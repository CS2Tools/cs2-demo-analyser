import {
  aimErrorToHead,
  CALIBRATED_PUNCH_MODEL,
  FACING_AWAY_DEGREES,
  unusedUtilityValue,
  utilityInInventory,
  wrap180,
  classifyBlinds,
  classifyDuels,
  isAimDuelWeapon,
  SHOT_TICK_OFFSET_AT_64,
  TickClock,
  type AimSample,
  type BlindInput,
  type KillInput,
  type Side,
} from '@cs2/core';
import { worldToRadarPercent, type MapMeta } from '@cs2/radar';
import type { DuckDb, SqlValue } from '@cs2/db';

export const PREAIM_LEAD_SECONDS = 0.25;

export const HEATMAP_BINS = 64;

export interface PassFResult {
  engagements: number;
  killsClassified: number;
  blindsClassified: number;
  heatmapBins: number;
  roundStats: number;

  facingAwayBlinds: number;
  unusedUtilityRows: number;
}

const INVENTORY_SEPARATOR = '|';

interface TickRow {
  tick: number;
  steam_id: string;
  x: number; y: number; z: number;
  pitch: number; yaw: number;
  punch_pitch: number; punch_yaw: number;
  duck_amount: number;
  shots_fired: number;
  weapon: string | null;
}

export async function runPassF(options: {
  matchId: string;
  db: DuckDb;
  clock: TickClock;
  windowParquet: string;

  replayParquet: string;
  mapMeta: MapMeta | null;
}): Promise<PassFResult> {
  const { matchId, db, clock, windowParquet, replayParquet, mapMeta } = options;

  const ticks = await db.query<TickRow>(
    `SELECT tick, steam_id, x, y, z, pitch, yaw, punch_pitch, punch_yaw,
            duck_amount, shots_fired, weapon
       FROM read_parquet(?) WHERE match_id = ?`,
    [windowParquet, matchId],
  );

  const state = new Map<string, TickRow>();
  for (const t of ticks) state.set(`${Number(t.tick)}|${t.steam_id}`, t);
  const at = (tick: number, steamId: string | null): TickRow | null =>
    steamId ? (state.get(`${tick}|${steamId}`) ?? null) : null;

  const killRows = await db.query<{
    kill_id: number; round_num: number | null; tick: number;
    attacker_steam_id: string | null; victim_steam_id: string | null;
    attacker_side: string | null; victim_side: string | null;
    weapon: string | null; headshot: boolean | null; distance: number | null;
  }>(
    `SELECT k.kill_id, k.round_num, k.tick, k.attacker_steam_id, k.victim_steam_id,
            k.attacker_side, k.victim_side, k.weapon, k.headshot, k.distance
       FROM kills k WHERE k.match_id = ? AND k.round_num IS NOT NULL
      ORDER BY k.tick`,
    [matchId],
  );

  const roundStart = new Map<number, number>();
  for (const r of await db.query<{ round_num: number; from_tick: number }>(
    `SELECT round_num, COALESCE(freeze_end_tick, start_tick, end_tick) AS from_tick
       FROM rounds WHERE match_id = ? AND phase = 'live'`,
    [matchId],
  )) {
    roundStart.set(Number(r.round_num), Number(r.from_tick));
  }

  const killInputs: KillInput[] = killRows.map((k) => ({
    killId: Number(k.kill_id),
    roundNum: Number(k.round_num),
    tick: Number(k.tick),
    attackerSteamId: k.attacker_steam_id,
    victimSteamId: k.victim_steam_id,
    attackerSide: (k.attacker_side as Side | null) ?? null,
    victimSide: (k.victim_side as Side | null) ?? null,
    timeInRound: clock.durationSeconds(roundStart.get(Number(k.round_num)) ?? 0, Number(k.tick)),
  }));

  const rosterBySide = new Map<number, { CT: number; T: number }>();
  for (const r of await db.query<{ round_num: number; side: string; n: number }>(
    `SELECT round_num, side, COUNT(DISTINCT steam_id) AS n
       FROM economy WHERE match_id = ? AND side IS NOT NULL
      GROUP BY round_num, side`,
    [matchId],
  )) {
    const roundNum = Number(r.round_num);
    const cur = rosterBySide.get(roundNum) ?? { CT: 0, T: 0 };
    if (r.side === 'CT') cur.CT = Number(r.n);
    else if (r.side === 'T') cur.T = Number(r.n);
    rosterBySide.set(roundNum, cur);
  }

  const duelFlags = classifyDuels(killInputs, { tickRate: clock.tickRate, rosterBySide });

  for (const f of duelFlags) {
    await db.exec(
      `UPDATE kills SET is_first_kill_of_round = ?, is_entry = ?, is_trade_kill = ?,
                        traded_kill_id = ?, death_was_traded = ?, traded_by_kill_id = ?
        WHERE match_id = ? AND kill_id = ?`,
      [
        f.isFirstKillOfRound, f.isEntry, f.isTradeKill,
        f.tradedKillId, f.deathWasTraded, f.tradedByKillId,
        matchId, f.killId,
      ],
    );
  }

  for (const k of killRows) {
    const victim = at(Number(k.tick), k.victim_steam_id);
    const attacker = at(Number(k.tick), k.attacker_steam_id);
    if (!victim && !attacker) continue;
    await db.exec(
      `UPDATE kills SET victim_x = ?, victim_y = ?, victim_z = ?,
                        attacker_x = ?, attacker_y = ?, attacker_z = ?
        WHERE match_id = ? AND kill_id = ?`,
      [
        victim ? Number(victim.x) : null,
        victim ? Number(victim.y) : null,
        victim ? Number(victim.z) : null,
        attacker ? Number(attacker.x) : null,
        attacker ? Number(attacker.y) : null,
        attacker ? Number(attacker.z) : null,
        matchId, Number(k.kill_id),
      ],
    );
  }

  const shotOffset = Math.round(SHOT_TICK_OFFSET_AT_64 * (clock.tickRate / 64));
  const preaimLead = clock.toTicksCeil(PREAIM_LEAD_SECONDS);

  const engagementRows: SqlValue[][] = [];
  let engId = 0;

  for (const k of killRows) {
    if (!k.attacker_steam_id || !k.victim_steam_id) continue;
    if (k.attacker_steam_id === k.victim_steam_id) continue;

    if (!isAimDuelWeapon(k.weapon)) continue;
    if (k.attacker_side !== null && k.attacker_side === k.victim_side) continue;

    const shotTick = Number(k.tick) + shotOffset;
    const shooter = at(shotTick, k.attacker_steam_id);
    const target = at(shotTick, k.victim_steam_id);
    if (!shooter || !target) continue;

    const sampleAt = (a: TickRow, b: TickRow): AimSample => ({
      shooter: { x: Number(a.x), y: Number(a.y), z: Number(a.z) },
      shooterDuck: Number(a.duck_amount),
      eyePitch: Number(a.pitch),
      eyeYaw: Number(a.yaw),
      punchPitch: Number(a.punch_pitch),
      punchYaw: Number(a.punch_yaw),
      cmdPitch: null,
      cmdYaw: null,
      victim: { x: Number(b.x), y: Number(b.y), z: Number(b.z) },
      victimDuck: Number(b.duck_amount),
    });

    const firstShot = aimErrorToHead(sampleAt(shooter, target), CALIBRATED_PUNCH_MODEL);

    const preShooter = at(shotTick - preaimLead, k.attacker_steam_id);
    const preTarget = at(shotTick - preaimLead, k.victim_steam_id);
    const preaim =
      preShooter && preTarget
        ? aimErrorToHead(sampleAt(preShooter, preTarget), CALIBRATED_PUNCH_MODEL)
        : null;

    engId++;
    engagementRows.push([
      engId, matchId, Number(k.round_num),
      k.attacker_steam_id, k.victim_steam_id,
      preShooter ? shotTick - preaimLead : null,
      shotTick,
      Number(k.tick),

      'first_damage',
      null,
      preaim?.totalDeg ?? null,
      preaim?.pitchDeg ?? null,
      firstShot.totalDeg,
      firstShot.distance,
      k.weapon,
      'kill',
      null,
      null,
    ]);
  }

  await db.bulkInsert(
    'engagements',
    [
      'eng_id', 'match_id', 'round_num', 'player_steam_id', 'enemy_steam_id',
      'tick_start', 'tick_first_shot', 'tick_resolved', 'acquisition_model',
      'ttfs_ms', 'preaim_total_deg', 'preaim_pitch_deg', 'firstshot_total_deg',
      'distance', 'weapon', 'outcome', 'player_was_moving', 'player_was_blind',
    ],
    engagementRows,
  );

  const blindRows = await db.query<{
    blind_id: number; round_num: number | null; tick: number;
    victim_steam_id: string | null; thrower_steam_id: string | null;
    blind_duration: number | null;
  }>(
    `SELECT blind_id, round_num, tick, victim_steam_id, thrower_steam_id, blind_duration
       FROM blinds WHERE match_id = ? AND round_num IS NOT NULL`,
    [matchId],
  );

  const sideOf = new Map<string, Map<number, Side>>();
  for (const e of await db.query<{ round_num: number; steam_id: string; side: string | null }>(
    `SELECT round_num, steam_id, side FROM economy WHERE match_id = ?`,
    [matchId],
  )) {
    if (!e.side) continue;
    const m = sideOf.get(e.steam_id) ?? new Map<number, Side>();
    m.set(Number(e.round_num), e.side as Side);
    sideOf.set(e.steam_id, m);
  }
  const sideAt = (steamId: string | null, round: number): Side | null =>
    steamId ? (sideOf.get(steamId)?.get(round) ?? null) : null;

  const blindInputs: BlindInput[] = blindRows.map((b) => ({
    blindId: Number(b.blind_id),
    roundNum: Number(b.round_num),
    tick: Number(b.tick),
    victimSteamId: b.victim_steam_id,
    throwerSteamId: b.thrower_steam_id,
    blindDuration: Number(b.blind_duration ?? 0),
    victimSide: sideAt(b.victim_steam_id, Number(b.round_num)),
    throwerSide: sideAt(b.thrower_steam_id, Number(b.round_num)),
  }));

  const blindFlags = classifyBlinds(blindInputs);
  for (const f of blindFlags) {
    await db.exec(
      `UPDATE blinds SET is_team_flash = ?, effective = ?, effectiveness_model = ?
        WHERE match_id = ? AND blind_id = ?`,
      [f.isTeamFlash, f.effective, 'duracao_minima_1.1s', matchId, f.blindId],
    );
  }

  let heatmapBins = 0;
  if (mapMeta) {
    const positions = await db.query<{
      round_num: number; victim_steam_id: string | null; attacker_steam_id: string | null;
      victim_side: string | null; attacker_side: string | null;
      victim_x: number | null; victim_y: number | null; victim_z: number | null;
      attacker_x: number | null; attacker_y: number | null; attacker_z: number | null;
    }>(
      `SELECT round_num, victim_steam_id, attacker_steam_id, victim_side, attacker_side,
              victim_x, victim_y, victim_z, attacker_x, attacker_y, attacker_z
         FROM kills WHERE match_id = ? AND round_num IS NOT NULL`,
      [matchId],
    );

    const bins = new Map<string, number>();
    const addBin = (
      kind: 'death' | 'kill',
      steamId: string | null,
      side: string | null,
      x: number | null, y: number | null, z: number | null,
    ) => {
      if (x === null || y === null || !steamId) return;
      const p = worldToRadarPercent({ x: Number(x), y: Number(y), z: Number(z ?? 0) }, mapMeta);
      const bx = Math.max(0, Math.min(HEATMAP_BINS - 1, Math.floor((p.px / 100) * HEATMAP_BINS)));
      const by = Math.max(0, Math.min(HEATMAP_BINS - 1, Math.floor((p.py / 100) * HEATMAP_BINS)));
      const key = `${steamId}|${side ?? ''}|${kind}|${bx}|${by}|${p.split}`;
      bins.set(key, (bins.get(key) ?? 0) + 1);
    };

    for (const k of positions) {
      addBin('death', k.victim_steam_id, k.victim_side, k.victim_x, k.victim_y, k.victim_z);
      addBin('kill', k.attacker_steam_id, k.attacker_side, k.attacker_x, k.attacker_y, k.attacker_z);
    }

    const binRows: SqlValue[][] = [...bins.entries()].map(([key, count]) => {
      const [steamId, side, kind, bx, by, split] = key.split('|');
      return [
        matchId, steamId!, mapMeta.name, side || null, null, kind!,
        Number(bx), Number(by), Number(split), count,
      ];
    });

    await db.bulkInsert(
      'heatmap_bins',
      ['match_id', 'steam_id', 'map_name', 'side', 'phase', 'kind',
        'bin_x', 'bin_y', 'bin_split', 'count'],
      binRows,
    );
    heatmapBins = binRows.length;
  }

  await db.exec(
    `INSERT INTO player_round_stats
       (match_id, round_num, steam_id, side, kills, deaths, assists, damage,
        utility_damage, enemies_flashed, survived, opening_kill, opening_death, equip_value, buy_type)
     SELECT e.match_id, e.round_num, e.steam_id, e.side,
            COALESCE(k.kills, 0), COALESCE(d.deaths, 0), 0,
            COALESCE(dmg.damage, 0), COALESCE(dmg.utility, 0),
            COALESCE(fl.flashed, 0),
            COALESCE(d.deaths, 0) = 0,
            COALESCE(k.entries, 0) > 0,
            COALESCE(d.entry_deaths, 0) > 0,
            e.equip_value, e.buy_type
       FROM economy e
       LEFT JOIN (SELECT match_id, round_num, attacker_steam_id sid,
                         COUNT(*)::INTEGER kills,
                         SUM(CASE WHEN is_entry THEN 1 ELSE 0 END)::INTEGER entries
                    FROM kills WHERE match_id = ? GROUP BY 1,2,3) k
              ON k.match_id = e.match_id AND k.round_num = e.round_num AND k.sid = e.steam_id
       LEFT JOIN (SELECT match_id, round_num, victim_steam_id sid,
                         COUNT(*)::INTEGER deaths,
                         SUM(CASE WHEN is_entry THEN 1 ELSE 0 END)::INTEGER entry_deaths
                    FROM kills WHERE match_id = ? GROUP BY 1,2,3) d
              ON d.match_id = e.match_id AND d.round_num = e.round_num AND d.sid = e.steam_id
       LEFT JOIN (SELECT match_id, round_num, attacker_steam_id sid,
                         SUM(dmg_health)::INTEGER damage,
                         SUM(CASE WHEN is_utility THEN dmg_health ELSE 0 END)::INTEGER utility
                    FROM damages WHERE match_id = ? AND is_team_damage = FALSE
                   GROUP BY 1,2,3) dmg
              ON dmg.match_id = e.match_id AND dmg.round_num = e.round_num AND dmg.sid = e.steam_id
       LEFT JOIN (SELECT match_id, round_num, thrower_steam_id sid, COUNT(*)::INTEGER flashed
                    FROM blinds WHERE match_id = ? AND is_team_flash = FALSE
                   GROUP BY 1,2,3) fl
              ON fl.match_id = e.match_id AND fl.round_num = e.round_num AND fl.sid = e.steam_id
      WHERE e.match_id = ?`,
    [matchId, matchId, matchId, matchId, matchId],
  );

  const roundStats = await db.queryOne<{ n: number }>(
    'SELECT COUNT(*)::INTEGER AS n FROM player_round_stats WHERE match_id = ?',
    [matchId],
  );

  const deaths = await db.query<{ round_num: number; steam_id: string; inventory: string | null }>(
    `SELECT k.round_num, k.victim_steam_id AS steam_id, t.inventory
       FROM kills k
       JOIN read_parquet(?) t
         ON t.match_id = k.match_id AND t.steam_id = k.victim_steam_id
        AND t.round_num = k.round_num AND t.tick <= k.tick
      WHERE k.match_id = ? AND k.round_num IS NOT NULL AND k.victim_steam_id IS NOT NULL
     QUALIFY ROW_NUMBER() OVER (PARTITION BY k.kill_id ORDER BY t.tick DESC) = 1`,
    [replayParquet, matchId],
  );

  for (const d of deaths) {
    const inventory = (d.inventory ?? '')
      .split(INVENTORY_SEPARATOR)
      .map((s) => s.trim())
      .filter(Boolean);
    await db.exec(
      `UPDATE player_round_stats
          SET unused_utility_value = ?, unused_utility_count = ?
        WHERE match_id = ? AND round_num = ? AND steam_id = ?`,
      [
        unusedUtilityValue(inventory),
        utilityInInventory(inventory).length,
        matchId, Number(d.round_num), d.steam_id,
      ],
    );
  }

  const blindAngles = await db.query<{
    blind_id: number; yaw: number | null;
    vx: number | null; vy: number | null; vz: number | null;
    fx: number | null; fy: number | null; fz: number | null;
  }>(
    `SELECT b.blind_id, t.yaw, t.x AS vx, t.y AS vy, t.z AS vz,
            d.x AS fx, d.y AS fy, d.z AS fz
       FROM blinds b
       JOIN grenade_detonations d
         ON d.match_id = b.match_id AND d.round_num = b.round_num
        AND lower(d.grenade_type) LIKE 'flash%'
        AND abs(d.tick - b.tick) <= ?
       JOIN read_parquet(?) t
         ON t.match_id = b.match_id AND t.steam_id = b.victim_steam_id
        AND t.round_num = b.round_num AND t.tick <= b.tick
      WHERE b.match_id = ? AND b.victim_steam_id IS NOT NULL AND b.round_num IS NOT NULL
     QUALIFY ROW_NUMBER() OVER (
       PARTITION BY b.blind_id ORDER BY abs(d.tick - b.tick), t.tick DESC) = 1`,
    [clock.tickRate, replayParquet, matchId],
  );

  let facingAwayBlinds = 0;
  for (const b of blindAngles) {
    if (b.yaw === null || b.vx === null || b.vy === null || b.fx === null || b.fy === null) continue;
    const dx = Number(b.fx) - Number(b.vx);
    const dy = Number(b.fy) - Number(b.vy);
    const dz = Number(b.fz ?? 0) - Number(b.vz ?? 0);
    const toFlash = (Math.atan2(dy, dx) * 180) / Math.PI;
    const away = Math.abs(wrap180(toFlash - Number(b.yaw))) > FACING_AWAY_DEGREES;
    if (away) facingAwayBlinds += 1;
    await db.exec(
      'UPDATE blinds SET facing_away = ?, flash_distance = ? WHERE match_id = ? AND blind_id = ?',
      [away, Math.hypot(dx, dy, dz), matchId, Number(b.blind_id)],
    );
  }

  await db.exec(
    `UPDATE player_match AS pm
        SET opening_kills = s.entries, opening_deaths = s.entry_deaths,
            trade_kills = s.trades, traded_deaths = s.traded
       FROM (SELECT
               p.steam_id,
               SUM(CASE WHEN k.is_entry AND k.attacker_steam_id = p.steam_id THEN 1 ELSE 0 END)::INTEGER entries,
               SUM(CASE WHEN k.is_entry AND k.victim_steam_id = p.steam_id THEN 1 ELSE 0 END)::INTEGER entry_deaths,
               SUM(CASE WHEN k.is_trade_kill AND k.attacker_steam_id = p.steam_id THEN 1 ELSE 0 END)::INTEGER trades,
               SUM(CASE WHEN k.death_was_traded AND k.victim_steam_id = p.steam_id THEN 1 ELSE 0 END)::INTEGER traded
             FROM player_match p
             CROSS JOIN kills k
            WHERE p.match_id = ? AND k.match_id = ? AND k.round_num IS NOT NULL
            GROUP BY p.steam_id) s
      WHERE pm.match_id = ? AND pm.steam_id = s.steam_id`,
    [matchId, matchId, matchId],
  );

  return {
    engagements: engagementRows.length,
    killsClassified: duelFlags.length,
    blindsClassified: blindFlags.length,
    heatmapBins,
    roundStats: Number(roundStats?.n ?? 0),
    facingAwayBlinds,
    unusedUtilityRows: deaths.length,
  };
}
