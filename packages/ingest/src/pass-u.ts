import { parseTicks } from '@laihoe/demoparser2';
import { TickClock, type Side } from '@cs2/core';
import type { DuckDb, SqlValue } from '@cs2/db';

type Row = Record<string, unknown>;

const PROPS_THROW = {
  required: ['X', 'Y', 'Z'],
  optional: [
    'duck_amount',

    'CCSPlayerPawn.m_fFlags',

    'm_flThrowStrength',
  ],
} as const;

const FLAG_ON_GROUND = 1;

const WEAPON_TO_TYPE: Record<string, string> = {
  weapon_smokegrenade: 'smoke',
  weapon_flashbang: 'flashbang',
  weapon_hegrenade: 'he',
  weapon_molotov: 'molotov',
  weapon_incgrenade: 'molotov',
  weapon_decoy: 'decoy',
};

export const THROW_MATCH_SECONDS = 0.5;

export interface PassUResult {
  throws: number;

  withoutStrength: number;
  droppedProps: string[];
}

interface FireRow {
  fire_id: number;
  round_num: number;
  tick: number;
  steam_id: string;
  weapon: string;
  x: number | null; y: number | null; z: number | null;
  pitch: number | null; yaw: number | null;
}

interface GrenadeRow {
  grenade_id: number;
  round_num: number;
  thrower_steam_id: string | null;
  grenade_type: string;
  throw_tick: number | null;
  detonate_tick: number | null;
  detonate_x: number | null; detonate_y: number | null; detonate_z: number | null;
  flight_time: number | null;
}

export async function runPassU(options: {
  demoPath: string;
  matchId: string;
  mapName: string;
  db: DuckDb;
  clock: TickClock;
}): Promise<PassUResult> {
  const { demoPath, matchId, mapName, db, clock } = options;

  const grenades = await db.query<GrenadeRow>(
    `SELECT grenade_id, round_num, thrower_steam_id, grenade_type, throw_tick, detonate_tick,
            detonate_x, detonate_y, detonate_z, flight_time
       FROM grenades
      WHERE match_id = ? AND round_num IS NOT NULL AND thrower_steam_id IS NOT NULL`,
    [matchId],
  );
  if (grenades.length === 0) return { throws: 0, withoutStrength: 0, droppedProps: [] };

  const fires = await db.query<FireRow>(
    `SELECT fire_id, round_num, tick, steam_id, weapon, x, y, z, pitch, yaw
       FROM weapon_fires
      WHERE match_id = ? AND round_num IS NOT NULL AND steam_id IS NOT NULL
        AND weapon IN (${Object.keys(WEAPON_TO_TYPE).map(() => '?').join(', ')})`,
    [matchId, ...Object.keys(WEAPON_TO_TYPE)],
  );

  const firesByKey = new Map<string, FireRow[]>();
  for (const f of fires) {
    const type = WEAPON_TO_TYPE[f.weapon];
    if (!type) continue;
    const key = `${Number(f.round_num)}|${f.steam_id}|${type}`;
    firesByKey.set(key, [...(firesByKey.get(key) ?? []), f]);
  }

  const window = clock.tickRate * THROW_MATCH_SECONDS;
  const matched = new Map<number, { grenade: GrenadeRow; fire: FireRow }>();
  const usedFires = new Set<number>();

  for (const g of grenades) {
    const reference = g.throw_tick ?? g.detonate_tick;
    if (reference === null) continue;
    const key = `${Number(g.round_num)}|${g.thrower_steam_id}|${g.grenade_type}`;
    let best: FireRow | null = null;
    let bestDistance = Infinity;
    for (const f of firesByKey.get(key) ?? []) {
      if (usedFires.has(Number(f.fire_id))) continue;
      const distance = Math.abs(Number(f.tick) - Number(reference));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = f;
      }
    }
    if (!best || bestDistance > window) continue;
    usedFires.add(Number(best.fire_id));
    matched.set(Number(g.grenade_id), { grenade: g, fire: best });
  }
  if (matched.size === 0) return { throws: 0, withoutStrength: 0, droppedProps: [] };

  const ticks = new Set<number>();
  for (const { fire } of matched.values()) {
    ticks.add(Number(fire.tick));
    ticks.add(Number(fire.tick) - 1);
  }

  const { rows, dropped } = parseResilientTicks(demoPath, [...ticks].sort((a, b) => a - b));

  const state = new Map<string, Row>();
  for (const row of rows) {
    const steamId = String(row['steamid'] ?? '');
    if (!steamId || steamId === '0') continue;
    state.set(`${Number(row['tick'])}|${steamId}`, row);
  }

  const sides = new Map<string, Side>();
  for (const e of await db.query<{ round_num: number; steam_id: string; side: string | null }>(
    'SELECT round_num, steam_id, side FROM economy WHERE match_id = ?',
    [matchId],
  )) {
    if (e.side) sides.set(`${Number(e.round_num)}|${e.steam_id}`, e.side as Side);
  }

  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  let withoutStrength = 0;
  const out: SqlValue[][] = [];

  for (const [grenadeId, { grenade, fire }] of matched) {
    const tick = Number(fire.tick);
    const at = state.get(`${tick}|${fire.steam_id}`);
    const before = state.get(`${tick - 1}|${fire.steam_id}`);

    const x = fire.x ?? num(at?.['X']);
    const y = fire.y ?? num(at?.['Y']);
    const z = fire.z ?? num(at?.['Z']);
    if (x === null || y === null || z === null) continue;

    const flags = num(at?.['CCSPlayerPawn.m_fFlags']);
    const onGround = flags === null ? null : (flags & FLAG_ON_GROUND) === FLAG_ON_GROUND;
    const duck = num(at?.['duck_amount']);
    const strength = num(at?.['m_flThrowStrength']);
    if (strength === null) withoutStrength += 1;

    let speed: number | null = null;
    const px = num(before?.['X']);
    const py = num(before?.['Y']);
    if (px !== null && py !== null && at) {
      const cx = num(at['X']);
      const cy = num(at['Y']);
      if (cx !== null && cy !== null) speed = Math.hypot(cx - px, cy - py) * clock.tickRate;
    }

    out.push([
      matchId, grenadeId, mapName, Number(grenade.round_num), fire.steam_id,
      sides.get(`${Number(grenade.round_num)}|${fire.steam_id}`) ?? null,
      grenade.grenade_type,
      tick,
      grenade.detonate_tick === null ? null : Number(grenade.detonate_tick),
      grenade.flight_time === null ? null : Number(grenade.flight_time),
      x, y, z,
      fire.pitch ?? num(at?.['pitch']),
      fire.yaw ?? num(at?.['yaw']),
      duck === null ? null : duck > 0.5,
      onGround,
      speed,
      strength,
      grenade.detonate_x, grenade.detonate_y, grenade.detonate_z,
      null, null, null,
    ]);
  }

  await db.bulkInsert(
    'utility_throws',
    [
      'match_id', 'throw_id', 'map_name', 'round_num', 'steam_id', 'side', 'grenade_type',
      'throw_tick', 'detonate_tick', 'flight_time',
      'throw_x', 'throw_y', 'throw_z', 'pitch', 'yaw',
      'crouched', 'on_ground', 'speed', 'throw_strength',
      'det_x', 'det_y', 'det_z',
      'enemies_blinded', 'enemy_damage', 'kills_after',
    ],
    out,
  );

  await fillOutcomes(db, matchId, clock);

  return { throws: out.length, withoutStrength, droppedProps: dropped };
}

export const OUTCOME_WINDOW_SECONDS = 5;

async function fillOutcomes(db: DuckDb, matchId: string, clock: TickClock): Promise<void> {
  const window = Math.round(clock.tickRate * OUTCOME_WINDOW_SECONDS);

  await db.exec(
    `UPDATE utility_throws AS u
        SET enemies_blinded = (
              SELECT COUNT(*)::INTEGER FROM blinds b
               WHERE b.match_id = u.match_id AND b.round_num = u.round_num
                 AND b.thrower_steam_id = u.steam_id AND b.is_team_flash = FALSE
                 AND b.tick BETWEEN u.throw_tick AND u.throw_tick + ?),
            enemy_damage = (
              SELECT COALESCE(SUM(d.dmg_health), 0)::INTEGER FROM damages d
               WHERE d.match_id = u.match_id AND d.round_num = u.round_num
                 AND d.attacker_steam_id = u.steam_id AND d.is_utility = TRUE
                 AND d.is_team_damage = FALSE
                 AND d.tick BETWEEN u.throw_tick AND u.throw_tick + ?),
            kills_after = (
              SELECT COUNT(*)::INTEGER FROM kills k
               WHERE k.match_id = u.match_id AND k.round_num = u.round_num
                 AND k.attacker_side = u.side AND k.victim_side <> u.side
                 AND k.tick BETWEEN COALESCE(u.detonate_tick, u.throw_tick)
                                AND COALESCE(u.detonate_tick, u.throw_tick) + ?)
      WHERE u.match_id = ?`,
    [window, window, window, matchId],
  );
}

function parseResilientTicks(demoPath: string, ticks: number[]): { rows: Row[]; dropped: string[] } {
  const parse = (props: string[]): Row[] => parseTicks(demoPath, props, ticks) as Row[];
  const all = [...PROPS_THROW.required, ...PROPS_THROW.optional];
  try {
    const rows = parse(all);
    const dropped = PROPS_THROW.optional.filter(
      (prop) => !rows.some((row) => prop in row && row[prop] !== null),
    );
    return { rows, dropped };
  } catch {
    const dropped: string[] = [];
    const kept: string[] = [];
    for (const prop of PROPS_THROW.optional) {
      try {
        parse([...PROPS_THROW.required, prop]);
        kept.push(prop);
      } catch {
        dropped.push(prop);
      }
    }
    return { rows: parse([...PROPS_THROW.required, ...kept]), dropped };
  }
}
