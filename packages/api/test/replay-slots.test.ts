import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { roundReplaySchema } from '@cs2/contract';
import { DuckDb, migrate } from '@cs2/db';
import { getRoundReplay, replayParquetPath } from '../src/replay-queries.js';

let dir: string;
let db: DuckDb;

const MAPS = join(process.cwd(), 'vendor', 'boltobserv-maps');

const posix = (caminho: string) => caminho.split('\\').join('/');
const FRAMES = 3;

async function seed(
  nA: number,
  nB: number,
  slotCount: number | null,

  semTime = 0,
): Promise<string[]> {
  const total = nA + nB + semTime;
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, map_raw, has_radar,
                          tick_rate, tick_rate_source, schema_version, ingested_at, bulk_state,
                          pinned, replay_data_version, replay_slot_count,
                          team_a_name, team_b_name)
     VALUES ('m1', 'x', 'a.dem', 'de_mirage', 'de_mirage', TRUE, 64, 'inferred', 20, ?, 'full',
             FALSE, 6, ?, 'Nos', 'Eles')`,
    [new Date(), slotCount],
  );
  await db.exec(
    `INSERT INTO rounds (match_id, round_num, phase, start_tick, freeze_end_tick, end_tick)
     VALUES ('m1', 1, 'live', 1000, 1100, 1100 + ?)`,
    [FRAMES * 8],
  );

  const ids: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const steamId = `p${String(i).padStart(2, '0')}`;
    ids.push(steamId);
    const slot = i < nA ? 'A' : i < nA + nB ? 'B' : null;
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name, team_name, team_slot,
                                 team_color, rounds_played)
       VALUES ('m1', ?, ?, ?, ?, 'yellow', 1)`,
      [steamId, steamId, slot === null ? null : slot === 'A' ? 'Nos' : 'Eles', slot],
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
    for (const [slot, steamId] of ids.entries()) {
      await db.exec(
        `INSERT INTO staging VALUES
         ('m1', 1, ?, ?, ?, 0, 0, 0, 0, 0, 100, 0, 0, 0, FALSE, 0, 'AK-47', ?,
          800, FALSE, FALSE, 'knife_t', FALSE)`,
        [1100 + frame * 8, steamId, slot, slot < nA ? 3 : 2],
      );
    }
  }
  const parquet = replayParquetPath(dir, 'm1');
  mkdirSync(join(dir, 'bulk', 'm1'), { recursive: true });
  await db.exec(
    `COPY (SELECT * FROM staging ORDER BY tick, slot) TO '${posix(parquet)}' (FORMAT PARQUET)`,
  );
  return ids;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2slots-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('getRoundReplay com elenco maior que cinco', () => {
  it('onze jogadores entram todos, com passo 11 e arrays do tamanho certo', async () => {
    await seed(6, 5, 11);
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);

    expect(r.slots).toHaveLength(11);
    expect(r.slotsPerFrame).toBe(11);
    expect(r.frames).toBe(FRAMES);
    expect(r.x).toHaveLength(FRAMES * 11);
    expect(r.health).toHaveLength(FRAMES * 11);

    expect(new Set(r.slots.map((s) => s.slot)).size).toBe(11);
  });

  it('o time vem de team_slot, e NAO do numero do slot', async () => {
    await seed(6, 5, 11);
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    const porSlot = new Map(r.slots.map((s) => [s.slot, s]));

    expect(porSlot.get(5)!.team).toBe('A');
    expect(porSlot.get(6)!.team).toBe('B');
    expect(r.slots.filter((s) => s.team === 'A')).toHaveLength(6);
    expect(r.slots.filter((s) => s.team === 'B')).toHaveLength(5);
  });

  it('o decimo-primeiro jogador tem posicao, e nao fica fora do buffer', async () => {
    const ids = await seed(6, 5, 11);
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    const decimoPrimeiro = r.slots.find((s) => s.steamId === ids[10]);

    expect(decimoPrimeiro).toBeDefined();
    expect(decimoPrimeiro!.slot).toBe(10);

    for (let frame = 0; frame < FRAMES; frame += 1) {
      expect(Number.isNaN(r.x[frame * r.slotsPerFrame + 10]!)).toBe(false);
    }
  });

  it('a cor de time chega em TODOS os slots, inclusive no decimo-primeiro', async () => {
    await seed(6, 5, 11);
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    expect(r.slots.filter((s) => s.teamColor !== null)).toHaveLength(11);
  });

  it('5v5 continua com passo 10 e os times nos lugares de antes', async () => {
    await seed(5, 5, 10);
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    expect(r.slotsPerFrame).toBe(10);
    expect(r.x).toHaveLength(FRAMES * 10);
    for (const s of r.slots) expect(s.team).toBe(s.slot < 5 ? 'A' : 'B');
  });

  it('sem replay_slot_count, o passo cai em dez', async () => {
    await seed(5, 5, null);
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);
    expect(r.slotsPerFrame).toBe(10);
    expect(r.slots).toHaveLength(10);
  });

  it('jogador sem time resolvido vem com team NULO, e nao chutado', async () => {
    const ids = await seed(5, 5, 11, 1);
    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);

    expect(r.slots).toHaveLength(11);
    const orfao = r.slots.find((x) => x.steamId === ids[10]);
    expect(orfao).toBeDefined();
    expect(orfao!.team).toBeNull();
    expect(orfao!.slot).toBe(10);

    expect(r.slots.filter((x) => x.team === 'A')).toHaveLength(5);
    expect(r.slots.filter((x) => x.team === 'B')).toHaveLength(5);
  });
});

describe('slot sem dado no quadro', () => {
  it('a rota NAO estoura quando um slot nao tem linha no Parquet', async () => {
    await seed(6, 5, 11);

    await db.exec(`CREATE OR REPLACE TABLE staging AS SELECT * FROM staging WHERE slot <> 3`);
    const parquet = posix(replayParquetPath(dir, 'm1'));
    await db.exec(`COPY (SELECT * FROM staging ORDER BY tick, slot) TO '${parquet}' (FORMAT PARQUET)`);

    const r = await getRoundReplay(db, dir, MAPS, 'm1', 1);

    expect(r.slots).toHaveLength(10);
    expect(r.slotsPerFrame).toBe(11);
    expect(r.x).toHaveLength(FRAMES * 11);

    for (let frame = 0; frame < FRAMES; frame += 1) {
      expect(Number.isNaN(r.x[frame * 11 + 3]!)).toBe(true);
      expect(Number.isNaN(r.y[frame * 11 + 3]!)).toBe(true);
      expect(Number.isNaN(r.x[frame * 11 + 4]!)).toBe(false);
    }
  });

  it('null vindo do transporte JSON e normalizado de volta para NaN', async () => {
    await seed(6, 5, 11);
    await db.exec(`CREATE OR REPLACE TABLE staging AS SELECT * FROM staging WHERE slot <> 3`);
    await db.exec(
      `COPY (SELECT * FROM staging ORDER BY tick, slot) TO '${posix(replayParquetPath(dir, 'm1'))}' (FORMAT PARQUET)`,
    );
    const direto = await getRoundReplay(db, dir, MAPS, 'm1', 1);

    const viaJson: unknown = JSON.parse(JSON.stringify(direto));
    expect((viaJson as { x: unknown[] }).x[3]).toBeNull();

    const reparsed = roundReplaySchema.parse(viaJson);
    expect(Number.isNaN(reparsed.x[3]!)).toBe(true);
    expect(reparsed.x[4]).toBe(direto.x[4]);
    expect(reparsed.slotsPerFrame).toBe(11);
  });
});
