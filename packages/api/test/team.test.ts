import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { getLineups, getTeamMatchReport } from '../src/team-queries.js';
import { ensureRoster } from '../src/roster-queries.js';

let dir: string;
let db: DuckDb;

const CINCO = ['a', 'b', 'c', 'd', 'e'];
const OUTROS = ['v', 'w', 'x', 'y', 'z'];

async function seedMatch(
  matchId: string,
  mapName: string,
  playedAt: string,
  casa: { name: string; players: string[] },
  fora: { name: string; players: string[] },
  roundsCasa: number,
  roundsFora: number,
): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, played_at, bulk_state,
                          pinned, team_a_name, team_b_name)
     VALUES (?, ?, 'x.dem', ?, TRUE, 64, 'inferred', 3, ?, ?, 'full', FALSE, ?, ?)`,
    [matchId, matchId.repeat(64).slice(0, 64), mapName, playedAt, playedAt, casa.name, fora.name],
  );

  for (const [time, lista] of [[casa, casa.players], [fora, fora.players]] as const) {
    for (const steamId of lista) {
      await db.exec(
        `INSERT INTO player_match (match_id, steam_id, name, team_name, rounds_played)
         VALUES (?, ?, ?, ?, ?)`,
        [matchId, steamId, `nome-${steamId}`, time.name, roundsCasa + roundsFora],
      );
    }
  }

  let round = 0;
  for (const [vencedor, quantos] of [['CT', roundsCasa], ['T', roundsFora]] as const) {
    for (let i = 0; i < quantos; i += 1) {
      round += 1;
      await db.exec(
        `INSERT INTO rounds (match_id, round_num, phase, winner_side, end_tick)
         VALUES (?, ?, 'live', ?, ?)`,
        [matchId, round, vencedor, round * 1000],
      );
      for (const steamId of casa.players) {
        await db.exec(
          `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, damage)
           VALUES (?, ?, ?, 'CT', 0, 0, 0)`,
          [matchId, round, steamId],
        );
      }
      for (const steamId of fora.players) {
        await db.exec(
          `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, damage)
           VALUES (?, ?, ?, 'T', 0, 0, 0)`,
          [matchId, round, steamId],
        );
      }
    }
  }
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2team-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('getLineups', () => {
  it('o mesmo elenco em duas partidas vira UM time, com os rounds somados', async () => {
    await seedMatch('m1', 'de_mirage', '2026-01-01 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 7);
    await seedMatch('m2', 'de_nuke', '2026-01-02 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Outros', players: ['p', 'q', 'r', 's', 't'] }, 13, 4);

    const lineups = await getLineups(db);
    const nos = lineups.find((l) => l.name === 'Nos')!;
    expect(nos.matches).toBe(2);
    expect(nos.wins).toBe(2);
    expect(nos.roundsWon).toBe(26);
    expect(nos.roundsLost).toBe(11);
    expect(nos.maps.map((m) => m.mapName).sort()).toEqual(['de_mirage', 'de_nuke']);
  });

  it('um reserva nao quebra o historico do time', async () => {
    await seedMatch('m1', 'de_mirage', '2026-01-01 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 7);
    await seedMatch('m2', 'de_mirage', '2026-01-02 10:00:00',
      { name: 'Nos v2', players: ['a', 'b', 'c', 'novo1', 'novo2'] },
      { name: 'Eles', players: OUTROS }, 13, 9);

    const lineups = await getLineups(db);
    const nos = lineups.find((l) => l.id.startsWith('a|'))!;
    expect(nos.matches).toBe(2);

    expect(nos.name).toBe('Nos v2');
    expect(nos.players.find((p) => p.steamId === 'novo1')!.matches).toBe(1);
    expect(nos.players.find((p) => p.steamId === 'a')!.matches).toBe(2);
  });

  it('times sem jogador em comum ficam separados', async () => {
    await seedMatch('m1', 'de_mirage', '2026-01-01 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 7);
    const lineups = await getLineups(db);
    expect(lineups).toHaveLength(2);
    expect(lineups.map((l) => l.name).sort()).toEqual(['Eles', 'Nos']);
  });

  it('o lado e contado separado: CT e T de cada partida', async () => {
    await seedMatch('m1', 'de_mirage', '2026-01-01 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 7);
    const lineups = await getLineups(db);
    const nos = lineups.find((l) => l.name === 'Nos')!;

    expect(nos.bySide).toEqual([{ side: 'CT', rounds: 20, won: 13 }]);
    const eles = lineups.find((l) => l.name === 'Eles')!;
    expect(eles.bySide).toEqual([{ side: 'T', rounds: 20, won: 7 }]);
  });

  it('partida de matchmaking nao colapsa os dois times numa instancia', async () => {
    await seedMatch('mm1', 'de_dust2', '2026-03-01 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 7);
    await db.exec('UPDATE matches SET team_a_name = NULL, team_b_name = NULL');
    await db.exec('UPDATE player_match SET team_name = NULL');
    await ensureRoster(db);

    const lineups = await getLineups(db);
    expect(lineups).toHaveLength(2);
    for (const l of lineups) expect(l.players).toHaveLength(5);
    const ids0 = new Set(lineups[0]!.players.map((p) => p.steamId));
    expect(lineups[1]!.players.filter((p) => ids0.has(p.steamId))).toEqual([]);
  });

  it('as partidas que entraram no grupo ficam a vista, para a heuristica ser conferivel', async () => {
    await seedMatch('m1', 'de_mirage', '2026-01-01 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 7);
    await seedMatch('m2', 'de_nuke', '2026-01-02 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 4);
    const nos = (await getLineups(db)).find((l) => l.name === 'Nos')!;
    expect(nos.matchIds).toEqual(['m1', 'm2']);
  });

  it('biblioteca vazia responde vazio, e nao erro', async () => {
    expect(await getLineups(db)).toEqual([]);
  });
});

describe('getTeamMatchReport sem nome de time', () => {
  it('os dois lados continuam sendo DOIS, mesmo com nome nulo', async () => {
    await seedMatch('mm', 'de_dust2', '2026-02-01 10:00:00',
      { name: 'Nos', players: CINCO }, { name: 'Eles', players: OUTROS }, 13, 7);
    await db.exec('UPDATE matches SET team_a_name = NULL, team_b_name = NULL');
    await db.exec('UPDATE player_match SET team_name = NULL');

    await ensureRoster(db);

    const r = await getTeamMatchReport(db, 'mm');
    expect(r.teams).toHaveLength(2);
    expect(r.teams[0]).not.toBe(r.teams[1]);
    expect(r.teams.map((t) => t.teamName)).toEqual([null, null]);

    expect(r.teams[0]!.players).toHaveLength(5);
    expect(r.teams[1]!.players).toHaveLength(5);
    const ids0 = new Set(r.teams[0]!.players.map((p) => p.steamId));
    expect(r.teams[1]!.players.filter((p) => ids0.has(p.steamId))).toEqual([]);
    expect(r.teams[0]!.roundsWon + r.teams[1]!.roundsWon).toBeGreaterThan(0);
  });

  it('dois times com o MESMO nome tambem continuam separados', async () => {
    await seedMatch('igual', 'de_dust2', '2026-02-02 10:00:00',
      { name: 'Time', players: CINCO }, { name: 'Time', players: OUTROS }, 13, 5);
    await db.exec(`UPDATE matches SET team_a_name = 'Time', team_b_name = 'Time'`);

    await ensureRoster(db);

    const r = await getTeamMatchReport(db, 'igual');
    expect(r.teams[0]).not.toBe(r.teams[1]);
    expect(r.teams[0]!.players).toHaveLength(5);
    expect(r.teams[1]!.players).toHaveLength(5);
  });
});
