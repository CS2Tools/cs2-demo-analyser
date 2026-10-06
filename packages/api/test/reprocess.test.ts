import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { DEFAULT_SETTINGS } from '@cs2/contract';
import { invoke } from '../src/handlers.js';
import type { ApiContext } from '../src/context.js';

let dir: string;
let db: DuckDb;
let calls: { path: string; force: boolean; original: unknown }[];

function ctx(): ApiContext {
  return {
    db,

    ingest: {
      submit: async (path: string, force: boolean, original: unknown) => {
        calls.push({ path, force, original });
        return { jobId: 'job-1', state: 'queued', matchId: null };
      },
    } as never,
    appVersion: 'test',
    transportKind: 'http',
    settings: { get: () => DEFAULT_SETTINGS, set: () => DEFAULT_SETTINGS },
    mapsDir: dir,
    dataDir: join(dir, 'data'),
    exportsDir: join(dir, 'exports'),
  };
}

async function seed(stored: string | null, original: string | null) {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, file_path, stored_demo_path, map_name,
                          has_radar, tick_rate, tick_rate_source, schema_version, ingested_at)
     VALUES ('m1', 'sha', 'x__team-contabilidade__vs__team-ttv.dem', ?, ?, 'de_overpass',
             TRUE, 64, 'inferred', 6, ?)`,
    [original, stored, new Date()],
  );
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2repro-'));
  db = await DuckDb.open(join(dir, 'lib.duckdb'));
  await migrate(db);
  calls = [];
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('match.reprocess', () => {
  it('le a copia da biblioteca, mas leva o nome ORIGINAL (de onde saem os times)', async () => {
    mkdirSync(join(dir, 'data', 'demos'), { recursive: true });
    const stored = join(dir, 'data', 'demos', `${'a'.repeat(64)}.dem`);
    writeFileSync(stored, 'demo');
    await seed(stored, 'C:/Downloads/x__team-contabilidade__vs__team-ttv.dem');

    const r = await invoke('match.reprocess', { matchId: 'm1' }, ctx());
    expect(r.source).toBe('stored');
    expect(calls).toEqual([{
      path: stored,
      force: true,
      original: {
        fileName: 'x__team-contabilidade__vs__team-ttv.dem',
        originalPath: 'C:/Downloads/x__team-contabilidade__vs__team-ttv.dem',
      },
    }]);
  });

  it('partida de antes da F2.0 (sem copia) usa o caminho original, se ainda existir', async () => {
    const original = join(dir, 'original.dem');
    writeFileSync(original, 'demo');
    await seed(null, original);
    const r = await invoke('match.reprocess', { matchId: 'm1' }, ctx());
    expect(r.source).toBe('original');
    expect(calls[0]!.path).toBe(original);
  });

  it('sem copia e sem original: diz que falta, nao tenta nada', async () => {
    await seed(null, join(dir, 'sumiu.dem'));
    const r = await invoke('match.reprocess', { matchId: 'm1' }, ctx());
    expect(r).toMatchObject({ jobId: null, source: 'missing' });
    expect(calls).toEqual([]);
  });
});
