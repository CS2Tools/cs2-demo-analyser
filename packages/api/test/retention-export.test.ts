import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { DuckDb, migrate } from '@cs2/db';
import { DEFAULT_SETTINGS, type Settings } from '@cs2/contract';
import { applyRetention, refreshPlayerFlags } from '../src/retention.js';
import { exportLibrary, exportMatch, safeFileName } from '../src/export.js';
import { invoke } from '../src/handlers.js';
import type { ApiContext, SettingsStore } from '../src/context.js';

let dir: string;
let dataDir: string;
let db: DuckDb;

class MemorySettings implements SettingsStore {
  constructor(private value: Settings = DEFAULT_SETTINGS) {}
  get() {
    return this.value;
  }
  set(patch: Partial<Settings>) {
    this.value = { ...this.value, ...patch };
    return this.value;
  }
}

function ctxWith(settings = new MemorySettings()): ApiContext {
  return {
    db,
    ingest: null as never,
    appVersion: 'test',
    transportKind: 'http',
    settings,
    mapsDir: join(dir, 'maps'),
    dataDir,
    exportsDir: join(dir, 'exports'),
  };
}

const shaOf = (n: number) => String(n).repeat(64).slice(0, 64);
const demoExists = (n: number) => existsSync(join(dataDir, 'demos', `${shaOf(n)}.dem`));

async function seedMatch(n: number, opts: { pinned?: boolean } = {}): Promise<string> {
  const matchId = `m${n}`;
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned,
                          team_a_name, team_b_name)
     VALUES (?, ?, ?, 'de_overpass', TRUE, 64, 'inferred', 3, ?, 'full', ?, 'Time Á', 'Time/B')`,
    [matchId, shaOf(n), `${matchId}.dem`, new Date(Date.UTC(2026, 0, n)), opts.pinned ?? false],
  );
  await db.exec(
    `INSERT INTO player_match (match_id, steam_id, name, rounds_played) VALUES (?, ?, 'jogador, "um"', 20)`,
    [matchId, '76561198000000001'],
  );

  const demos = join(dataDir, 'demos');
  mkdirSync(demos, { recursive: true });
  writeFileSync(join(demos, `${shaOf(n)}.dem`), 'demo');
  const bulk = join(dataDir, 'bulk', matchId);
  mkdirSync(bulk, { recursive: true });
  writeFileSync(join(bulk, 'ticks_replay.parquet'), 'nao e parquet de verdade');
  return matchId;
}

const bulkState = async (id: string) =>
  (await db.queryOne<{ bulk_state: string }>('SELECT bulk_state FROM matches WHERE match_id = ?', [id]))!
    .bulk_state;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2ret-'));
  dataDir = join(dir, 'data');
  db = await DuckDb.open(join(dataDir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('retencao', () => {
  it('mantem as N importadas mais recentemente e poda o resto', async () => {
    for (let n = 1; n <= 4; n++) await seedMatch(n);
    const r = await applyRetention(db, dataDir, 2);

    expect(r.pruned.sort()).toEqual(['m1', 'm2']);
    expect(await bulkState('m1')).toBe('pruned');
    expect(await bulkState('m4')).toBe('full');
    expect(existsSync(join(dataDir, 'bulk', 'm1'))).toBe(false);
    expect(existsSync(join(dataDir, 'bulk', 'm4'))).toBe(true);
  });

  it('podar nao apaga NADA do banco alem da marca', async () => {
    await seedMatch(1);
    await seedMatch(2);
    await applyRetention(db, dataDir, 1);
    const players = await db.query("SELECT * FROM player_match WHERE match_id = 'm1'");
    expect(players).toHaveLength(1);
  });

  it('partida fixada nao e podada e nao ocupa vaga', async () => {
    await seedMatch(1, { pinned: true });
    await seedMatch(2);
    await seedMatch(3);
    const r = await applyRetention(db, dataDir, 1);
    expect(r.pruned).toEqual(['m2']);
    expect(await bulkState('m1')).toBe('full');
    expect(await bulkState('m3')).toBe('full');
  });

  it('a copia da demo sai junto com o replay', async () => {
    for (let n = 1; n <= 3; n++) await seedMatch(n);
    const r = await applyRetention(db, dataDir, 1);
    expect(r.demosRemoved).toBe(2);
    expect(demoExists(1)).toBe(false);
    expect(demoExists(3)).toBe(true);
  });

  it('nao apaga a demo de uma importacao em andamento, que ainda nem tem partida', async () => {
    await seedMatch(1);
    const inflight = 'f'.repeat(64);
    writeFileSync(join(dataDir, 'demos', `${inflight}.dem`), 'lendo agora');
    await db.exec(
      `INSERT INTO ingest_jobs (job_id, demo_path, file_name, sha256, state, progress, started_at)
       VALUES ('j1', 'x.dem', 'x.dem', ?, 'running', 0.3, ?)`,
      [inflight, new Date()],
    );
    await applyRetention(db, dataDir, 5);
    expect(existsSync(join(dataDir, 'demos', `${inflight}.dem`))).toBe(true);
  });

  it('N = 0 guarda tudo', async () => {
    for (let n = 1; n <= 3; n++) await seedMatch(n);
    expect((await applyRetention(db, dataDir, 0)).pruned).toEqual([]);
  });

  it('e idempotente', async () => {
    for (let n = 1; n <= 3; n++) await seedMatch(n);
    await applyRetention(db, dataDir, 1);
    expect((await applyRetention(db, dataDir, 1)).pruned).toEqual([]);
  });

  it('baixar o N nas configuracoes poda na hora', async () => {
    for (let n = 1; n <= 3; n++) await seedMatch(n);
    await invoke('settings.set', { retentionBulkMatches: 1 }, ctxWith());
    expect(await bulkState('m1')).toBe('pruned');
    expect(await bulkState('m3')).toBe('full');
  });

  it('desafixar pode podar na hora', async () => {
    await seedMatch(1, { pinned: true });
    await seedMatch(2);
    const ctx = ctxWith(new MemorySettings({ ...DEFAULT_SETTINGS, retentionBulkMatches: 1 }));
    const r = await invoke('match.pin', { matchId: 'm1', pinned: false }, ctx);
    expect(r.pruned).toEqual(['m1']);
  });
});

describe('marcas de jogador', () => {
  it('o SteamID configurado depois da importacao marca as partidas antigas', async () => {
    await seedMatch(1);
    await refreshPlayerFlags(db, '76561198000000001', []);
    const row = await db.queryOne<{ is_user: boolean; is_poi: boolean }>(
      'SELECT is_user, is_poi FROM player_match',
    );
    expect(row).toEqual({ is_user: true, is_poi: false });
  });

  it('remover um jogador de interesse desmarca', async () => {
    await seedMatch(1);
    await refreshPlayerFlags(db, null, ['76561198000000001']);
    await refreshPlayerFlags(db, null, []);
    const row = await db.queryOne<{ is_user: boolean; is_poi: boolean }>(
      'SELECT is_user, is_poi FROM player_match',
    );
    expect(row).toEqual({ is_user: false, is_poi: false });
  });
});

describe('exportacao', () => {
  it('a partida vira um zip com CSVs, JSONs com bases, Parquet e manifesto', async () => {
    await seedMatch(1);
    const r = await exportMatch(ctxWith(), 'm1');

    expect(r.path.endsWith('.zip')).toBe(true);
    const files = unzipSync(readFileSync(r.path));
    const names = Object.keys(files);
    for (const f of ['manifest.json', 'match.json', 'analysis.json', 'findings.json',
      'csv/player_match.csv', 'csv/kills.csv', 'bulk/ticks_replay.parquet']) {
      expect(names, f).toContain(f);
    }

    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    expect(manifest.kind).toBe('cs2-demo-analyser/match');

    const csv = new TextDecoder().decode(files['csv/player_match.csv']);
    expect(csv).toContain('"jogador, ""um"""');

    const leftovers = (await import('node:fs')).readdirSync(join(dir, 'exports'));
    expect(leftovers.filter((f) => f.startsWith('.tmp'))).toEqual([]);
  });

  it('nome de arquivo sem acento, barra ou espaco', () => {
    expect(safeFileName('de_overpass_Time Á-vs-Time/B')).toBe('de_overpass_Time-A-vs-Time-B');
  });

  it('a biblioteca vira uma pasta com um banco que ABRE e tem as partidas', async () => {
    await seedMatch(1);
    await seedMatch(2);
    const r = await exportLibrary(ctxWith());

    expect(existsSync(join(r.path, 'manifest.json'))).toBe(true);
    expect(existsSync(join(r.path, 'bulk', 'm1', 'ticks_replay.parquet'))).toBe(true);

    const copy = await DuckDb.open(join(r.path, 'library.duckdb'));
    try {
      const rows = await copy.query('SELECT match_id FROM matches ORDER BY 1');
      expect(rows).toEqual([{ match_id: 'm1' }, { match_id: 'm2' }]);
    } finally {
      await copy.close();
    }
  });

  it('revelar so funciona dentro da pasta de exportacao', async () => {
    const revealed: string[] = [];
    const ctx = { ...ctxWith(), reveal: (p: string) => revealed.push(p) };
    const outside = await invoke('app.reveal', { path: 'C:\\Windows\\System32' }, ctx);
    const inside = await invoke('app.reveal', { path: join(ctx.exportsDir, 'x.zip') }, ctx);
    expect(outside.ok).toBe(false);
    expect(inside.ok).toBe(true);
    expect(revealed).toHaveLength(1);
  });
});
