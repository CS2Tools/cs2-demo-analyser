import { RULES } from '@cs2/core';
import type {
  PlayerListItem,
  PlayerMapRow,
  PlayerMetricPoint,
  PlayerMetricSeries,
  PlayerProfile,
  PlayerTrainItem,
  PlayerWeaponRow,
  Settings,
} from '@cs2/contract';
import type { Db } from '@cs2/db';
import { ensureMetricHistory, getMatchFindings } from './findings-queries.js';

const CHRONO = 'COALESCE(m.played_at, m.ingested_at)';

const iso = (v: Date | string | null): string | null =>
  v === null || v === undefined ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();

export async function listPlayers(
  db: Db,
  settings: Pick<Settings, 'userSteamId' | 'playersOfInterest'>,
  params: { query: string; limit: number },
): Promise<PlayerListItem[]> {
  const term = params.query.trim();
  const where = term === '' ? '' : `WHERE p.last_known_name ILIKE ? OR p.steam_id LIKE ?`;
  const args = term === '' ? [] : [`%${term}%`, `%${term}%`];

  const rows = await db.query<{
    steam_id: string; name: string; matches: number;
    first_seen: Date | string | null; last_seen: Date | string | null;
  }>(
    `SELECT p.steam_id, p.last_known_name AS name,
            (SELECT COUNT(*)::INTEGER FROM player_match pm WHERE pm.steam_id = p.steam_id) AS matches,
            p.first_seen, p.last_seen
       FROM players p
       ${where}
      ORDER BY matches DESC, p.last_seen DESC
      LIMIT ?`,
    [...args, params.limit],
  );

  const colours = new Map(settings.playersOfInterest.map((p) => [p.steamId, p.colour]));
  const items = rows
    .filter((r) => Number(r.matches) > 0)
    .map((r): PlayerListItem => ({
      steamId: r.steam_id,
      name: r.name,
      matches: Number(r.matches),
      firstSeen: iso(r.first_seen),
      lastSeen: iso(r.last_seen),
      isUser: r.steam_id === settings.userSteamId,
      isPoi: colours.has(r.steam_id),
      colour: colours.get(r.steam_id) ?? null,
    }));

  const rank = (p: PlayerListItem) => (p.isUser ? 0 : p.isPoi ? 1 : 2);
  return items.sort((a, b) => rank(a) - rank(b) || b.matches - a.matches);
}

interface MatchRow {
  match_id: string;
  map_name: string;
  chrono: Date | string;
  bulk_state: string;
  team_a_name: string | null;
  team_b_name: string | null;
  name: string;
  team_name: string | null;
}

export async function getPlayerProfile(
  db: Db,
  steamId: string,
  lastMatches: number,
  settings: Pick<Settings, 'userSteamId' | 'playersOfInterest'>,
): Promise<PlayerProfile> {

  await ensureMetricHistory(db);

  const matches = await db.query<MatchRow>(
    `SELECT m.match_id, m.map_name, ${CHRONO} AS chrono, m.bulk_state,
            m.team_a_name, m.team_b_name, pm.name, pm.team_name
       FROM player_match pm
       JOIN matches m ON m.match_id = pm.match_id
      WHERE pm.steam_id = ?
      ORDER BY chrono`,
    [steamId],
  );

  if (matches.length === 0) {

    const known = await db.queryOne<{ name: string }>(
      'SELECT last_known_name AS name FROM players WHERE steam_id = ?',
      [steamId],
    );
    return {
      steamId, name: known?.name ?? steamId, aliases: [], matches: 0,
      firstSeen: null, lastSeen: null, maps: [], windowMatches: 0, prunedMatches: 0,
      series: [], train: [], byMap: [], byWeapon: [],
    };
  }

  const names = matches.map((m) => m.name).reverse();
  const aliases = [...new Set(names)];

  const profile: PlayerProfile = {
    steamId,
    name: aliases[0]!,
    aliases: aliases.slice(1),
    matches: matches.length,
    firstSeen: iso(matches[0]!.chrono),
    lastSeen: iso(matches[matches.length - 1]!.chrono),
    maps: [...new Set(matches.map((m) => m.map_name))].sort(),
    windowMatches: Math.min(lastMatches, matches.length),
    prunedMatches: matches.filter((m) => m.bulk_state === 'pruned').length,
    series: await buildSeries(db, steamId, matches),
    train: await buildTrain(db, steamId, matches.slice(-lastMatches), settings),
    byMap: await byMap(db, steamId),
    byWeapon: await byWeapon(db, steamId),
  };
  return profile;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

async function buildSeries(
  db: Db,
  steamId: string,
  matches: MatchRow[],
): Promise<PlayerMetricSeries[]> {
  const rows = await db.query<{
    metric_id: string; match_id: string; value: number; sample_n: number;
  }>(
    `SELECT metric_id, match_id, value, sample_n
       FROM player_metric_history WHERE steam_id = ?`,
    [steamId],
  );

  const byMetric = new Map<string, Map<string, { value: number; sampleN: number }>>();
  for (const r of rows) {
    const m = byMetric.get(r.metric_id) ?? new Map();
    m.set(r.match_id, { value: Number(r.value), sampleN: Number(r.sample_n) });
    byMetric.set(r.metric_id, m);
  }

  const out: PlayerMetricSeries[] = [];

  for (const rule of RULES) {
    const values = byMetric.get(rule.metricId);
    if (!values || values.size === 0) continue;

    const points: PlayerMetricPoint[] = [];
    const seen: number[] = [];
    for (const m of matches) {
      const v = values.get(m.match_id);
      if (!v) continue;
      points.push({
        matchId: m.match_id,
        mapName: m.map_name,
        playedAt: iso(m.chrono)!,
        opponent: opponentOf(m),
        value: v.value,
        sampleN: v.sampleN,
        enough: v.sampleN >= rule.minSample,
        priorMedian: seen.length > 0 ? median(seen) : null,
      });
      seen.push(v.value);
    }
    if (points.length === 0) continue;

    out.push({
      ruleId: rule.id,
      metricId: rule.metricId,
      family: rule.family,
      unit: rule.unit,
      direction: rule.direction,
      minSample: rule.minSample,
      points,
    });
  }
  return out;
}

function opponentOf(m: MatchRow): string | null {
  if (!m.team_name || !m.team_a_name || !m.team_b_name) return null;
  if (m.team_name === m.team_a_name) return m.team_b_name;
  if (m.team_name === m.team_b_name) return m.team_a_name;
  return null;
}

async function buildTrain(
  db: Db,
  steamId: string,
  window: MatchRow[],
  settings: Pick<Settings, 'userSteamId' | 'playersOfInterest'>,
): Promise<PlayerTrainItem[]> {
  if (window.length === 0) return [];

  for (const m of window) {
    await getMatchFindings(db, m.match_id, settings);
  }

  const ids = window.map((m) => m.match_id);
  const rows = await db.query<{
    match_id: string; metric_id: string; severity: string; value: number; unit: string;
  }>(
    `SELECT match_id, metric_id, severity, value, unit
       FROM match_findings
      WHERE steam_id = ?
        AND match_id IN (${ids.map(() => '?').join(', ')})`,
    [steamId, ...ids],
  );

  const order = new Map(window.map((m, i) => [m.match_id, i]));
  const mapOf = new Map(window.map((m) => [m.match_id, m.map_name]));
  const dateOf = new Map(window.map((m) => [m.match_id, iso(m.chrono)!]));

  const out: PlayerTrainItem[] = [];
  for (const rule of RULES) {
    const mine = rows.filter((r) => r.metric_id === rule.metricId);
    if (mine.length === 0) continue;

    const flagged = mine
      .filter((r) => r.severity === 'critical' || r.severity === 'warning')
      .sort((a, b) => (order.get(a.match_id) ?? 0) - (order.get(b.match_id) ?? 0));
    if (flagged.length === 0) continue;

    out.push({
      ruleId: rule.id,
      metricId: rule.metricId,
      unit: rule.unit,
      times: flagged.length,

      of: mine.length,
      worst: flagged.some((r) => r.severity === 'critical') ? 'critical' : 'warning',
      trend: trendOf(mine, flagged, order),
      matches: flagged.map((r) => ({
        matchId: r.match_id,
        mapName: mapOf.get(r.match_id) ?? '',
        playedAt: dateOf.get(r.match_id) ?? '',
        severity: r.severity as 'critical' | 'warning',
        value: Number(r.value),
      })),
    });
  }

  return out.sort((a, b) => b.times / b.of - a.times / a.of || b.times - a.times);
}

function trendOf(
  measured: { match_id: string }[],
  flagged: { match_id: string }[],
  order: Map<string, number>,
): 'better' | 'worse' | 'flat' | null {
  if (measured.length < 4) return null;
  const idx = measured
    .map((r) => order.get(r.match_id) ?? 0)
    .sort((a, b) => a - b);
  const cut = idx[Math.floor(idx.length / 2)]!;

  const rate = (half: 'first' | 'second') => {
    const keep = (i: number) => (half === 'first' ? i < cut : i >= cut);
    const total = idx.filter(keep).length;
    if (total === 0) return null;
    const hits = flagged.filter((r) => keep(order.get(r.match_id) ?? 0)).length;
    return hits / total;
  };

  const before = rate('first');
  const after = rate('second');
  if (before === null || after === null) return null;
  if (Math.abs(after - before) < 0.2) return 'flat';
  return after < before ? 'better' : 'worse';
}

async function byMap(db: Db, steamId: string): Promise<PlayerMapRow[]> {
  const rows = await db.query<{
    map_name: string; matches: number; wins: number; losses: number; draws: number;
    rounds: number; damage: number; kills: number; deaths: number;
    opening_kills: number; opening_deaths: number;
  }>(

    `WITH per_match AS (
       SELECT pm.match_id, m.map_name,
              pm.rounds_played, pm.damage_total, pm.kills, pm.deaths,
              pm.opening_kills, pm.opening_deaths,
              SUM(CASE WHEN r.winner_side = prs.side THEN 1 ELSE 0 END) AS rounds_won,
              COUNT(r.round_num) AS rounds_scored
         FROM player_match pm
         JOIN matches m ON m.match_id = pm.match_id
         LEFT JOIN player_round_stats prs
                ON prs.match_id = pm.match_id AND prs.steam_id = pm.steam_id
         LEFT JOIN rounds r
                ON r.match_id = prs.match_id AND r.round_num = prs.round_num
               AND r.phase = 'live'
        WHERE pm.steam_id = ?
        GROUP BY ALL
     )
     SELECT map_name,
            COUNT(*)::INTEGER AS matches,
            SUM(CASE WHEN rounds_won * 2 > rounds_scored THEN 1 ELSE 0 END)::INTEGER AS wins,
            SUM(CASE WHEN rounds_won * 2 < rounds_scored THEN 1 ELSE 0 END)::INTEGER AS losses,
            SUM(CASE WHEN rounds_won * 2 = rounds_scored THEN 1 ELSE 0 END)::INTEGER AS draws,
            SUM(rounds_played)::INTEGER AS rounds,
            SUM(damage_total)::INTEGER AS damage,
            SUM(kills)::INTEGER AS kills,
            SUM(deaths)::INTEGER AS deaths,
            SUM(opening_kills)::INTEGER AS opening_kills,
            SUM(opening_deaths)::INTEGER AS opening_deaths
       FROM per_match
      GROUP BY map_name
      ORDER BY matches DESC, map_name`,
    [steamId],
  );

  return rows.map((r): PlayerMapRow => {
    const rounds = Number(r.rounds);
    const kills = Number(r.kills);
    const deaths = Number(r.deaths);
    const attempts = Number(r.opening_kills) + Number(r.opening_deaths);
    return {
      mapName: r.map_name,
      matches: Number(r.matches),
      wins: Number(r.wins),
      losses: Number(r.losses),
      draws: Number(r.draws),
      roundsPlayed: rounds,
      adr: rounds > 0 ? Number(r.damage) / rounds : null,
      kd: deaths > 0 ? kills / deaths : kills > 0 ? kills : null,
      entrySuccess: attempts > 0 ? Number(r.opening_kills) / attempts : null,
    };
  });
}

async function byWeapon(db: Db, steamId: string): Promise<PlayerWeaponRow[]> {
  const kills = await db.query<{
    weapon: string; kills: number; hs: number; distance: number | null;
  }>(
    `SELECT weapon,
            COUNT(*)::INTEGER AS kills,
            SUM(CASE WHEN headshot THEN 1 ELSE 0 END)::INTEGER AS hs,
            MEDIAN(distance) AS distance
       FROM kills
      WHERE attacker_steam_id = ? AND round_num IS NOT NULL
      GROUP BY weapon`,
    [steamId],
  );

  const damage = await weaponDamage(db, steamId);

  return kills
    .map((r): PlayerWeaponRow => {
      const n = Number(r.kills);
      return {
        weapon: r.weapon,
        kills: n,
        headshotPct: n > 0 ? Number(r.hs) / n : null,
        medianDistance: r.distance === null ? null : Number(r.distance),
        damage: damage.get(r.weapon) ?? null,
      };
    })
    .sort((a, b) => b.kills - a.kills);
}

async function weaponDamage(db: Db, steamId: string): Promise<Map<string, number>> {
  const pairs = await db.query<{ kill_weapon: string; dmg_weapon: string; n: number }>(
    `SELECT k.weapon AS kill_weapon, d.weapon AS dmg_weapon, COUNT(*)::INTEGER AS n
       FROM kills k
       JOIN damages d
         ON d.match_id = k.match_id AND d.tick = k.tick
        AND d.attacker_steam_id = k.attacker_steam_id
        AND d.victim_steam_id = k.victim_steam_id
      WHERE k.attacker_steam_id = ? AND k.round_num IS NOT NULL
      GROUP BY 1, 2`,
    [steamId],
  );

  const best = new Map<string, { dmg: string; n: number }>();
  for (const p of pairs) {
    const cur = best.get(p.kill_weapon);
    if (!cur || Number(p.n) > cur.n) best.set(p.kill_weapon, { dmg: p.dmg_weapon, n: Number(p.n) });
  }

  const claimants = new Map<string, number>();
  for (const { dmg } of best.values()) claimants.set(dmg, (claimants.get(dmg) ?? 0) + 1);

  const totals = new Map<string, number>();
  for (const d of await db.query<{ weapon: string; damage: number }>(
    `SELECT weapon, SUM(dmg_health)::INTEGER AS damage
       FROM damages
      WHERE attacker_steam_id = ? AND round_num IS NOT NULL AND NOT is_team_damage
      GROUP BY weapon`,
    [steamId],
  )) {
    totals.set(d.weapon, Number(d.damage));
  }

  const out = new Map<string, number>();
  for (const [killWeapon, { dmg }] of best) {
    if ((claimants.get(dmg) ?? 0) > 1) continue;
    const total = totals.get(dmg);
    if (total !== undefined) out.set(killWeapon, total);
  }
  return out;
}
