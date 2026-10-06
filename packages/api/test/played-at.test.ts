import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { ensurePlayedAt } from '../src/played-at-backfill.js';
import { listMatches } from '../src/match-queries.js';

let dir: string;
let db: DuckDb;

async function seed(matchId: string, fileName: string, ingestedAt: Date): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned)
     VALUES (?, ?, ?, 'de_mirage', TRUE, 64, 'inferred', 3, ?, 'full', FALSE)`,
    [matchId, matchId.repeat(64).slice(0, 64), fileName, ingestedAt],
  );
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2played-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('ensurePlayedAt', () => {
  it('a data sai do nome guardado: nenhuma demo e reprocessada', async () => {
    await seed('m1', '2026-09-09__2258__1__27829555__de_overpass__a__vs__b.dem', new Date(2026, 9, 1));
    const r = await ensurePlayedAt(db);
    expect(r.filled).toEqual(['m1']);

    const row = await db.queryOne<{ played_at: Date; played_at_source: string }>(
      'SELECT played_at, played_at_source FROM matches WHERE match_id = ?',
      ['m1'],
    );
    expect(row!.played_at_source).toBe('filename');
    expect(new Date(row!.played_at).getFullYear()).toBe(2026);
    expect(new Date(row!.played_at).getMonth()).toBe(8);
    expect(new Date(row!.played_at).getDate()).toBe(9);
  });

  it('nome sem data continua sem data: a ordem de importacao vale, como antes', async () => {
    await seed('m2', 'mibr-vs-furia-m1-mirage.dem', new Date(2026, 9, 1));
    const r = await ensurePlayedAt(db);
    expect(r.filled).toEqual([]);
    expect(r.unknown).toBe(1);

    const row = await db.queryOne<{ played_at: Date | null }>(
      'SELECT played_at FROM matches WHERE match_id = ?',
      ['m2'],
    );
    expect(row!.played_at).toBeNull();
  });

  it('roda uma vez: a segunda passada nao toca em nada', async () => {
    await seed('m1', '2026-09-09__2258__x.dem', new Date(2026, 9, 1));
    await ensurePlayedAt(db);
    expect((await ensurePlayedAt(db)).filled).toEqual([]);
  });

  it('nao sobrescreve a data que a ingestao ja gravou', async () => {
    await seed('m1', '2026-09-09__2258__x.dem', new Date(2026, 9, 1));
    await db.exec(
      `UPDATE matches SET played_at = ?, played_at_source = 'file_mtime' WHERE match_id = 'm1'`,
      [new Date(2026, 0, 2, 3, 4)],
    );
    await ensurePlayedAt(db);
    const row = await db.queryOne<{ played_at: Date; played_at_source: string }>(
      'SELECT played_at, played_at_source FROM matches WHERE match_id = ?',
      ['m1'],
    );
    expect(row!.played_at_source).toBe('file_mtime');
    expect(new Date(row!.played_at).getMonth()).toBe(0);
  });

  it('o historico de metricas acompanha a data nova', async () => {
    await seed('m1', '2026-09-09__2258__x.dem', new Date(2026, 9, 1));
    await db.exec(
      `INSERT INTO player_metric_history (steam_id, match_id, metric_id, value, sample_n, played_at)
       VALUES ('p1', 'm1', 'aim.preaim', 12.5, 20, ?)`,
      [new Date(2026, 9, 1)],
    );
    await ensurePlayedAt(db);

    const row = await db.queryOne<{ played_at: Date }>(
      'SELECT played_at FROM player_metric_history WHERE match_id = ?',
      ['m1'],
    );
    expect(new Date(row!.played_at).getMonth()).toBe(8);
    expect(new Date(row!.played_at).getDate()).toBe(9);
  });
});

describe('listMatches', () => {
  it('ordena pela data da partida, e nao pela de importacao', async () => {

    await seed('antiga', '2026-01-05__1000__x.dem', new Date(2026, 9, 9));
    await seed('recente', '2026-08-20__2240__x.dem', new Date(2026, 9, 1));
    await ensurePlayedAt(db);

    const list = await listMatches(db);
    expect(list.map((m) => m.matchId)).toEqual(['recente', 'antiga']);
    expect(list[0]!.playedAtSource).toBe('filename');
  });

  it('quem nao tem data entra pela importacao, sem sumir da lista', async () => {
    await seed('com', '2026-01-05__1000__x.dem', new Date(2026, 0, 1));
    await seed('sem', 'sem-data.dem', new Date(2026, 11, 31));
    await ensurePlayedAt(db);

    const list = await listMatches(db);
    expect(list.map((m) => m.matchId)).toEqual(['sem', 'com']);
    expect(list[0]!.playedAt).toBeNull();
  });
});
