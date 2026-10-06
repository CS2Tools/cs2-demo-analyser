import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { matchFindingsSchema } from '@cs2/contract';
import { ensureMetricHistory, getMatchFindings, resolveFocus } from '../src/findings-queries.js';

let dir: string;
let db: DuckDb;

const players = Array.from({ length: 10 }, (_, i) => `7656119800000000${i}`.slice(-17));
const HERO = players[0]!;
const noSettings = { userSteamId: null, playersOfInterest: [] };

async function seedMatch(n: number, heroPreaim: number): Promise<string> {
  const matchId = `m${n}`;
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at)
     VALUES (?, ?, ?, 'de_overpass', TRUE, 64, 'inferred', 2, ?)`,
    [matchId, `sha${n}`, `${matchId}.dem`, new Date(Date.UTC(2026, 0, n))],
  );

  let eng = n * 1000;
  for (const [i, steamId] of players.entries()) {
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name, team_name, rounds_played, kills, deaths,
                                 adr, opening_kills, opening_deaths, traded_deaths)
       VALUES (?, ?, ?, ?, 20, 15, 15, ?, ?, ?, ?)`,
      [matchId, steamId, `player${i}`, i < 5 ? 'A' : 'B', 60 + i * 5, i % 3, 2, i === 9 ? 0 : 5],
    );

    const preaim = i === 0 ? heroPreaim : 2 + i * 0.3;
    for (let k = 0; k < 12; k++) {
      await db.exec(
        `INSERT INTO engagements (eng_id, match_id, round_num, player_steam_id, tick_first_shot,
                                  preaim_total_deg, preaim_pitch_deg, firstshot_total_deg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [eng++, matchId, (k % 5) + 1, steamId, 1000 + k * 64,
          preaim + (k % 3) * 0.1 - 0.1, i === 1 ? -4 : 0.2, 1 + i * 0.1],
      );
    }
  }
  return matchId;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2findings-'));
  db = await DuckDb.open(join(dir, 'test.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('getMatchFindings', () => {
  it('toda saida passa no schema e todo achado tem base', async () => {
    await seedMatch(1, 4);
    const result = await getMatchFindings(db, 'm1', noSettings);
    expect(() => matchFindingsSchema.parse(result)).not.toThrow();
    expect(result.all.length).toBeGreaterThan(0);
    for (const v of result.all) expect(v.baseline.kind).toBeTruthy();
  });

  it('entrega de 3 a 5 achados no resumo, com diversidade', async () => {
    await seedMatch(1, 6);
    const { summary, focus } = await getMatchFindings(db, 'm1', noSettings);
    expect(focus.kind).toBe('match');
    expect(summary.length).toBeGreaterThanOrEqual(3);
    expect(summary.length).toBeLessThanOrEqual(5);

    expect(new Set(summary.map((v) => v.steamId)).size).toBe(summary.length);
  });

  it('o vies vertical de -4 graus vira "mira baixa"', async () => {
    await seedMatch(1, 4);
    const { all } = await getMatchFindings(db, 'm1', noSettings);
    const bias = all.find((v) => v.ruleId === 'aim.pitch_bias' && v.steamId === players[1]);
    expect(bias?.titleKey).toBe('verdict.rules.aim.pitch_bias.low.title');
    expect(bias?.baseline.kind).toBe('fixed_reference');
    expect(bias?.evidence.length).toBeGreaterThan(0);
  });

  it('com cinco partidas anteriores, a base vira o historico proprio', async () => {
    for (let n = 1; n <= 5; n++) await seedMatch(n, 4);
    await seedMatch(6, 1.5);

    const { all } = await getMatchFindings(db, 'm6', { userSteamId: HERO, playersOfInterest: [] });
    const v = all.find((x) => x.ruleId === 'aim.preaim' && x.steamId === HERO)!;
    expect(v.baseline.kind).toBe('own_history');
    if (v.baseline.kind === 'own_history') expect(v.baseline.matches).toBe(5);
    expect(v.severity).toBe('positive');
  });

  it('o historico e ESTRITAMENTE anterior: a primeira partida nunca ve as seguintes', async () => {
    for (let n = 1; n <= 6; n++) await seedMatch(n, 4);
    const result = await getMatchFindings(db, 'm1', { userSteamId: HERO, playersOfInterest: [] });
    const v = result.all.find((x) => x.ruleId === 'aim.preaim' && x.steamId === HERO)!;
    expect(v.baseline.kind).toBe('match_relative');
    expect(result.history).toEqual([
      { steamId: HERO, name: 'player0', priorMatches: 0, required: 5 },
    ]);
  });

  it('grava os achados em match_findings como chaves, nao prosa', async () => {
    await seedMatch(1, 6);
    const result = await getMatchFindings(db, 'm1', noSettings);
    const rows = await db.query<{ title_key: string; baseline_kind: string; rank: number | null }>(
      'SELECT title_key, baseline_kind, rank FROM match_findings WHERE match_id = ?',
      ['m1'],
    );
    expect(rows.length).toBe(result.all.length);
    for (const r of rows) expect(r.title_key).toMatch(/^verdict\.rules\./);
    expect(rows.filter((r) => r.rank !== null)).toHaveLength(result.summary.length);
  });

  it('recalcular nao duplica nada', async () => {
    await seedMatch(1, 6);
    await getMatchFindings(db, 'm1', noSettings);
    await getMatchFindings(db, 'm1', noSettings);
    const [h] = await db.query<{ n: number }>(
      "SELECT COUNT(*)::INTEGER AS n FROM player_metric_history WHERE match_id = 'm1'",
    );
    const [f] = await db.query<{ n: number }>(
      "SELECT COUNT(*)::INTEGER AS n FROM match_findings WHERE match_id = 'm1'",
    );
    const again = await getMatchFindings(db, 'm1', noSettings);
    expect(Number(f!.n)).toBe(again.all.length);
    expect(Number(h!.n)).toBeGreaterThan(0);
  });
});

describe('historico de metricas', () => {

  it('partida ja calculada ganha metrica nova sem reimportar', async () => {
    const matchId = await seedMatch(1, 2);
    await ensureMetricHistory(db);

    const before = await db.query<{ metric_id: string }>(
      'SELECT DISTINCT metric_id FROM player_metric_history WHERE match_id = ?',
      [matchId],
    );
    expect(before.length).toBeGreaterThan(0);

    await db.exec(
      `DELETE FROM player_metric_history WHERE match_id = ? AND metric_id = 'combat.adr'`,
      [matchId],
    );
    await db.exec('UPDATE matches SET metrics_version = 1 WHERE match_id = ?', [matchId]);

    await ensureMetricHistory(db);

    const after = await db.query<{ metric_id: string }>(
      'SELECT DISTINCT metric_id FROM player_metric_history WHERE match_id = ?',
      [matchId],
    );
    expect(after.map((r) => r.metric_id).sort()).toEqual(before.map((r) => r.metric_id).sort());
  });

  it('nao recalcula o que ja esta na versao atual', async () => {
    const matchId = await seedMatch(1, 2);
    await ensureMetricHistory(db);

    const version = await db.queryOne<{ v: number | null }>(
      'SELECT metrics_version AS v FROM matches WHERE match_id = ?',
      [matchId],
    );
    expect(Number(version!.v)).toBeGreaterThan(0);

    await db.exec(
      `INSERT INTO player_metric_history (steam_id, match_id, metric_id, value, sample_n, played_at)
       VALUES ('marcador', ?, 'teste.marcador', 1, 1, ?)`,
      [matchId, new Date()],
    );
    await ensureMetricHistory(db);

    const marker = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*)::INTEGER AS n FROM player_metric_history WHERE metric_id = 'teste.marcador'`,
    );
    expect(Number(marker!.n)).toBe(1);
  });
});

describe('resolveFocus', () => {
  const inMatch = new Set(['a', 'b']);

  it('o usuario configurado tem prioridade', () => {
    expect(resolveFocus({ userSteamId: 'a', playersOfInterest: [] }, inMatch))
      .toEqual({ kind: 'user', steamIds: ['a'] });
  });

  it('sem o usuario na partida, caem os jogadores de interesse presentes', () => {
    const poi = { steamId: 'b', displayName: 'B', note: '', colour: '#f59e0b' };
    expect(resolveFocus({ userSteamId: 'z', playersOfInterest: [poi] }, inMatch))
      .toEqual({ kind: 'poi', steamIds: ['b'] });
  });

  it('sem ninguem conhecido, o foco e a partida', () => {
    expect(resolveFocus({ userSteamId: null, playersOfInterest: [] }, inMatch).kind).toBe('match');
  });
});
