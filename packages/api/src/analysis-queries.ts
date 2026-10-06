import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCURATE_SPEED_FRACTION,
  C4_TIMER_REFERENCE_SECONDS,
  summarizeAccuracy,
  summarizeBomb,
  breakPoints,
  buyConversion,
  economicImpact,
  forceBuyCosts,
  LOSS_BONUS_STEPS,
  lossBonusSeries,
  type BuyRound,
  type EconKill,
  type EconPlayerRound,
  type Side,
  FACING_AWAY_DEGREES,
  fireStats,
  flashDepth,
  heStats,
  smokeStats,
  throwOutcomes,
  EMPTY_OUTCOME,
  type GrenadeRef,
  DEFAULT_TRADE_WINDOW_SECONDS,
  EFFECTIVE_BLIND_SECONDS,
  TEAM_FLASH_PENALTY,
  CALIBRATED_PUNCH_MODEL,
} from '@cs2/core';
import { parseMapMeta, worldToRadarPercent, type MapMeta } from '@cs2/radar';
import { ensureRoundStats, getRoundsAnalysis, getTradeChains } from './round-flow-queries.js';
import { ensureRoster } from './roster-queries.js';
import { getRatingAnalysis } from './rating-queries.js';
import type { Db } from '@cs2/db';
import type { BuyType, DeepEconomy, MatchAnalysis, UtilityAnalysis, UtilityThrow } from '@cs2/contract';

export const HEATMAP_GRID = 64;

export interface Identity {
  name: string;
  teamName: string | null;
}

async function loadIdentity(db: Db, matchId: string): Promise<Map<string, Identity>> {
  const rows = await db.query<{ steam_id: string; name: string; team_name: string | null }>(
    'SELECT steam_id, name, team_name FROM player_match WHERE match_id = ?',
    [matchId],
  );
  return new Map(rows.map((r) => [r.steam_id, { name: r.name, teamName: r.team_name }]));
}

export function named<T extends { steamId: string }>(
  who: Map<string, Identity>,
  row: T,
): T & Identity {
  const id = who.get(row.steamId);
  return { ...row, name: id?.name ?? row.steamId, teamName: id?.teamName ?? null };
}

export async function getMatchAnalysis(
  db: Db,
  matchId: string,

  mapsDir?: string,
): Promise<MatchAnalysis> {
  const match = await db.queryOne<{
    map_name: string; has_radar: boolean; tick_rate: number;
    c4_timer_seconds: number | null; c4_timer_source: string | null;
    team_a_name: string | null; team_b_name: string | null;
  }>(
    `SELECT map_name, has_radar, tick_rate, c4_timer_seconds, c4_timer_source,
            team_a_name, team_b_name
       FROM matches WHERE match_id = ?`,
    [matchId],
  );
  if (!match) throw new Error(`Partida nao encontrada: ${matchId}`);

  await ensureRoster(db);

  await ensureRoundStats(db);

  const who = await loadIdentity(db, matchId);

  const [economy, heatmap, duels, aim, accuracy, rounds, bomb, flashes, utility, rating] = await Promise.all([
    economyAnalysis(db, matchId, who),
    heatmapAnalysis(db, matchId, who),
    duelAnalysis(db, matchId, Number(match.tick_rate ?? 64), who),
    aimAnalysis(db, matchId, who),
    accuracyAnalysis(db, matchId, Number(match.tick_rate ?? 64), who),
    roundsAnalysis(db, matchId, who),
    bombAnalysis(db, matchId, {
      tickRate: Number(match.tick_rate ?? 64),
      c4TimerSeconds: Number(match.c4_timer_seconds ?? C4_TIMER_REFERENCE_SECONDS),
      c4TimerSource: match.c4_timer_source === 'measured' ? 'measured' : 'reference',
      meta: mapsDir ? loadMapMeta(mapsDir, match.map_name) : null,
    }),
    flashAnalysis(db, matchId, who),
    utilityAnalysis(db, matchId, {
      tickRate: Number(match.tick_rate ?? 64),
      meta: mapsDir ? loadMapMeta(mapsDir, match.map_name) : null,
    }),
    getRatingAnalysis(db, matchId),
  ]);

  return {
    matchId,
    mapName: match.map_name,
    hasRadar: match.has_radar,
    teams: { a: match.team_a_name, b: match.team_b_name },
    economy,
    heatmap,
    duels,
    aim,
    accuracy,
    rounds,
    bomb,
    flashes,
    utility,
    rating,
  };
}

const metaCache = new Map<string, MapMeta | null>();
function loadMapMeta(mapsDir: string, mapName: string): MapMeta | null {
  if (metaCache.has(mapName)) return metaCache.get(mapName) ?? null;
  let meta: MapMeta | null = null;
  try {
    meta = parseMapMeta(mapName, readFileSync(join(mapsDir, mapName, 'meta.json5'), 'utf8'));
  } catch {
    meta = null;
  }
  metaCache.set(mapName, meta);
  return meta;
}

async function economyAnalysis(db: Db, matchId: string, who: Map<string, Identity>) {
  const rounds = await db.query<{
    round_num: number; ct_equip_value: number | null; t_equip_value: number | null;
    ct_buy_type: string | null; t_buy_type: string | null; winner_side: string | null;
    half: number | null;
  }>(
    `SELECT round_num, ct_equip_value, t_equip_value, ct_buy_type, t_buy_type, winner_side, half
       FROM rounds WHERE match_id = ? AND phase = 'live' ORDER BY round_num`,
    [matchId],
  );

  const matchups = new Map<string, { rounds: number; won: number }>();
  for (const r of rounds) {
    if (!r.ct_buy_type || !r.t_buy_type) continue;
    for (const [side, mine, theirs] of [
      ['CT', r.ct_buy_type, r.t_buy_type],
      ['T', r.t_buy_type, r.ct_buy_type],
    ] as const) {
      const key = `${mine}|${theirs}`;
      const cur = matchups.get(key) ?? { rounds: 0, won: 0 };
      cur.rounds++;
      if (r.winner_side === side) cur.won++;
      matchups.set(key, cur);
    }
  }

  const damagePerThousand = await db.query<{
    steam_id: string; damage: number; spent: number;
  }>(
    `SELECT e.steam_id,
            COALESCE(SUM(s.damage), 0)::INTEGER AS damage,
            SUM(e.spent)::INTEGER AS spent
       FROM economy e
       LEFT JOIN player_round_stats s
              ON s.match_id = e.match_id AND s.round_num = e.round_num
             AND s.steam_id = e.steam_id
      WHERE e.match_id = ?
      GROUP BY e.steam_id
      ORDER BY damage DESC`,
    [matchId],
  );

  return {
    rounds: rounds.map((r) => ({
      roundNum: Number(r.round_num),
      ctEquipValue: r.ct_equip_value,
      tEquipValue: r.t_equip_value,
      ctBuyType: (r.ct_buy_type as BuyType | null) ?? null,
      tBuyType: (r.t_buy_type as BuyType | null) ?? null,
      winnerSide: (r.winner_side as 'CT' | 'T' | null) ?? null,
    })),
    matchups: [...matchups.entries()].map(([key, v]) => {
      const [buyType, enemyBuyType] = key.split('|');
      return {
        buyType: buyType as BuyType,
        enemyBuyType: enemyBuyType as BuyType,
        rounds: v.rounds,
        won: v.won,
      };
    }),
    damagePerThousand: damagePerThousand.map((d) => ({
      ...named(who, { steamId: d.steam_id }),
      damage: Number(d.damage),
      spent: Number(d.spent),
      perThousand: Number(d.spent) > 0 ? (Number(d.damage) / Number(d.spent)) * 1000 : null,
    })),
    deep: await deepEconomy(db, matchId, rounds.map((r) => ({
      roundNum: Number(r.round_num),
      half: r.half === null ? null : Number(r.half),
      winnerSide: (r.winner_side as Side | null) ?? null,
      ctBuyType: (r.ct_buy_type as BuyRound['ctBuyType']) ?? null,
      tBuyType: (r.t_buy_type as BuyRound['tBuyType']) ?? null,
    }))),
  };
}

async function deepEconomy(db: Db, matchId: string, rounds: BuyRound[]): Promise<DeepEconomy> {
  const econRows = await db.query<{
    round_num: number; steam_id: string; side: string | null;
    start_balance: number | null; spent: number | null; equip_value: number | null;
    survived: boolean | null; name: string | null; team_name: string | null;
  }>(
    `SELECT e.round_num, e.steam_id, e.side, e.start_balance, e.spent, e.equip_value,
            s.survived, pm.name, pm.team_name
       FROM economy e
       LEFT JOIN player_round_stats s
              ON s.match_id = e.match_id AND s.round_num = e.round_num AND s.steam_id = e.steam_id
       LEFT JOIN player_match pm ON pm.match_id = e.match_id AND pm.steam_id = e.steam_id
      WHERE e.match_id = ?`,
    [matchId],
  );

  const killRows = await db.query<{
    round_num: number; victim_steam_id: string | null;
    attacker_steam_id: string | null; attacker_side: string | null;
  }>(
    `SELECT round_num, victim_steam_id, attacker_steam_id, attacker_side
       FROM kills WHERE match_id = ? AND round_num IS NOT NULL`,
    [matchId],
  );

  const players: EconPlayerRound[] = econRows.map((e) => ({
    roundNum: Number(e.round_num),
    steamId: e.steam_id,
    side: (e.side as Side | null) ?? null,
    startBalance: Number(e.start_balance ?? 0),
    spent: Number(e.spent ?? 0),
    equipValue: Number(e.equip_value ?? 0),
    survived: e.survived === true,
  }));

  const kills: EconKill[] = killRows
    .filter((k) => k.victim_steam_id)
    .map((k) => ({
      roundNum: Number(k.round_num),
      victimSteamId: k.victim_steam_id!,
      attackerSteamId: k.attacker_steam_id,
      attackerSide: (k.attacker_side as Side | null) ?? null,
    }));

  const teamBuyType = rounds.flatMap((r) => [
    { roundNum: r.roundNum, side: 'CT' as Side, buyType: r.ctBuyType },
    { roundNum: r.roundNum, side: 'T' as Side, buyType: r.tBuyType },
  ]);

  const impact = economicImpact({ players, kills, teamBuyType });
  const bonus = new Map(lossBonusSeries(rounds).map((b) => [b.roundNum, b]));
  const breaks = new Set(breakPoints(rounds).map((b) => `${b.roundNum}|${b.side}`));

  const money = new Map<string, number>();
  for (const p of players) {
    if (!p.side) continue;
    const key = `${p.roundNum}|${p.side}`;
    money.set(key, (money.get(key) ?? 0) + p.startBalance);
  }

  const identity = new Map(econRows.map((e) => [e.steam_id, {
    name: e.name ?? e.steam_id,
    teamName: e.team_name ?? null,
  }]));

  return {
    rounds: rounds.map((r) => {
      const b = bonus.get(r.roundNum);
      return {
        roundNum: r.roundNum,
        half: r.half,
        ctMoney: money.get(`${r.roundNum}|CT`) ?? 0,
        tMoney: money.get(`${r.roundNum}|T`) ?? 0,
        ctLossBonus: b?.ct ?? 0,
        tLossBonus: b?.t ?? 0,
        ctLossStep: b?.ctStep ?? 0,
        tLossStep: b?.tStep ?? 0,
        ctBreak: breaks.has(`${r.roundNum}|CT`),
        tBreak: breaks.has(`${r.roundNum}|T`),
      };
    }),
    lossBonusSteps: [...LOSS_BONUS_STEPS],
    conversion: buyConversion(rounds).map((c) => ({ ...c, buyType: c.buyType as BuyType })),
    forceBuys: forceBuyCosts(rounds),
    bySide: impact.bySide,
    byPlayer: impact.byPlayer
      .map((p) => ({
        ...p,
        name: identity.get(p.steamId)?.name ?? p.steamId,
        teamName: identity.get(p.steamId)?.teamName ?? null,
      }))
      .sort((a, b) => b.equipDestroyed - a.equipDestroyed),
  };
}

function grenadeKind(type: string | null): UtilityThrow['kind'] | null {
  const t = (type ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (t.startsWith('smoke')) return 'smoke';
  if (t.startsWith('flash')) return 'flash';
  if (t.startsWith('molotov') || t.startsWith('inc') || t.startsWith('fire')) return 'fire';
  if (t.startsWith('he') || t.startsWith('high')) return 'he';
  if (t.startsWith('decoy')) return 'decoy';
  return null;
}

async function utilityAnalysis(
  db: Db,
  matchId: string,
  options: { tickRate: number; meta: MapMeta | null },
): Promise<UtilityAnalysis> {
  const grenadeRows = await db.query<{
    grenade_id: number; round_num: number | null; thrower_steam_id: string | null;
    grenade_type: string | null; throw_tick: number | null; detonate_tick: number | null;
    throw_x: number | null; throw_y: number | null; throw_z: number | null;
    detonate_x: number | null; detonate_y: number | null; detonate_z: number | null;
    side: string | null;
  }>(
    `SELECT g.grenade_id, g.round_num, g.thrower_steam_id, g.grenade_type,
            g.throw_tick, g.detonate_tick,
            g.throw_x, g.throw_y, g.throw_z, g.detonate_x, g.detonate_y, g.detonate_z,
            e.side
       FROM grenades g
       LEFT JOIN economy e
              ON e.match_id = g.match_id AND e.round_num = g.round_num
             AND e.steam_id = g.thrower_steam_id
      WHERE g.match_id = ? AND g.round_num IS NOT NULL
      ORDER BY g.round_num, g.throw_tick`,
    [matchId],
  );

  const grenades: GrenadeRef[] = grenadeRows.map((g) => ({
    grenadeId: Number(g.grenade_id),
    roundNum: Number(g.round_num),
    throwerSteamId: g.thrower_steam_id,
    type: g.grenade_type ?? '',
    throwTick: g.throw_tick === null ? null : Number(g.throw_tick),
    detonateTick: g.detonate_tick === null ? null : Number(g.detonate_tick),
  }));

  const damages = (await db.query<{
    round_num: number; tick: number; attacker_steam_id: string | null;
    victim_steam_id: string | null; weapon: string | null;
    dmg_health: number | null; is_team_damage: boolean | null;
  }>(
    `SELECT round_num, tick, attacker_steam_id, victim_steam_id, weapon, dmg_health, is_team_damage
       FROM damages WHERE match_id = ? AND is_utility = TRUE AND round_num IS NOT NULL`,
    [matchId],
  )).map((d) => ({
    roundNum: Number(d.round_num),
    tick: Number(d.tick),
    attackerSteamId: d.attacker_steam_id,
    victimSteamId: d.victim_steam_id,
    weapon: d.weapon,
    damage: Number(d.dmg_health ?? 0),
    isTeamDamage: d.is_team_damage === true,
  }));

  const killRows = await db.query<{
    round_num: number; tick: number; attacker_steam_id: string | null;
    victim_steam_id: string | null; weapon: string | null;
    thru_smoke: boolean | null; assisted_flash: boolean | null;
    assister_steam_id: string | null;
  }>(
    `SELECT round_num, tick, attacker_steam_id, victim_steam_id, weapon,
            thru_smoke, assisted_flash, assister_steam_id
       FROM kills WHERE match_id = ? AND round_num IS NOT NULL`,
    [matchId],
  );

  const kills = killRows.map((k) => ({
    roundNum: Number(k.round_num),
    tick: Number(k.tick),
    attackerSteamId: k.attacker_steam_id,
    victimSteamId: k.victim_steam_id,
    weapon: k.weapon,
  }));

  const blindRows = await db.query<{
    round_num: number; tick: number; thrower_steam_id: string | null;
    victim_steam_id: string | null; blind_duration: number | null;
    is_team_flash: boolean | null; effective: boolean | null; facing_away: boolean | null;
    flash_distance: number | null;
  }>(
    `SELECT round_num, tick, thrower_steam_id, victim_steam_id, blind_duration,
            is_team_flash, effective, facing_away, flash_distance
       FROM blinds WHERE match_id = ? AND round_num IS NOT NULL`,
    [matchId],
  );

  const roundStartTicks = new Map<number, number>();
  for (const r of await db.query<{ round_num: number; from_tick: number | null }>(
    `SELECT round_num, COALESCE(freeze_end_tick, start_tick) AS from_tick
       FROM rounds WHERE match_id = ? AND phase = 'live'`,
    [matchId],
  )) {
    if (r.from_tick !== null) roundStartTicks.set(Number(r.round_num), Number(r.from_tick));
  }

  const blinds = blindRows.map((b) => ({
    roundNum: Number(b.round_num),
    tick: Number(b.tick),
    throwerSteamId: b.thrower_steam_id,
    victimSteamId: b.victim_steam_id,
    duration: Number(b.blind_duration ?? 0),
    isTeamFlash: b.is_team_flash === true,
    effective: b.effective === true,
    facingAway: b.facing_away === null ? null : b.facing_away === true,
    distance: b.flash_distance === null ? null : Number(b.flash_distance),
  }));

  const he = heStats({ grenades, damages });
  const fire = fireStats({ grenades, damages, kills });
  const smoke = smokeStats({
    grenades,
    roundStartTicks,
    tickRate: options.tickRate,
    killsThroughSmoke: killRows
      .filter((k) => k.thru_smoke === true)
      .map((k) => ({ roundNum: Number(k.round_num), attackerSteamId: k.attacker_steam_id })),
  });
  const flash = flashDepth({
    grenades,
    tickRate: options.tickRate,
    blinds,
    flashAssists: killRows
      .filter((k) => k.assisted_flash === true)
      .map((k) => ({ roundNum: Number(k.round_num), flasherSteamId: k.assister_steam_id })),
  });

  const unused = await db.query<{
    steam_id: string; value: number | null; count: number | null;
    deaths: number; filled: number;
  }>(
    `SELECT steam_id,
            SUM(COALESCE(unused_utility_value, 0))::INTEGER AS value,
            SUM(COALESCE(unused_utility_count, 0))::INTEGER AS count,
            SUM(CASE WHEN survived THEN 0 ELSE 1 END)::INTEGER AS deaths,
            SUM(CASE WHEN unused_utility_value IS NULL THEN 0 ELSE 1 END)::INTEGER AS filled
       FROM player_round_stats WHERE match_id = ? GROUP BY steam_id`,
    [matchId],
  );

  const identity = await db.query<{ steam_id: string; name: string; team_name: string | null }>(
    'SELECT steam_id, name, team_name FROM player_match WHERE match_id = ?',
    [matchId],
  );

  const byId = <T extends { steamId: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.steamId, r]));
  const heBy = byId(he.byPlayer);
  const fireBy = byId(fire.byPlayer);
  const smokeBy = byId(smoke.byPlayer);
  const flashBy = byId(flash.byPlayer);
  const unusedBy = new Map(unused.map((u) => [u.steam_id, u]));

  const players = identity.map((p) => {
    const h = heBy.get(p.steam_id);
    const f = fireBy.get(p.steam_id);
    const s = smokeBy.get(p.steam_id);
    const fl = flashBy.get(p.steam_id);
    const u = unusedBy.get(p.steam_id);
    return {
      steamId: p.steam_id,
      name: p.name,
      teamName: p.team_name,
      he: {
        grenades: h?.grenades ?? 0, damage: h?.damage ?? 0, enemiesHit: h?.enemiesHit ?? 0,
        bestMultiHit: h?.bestMultiHit ?? 0, teamDamage: h?.teamDamage ?? 0,
      },
      fire: {
        grenades: f?.grenades ?? 0, damage: f?.damage ?? 0, enemiesHit: f?.enemiesHit ?? 0,
        kills: f?.kills ?? 0, teamDamage: f?.teamDamage ?? 0,
      },
      smoke: {
        smokes: s?.smokes ?? 0,
        medianSecondsIntoRound: s?.medianSecondsIntoRound ?? null,
        killsThroughSmoke: s?.killsThroughSmoke ?? 0,
      },
      flash: {
        flashes: fl?.flashes ?? 0, effectiveBlinds: fl?.effectiveBlinds ?? 0,
        teamFlashes: fl?.teamFlashes ?? 0, flashAssists: fl?.flashAssists ?? 0,
        blindedFacingAway: fl?.blindedFacingAway ?? 0,
        medianDistance: fl?.medianDistance ?? null,
      },
      unusedUtility: {
        value: Number(u?.value ?? 0),
        count: Number(u?.count ?? 0),
        deaths: Number(u?.deaths ?? 0),
      },
    };
  });

  const meta = options.meta;
  const point = (x: number | null, y: number | null, z: number | null) => {
    if (!meta || x === null || y === null) return { px: null, py: null, split: 0 };
    const p = worldToRadarPercent({ x: Number(x), y: Number(y), z: Number(z ?? 0) }, meta);
    return { px: p.px, py: p.py, split: p.split };
  };

  const outcomes = throwOutcomes({ grenades, damages, blinds });

  const throws: UtilityThrow[] = [];
  for (const g of grenadeRows) {
    const kind = grenadeKind(g.grenade_type);
    if (!kind) continue;
    const from = point(g.throw_x, g.throw_y, g.throw_z);
    const to = point(g.detonate_x, g.detonate_y, g.detonate_z);
    const outcome = outcomes.byGrenade.get(Number(g.grenade_id)) ?? EMPTY_OUTCOME;
    throws.push({
      grenadeId: Number(g.grenade_id),
      roundNum: Number(g.round_num),
      steamId: g.thrower_steam_id,
      kind,
      side: (g.side as 'CT' | 'T' | null) ?? null,
      throwPx: from.px, throwPy: from.py,
      detPx: to.px, detPy: to.py,
      split: to.split || from.split,
      damage: outcome.damage,
      enemiesHit: outcome.enemiesHit,
      enemiesBlinded: outcome.enemiesBlinded,
      blindSeconds: outcome.blindSeconds,
      bestBlindSeconds: outcome.bestBlindSeconds,
    });
  }

  return {
    players,
    throws,
    facingAwayDegrees: FACING_AWAY_DEGREES,
    hasDeepData: unused.some((u) => Number(u.filled) > 0),
    unattributedDamage: outcomes.unattributedDamage,
    unattributedBlindSeconds: outcomes.unattributedBlindSeconds,
  };
}

async function heatmapAnalysis(db: Db, matchId: string, who: Map<string, Identity>) {

  const rows = await db.query<{
    kind: string; bin_x: number; bin_y: number; bin_split: number;
    steam_id: string | null; side: string | null; count: number;
  }>(
    `SELECT kind, bin_x, bin_y, bin_split, steam_id, side, SUM(count)::INTEGER AS count
       FROM heatmap_bins WHERE match_id = ?
      GROUP BY kind, bin_x, bin_y, bin_split, steam_id, side`,
    [matchId],
  );

  const pick = (kind: string) =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => ({
        binX: Number(r.bin_x),
        binY: Number(r.bin_y),
        split: Number(r.bin_split),
        count: Number(r.count),
        steamId: r.steam_id,
        side: (r.side as 'CT' | 'T' | null) ?? null,
      }));

  const deaths = pick('death');
  const kills = pick('kill');

  const total = new Map<string, number>();
  for (const d of deaths) {
    const key = `${d.binX}|${d.binY}|${d.split}`;
    total.set(key, (total.get(key) ?? 0) + d.count);
  }
  const maxCount = Math.max(1, ...total.values());

  const players = await db.query<{ steam_id: string }>(
    `SELECT DISTINCT steam_id FROM heatmap_bins
      WHERE match_id = ? AND steam_id IS NOT NULL`,
    [matchId],
  );

  return {
    gridSize: HEATMAP_GRID,
    deaths,
    kills,
    maxCount,
    players: players
      .map((p) => named(who, { steamId: p.steam_id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function bombAnalysis(
  db: Db,
  matchId: string,
  ctx: { tickRate: number; c4TimerSeconds: number; c4TimerSource: 'measured' | 'reference'; meta: MapMeta | null },
) {
  const rounds = await db.query<{
    round_num: number; plant_site: string | null;
    bomb_plant_tick: number | null; bomb_defuse_tick: number | null;
    bomb_explode_tick: number | null; freeze_end_tick: number | null;
    winner_side: string | null;
  }>(
    `SELECT round_num, plant_site, bomb_plant_tick, bomb_defuse_tick, bomb_explode_tick,
            freeze_end_tick, winner_side
       FROM rounds
      WHERE match_id = ? AND phase = 'live' AND bomb_plant_tick IS NOT NULL
      ORDER BY round_num`,
    [matchId],
  );

  const kitOf = new Map<number, boolean | null>();
  for (const e of await db.query<{ round_num: number; has_kit: boolean | null }>(
    `SELECT round_num, has_kit FROM bomb_events
      WHERE match_id = ? AND event_type = 'begindefuse' AND round_num IS NOT NULL
      ORDER BY tick`,
    [matchId],
  )) {
    kitOf.set(Number(e.round_num), e.has_kit);
  }

  const summary = summarizeBomb(
    rounds.map((r) => ({
      roundNum: Number(r.round_num),
      site: (r.plant_site as 'A' | 'B' | null) ?? null,
      plantTick: r.bomb_plant_tick === null ? null : Number(r.bomb_plant_tick),
      defuseTick: r.bomb_defuse_tick === null ? null : Number(r.bomb_defuse_tick),
      explodeTick: r.bomb_explode_tick === null ? null : Number(r.bomb_explode_tick),
      freezeEndTick: r.freeze_end_tick === null ? null : Number(r.freeze_end_tick),
      winnerSide: (r.winner_side as 'CT' | 'T' | null) ?? null,
      defuseWithKit: kitOf.get(Number(r.round_num)) ?? null,
    })),
    ctx.tickRate,
    ctx.c4TimerSeconds,
  );

  const points: { roundNum: number; site: 'A' | 'B' | null; px: number; py: number; split: number;
    outcome: 'defused' | 'exploded' | 'unknown' }[] = [];
  if (ctx.meta) {
    const outcome = new Map<number, 'defused' | 'exploded' | 'unknown'>();
    for (const r of rounds) {
      outcome.set(
        Number(r.round_num),
        r.bomb_defuse_tick !== null ? 'defused' : r.bomb_explode_tick !== null ? 'exploded' : 'unknown',
      );
    }
    for (const p of await db.query<{
      round_num: number; site: string | null; x: number | null; y: number | null; z: number | null;
    }>(
      `SELECT round_num, site, x, y, z FROM bomb_events
        WHERE match_id = ? AND event_type = 'planted' AND round_num IS NOT NULL
          AND x IS NOT NULL`,
      [matchId],
    )) {
      const at = worldToRadarPercent(
        { x: Number(p.x), y: Number(p.y), z: Number(p.z ?? 0) },
        ctx.meta,
      );
      points.push({
        roundNum: Number(p.round_num),
        site: (p.site as 'A' | 'B' | null) ?? null,
        px: at.px,
        py: at.py,
        split: at.split,
        outcome: outcome.get(Number(p.round_num)) ?? 'unknown',
      });
    }
  }

  const postPlant = await db.query<{ side: string | null; deaths: number }>(
    `SELECT k.victim_side AS side, COUNT(*)::INTEGER AS deaths
       FROM kills k
       JOIN rounds r ON r.match_id = k.match_id AND r.round_num = k.round_num
      WHERE k.match_id = ? AND r.phase = 'live'
        AND r.bomb_plant_tick IS NOT NULL AND k.tick >= r.bomb_plant_tick
        AND k.victim_side IS NOT NULL
      GROUP BY k.victim_side`,
    [matchId],
  );

  return {
    ...summary,
    c4TimerSeconds: ctx.c4TimerSeconds,
    c4TimerSource: ctx.c4TimerSource,
    points,
    postPlantDeaths: postPlant.map((p) => ({
      side: p.side as 'CT' | 'T',
      deaths: Number(p.deaths),
    })),
  };
}

async function duelAnalysis(db: Db, matchId: string, tickRate: number, who: Map<string, Identity>) {
  const players = await db.query<{
    steam_id: string; name: string; team_name: string | null;
    opening_kills: number; opening_deaths: number;
    trade_kills: number; traded_deaths: number; deaths: number;
  }>(
    `SELECT steam_id, name, team_name, opening_kills, opening_deaths,
            trade_kills, traded_deaths, deaths
       FROM player_match WHERE match_id = ?
      ORDER BY opening_kills DESC, name`,
    [matchId],
  );

  const chains = await getTradeChains(db, matchId, tickRate);

  return {
    tradeWindowSeconds: DEFAULT_TRADE_WINDOW_SECONDS,
    trades: chains.map((c) => named(who, c)),
    players: players.map((p) => {
      const attempts = Number(p.opening_kills) + Number(p.opening_deaths);
      const deaths = Number(p.deaths);
      return {
        steamId: p.steam_id,
        name: p.name,
        teamName: p.team_name,
        entryKills: Number(p.opening_kills),
        entryDeaths: Number(p.opening_deaths),
        entrySuccess: attempts > 0 ? Number(p.opening_kills) / attempts : null,
        tradeKills: Number(p.trade_kills),
        tradedDeaths: Number(p.traded_deaths),
        deaths,
        tradedDeathRate: deaths > 0 ? Number(p.traded_deaths) / deaths : null,
      };
    }),
  };
}

async function aimAnalysis(db: Db, matchId: string, who: Map<string, Identity>) {
  const players = await db.query<{
    steam_id: string; duels: number;
    preaim: number | null; preaim_pitch: number | null;
    firstshot: number | null; distance: number | null;
  }>(
    `SELECT e.player_steam_id AS steam_id,
            COUNT(*)::INTEGER AS duels,
            MEDIAN(e.preaim_total_deg) AS preaim,
            MEDIAN(e.preaim_pitch_deg) AS preaim_pitch,
            MEDIAN(e.firstshot_total_deg) AS firstshot,
            MEDIAN(e.distance) AS distance
       FROM engagements e
      WHERE e.match_id = ? AND e.player_steam_id IS NOT NULL
      GROUP BY e.player_steam_id
      ORDER BY preaim`,
    [matchId],
  );

  return {
    punchModel: CALIBRATED_PUNCH_MODEL,
    calibrationMedianDeg: 1.07,
    players: players.map((p) => {
      const preaim = p.preaim === null ? null : Number(p.preaim);
      const distance = p.distance === null ? null : Number(p.distance);
      return {
        ...named(who, { steamId: p.steam_id }),
        duels: Number(p.duels),
        preaimMedianDeg: preaim,
        preaimPitchMedianDeg: p.preaim_pitch === null ? null : Number(p.preaim_pitch),
        firstShotMedianDeg: p.firstshot === null ? null : Number(p.firstshot),

        medianMissUnits:
          preaim !== null && distance !== null
            ? distance * Math.tan((preaim * Math.PI) / 180)
            : null,
      };
    }),
  };
}

async function accuracyAnalysis(db: Db, matchId: string, tickRate: number, who: Map<string, Identity>) {
  const shots = await db.query<{
    steam_id: string | null; weapon: string | null; tick: number;
    speed: number | null; is_scoped: boolean | null;
  }>(
    `SELECT steam_id, weapon, tick, speed, is_scoped
       FROM weapon_fires
      WHERE match_id = ? AND round_num IS NOT NULL AND steam_id IS NOT NULL
      ORDER BY tick`,
    [matchId],
  );

  const hits = await db.query<{
    attacker_steam_id: string | null; victim_steam_id: string | null;
    tick: number; dmg_health: number | null; hitgroup: string | null;
  }>(
    `SELECT attacker_steam_id, victim_steam_id, tick, dmg_health, hitgroup
       FROM damages
      WHERE match_id = ? AND round_num IS NOT NULL
        AND NOT is_utility AND NOT is_team_damage
        AND attacker_steam_id IS NOT NULL`,
    [matchId],
  );

  const summary = summarizeAccuracy(
    shots
      .filter((s) => s.steam_id !== null && s.weapon !== null)
      .map((s) => ({
        steamId: s.steam_id!,
        weapon: s.weapon!,
        tick: Number(s.tick),
        speed: s.speed === null ? null : Number(s.speed),
        isScoped: s.is_scoped,
      })),
    hits.map((h) => ({
      attackerSteamId: h.attacker_steam_id!,
      victimSteamId: h.victim_steam_id ?? '',
      tick: Number(h.tick),
      damage: Number(h.dmg_health ?? 0),
      hitgroup: h.hitgroup,
    })),
    tickRate,
  );

  return {
    players: summary.players.map((p) => named(who, p)),
    byWeapon: summary.byWeapon,
    hasShotData: summary.hasShotData,
    accurateSpeedFraction: ACCURATE_SPEED_FRACTION,
  };
}

async function roundsAnalysis(db: Db, matchId: string, who: Map<string, Identity>) {
  const flow = await getRoundsAnalysis(db, matchId);

  return {
    clutches: flow.clutches.map((c) => named(who, c)),
    advantages: flow.advantages,
    multikills: flow.multikills.map((m) => named(who, m)),
    kast: flow.kast.map((k) => named(who, k)),
    opening: flow.opening,
    rounds: flow.rounds.length,
  };
}

async function flashAnalysis(db: Db, matchId: string, who: Map<string, Identity>) {
  const players = await db.query<{
    steam_id: string; thrown: number;
    enemies: number; effective: number; teammates: number;
    enemy_seconds: number; team_seconds: number;
  }>(
    `SELECT b.thrower_steam_id AS steam_id,
            COUNT(DISTINCT b.tick)::INTEGER AS thrown,
            SUM(CASE WHEN NOT b.is_team_flash THEN 1 ELSE 0 END)::INTEGER AS enemies,
            SUM(CASE WHEN b.effective THEN 1 ELSE 0 END)::INTEGER AS effective,
            SUM(CASE WHEN b.is_team_flash THEN 1 ELSE 0 END)::INTEGER AS teammates,
            SUM(CASE WHEN NOT b.is_team_flash THEN b.blind_duration ELSE 0 END) AS enemy_seconds,
            SUM(CASE WHEN b.is_team_flash THEN b.blind_duration ELSE 0 END) AS team_seconds
       FROM blinds b
       JOIN player_match pm
         ON pm.match_id = b.match_id AND pm.steam_id = b.thrower_steam_id
      WHERE b.match_id = ? AND b.round_num IS NOT NULL
      GROUP BY b.thrower_steam_id
      ORDER BY effective DESC`,
    [matchId],
  );

  return {
    effectiveThresholdSeconds: EFFECTIVE_BLIND_SECONDS,
    teamFlashPenalty: TEAM_FLASH_PENALTY,
    players: players.map((p) => {
      const enemySeconds = Number(p.enemy_seconds ?? 0);
      const teamSeconds = Number(p.team_seconds ?? 0);
      return {
        ...named(who, { steamId: p.steam_id }),
        thrown: Number(p.thrown),
        enemiesFlashed: Number(p.enemies),
        effectiveFlashes: Number(p.effective),
        teammatesFlashed: Number(p.teammates),
        enemyBlindSeconds: enemySeconds,
        teamBlindSeconds: teamSeconds,
        netValueSeconds: enemySeconds - TEAM_FLASH_PENALTY * teamSeconds,
      };
    }),
  };
}
