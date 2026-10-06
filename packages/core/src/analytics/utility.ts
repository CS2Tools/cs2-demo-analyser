import { weaponClass, weaponPrice } from '../weapons.js';

export const FACING_AWAY_DEGREES = 90;

export interface GrenadeRef {
  grenadeId: number;
  roundNum: number;
  throwerSteamId: string | null;

  type: string;
  throwTick: number | null;
  detonateTick: number | null;
}

export interface DamageRef {
  roundNum: number;
  tick: number;
  attackerSteamId: string | null;
  victimSteamId: string | null;
  weapon: string | null;
  damage: number;
  isTeamDamage: boolean;
}

export interface KillRef {
  roundNum: number;
  tick: number;
  attackerSteamId: string | null;
  victimSteamId: string | null;
  weapon: string | null;
}

const isHe = (type: string) => /^(he|high)/i.test(type.replace(/[\s_-]/g, ''));
const isFireType = (type: string) =>
  /^(molotov|inc)/i.test(type.replace(/[\s_-]/g, ''));
const isSmokeType = (type: string) => /^smoke/i.test(type.replace(/[\s_-]/g, ''));
const isFlashType = (type: string) => /^flash/i.test(type.replace(/[\s_-]/g, ''));

const FIRE_WEAPONS = new Set(['inferno', 'molotov', 'incgrenade', 'firebomb']);
const isFireWeapon = (w: string | null) =>
  w !== null && FIRE_WEAPONS.has(w.toLowerCase().replace(/[\s_-]/g, ''));
const isHeWeapon = (w: string | null) => w !== null && isHe(w);

export interface HeStats {
  steamId: string;
  grenades: number;
  damage: number;

  enemiesHit: number;

  bestMultiHit: number;
  teamDamage: number;
}

export function heStats(input: { grenades: GrenadeRef[]; damages: DamageRef[] }): {
  byPlayer: HeStats[];
} {
  const hes = input.grenades.filter((g) => isHe(g.type));
  const victimsPerGrenade = new Map<number, Set<string>>();
  const acc = new Map<string, HeStats>();
  const get = (id: string): HeStats => {
    const cur = acc.get(id) ?? {
      steamId: id, grenades: 0, damage: 0, enemiesHit: 0, bestMultiHit: 0, teamDamage: 0,
    };
    acc.set(id, cur);
    return cur;
  };

  for (const g of hes) if (g.throwerSteamId) get(g.throwerSteamId).grenades += 1;

  for (const d of input.damages) {
    if (!isHeWeapon(d.weapon) || !d.attackerSteamId || !d.victimSteamId) continue;
    const player = get(d.attackerSteamId);
    if (d.isTeamDamage) {
      player.teamDamage += d.damage;
      continue;
    }
    player.damage += d.damage;

    const grenade = nearestGrenade(hes, d.attackerSteamId, d.roundNum, d.tick);
    if (grenade === null) continue;
    const victims = victimsPerGrenade.get(grenade) ?? new Set<string>();
    victims.add(d.victimSteamId);
    victimsPerGrenade.set(grenade, victims);
  }

  for (const g of hes) {
    if (!g.throwerSteamId) continue;
    const victims = victimsPerGrenade.get(g.grenadeId)?.size ?? 0;
    const player = get(g.throwerSteamId);
    player.enemiesHit += victims;
    player.bestMultiHit = Math.max(player.bestMultiHit, victims);
  }

  return { byPlayer: [...acc.values()] };
}

function nearestGrenade(
  grenades: GrenadeRef[],
  throwerSteamId: string,
  roundNum: number,
  tick: number,
): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const g of grenades) {
    if (g.throwerSteamId !== throwerSteamId || g.roundNum !== roundNum) continue;
    const ref = g.detonateTick ?? g.throwTick;
    if (ref === null) continue;
    const dist = Math.abs(tick - ref);
    if (dist < bestDist) {
      bestDist = dist;
      best = g.grenadeId;
    }
  }
  return best;
}

export interface FireStats {
  steamId: string;
  grenades: number;
  damage: number;
  enemiesHit: number;
  kills: number;
  teamDamage: number;
}

export function fireStats(input: {
  grenades: GrenadeRef[];
  damages: DamageRef[];
  kills: KillRef[];
}): { byPlayer: FireStats[] } {
  const acc = new Map<string, FireStats & { victims: Set<string> }>();
  const get = (id: string) => {
    const cur = acc.get(id) ?? {
      steamId: id, grenades: 0, damage: 0, enemiesHit: 0, kills: 0, teamDamage: 0,
      victims: new Set<string>(),
    };
    acc.set(id, cur);
    return cur;
  };

  for (const g of input.grenades) {
    if (isFireType(g.type) && g.throwerSteamId) get(g.throwerSteamId).grenades += 1;
  }

  for (const d of input.damages) {
    if (!isFireWeapon(d.weapon) || !d.attackerSteamId || !d.victimSteamId) continue;
    const player = get(d.attackerSteamId);
    if (d.isTeamDamage) {
      player.teamDamage += d.damage;
      continue;
    }
    player.damage += d.damage;
    player.victims.add(`${d.roundNum}|${d.victimSteamId}`);
  }

  for (const k of input.kills) {
    if (!isFireWeapon(k.weapon) || !k.attackerSteamId) continue;
    get(k.attackerSteamId).kills += 1;
  }

  return {
    byPlayer: [...acc.values()].map(({ victims, ...rest }) => ({
      ...rest,
      enemiesHit: victims.size,
    })),
  };
}

export interface SmokeStats {
  steamId: string;
  smokes: number;

  medianSecondsIntoRound: number | null;
  killsThroughSmoke: number;
}

export function smokeStats(input: {
  grenades: GrenadeRef[];

  roundStartTicks: Map<number, number>;
  tickRate: number;
  killsThroughSmoke: { roundNum: number; attackerSteamId: string | null }[];
}): { byPlayer: SmokeStats[] } {
  const timings = new Map<string, number[]>();
  const smokes = new Map<string, number>();

  for (const g of input.grenades) {
    if (!isSmokeType(g.type) || !g.throwerSteamId) continue;
    smokes.set(g.throwerSteamId, (smokes.get(g.throwerSteamId) ?? 0) + 1);
    const start = input.roundStartTicks.get(g.roundNum);
    if (start === undefined || g.throwTick === null) continue;
    const seconds = Math.max(0, (g.throwTick - start) / input.tickRate);
    timings.set(g.throwerSteamId, [...(timings.get(g.throwerSteamId) ?? []), seconds]);
  }

  const through = new Map<string, number>();
  for (const k of input.killsThroughSmoke) {
    if (!k.attackerSteamId) continue;
    through.set(k.attackerSteamId, (through.get(k.attackerSteamId) ?? 0) + 1);
  }

  return {
    byPlayer: [...smokes.entries()].map(([steamId, count]) => ({
      steamId,
      smokes: count,
      medianSecondsIntoRound: median(timings.get(steamId) ?? []),
      killsThroughSmoke: through.get(steamId) ?? 0,
    })),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface BlindRef {
  roundNum: number;
  tick: number;
  throwerSteamId: string | null;
  victimSteamId: string | null;
  duration: number;
  isTeamFlash: boolean;
  effective: boolean;

  facingAway: boolean | null;

  distance: number | null;
}

export interface FlashDepth {
  steamId: string;
  flashes: number;
  effectiveBlinds: number;
  teamFlashes: number;
  flashAssists: number;
  blindedFacingAway: number;

  medianDistance: number | null;
}

export function flashDepth(input: {
  grenades: GrenadeRef[];
  blinds: BlindRef[];
  tickRate: number;
  flashAssists: { roundNum: number; flasherSteamId: string | null }[];
}): { byPlayer: FlashDepth[] } {
  const acc = new Map<string, FlashDepth>();
  const distances = new Map<string, number[]>();
  const get = (id: string): FlashDepth => {
    const cur = acc.get(id) ?? {
      steamId: id, flashes: 0, effectiveBlinds: 0, teamFlashes: 0,
      flashAssists: 0, blindedFacingAway: 0, medianDistance: null,
    };
    acc.set(id, cur);
    return cur;
  };

  for (const g of input.grenades) {
    if (isFlashType(g.type) && g.throwerSteamId) get(g.throwerSteamId).flashes += 1;
  }

  for (const b of input.blinds) {
    if (!b.throwerSteamId) continue;
    const player = get(b.throwerSteamId);
    if (b.isTeamFlash) {
      player.teamFlashes += 1;
      continue;
    }
    if (b.effective) player.effectiveBlinds += 1;
    if (b.facingAway) player.blindedFacingAway += 1;
    if (b.distance !== null) {
      distances.set(b.throwerSteamId, [...(distances.get(b.throwerSteamId) ?? []), b.distance]);
    }
  }

  for (const a of input.flashAssists) {
    if (a.flasherSteamId) get(a.flasherSteamId).flashAssists += 1;
  }

  for (const [steamId, values] of distances) get(steamId).medianDistance = median(values);

  return { byPlayer: [...acc.values()] };
}

export function utilityInInventory(inventory: string[]): { name: string; price: number }[] {
  return inventory
    .filter((item) => weaponClass(item) === 'grenade')
    .map((item) => ({ name: item, price: weaponPrice(item) }));
}

export function unusedUtilityValue(inventory: string[]): number {
  return utilityInInventory(inventory).reduce((sum, g) => sum + g.price, 0);
}

export interface ThrowOutcome {

  damage: number;

  enemiesHit: number;

  enemiesBlinded: number;

  blindSeconds: number;

  bestBlindSeconds: number;
}

export const EMPTY_OUTCOME: ThrowOutcome = {
  damage: 0,
  enemiesHit: 0,
  enemiesBlinded: 0,
  blindSeconds: 0,
  bestBlindSeconds: 0,
};

export interface ThrowOutcomes {
  byGrenade: Map<number, ThrowOutcome>;

  unattributedDamage: number;

  unattributedBlindSeconds: number;
}

export function throwOutcomes(input: {
  grenades: GrenadeRef[];
  damages: DamageRef[];
  blinds: BlindRef[];
}): ThrowOutcomes {
  const out = new Map<number, ThrowOutcome>();
  let unattributedDamage = 0;
  let unattributedBlindSeconds = 0;
  const victims = new Map<number, Set<string>>();
  const blinded = new Map<number, Set<string>>();
  const get = (id: number): ThrowOutcome => {
    const cur = out.get(id) ?? { ...EMPTY_OUTCOME };
    out.set(id, cur);
    return cur;
  };
  const add = (map: Map<number, Set<string>>, id: number, who: string) => {
    const set = map.get(id) ?? new Set<string>();
    set.add(who);
    map.set(id, set);
  };

  const hes = input.grenades.filter((g) => isHe(g.type));
  const fires = input.grenades.filter((g) => isFireType(g.type));
  const flashes = input.grenades.filter((g) => isFlashType(g.type));

  for (const g of input.grenades) get(g.grenadeId);

  for (const d of input.damages) {
    if (d.isTeamDamage || !d.attackerSteamId || !d.victimSteamId) continue;
    const pool = isHeWeapon(d.weapon) ? hes : isFireWeapon(d.weapon) ? fires : null;
    if (pool === null) continue;
    const id = nearestGrenade(pool, d.attackerSteamId, d.roundNum, d.tick);
    if (id === null) {
      unattributedDamage += d.damage;
      continue;
    }
    get(id).damage += d.damage;
    add(victims, id, d.victimSteamId);
  }

  for (const b of input.blinds) {
    if (b.isTeamFlash || !b.throwerSteamId || !b.victimSteamId) continue;
    const id = nearestGrenade(flashes, b.throwerSteamId, b.roundNum, b.tick);
    if (id === null) {
      unattributedBlindSeconds += b.duration;
      continue;
    }
    const o = get(id);
    o.blindSeconds += b.duration;
    o.bestBlindSeconds = Math.max(o.bestBlindSeconds, b.duration);
    add(blinded, id, b.victimSteamId);
  }

  for (const [id, set] of victims) get(id).enemiesHit = set.size;
  for (const [id, set] of blinded) get(id).enemiesBlinded = set.size;
  return { byGrenade: out, unattributedDamage, unattributedBlindSeconds };
}
