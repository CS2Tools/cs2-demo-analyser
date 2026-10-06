import { app, BrowserWindow, dialog, ipcMain, protocol, session, shell } from 'electron';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import {
  applyRetention,
  deleteMatchRows,
  ICON_PATH,
  VOICE_FILE,
  VOICE_MATCH_ID,
  invoke,
  JsonSettingsStore,
  type ApiContext,
} from '@cs2/api';
import { DuckDb, migrate, setSchemaDir } from '@cs2/db';
import { IngestQueue, type WorkerLauncher } from '@cs2/ingest';
import { isRouteKey, type IngestProgress } from '@cs2/contract';
import { runSmokeTest } from './smoke.js';

const isDev = !app.isPackaged;

const WEB_DIR = join(__dirname, 'web');
const WORKER_ENTRY = join(__dirname, 'worker.js');
const SCHEMA_DIR = join(__dirname, 'schema');
const PARSER_VERSION_FILE = join(__dirname, 'parser-version.json');

const MAPS_DIR = isDev
  ? resolve(__dirname, '..', '..', '..', 'vendor', 'boltobserv-maps')
  : join(process.resourcesPath, 'maps');

const ICONS_DIR = isDev
  ? resolve(__dirname, '..', '..', '..', 'vendor', 'counter-strike-icons')
  : join(process.resourcesPath, 'icons');

const VOICE_DIR = isDev
  ? resolve(__dirname, '..', '..', '..', 'vendor', 'csgo-voice-extractor', 'win32-x64')
  : join(process.resourcesPath, 'voice-extractor');

const IS_SMOKE = process.argv.includes('--smoke-test');
if (IS_SMOKE) {
  app.setPath('userData', mkdtempSync(join(tmpdir(), 'cs2-smoke-')));
}

const DATA_DIR = join(app.getPath('userData'), 'data');

const EXPORTS_DIR = IS_SMOKE
  ? join(app.getPath('userData'), 'exportacoes')
  : join(app.getPath('documents'), 'CS2 Demo Analyser', 'exportacoes');

let db: DuckDb | null = null;
let ingest: IngestQueue | null = null;
let ctx: ApiContext | null = null;
let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.json5': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
};

function safeJoin(root: string, relative: string): string | null {
  const target = normalize(join(root, decodeURIComponent(relative)));
  return target === root || target.startsWith(root + sep) ? target : null;
}

function registerAppProtocol(): void {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;

    if (path.startsWith('/assets/icon/')) {
      const rel = decodeURIComponent(path.slice('/assets/icon/'.length));
      if (!ICON_PATH.test(rel)) return new Response('invalido', { status: 400 });
      const iconPath = join(ICONS_DIR, rel);
      if (!existsSync(iconPath)) return new Response('nao encontrado', { status: 404 });
      const iconStream = Readable.toWeb(createReadStream(iconPath)) as ReadableStream<Uint8Array>;
      return new Response(iconStream, { headers: { 'Content-Type': 'image/svg+xml' } });
    }

    if (path.startsWith('/assets/voice/')) {
      const [matchId = '', file = ''] = path.slice('/assets/voice/'.length).split('/');
      if (!VOICE_MATCH_ID.test(matchId) || !VOICE_FILE.test(file)) {
        return new Response('invalido', { status: 400 });
      }
      const voicePath = join(DATA_DIR, 'bulk', matchId, 'voice', file);
      if (!existsSync(voicePath)) return new Response('nao encontrado', { status: 404 });
      const voiceStream = Readable.toWeb(createReadStream(voicePath)) as ReadableStream<Uint8Array>;
      return new Response(voiceStream, { headers: { 'Content-Type': 'audio/wav' } });
    }

    const isAsset = path.startsWith('/assets/radar/');
    const root = isAsset ? MAPS_DIR : WEB_DIR;
    const relative = isAsset ? path.slice('/assets/radar/'.length) : path.slice(1);

    let file = safeJoin(root, relative);

    if (!file || !existsSync(file)) {
      if (isAsset) return new Response('nao encontrado', { status: 404 });
      file = join(WEB_DIR, 'index.html');
    }

    const ext = file.slice(file.lastIndexOf('.'));
    const type = MIME[ext] ?? 'application/octet-stream';
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers: { 'Content-Type': type } });
  });
}

function blockNetwork(): void {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed =
      details.url.startsWith('app://') ||
      details.url.startsWith('devtools:') ||
      (isDev && details.url.startsWith('http://127.0.0.1:5173'));
    if (!allowed) {
      process.stderr.write(`[rede bloqueada] ${details.url}\n`);
    }
    callback({ cancel: !allowed });
  });
}

function workerLauncher(): WorkerLauncher {
  return {

    execPath: process.execPath,
    entry: WORKER_ENTRY,
    execArgv: ['--max-old-space-size=4096'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    schemaDir: SCHEMA_DIR,
  };
}

const ingestListeners = new Set<(msg: IngestProgress) => void>();

function publishIngest(msg: IngestProgress): void {
  mainWindow?.webContents.send('channel:ingest', msg);
  for (const fn of ingestListeners) fn(msg);
}

async function bootstrap(): Promise<void> {

  setSchemaDir(SCHEMA_DIR);

  db = await DuckDb.open(join(DATA_DIR, 'library.duckdb'));
  await migrate(db);

  const settings = new JsonSettingsStore(join(DATA_DIR, 'settings.json'));

  let parserVersion = 'desconhecida';
  try {
    parserVersion = (
      JSON.parse(readFileSync(PARSER_VERSION_FILE, 'utf8')) as { version: string }
    ).version;
  } catch {

  }

  ingest = new IngestQueue({
    db,
    dataDir: DATA_DIR,
    mapsDir: MAPS_DIR,
    appVersion: app.getVersion(),
    parserVersion,
    getUserSteamId: () => settings.get().userSteamId,
    getPoiSteamIds: () => settings.get().playersOfInterest.map((p) => p.steamId),
    publish: publishIngest,
    deleteMatch: (tx, matchId) => deleteMatchRows(tx, matchId),
    workerLauncher: workerLauncher(),
    afterMerge: async () => {
      await applyRetention(db!, DATA_DIR, settings.get().retentionBulkMatches);
    },
    voiceExtractorDir: VOICE_DIR,
  });

  const recovery = await ingest.recoverInterrupted();
  if (recovery.interruptedJobs + recovery.orphanStagingFiles > 0) {
    process.stdout.write(
      `  recuperacao: ${recovery.interruptedJobs} job(s) interrompido(s), ` +
        `${recovery.orphanStagingFiles} arquivo(s) de staging removido(s)
`,
    );
  }

  ctx = {
    db,
    ingest,
    appVersion: app.getVersion(),
    transportKind: 'ipc',
    settings,
    mapsDir: MAPS_DIR,
    dataDir: DATA_DIR,
    exportsDir: EXPORTS_DIR,

    voiceExtractorDir: VOICE_DIR,
    reveal: (path) => shell.showItemInFolder(path),
  };

  await applyRetention(db, DATA_DIR, settings.get().retentionBulkMatches);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0a0a0a',
    icon: join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  void mainWindow.loadURL('app://cs2/index.html');
}

ipcMain.handle('rpc', async (_event, route: string, params: unknown) => {
  if (!ctx) throw new Error('app ainda inicializando');
  if (!isRouteKey(route)) throw new Error(`rota desconhecida: ${route}`);
  return invoke(route, params ?? {}, ctx);
});

ipcMain.handle('pick-demos', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Escolher demos',
    filters: [{ name: 'Demos do CS2', extensions: ['dem'] }],
    properties: ['openFile', 'multiSelections'],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('save-file', async (_event, suggestedName: string, data: ArrayBuffer) => {
  const safeName = String(suggestedName).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: join(app.getPath('downloads'), safeName),
  });
  if (result.canceled || !result.filePath) return false;
  writeFileSync(result.filePath, Buffer.from(data));
  return true;
});

function smokeTestDemoPath(): string | null {
  const i = process.argv.indexOf('--smoke-test');
  if (i === -1) return null;
  const rest = process.argv.slice(i + 1);
  if (rest.length === 0) return null;
  const joined = rest.join(' ');
  return existsSync(joined) ? joined : (rest[0] ?? null);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  registerAppProtocol();
  blockNetwork();
  await bootstrap();

  const smokeDemo = smokeTestDemoPath();
  if (smokeDemo) {
    const code = await runSmokeTest(ctx!, smokeDemo, (cb) => ingestListeners.add(cb));
    await db?.close();

    try {
      rmSync(app.getPath('userData'), { recursive: true, force: true });
    } catch {

    }
    app.exit(code);
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err: unknown) => {
  process.stderr.write(`falha ao iniciar: ${String(err)}\n`);
  app.exit(1);
});

app.on('window-all-closed', () => {
  void db?.close().finally(() => app.quit());
});
