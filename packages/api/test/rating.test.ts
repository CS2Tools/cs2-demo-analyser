import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { ensureRoundStats } from '../src/round-flow-queries.js';
import { getRatingAnalysis, loadWinProbability } from '../src/rating-queries.js';

let dir: string;
let db: DuckDb;

const CT = ['c1', 'c2', 'c3', 'c4', 'c5'];
const T = ['t1', 't2', 't3', 't4', 't5'];

async function seedMatch(matchId: string, rounds: number, winner: 'CT' | 'T'): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned,
                          team_a_name, team_b_name)
     VALUES (?, ?, 'x.dem', 'de_mirage', TRUE, 64, 'inferred', 3, ?, 'full', FALSE, 'Nos', 'Eles')`,
    [matchId, matchId.repeat(64).slice(0, 64), new Date()],
  );

  let killId = 1;
  for (let roundNum = 1; roundNum <= rounds; roundNum += 1) {
    await db.exec(
      `INSERT INTO rounds (match_id, round_num, phase, winner_side, end_tick, bomb_plant_tick)
       VALUES (?, ?, 'live', ?, ?, NULL)`,
      [matchId, roundNum, winner, roundNum * 10000],
    );
    for (const [steamId, side] of [
      ...CT.map((c) => [c, 'CT'] as const),
      ...T.map((t) => [t, 'T'] as const),
    ]) {
      await db.exec(
        `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, damage)
         VALUES (?, ?, ?, ?, 0, 0, 0)`,
        [matchId, roundNum, steamId, side],
      );
    }

    for (const victim of [T[0]!, T[1]!]) {
      await db.exec(
        `INSERT INTO kills (kill_id, match_id, round_num, tick, attacker_steam_id, victim_steam_id,
                            attacker_side, victim_side, assister_steam_id, death_was_traded)
         VALUES (?, ?, ?, ?, 'c1', ?, 'CT', 'T', NULL, FALSE)`,
        [killId, matchId, roundNum, roundNum * 10000 + killId, victim],
      );
      killId += 1;
    }
  }

  for (const steamId of [...CT, ...T]) {
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name, rounds_played, kills, deaths, assists,
                                 adr, kast_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matchId, steamId, steamId, rounds,
        steamId === 'c1' ? rounds * 2 : 0,
        steamId === 't1' || steamId === 't2' ? rounds : 0,
        0,
        steamId === 'c1' ? 90 : 20,
        steamId === 'c1' ? 1 : 0.5,
      ],
    );
  }
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2rating-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('round_states', () => {
  it('o backfill grava um estado por transicao, com o desfecho do round', async () => {
    await seedMatch('m1', 2, 'CT');
    await ensureRoundStats(db);

    const rows = await db.query<{
      round_num: number; seq: number; alive_ct: number; alive_t: number; ct_won: boolean;
    }>(`SELECT round_num, seq, alive_ct, alive_t, ct_won FROM round_states
         WHERE round_num = 1 ORDER BY seq`);
    expect(rows.map((r) => [Number(r.alive_ct), Number(r.alive_t)])).toEqual([
      [5, 5], [5, 4], [5, 3],
    ]);
    expect(rows.every((r) => r.ct_won === true)).toBe(true);
  });

  it('rodar de novo nao duplica estado', async () => {
    await seedMatch('m1', 2, 'CT');
    await ensureRoundStats(db);
    const antes = await db.queryOne<{ n: number }>('SELECT COUNT(*)::INTEGER AS n FROM round_states');
    await db.exec('UPDATE matches SET round_stats_version = 0');
    await ensureRoundStats(db);
    const depois = await db.queryOne<{ n: number }>('SELECT COUNT(*)::INTEGER AS n FROM round_states');
    expect(Number(depois!.n)).toBe(Number(antes!.n));
  });
});

describe('getRatingAnalysis', () => {
  it('com biblioteca pequena, o impacto se cala — mas o rating continua', async () => {
    await seedMatch('m1', 2, 'CT');
    await ensureRoundStats(db);

    const r = await getRatingAnalysis(db, 'm1');
    const c1 = r.players.find((p) => p.steamId === 'c1')!;
    expect(c1.rating).not.toBeNull();

    expect(c1.swingPerRound).toBeNull();
    expect(c1.skippedKills).toBe(4);
    expect(r.baseline.states).toBe(0);
  });

  it('com biblioteca suficiente, a probabilidade sai da propria biblioteca', async () => {

    for (let i = 0; i < 11; i += 1) {
      await seedMatch(`m${i}`, 2, i < 8 ? 'CT' : 'T');
    }
    await ensureRoundStats(db);

    const p = await loadWinProbability(db);
    const cheio = p.ctWinRate({ aliveCT: 5, aliveT: 5, planted: false })!;
    expect(cheio.sample).toBe(22);

    expect(cheio.ctWinRate).toBeCloseTo(16 / 22, 10);

    const r = await getRatingAnalysis(db, 'm0');
    const c1 = r.players.find((p) => p.steamId === 'c1')!;
    expect(c1.swingPerRound).not.toBeNull();
    expect(c1.skippedKills).toBe(0);
    expect(r.baseline.states).toBeGreaterThan(0);
  });

  it('quem nao matou fica em zero — que e diferente de nao saber', async () => {
    for (let i = 0; i < 11; i += 1) await seedMatch(`m${i}`, 2, 'CT');
    await ensureRoundStats(db);

    const r = await getRatingAnalysis(db, 'm0');
    expect(r.players.find((p) => p.steamId === 'c2')!.swingPerRound).toBe(0);
  });

  it('sem KAST nao ha rating: nulo em vez de numero baixo', async () => {
    await seedMatch('m1', 2, 'CT');
    await db.exec(`UPDATE player_match SET kast_pct = NULL WHERE steam_id = 'c1'`);

    await db.exec(`UPDATE matches SET round_stats_version = 2`);

    const r = await getRatingAnalysis(db, 'm1');
    expect(r.players.find((p) => p.steamId === 'c1')!.rating).toBeNull();
  });
});
