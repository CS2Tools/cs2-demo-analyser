import { execFile } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
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
import { DuckDb, migrate } from '@cs2/db';
import { IngestQueue } from '@cs2/ingest';
import { createRequire } from 'node:module';
import { isRouteKey, type IngestProgress } from '@cs2/contract';

const here = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(here, '..', '..', '..');

const HOST = '127.0.0.1';
const PORT = Number(process.env.CS2_HOST_PORT ?? 5174);

const DATA_DIR = join(PROJECT_ROOT, 'data');

const db = await DuckDb.open(join(DATA_DIR, 'library.duckdb'));
const { applied } = await migrate(db);

const settings = new JsonSettingsStore(join(DATA_DIR, 'settings.json'));

const ingestSubscribers = new Set<(msg: IngestProgress) => void>();

export function publishIngest(msg: IngestProgress): void {
  for (const fn of ingestSubscribers) fn(msg);
}

const require = createRequire(import.meta.url);
const parserVersion = (
  require('@laihoe/demoparser2/package.json') as { version: string }
).version;

const ingest = new IngestQueue({
  db,
  dataDir: DATA_DIR,
  mapsDir: join(PROJECT_ROOT, 'vendor', 'boltobserv-maps'),
  appVersion: process.env.npm_package_version ?? '0.1.0',
  parserVersion,
  getUserSteamId: () => settings.get().userSteamId,
  getPoiSteamIds: () => settings.get().playersOfInterest.map((p) => p.steamId),
  publish: publishIngest,
  deleteMatch: (tx, matchId) => deleteMatchRows(tx, matchId),
  afterMerge: async () => {
    await applyRetention(db, DATA_DIR, settings.get().retentionBulkMatches);
  },
  voiceExtractorDir: join(PROJECT_ROOT, 'vendor', 'csgo-voice-extractor', 'win32-x64'),
});

const recovery = await ingest.recoverInterrupted();

const ctx: ApiContext = {
  db,
  ingest,
  appVersion: process.env.npm_package_version ?? '0.1.0',
  transportKind: 'http',
  settings,
  mapsDir: join(PROJECT_ROOT, 'vendor', 'boltobserv-maps'),
  dataDir: DATA_DIR,
  exportsDir: join(DATA_DIR, 'exports'),

  voiceExtractorDir: join(PROJECT_ROOT, 'vendor', 'csgo-voice-extractor', 'win32-x64'),

  reveal: (path) => {
    if (process.platform === 'win32') execFile('explorer.exe', [`/select,${path}`], () => undefined);
  },
};

await applyRetention(db, DATA_DIR, settings.get().retentionBulkMatches);

const app = Fastify({ logger: { level: 'warn' }, bodyLimit: 1024 * 1024 });

app.post<{ Params: { route: string } }>('/api/:route', async (req, reply) => {
  const { route } = req.params;
  if (!isRouteKey(route)) {
    return reply.code(404).send({ error: `rota desconhecida: ${route}` });
  }
  try {
    const result = await invoke(route, req.body ?? {}, ctx);
    return reply.send({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, route }, 'falha na rota');
    return reply.code(400).send({ ok: false, error: message });
  }
});

app.get('/api/events', (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  reply.raw.write(': conectado\n\n');

  const send = (msg: IngestProgress) => {
    reply.raw.write(`event: ingest\ndata: ${JSON.stringify(msg)}\n\n`);
  };
  ingestSubscribers.add(send);

  const keepAlive = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);

  req.raw.on('close', () => {
    clearInterval(keepAlive);
    ingestSubscribers.delete(send);
  });
});

const SAFE_NAME = /^[a-z0-9_]+$/;

app.get<{ Params: { map: string; file: string } }>(
  '/assets/radar/:map/:file',
  async (req, reply) => {
    const { map, file } = req.params;
    const allowed: Record<string, string> = {
      'radar.png': 'image/png',
      'overlay_logos.png': 'image/png',
      'overlay_buyzones.png': 'image/png',

      'meta.json5': 'text/plain; charset=utf-8',
    };
    const contentType = allowed[file];
    if (!SAFE_NAME.test(map) || !contentType) {
      return reply.code(400).send({ error: 'asset invalido' });
    }
    const path = join(ctx.mapsDir, map, file);
    if (!existsSync(path)) return reply.code(404).send({ error: 'asset nao encontrado' });

    return reply
      .type(contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(createReadStream(path));
  },
);

const ICONS_DIR = join(PROJECT_ROOT, 'vendor', 'counter-strike-icons');
app.get<{ Params: { folder: string; file: string } }>(
  '/assets/icon/:folder/:file',
  async (req, reply) => {
    const rel = `${req.params.folder}/${req.params.file}`;
    if (!ICON_PATH.test(rel)) return reply.code(400).send({ error: 'asset invalido' });
    const path = join(ICONS_DIR, rel);
    if (!existsSync(path)) return reply.code(404).send({ error: 'asset nao encontrado' });
    return reply
      .type('image/svg+xml')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(createReadStream(path));
  },
);

app.get<{ Params: { matchId: string; file: string } }>(
  '/assets/voice/:matchId/:file',
  async (req, reply) => {
    const { matchId, file } = req.params;
    if (!VOICE_MATCH_ID.test(matchId) || !VOICE_FILE.test(file)) {
      return reply.code(400).send({ error: 'asset invalido' });
    }
    const path = join(DATA_DIR, 'bulk', matchId, 'voice', file);
    if (!existsSync(path)) return reply.code(404).send({ error: 'asset nao encontrado' });
    return reply.type('audio/wav').send(createReadStream(path));
  },
);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void db.close().finally(() => process.exit(0));
  });
}

await app.listen({ host: HOST, port: PORT });
process.stdout.write(
  [
    '',
    `  host de dev em http://${HOST}:${PORT}  (somente local)`,
    `  banco: ${join(DATA_DIR, 'library.duckdb')}` +
      (applied.length ? `  (migracoes aplicadas: ${applied.join(', ')})` : ''),
    recovery.interruptedJobs + recovery.orphanStagingFiles > 0
      ? `  recuperacao: ${recovery.interruptedJobs} job(s) interrompido(s), ` +
        `${recovery.orphanStagingFiles} arquivo(s) de staging removido(s)`
      : '',
    '',
  ].join('\n'),
);
