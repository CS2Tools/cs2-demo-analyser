import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { getRoundReplay, replayParquetPath } from '../src/replay-queries.js';

let dir: string;
let db: DuckDb;

const MAPS = join(process.cwd(), 'vendor', 'boltobserv-maps');
const posix = (caminho: string) => caminho.split('\\').join('/');
const FRAMES = 4;

type Sides = (slot: number, frame: number) => number;

async function seed(n: number, sides: Sides): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, map_raw, has_radar,
                          tick_rate, tick_rate_source, schema_version, ingested_at, bulk_state,
                          pinned, replay_data_version, replay_slot_count,
                          team_a_name, team_b_name)
     VALUES ('m1', 'x', 'a.dem', 'de_mirage', 'de_mirage', TRUE, 64, 'inferred', 20, ?, 'full',
             FALSE, 6, ?, 'Nos', 'Eles')`,
    [new Date(), n],
  );
  await db.exec(
    `INSERT INTO rounds (match_id, round_num, phase, start_tick, freeze_end_tick, end_tick)
     VALUES ('m1', 1, 'live', 1000, 1100, 1100 + ?)`,
    [FRAMES * 8],
  );

  for (let i = 0; i < n; i += 1) {
    const steamId = `p${String(i).padStart(2, '0')}`;
    const time = i < n / 2 ? 'A' : 'B';
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name, team_name, team_slot,
                                 team_color, rounds_played)
       VALUES ('m1', ?, ?, ?, ?, 'yellow', 1)`,
      [steamId, steamId, time === 'A' ? 'Nos' : 'Eles', time],
    );
  }

  await db.exec(`CREATE OR REPLACE TABLE staging (
    match_id VARCHAR, round_num INTEGER, tick BIGINT, steam_id VARCHAR, slot TINYINT,
    x FLOAT, y FLOAT, z FLOAT, yaw FLOAT, pitch FLOAT,
    health SMALLINT, armor SMALLINT, life_state TINYINT,
    flash_duration FLOAT, is_scoped BOOLEAN, duck_amount FLOAT,
    weapon VARCHAR, side TINYINT,
    money INTEGER, has_helmet BOOLEAN, has_defuser BOOLEAN, inventory VARCHAR,
    is_defusing BOOLEAN)`);
  for (let frame = 0; frame < FRAMES; frame += 1) {
    for (let slot = 0; slot < n; slot += 1) {
      await db.exec(
        `INSERT INTO staging VALUES
         ('m1', 1, ?, ?, ?, 0, 0, 0, 0, 0, 100, 0, 0, 0, FALSE, 0, 'AK-47', ?,
          800, FALSE, FALSE, 'knife_t', FALSE)`,
        [1100 + frame * 8, `p${String(slot).padStart(2, '0')}`, slot, sides(slot, frame)],
      );
    }
  }

  const parquet = replayParquetPath(dir, 'm1');
  mkdirSync(join(dir, 'bulk', 'm1'), { recursive: true });
  await db.exec(
    `COPY (SELECT * FROM staging ORDER BY tick, slot) TO '${posix(parquet)}' (FORMAT PARQUET)`,
  );
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2side-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('o lado de cada slot', () => {

  it('5v5 normal: cinco CT, cinco T, ninguem sem lado', async () => {
    await seed(10, (slot) => (slot < 5 ? 3 : 2));
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);

    expect(r.slots).toHaveLength(10);
    expect(r.slots.filter((s) => s.side === 'CT')).toHaveLength(5);
    expect(r.slots.filter((s) => s.side === 'T')).toHaveLength(5);
    expect(r.slots.filter((s) => s.side === null)).toHaveLength(0);
  });

  it('quem reconecta pega o lado do primeiro quadro VALIDO, nao do primeiro quadro', async () => {

    await seed(10, (slot, frame) => (slot === 0 && frame === 0 ? 0 : slot < 5 ? 3 : 2));
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);

    const reconectado = r.slots.find((s) => s.slot === 0);
    expect(reconectado).toBeDefined();

    expect(reconectado!.side).toBe('CT');
  });

  it('quem nao jogou o round some: nem radar, nem painel, nem numeracao', async () => {

    await seed(10, (slot) => (slot === 9 ? 0 : slot < 5 ? 3 : 2));
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);

    expect(r.slots).toHaveLength(9);
    expect(r.slots.some((s) => s.slot === 9)).toBe(false);

    expect(r.slotsPerFrame).toBe(10);
    expect(r.x).toHaveLength(FRAMES * 10);
  });

  it('nenhum slot entregue fica sem lado', async () => {
    await seed(10, (slot, frame) => (frame === 0 ? 0 : slot < 5 ? 3 : 2));
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    expect(r.slots).toHaveLength(10);
    for (const s of r.slots) expect(s.side).not.toBeNull();
  });

  it('a virada do intervalo nos quadros finais nao troca o lado do round', async () => {
    await seed(10, (slot, frame) => {
      const metade1 = slot < 5 ? 3 : 2;
      const metade2 = slot < 5 ? 2 : 3;
      return frame < FRAMES - 1 ? metade1 : metade2;
    });
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    for (const s of r.slots) expect(s.side).toBe(s.slot < 5 ? 'CT' : 'T');
  });
});

describe('K/D/A acumulado antes do round (F7.4)', () => {
  it('sem rounds anteriores, todo mundo comeca em zero', async () => {
    await seed(10, (slot) => (slot < 5 ? 3 : 2));
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    for (const s of r.slots) {
      expect(s.killsBefore).toBe(0);
      expect(s.deathsBefore).toBe(0);
      expect(s.assistsBefore).toBe(0);
    }
  });

  it('soma so os rounds LIVE anteriores, nunca o round que se esta assistindo', async () => {
    await seed(10, (slot) => (slot < 5 ? 3 : 2));

    await db.exec(
      `INSERT INTO rounds (match_id, round_num, phase, start_tick, freeze_end_tick, end_tick)
       VALUES ('m1', 0, 'live', 1, 2, 3)`,
    );
    await db.exec(
      `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, assists)
       VALUES ('m1', 0, 'p00', 'CT', 2, 1, 3), ('m1', 1, 'p00', 'CT', 9, 9, 9)`,
    );

    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    const p = r.slots.find((s) => s.steamId === 'p00')!;
    expect(p.killsBefore).toBe(2);
    expect(p.deathsBefore).toBe(1);
    expect(p.assistsBefore).toBe(3);
  });
});
