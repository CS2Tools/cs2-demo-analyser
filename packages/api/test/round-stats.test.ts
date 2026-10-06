import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { computeMatchMetrics } from '../src/findings-queries.js';
import {
  ensureRoundStats,
  getRoundsAnalysis,
  ROUND_STATS_VERSION,
} from '../src/round-flow-queries.js';

let dir: string;
let db: DuckDb;

const CT = ['c1', 'c2', 'c3', 'c4', 'c5'];
const T = ['t1', 't2', 't3', 't4', 't5'];

async function seedMatch(matchId = 'm1'): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned,
                          team_a_name, team_b_name)
     VALUES (?, ?, 'x.dem', 'de_mirage', TRUE, 64, 'inferred', 3, ?, 'full', FALSE, 'Nos', 'Eles')`,
    [matchId, matchId.repeat(30).slice(0, 64), new Date()],
  );

  for (const roundNum of [1, 2]) {
    await db.exec(
      `INSERT INTO rounds (match_id, round_num, phase, winner_side, end_tick, bomb_plant_tick)
       VALUES (?, ?, 'live', 'CT', ?, NULL)`,
      [matchId, roundNum, roundNum * 10000],
    );
    const elenco: [string, 'CT' | 'T'][] = [
      ...CT.map((c): [string, 'CT'] => [c, 'CT']),
      ...T.map((t): [string, 'T'] => [t, 'T']),
    ];
    for (const [steamId, side] of elenco) {
      await db.exec(
        `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, damage)
         VALUES (?, ?, ?, ?, 0, 0, 0)`,
        [matchId, roundNum, steamId, side],
      );
    }
  }

  for (const steamId of [...CT, ...T]) {
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name, rounds_played) VALUES (?, ?, ?, 2)`,
      [matchId, steamId, steamId],
    );
  }
}

async function seedAce(matchId = 'm1'): Promise<void> {
  let killId = 1;
  for (const victim of T) {
    await db.exec(
      `INSERT INTO kills (kill_id, match_id, round_num, tick, attacker_steam_id, victim_steam_id,
                          attacker_side, victim_side, assister_steam_id, death_was_traded)
       VALUES (?, ?, 1, ?, 'c1', ?, 'CT', 'T', NULL, FALSE)`,
      [killId, matchId, 1000 + killId * 10, victim],
    );
    killId += 1;
  }
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2round-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
  await seedMatch();
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('KAST e clutch materializados', () => {
  it('preenche as colunas que a ingestao deixava vazias', async () => {
    await seedAce();
    await ensureRoundStats(db);

    const rows = await db.query<{ n: number; com_kast: number; assists: number }>(
      `SELECT COUNT(*)::INTEGER AS n, COUNT(kast)::INTEGER AS com_kast,
              SUM(assists)::INTEGER AS assists
         FROM player_round_stats`,
    );

    expect([Number(rows[0]!.n), Number(rows[0]!.com_kast)]).toEqual([20, 20]);

    const c1 = await db.queryOne<{ kast_rounds: number; kast_pct: number }>(
      `SELECT kast_rounds, kast_pct FROM player_match WHERE steam_id = 'c1'`,
    );

    expect(Number(c1!.kast_rounds)).toBe(2);
    expect(Number(c1!.kast_pct)).toBe(1);

    const t1 = await db.queryOne<{ kast_rounds: number }>(
      `SELECT kast_rounds FROM player_match WHERE steam_id = 't1'`,
    );
    expect(Number(t1!.kast_rounds)).toBe(1);
  });

  it('grava o clutch com o numero de inimigos, e so quando houve', async () => {
    await seedAce();
    await ensureRoundStats(db);

    const clutch = await db.query<{ steam_id: string; clutch_type: string; clutch_won: boolean }>(
      `SELECT steam_id, clutch_type, clutch_won FROM player_round_stats
        WHERE clutch_type IS NOT NULL ORDER BY steam_id`,
    );
    expect(clutch).toHaveLength(1);
    expect(clutch[0]).toMatchObject({ steam_id: 't5', clutch_type: '1v5', clutch_won: false });

    const tried = await db.queryOne<{ tried: number; won: number }>(
      `SELECT SUM(clutches_tried)::INTEGER AS tried, SUM(clutches_won)::INTEGER AS won
         FROM player_match`,
    );
    expect([Number(tried!.tried), Number(tried!.won)]).toEqual([1, 0]);
  });

  it('roda uma vez por partida e nao repete', async () => {
    await seedAce();
    const first = await ensureRoundStats(db);
    expect(first.updated).toEqual(['m1']);

    const second = await ensureRoundStats(db);
    expect(second.updated).toEqual([]);

    const version = await db.queryOne<{ v: number }>(
      'SELECT round_stats_version AS v FROM matches WHERE match_id = ?',
      ['m1'],
    );
    expect(Number(version!.v)).toBe(ROUND_STATS_VERSION);
  });

  it('partida sem kill nenhuma nao quebra: todos sobreviveram', async () => {
    await ensureRoundStats(db);
    const all = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*)::INTEGER AS n FROM player_round_stats WHERE kast`,
    );
    expect(Number(all!.n)).toBe(20);
  });

  it('a analise da tela le os mesmos numeros que o banco guardou', async () => {
    await seedAce();
    await ensureRoundStats(db);
    const flow = await getRoundsAnalysis(db, 'm1');

    expect(flow.rounds).toHaveLength(2);
    expect(flow.multikills[0]).toMatchObject({ steamId: 'c1', counts: [0, 0, 0, 1] });
    expect(flow.clutches[0]).toMatchObject({ steamId: 't5', tried: 1, won: 0 });

    const banco = await db.queryOne<{ kast_pct: number }>(
      `SELECT kast_pct FROM player_match WHERE steam_id = 'c1'`,
    );
    const tela = flow.kast.find((k) => k.steamId === 'c1')!;
    expect(tela.kast).toBe(Number(banco!.kast_pct));
  });

  it('round descartado (faca, aquecimento) fica de fora', async () => {
    await seedAce();
    await db.exec(
      `INSERT INTO rounds (match_id, round_num, phase, winner_side, end_tick)
       VALUES ('m1', 0, 'knife', 'T', 500)`,
    );
    const flow = await getRoundsAnalysis(db, 'm1');
    expect(flow.rounds.map((r) => r.roundNum)).toEqual([1, 2]);
  });
});

describe('metricas da F4.8 no historico', () => {
  it('acerto, counter-strafe, KAST e ir atras da troca viram observacao', async () => {
    await seedAce();

    for (let i = 1; i <= 50; i += 1) {
      await db.exec(
        `INSERT INTO weapon_fires (fire_id, match_id, round_num, tick, steam_id, weapon, speed)
         VALUES (?, 'm1', 1, ?, 'c1', 'weapon_ak47', ?)`,
        [i, 2000 + i * 10, i <= 40 ? 10 : 200],
      );
    }
    for (let i = 1; i <= 12; i += 1) {
      await db.exec(
        `INSERT INTO damages (damage_id, match_id, round_num, tick, attacker_steam_id,
                              victim_steam_id, weapon, dmg_health, hitgroup, is_utility, is_team_damage)
         VALUES (?, 'm1', 1, ?, 'c1', 't1', 'ak47', 25, 'chest', FALSE, FALSE)`,
        [i, 2000 + i * 10],
      );
    }

    const metrics = await computeMatchMetrics(db, 'm1');
    const of = (id: string) => metrics.find((m) => m.steamId === 'c1' && m.metricId === id);

    expect(of('aim.accuracy')).toMatchObject({ value: 12 / 50, sampleN: 50 });

    expect(of('aim.counter_strafe')).toMatchObject({ value: 0.8, sampleN: 50 });
    expect(of('duels.kast')).toMatchObject({ value: 1, sampleN: 2 });

    expect(of('duels.trade_attempt_rate')).toBeUndefined();

    const t5 = metrics.find((m) => m.steamId === 't5' && m.metricId === 'duels.trade_attempt_rate');
    expect(t5).toMatchObject({ value: 0 });
  });
});
