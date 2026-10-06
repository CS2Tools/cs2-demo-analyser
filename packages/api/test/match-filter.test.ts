import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { DEFAULT_SETTINGS, type Settings } from '@cs2/contract';
import { refreshPlayerFlags } from '../src/retention.js';
import { invoke } from '../src/handlers.js';
import type { ApiContext, SettingsStore } from '../src/context.js';

let dir: string;
let db: DuckDb;

const ME = '76561198000000001';
const FRIEND = '76561198000000002';
const STRANGER = '76561198000000003';

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

function ctx(): ApiContext {
  return {
    db,
    ingest: null as never,
    appVersion: 'test',
    transportKind: 'http',
    settings: new MemorySettings(),
    mapsDir: join(dir, 'maps'),
    dataDir: dir,
    exportsDir: join(dir, 'exports'),
  };
}

async function seed(n: number, players: string[]): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned,
                          team_a_name, team_b_name)
     VALUES (?, ?, ?, 'de_mirage', TRUE, 64, 'inferred', 3, ?, 'full', FALSE, 'Nos', 'Eles')`,
    [`m${n}`, String(n).repeat(64).slice(0, 64), `m${n}.dem`, new Date(Date.UTC(2026, 0, n))],
  );
  for (const steamId of players) {
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name, rounds_played) VALUES (?, ?, ?, 20)`,
      [`m${n}`, steamId, `p${steamId.slice(-1)}`],
    );
  }
}

const ids = async (filter?: 'all' | 'mine' | 'poi') =>
  (await invoke('matches.list', filter ? { filter } : {}, ctx())).map((m) => m.matchId).sort();

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2-filter-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
  await seed(1, [ME, STRANGER]);
  await seed(2, [FRIEND, STRANGER]);
  await seed(3, [STRANGER]);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('filtro da biblioteca', () => {
  it('sem filtro (e com "all"), a biblioteca inteira', async () => {
    expect(await ids()).toEqual(['m1', 'm2', 'm3']);
    expect(await ids('all')).toEqual(['m1', 'm2', 'm3']);
  });

  it('"so as minhas" traz so onde o SteamID configurado jogou', async () => {
    await refreshPlayerFlags(db, ME, []);
    expect(await ids('mine')).toEqual(['m1']);
  });

  it('"jogadores de interesse" traz so onde algum deles jogou', async () => {
    await refreshPlayerFlags(db, ME, [FRIEND]);
    expect(await ids('poi')).toEqual(['m2']);

    expect(await ids('mine')).toEqual(['m1']);
  });

  it('mudar as configuracoes vale para as partidas ANTIGAS, sem reprocessar', async () => {
    await refreshPlayerFlags(db, ME, []);
    expect(await ids('poi')).toEqual([]);
    await refreshPlayerFlags(db, ME, [STRANGER]);
    expect(await ids('poi')).toEqual(['m1', 'm2', 'm3']);
    await refreshPlayerFlags(db, null, []);
    expect(await ids('mine')).toEqual([]);
  });
});
