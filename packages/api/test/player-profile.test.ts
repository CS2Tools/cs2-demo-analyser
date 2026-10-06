import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { DEFAULT_SETTINGS } from '@cs2/contract';
import { getPlayerProfile, listPlayers } from '../src/player-queries.js';

let dir: string;
let db: DuckDb;

const ME = '76561198000000001';
const OTHER = '76561198000000002';
const settings = { userSteamId: ME, playersOfInterest: DEFAULT_SETTINGS.playersOfInterest };

async function seedMatch(opts: {
  id: string;
  day: number;
  map: string;
  won: number;
  lost: number;
  name?: string;
  adr?: number;

  duels?: number;

  pitch?: number;
}): Promise<void> {
  const { id, day, map, won, lost } = opts;
  const rounds = won + lost;
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, played_at, bulk_state,
                          pinned, team_a_name, team_b_name)
     VALUES (?, ?, ?, ?, TRUE, 64, 'inferred', 3, ?, ?, 'full', FALSE, 'Nos', 'Eles')`,
    [id, id.repeat(10).slice(0, 64), `${id}.dem`, map,
     new Date(Date.UTC(2026, 0, day)), new Date(Date.UTC(2026, 0, day))],
  );
  await db.exec(
    `INSERT INTO player_match (match_id, steam_id, name, team_name, rounds_played, kills, deaths,
                               damage_total, adr, opening_kills, opening_deaths)
     VALUES (?, ?, ?, 'Nos', ?, 10, 5, ?, ?, 2, 1),
            (?, ?, 'ele', 'Eles', ?, 5, 10, 500, 20, 1, 2)`,
    [id, ME, opts.name ?? 'eu', rounds, (opts.adr ?? 100) * rounds, opts.adr ?? 100,
     id, OTHER, rounds],
  );

  for (let n = 1; n <= rounds; n += 1) {
    const side = n <= Math.ceil(rounds / 2) ? 'CT' : 'T';
    const winner = n <= won ? side : side === 'CT' ? 'T' : 'CT';
    await db.exec(
      `INSERT INTO rounds (match_id, round_num, phase, winner_side, end_tick)
       VALUES (?, ?, 'live', ?, ?)`,
      [id, n, winner, n * 1000],
    );
    await db.exec(
      `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, damage)
       VALUES (?, ?, ?, ?, 1, 0, 100)`,
      [id, n, ME, side],
    );
  }

  await db.exec(
    `INSERT INTO rounds (match_id, round_num, phase, winner_side, end_tick)
     VALUES (?, 0, 'knife', 'T', 1)`,
    [id],
  );
  await db.exec(
    `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, damage)
     VALUES (?, 0, ?, 'CT', 0, 1, 0)`,
    [id, ME],
  );

  for (let i = 1; i <= (opts.duels ?? 0); i += 1) {
    await db.exec(
      `INSERT INTO engagements (eng_id, match_id, round_num, player_steam_id, enemy_steam_id,
                                tick_first_shot, preaim_total_deg, preaim_pitch_deg,
                                firstshot_total_deg, distance, weapon, outcome,
                                player_was_moving, player_was_blind)
       VALUES (?, ?, 1, ?, ?, ?, 2.0, ?, 1.2, 500, 'ak47', 'kill', FALSE, FALSE)`,
      [i, id, ME, OTHER, 100 + i, opts.pitch ?? 0.2],
    );
  }

  await db.exec(
    `INSERT INTO players (steam_id, last_known_name, first_seen, last_seen, matches_count)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT (steam_id) DO UPDATE SET last_known_name = excluded.last_known_name,
                                          last_seen = excluded.last_seen`,
    [ME, opts.name ?? 'eu', new Date(Date.UTC(2026, 0, day)), new Date(Date.UTC(2026, 0, day))],
  );
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2player-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('tela Jogador', () => {
  it('jogador sem partida devolve perfil vazio, nao erro', async () => {
    const p = await getPlayerProfile(db, '76561198999999999', 10, settings);
    expect(p.matches).toBe(0);
    expect(p.series).toEqual([]);
    expect(p.byMap).toEqual([]);
  });

  it('a serie vem em ordem cronologica, e a mediana anterior nao inclui a propria partida', async () => {

    await seedMatch({ id: 'm3', day: 30, map: 'de_nuke', won: 9, lost: 7, adr: 140 });
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7, adr: 60 });
    await seedMatch({ id: 'm2', day: 20, map: 'de_mirage', won: 9, lost: 7, adr: 100 });

    const p = await getPlayerProfile(db, ME, 10, settings);
    const adr = p.series.find((x) => x.metricId === 'combat.adr')!;
    expect(adr.points.map((x) => x.matchId)).toEqual(['m1', 'm2', 'm3']);
    expect(adr.points.map((x) => x.value)).toEqual([60, 100, 140]);

    expect(adr.points.map((x) => x.priorMedian)).toEqual([null, 60, 80]);
    expect(p.firstSeen! < p.lastSeen!).toBe(true);
  });

  it('amostra abaixo do minimo da regra aparece, mas marcada', async () => {

    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 2, lost: 2, duels: 6 });
    const p = await getPlayerProfile(db, ME, 10, settings);
    expect(p.series.find((x) => x.metricId === 'combat.adr')!.points[0]!.enough).toBe(false);
    expect(p.series.find((x) => x.metricId === 'aim.preaim_deg')!.points[0]!.enough).toBe(true);
  });

  it('as metricas saem da biblioteca inteira, mesmo de partida nunca aberta', async () => {

    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7, duels: 6, pitch: 5 });
    await seedMatch({ id: 'm2', day: 11, map: 'de_mirage', won: 9, lost: 7, duels: 6, pitch: 0.2 });

    const p = await getPlayerProfile(db, ME, 10, settings);
    const pitch = p.series.find((x) => x.metricId === 'aim.preaim_pitch_deg')!;
    expect(pitch.points.map((x) => x.value)).toEqual([5, 0.2]);

    const item = p.train.find((x) => x.ruleId === 'aim.pitch_bias')!;
    expect([item.times, item.of]).toEqual([1, 2]);
    expect(item.matches.map((m) => m.matchId)).toEqual(['m1']);
    expect(item.worst).toBe('critical');

    expect(item.trend).toBeNull();
  });

  it('a janela de "o que treinar" olha so as ultimas N partidas', async () => {
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7, duels: 6, pitch: 5 });
    await seedMatch({ id: 'm2', day: 11, map: 'de_mirage', won: 9, lost: 7, duels: 6, pitch: 0.2 });
    await seedMatch({ id: 'm3', day: 12, map: 'de_mirage', won: 9, lost: 7, duels: 6, pitch: 0.2 });
    await seedMatch({ id: 'm4', day: 13, map: 'de_mirage', won: 9, lost: 7, duels: 6, pitch: 0.2 });

    const all = await getPlayerProfile(db, ME, 10, settings);
    expect(all.windowMatches).toBe(4);
    expect(all.train.find((x) => x.ruleId === 'aim.pitch_bias')!.of).toBe(4);

    const recent = await getPlayerProfile(db, ME, 3, settings);
    expect(recent.windowMatches).toBe(3);
    expect(recent.train.find((x) => x.ruleId === 'aim.pitch_bias')).toBeUndefined();

    expect(recent.series.find((x) => x.metricId === 'aim.preaim_pitch_deg')!.points)
      .toHaveLength(4);
  });

  it('vitoria e contada pelos rounds do lado do jogador, e o round faca fica de fora', async () => {
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 13, lost: 4 });
    await seedMatch({ id: 'm2', day: 11, map: 'de_mirage', won: 4, lost: 13 });
    await seedMatch({ id: 'm3', day: 12, map: 'de_nuke', won: 8, lost: 8 });

    const p = await getPlayerProfile(db, ME, 10, settings);
    const mirage = p.byMap.find((m) => m.mapName === 'de_mirage')!;
    expect([mirage.matches, mirage.wins, mirage.losses, mirage.draws]).toEqual([2, 1, 1, 0]);

    const nuke = p.byMap.find((m) => m.mapName === 'de_nuke')!;
    expect([nuke.wins, nuke.losses, nuke.draws]).toEqual([0, 0, 1]);
  });

  it('o dano por arma respeita o nome grosso do evento de dano', async () => {
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7 });

    await db.exec(
      `INSERT INTO kills (kill_id, match_id, round_num, tick, attacker_steam_id, victim_steam_id,
                          weapon, headshot, distance)
       VALUES (1, 'm1', 1, 100, ?, ?, 'usp_silencer', TRUE, 10),
              (2, 'm1', 1, 200, ?, ?, 'ak47', FALSE, 20)`,
      [ME, OTHER, ME, OTHER],
    );
    await db.exec(
      `INSERT INTO damages (damage_id, match_id, round_num, tick, attacker_steam_id,
                            victim_steam_id, weapon, dmg_health, is_utility, is_team_damage)
       VALUES (1, 'm1', 1, 100, ?, ?, 'hkp2000', 100, FALSE, FALSE),
              (2, 'm1', 1, 200, ?, ?, 'ak47', 100, FALSE, FALSE),
              (3, 'm1', 1, 250, ?, ?, 'hkp2000', 40, FALSE, FALSE)`,
      [ME, OTHER, ME, OTHER, ME, OTHER],
    );

    const p = await getPlayerProfile(db, ME, 10, settings);
    const usp = p.byWeapon.find((w) => w.weapon === 'usp_silencer')!;

    expect(usp.damage).toBe(140);
    expect(p.byWeapon.find((w) => w.weapon === 'ak47')!.damage).toBe(100);
  });

  it('quando duas armas caem no mesmo nome de dano, o dano fica nulo', async () => {
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7 });
    await db.exec(
      `INSERT INTO kills (kill_id, match_id, round_num, tick, attacker_steam_id, victim_steam_id,
                          weapon, headshot, distance)
       VALUES (1, 'm1', 1, 100, ?, ?, 'm4a1', FALSE, 10),
              (2, 'm1', 1, 200, ?, ?, 'm4a1_silencer', FALSE, 20)`,
      [ME, OTHER, ME, OTHER],
    );
    await db.exec(
      `INSERT INTO damages (damage_id, match_id, round_num, tick, attacker_steam_id,
                            victim_steam_id, weapon, dmg_health, is_utility, is_team_damage)
       VALUES (1, 'm1', 1, 100, ?, ?, 'm4a1', 100, FALSE, FALSE),
              (2, 'm1', 1, 200, ?, ?, 'm4a1', 100, FALSE, FALSE)`,
      [ME, OTHER, ME, OTHER],
    );

    const p = await getPlayerProfile(db, ME, 10, settings);

    expect(p.byWeapon.every((w) => w.damage === null)).toBe(true);
    expect(p.byWeapon.map((w) => w.kills)).toEqual([1, 1]);
  });

  it('o nome e o mais recente, e os apelidos antigos continuam listados', async () => {
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7, name: 'nick velho' });
    await seedMatch({ id: 'm2', day: 20, map: 'de_mirage', won: 9, lost: 7, name: 'nick novo' });

    const p = await getPlayerProfile(db, ME, 10, settings);
    expect(p.name).toBe('nick novo');
    expect(p.aliases).toEqual(['nick velho']);
    expect(p.matches).toBe(2);
  });

  it('o seletor poe voce na frente, e ignora quem so existe em partida apagada', async () => {
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7 });
    await db.exec(
      `INSERT INTO players (steam_id, last_known_name, matches_count) VALUES (?, 'fantasma', 9)`,
      ['76561198000000003'],
    );
    await db.exec(
      `INSERT INTO players (steam_id, last_known_name, matches_count) VALUES (?, 'ele', 1)`,
      [OTHER],
    );

    const list = await listPlayers(db, settings, { query: '', limit: 60 });
    expect(list[0]!.steamId).toBe(ME);
    expect(list[0]!.isUser).toBe(true);

    expect(list.map((p) => p.steamId)).not.toContain('76561198000000003');
  });

  it('a busca aceita nome e SteamID', async () => {
    await seedMatch({ id: 'm1', day: 10, map: 'de_mirage', won: 9, lost: 7, name: 'jorge' });
    expect((await listPlayers(db, settings, { query: 'JOR', limit: 60 })).length).toBe(1);
    expect((await listPlayers(db, settings, { query: ME.slice(-6), limit: 60 })).length).toBe(1);
    expect((await listPlayers(db, settings, { query: 'ninguem', limit: 60 })).length).toBe(0);
  });
});
