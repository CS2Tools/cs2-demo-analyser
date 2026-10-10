import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate, splitStatements } from '@cs2/db';
import { computeMatchRoster, ensureRoster } from '../src/roster-queries.js';

let dir: string;
let db: DuckDb;

const MIGRACAO_021 = splitStatements(
  readFileSync(
    join(__dirname, '..', '..', 'db', 'src', 'schema', '021_drop_absent_round_rows.sql'),
    'utf8',
  ),
);

const ROUNDS = 16;

const CT = ['ct1', 'ct2', 'ct3', 'ct4', 'ct5'];
const T = ['t1', 't2', 't3', 't4'];

const SAI = 'sai';

const ENTRA = 'entra';
const SAIU_NO = 5;
const ENTROU_NO = 7;

async function partida(matchId: string, metricsVersion = 4): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned,
                          team_a_name, team_b_name, score_a, score_b, metrics_version)
     VALUES (?, ?, 'a.dem', 'de_cache', TRUE, 64, 'inferred', 21, ?, 'full', FALSE,
             'Nos', 'Eles', 0, 0, ?)`,
    [matchId, matchId, new Date(), metricsVersion],
  );
  for (const id of [...CT, ...T, SAI, ENTRA]) {
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name, rounds_played)
       VALUES (?, ?, ?, 0)`,
      [matchId, id, id],
    );
  }
}

async function jogou(matchId: string, roundNum: number, steamId: string, side: 'CT' | 'T') {
  await db.exec(
    `INSERT INTO player_round_stats
       (match_id, round_num, steam_id, side, kills, deaths, damage, survived)
     VALUES (?, ?, ?, ?, 1, 1, 80, FALSE)`,
    [matchId, roundNum, steamId, side],
  );
  await db.exec(
    `INSERT INTO economy (match_id, round_num, steam_id, side, start_balance, spent,
                          equip_value, buy_type, team_buy_type)
     VALUES (?, ?, ?, ?, 3400, 3100, 3400, 'full_buy', 'full_buy')`,
    [matchId, roundNum, steamId, side],
  );
}

async function fantasma(matchId: string, roundNum: number, steamId: string) {
  await db.exec(
    `INSERT INTO player_round_stats
       (match_id, round_num, steam_id, side, kills, deaths, damage, survived, kast)
     VALUES (?, ?, ?, NULL, 0, 0, 0, TRUE, NULL)`,
    [matchId, roundNum, steamId],
  );
  await db.exec(
    `INSERT INTO economy (match_id, round_num, steam_id, side, start_balance, spent,
                          equip_value, buy_type, team_buy_type)
     VALUES (?, ?, ?, NULL, 3400, 0, 0, 'eco', 'eco')`,
    [matchId, roundNum, steamId],
  );
}

async function comComplete(matchId = 'm1'): Promise<void> {
  await partida(matchId);
  for (let r = 1; r <= ROUNDS; r += 1) {
    await db.exec(
      `INSERT INTO rounds (match_id, round_num, phase, start_tick, freeze_end_tick, end_tick,
                           winner_side)
       VALUES (?, ?, 'live', ?, ?, ?, 'CT')`,
      [matchId, r, r * 1000, r * 1000 + 640, r * 1000 + 900],
    );
    for (const id of CT) await jogou(matchId, r, id, 'CT');
    for (const id of T) await jogou(matchId, r, id, 'T');
    if (r <= SAIU_NO) await jogou(matchId, r, SAI, 'T');
    else await fantasma(matchId, r, SAI);
    if (r >= ENTROU_NO) await jogou(matchId, r, ENTRA, 'T');
  }
}

async function cincoContraCinco(matchId = 'm2'): Promise<void> {
  await partida(matchId, 4);
  for (let r = 1; r <= ROUNDS; r += 1) {
    await db.exec(
      `INSERT INTO rounds (match_id, round_num, phase, start_tick, freeze_end_tick, end_tick,
                           winner_side)
       VALUES (?, ?, 'live', ?, ?, ?, 'CT')`,
      [matchId, r, r * 1000, r * 1000 + 640, r * 1000 + 900],
    );
    for (const id of CT) await jogou(matchId, r, id, 'CT');
    for (const id of [...T, SAI]) await jogou(matchId, r, id, 'T');
  }
}

async function aplicar021(): Promise<void> {
  for (const statement of MIGRACAO_021) await db.exec(statement);
}

const contar = async (sql: string, params: unknown[] = []): Promise<number> =>
  Number((await db.queryOne<{ n: number }>(sql, params as never))!.n);

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2absent-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('a linha de round de quem nao jogou o round', () => {
  it('quem sai no round 5 nao fica com linha nos rounds seguintes', async () => {
    await comComplete();

    expect(
      await contar(`SELECT COUNT(*) AS n FROM player_round_stats
                     WHERE match_id = 'm1' AND steam_id = ?`, [SAI]),
    ).toBe(ROUNDS);
    expect(
      await contar(`SELECT COUNT(*) AS n FROM player_round_stats
                     WHERE match_id = 'm1' AND steam_id = ? AND survived`, [SAI]),
    ).toBe(ROUNDS - SAIU_NO);

    await aplicar021();

    const dele = await db.query<{ round_num: number; side: string | null; survived: boolean }>(
      `SELECT round_num, side, survived FROM player_round_stats
        WHERE match_id = 'm1' AND steam_id = ? ORDER BY round_num`,
      [SAI],
    );
    expect(dele.map((r) => Number(r.round_num))).toEqual([1, 2, 3, 4, 5]);

    for (const r of dele) expect(r.side).toBe('T');
    expect(dele.some((r) => r.survived)).toBe(false);

    expect(
      await contar(`SELECT COUNT(*) AS n FROM economy
                     WHERE match_id = 'm1' AND steam_id = ?`, [SAI]),
    ).toBe(SAIU_NO);
  });

  it('o invariante vale para a partida inteira, nas duas tabelas', async () => {
    await comComplete();
    await aplicar021();
    for (const tabela of ['player_round_stats', 'economy']) {
      expect(await contar(`SELECT COUNT(*) AS n FROM ${tabela} WHERE side IS NULL`)).toBe(0);
    }
  });

  it('quem jogou continua identico: o substituto e os dez titulares', async () => {
    await comComplete();
    const antes = await db.query(
      `SELECT steam_id, round_num, side, kills, deaths, damage, survived
         FROM player_round_stats WHERE match_id = 'm1' AND side IS NOT NULL
        ORDER BY steam_id, round_num`,
    );
    await aplicar021();
    const depois = await db.query(
      `SELECT steam_id, round_num, side, kills, deaths, damage, survived
         FROM player_round_stats WHERE match_id = 'm1'
        ORDER BY steam_id, round_num`,
    );
    expect(depois).toEqual(antes);

    const janela = await db.query<{ round_num: number }>(
      `SELECT round_num FROM player_round_stats
        WHERE match_id = 'm1' AND steam_id = ? ORDER BY round_num`,
      [ENTRA],
    );
    expect(janela.map((r) => Number(r.round_num))).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it('a partida 5v5 passa intacta: nenhuma linha, nenhuma versao', async () => {
    await cincoContraCinco();
    const linhasAntes = await contar(
      `SELECT COUNT(*) AS n FROM player_round_stats WHERE match_id = 'm2'`,
    );
    const econAntes = await contar(`SELECT COUNT(*) AS n FROM economy WHERE match_id = 'm2'`);
    await aplicar021();

    expect(
      await contar(`SELECT COUNT(*) AS n FROM player_round_stats WHERE match_id = 'm2'`),
    ).toBe(linhasAntes);
    expect(await contar(`SELECT COUNT(*) AS n FROM economy WHERE match_id = 'm2'`)).toBe(econAntes);

    expect(linhasAntes).toBe(10 * ROUNDS);

    expect(
      await contar(`SELECT metrics_version AS n FROM matches WHERE match_id = 'm2'`),
    ).toBe(4);
  });

  it('so a partida afetada volta para o recalculo do historico de metricas', async () => {
    await comComplete('m1');
    await cincoContraCinco('m2');
    await aplicar021();
    expect(await contar(`SELECT metrics_version AS n FROM matches WHERE match_id = 'm1'`)).toBe(0);
    expect(await contar(`SELECT metrics_version AS n FROM matches WHERE match_id = 'm2'`)).toBe(4);
  });

  it('a taxa de sobrevivencia deixa de contar round que nao houve', async () => {
    await comComplete();
    const taxa = async () =>
      Number(
        (await db.queryOne<{ p: number }>(
          `SELECT AVG(CASE WHEN survived THEN 1.0 ELSE 0.0 END) AS p
             FROM player_round_stats WHERE match_id = 'm1' AND steam_id = ?`,
          [SAI],
        ))!.p,
      );
    expect(await taxa()).toBeCloseTo((ROUNDS - SAIU_NO) / ROUNDS, 6);
    await aplicar021();
    expect(await taxa()).toBe(0);
  });

  it('a amostra por round deixa de contar round que nao houve', async () => {
    await comComplete();
    const amostra = async () =>
      await contar(`SELECT COUNT(*) AS n FROM economy WHERE match_id = 'm1' AND steam_id = ?`, [SAI]);
    expect(await amostra()).toBe(ROUNDS);
    await aplicar021();
    expect(await amostra()).toBe(SAIU_NO);
  });

  it('as janelas de presenca e as trocas nao mudam', async () => {
    await comComplete();
    const antes = await computeMatchRoster(db, 'm1');
    await aplicar021();
    const depois = await computeMatchRoster(db, 'm1');
    expect(depois.spells).toEqual(antes.spells);
    expect(depois.handoffs).toEqual(antes.handoffs);

    await ensureRoster(db);
    const s = await db.queryOne<{ first_round: number; last_round: number; rounds: number }>(
      `SELECT first_round, last_round, rounds FROM roster_spells
        WHERE match_id = 'm1' AND steam_id = ?`,
      [SAI],
    );
    expect(s).toMatchObject({ first_round: 1, last_round: SAIU_NO, rounds: SAIU_NO });
  });

  it('os onze jogadores continuam no elenco da partida', async () => {
    await comComplete();
    await aplicar021();
    await ensureRoster(db);
    expect(
      await contar(`SELECT COUNT(*) AS n FROM player_match WHERE match_id = 'm1'`),
    ).toBe(11);
  });
});
