import { isAimDuelWeapon, shotWasSlowEnough, weaponClass } from './weapons.js';

export interface ShotInput {
  steamId: string;
  weapon: string;
  tick: number;

  speed: number | null;
  isScoped: boolean | null;
}

export interface HitInput {
  attackerSteamId: string;
  victimSteamId: string;
  tick: number;
  damage: number;

  hitgroup: string | null;
}

export const SPRAY_MAX_GAP_SECONDS = 0.15;

export const SPRAY_MIN_SHOTS = 3;

export const HITGROUPS = [
  'head', 'neck', 'chest', 'stomach', 'left_arm', 'right_arm',
  'left_leg', 'right_leg', 'generic',
] as const;
export type Hitgroup = (typeof HITGROUPS)[number];

export interface AccuracyStats {
  steamId: string;
  shots: number;
  hits: number;
  accuracy: number | null;
  damage: number;
  damagePerShot: number | null;

  headshotHits: number;
  headshotAccuracy: number | null;

  firstShots: number;
  firstHits: number;
  firstAccuracy: number | null;

  sprayShots: number;
  sprayHits: number;
  sprayAccuracy: number | null;
  scopedShots: number;

  judgedShots: number;
  slowEnoughShots: number;
  counterStrafe: number | null;
  hitgroups: Record<string, number>;
}

export interface WeaponAccuracy {
  steamId: string;
  weapon: string;
  shots: number;
  hits: number;
  accuracy: number | null;
  headshotHits: number;
  damage: number;
}

export interface AccuracySummary {
  players: AccuracyStats[];
  byWeapon: WeaponAccuracy[];

  hasShotData: boolean;
}

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

function isFirearm(weapon: string): boolean {
  const cls = weaponClass(weapon);
  return cls !== 'grenade' && cls !== 'knife' && cls !== 'equipment' && isAimDuelWeapon(weapon);
}

export function burstPositions(
  shots: readonly ShotInput[],
  tickRate: number,
): { position: number; burstSize: number }[] {
  const maxGap = SPRAY_MAX_GAP_SECONDS * tickRate;
  const out = shots.map(() => ({ position: 0, burstSize: 1 }));

  const byPlayer = new Map<string, number[]>();
  shots.forEach((s, i) => {
    const key = `${s.steamId}|${s.weapon}`;
    const list = byPlayer.get(key) ?? [];
    list.push(i);
    byPlayer.set(key, list);
  });

  for (const indices of byPlayer.values()) {
    indices.sort((a, b) => shots[a]!.tick - shots[b]!.tick);
    let burst: number[] = [];

    const close = () => {
      for (let p = 0; p < burst.length; p += 1) {
        out[burst[p]!] = { position: p, burstSize: burst.length };
      }
      burst = [];
    };

    for (const i of indices) {
      const prev = burst.length > 0 ? shots[burst[burst.length - 1]!]! : null;
      if (prev && shots[i]!.tick - prev.tick > maxGap) close();
      burst.push(i);
    }
    close();
  }

  return out;
}

export function summarizeAccuracy(
  shotsIn: readonly ShotInput[],
  hitsIn: readonly HitInput[],
  tickRate: number,
): AccuracySummary {
  const shots = shotsIn.filter((s) => isFirearm(s.weapon));
  const bursts = burstPositions(shots, tickRate);

  const hitsAt = new Map<string, HitInput[]>();
  for (const h of hitsIn) {
    const key = `${h.attackerSteamId}|${h.tick}`;
    const list = hitsAt.get(key) ?? [];
    list.push(h);
    hitsAt.set(key, list);
  }

  const players = new Map<string, AccuracyStats>();
  const weapons = new Map<string, WeaponAccuracy>();
  let sawShotData = false;

  shots.forEach((shot, i) => {
    const p = players.get(shot.steamId) ?? blank(shot.steamId);
    players.set(shot.steamId, p);

    const wKey = `${shot.steamId}|${shot.weapon}`;
    const w = weapons.get(wKey) ?? {
      steamId: shot.steamId, weapon: shot.weapon,
      shots: 0, hits: 0, accuracy: null, headshotHits: 0, damage: 0,
    };
    weapons.set(wKey, w);

    const landed = hitsAt.get(`${shot.steamId}|${shot.tick}`) ?? [];
    const hit = landed.length > 0;
    const damage = landed.reduce((sum, h) => sum + h.damage, 0);
    const head = landed.some((h) => h.hitgroup === 'head');

    p.shots += 1;
    w.shots += 1;
    if (hit) {
      p.hits += 1;
      w.hits += 1;
      p.damage += damage;
      w.damage += damage;
      if (head) {
        p.headshotHits += 1;
        w.headshotHits += 1;
      }
      for (const h of landed) {
        if (h.hitgroup === null) continue;
        sawShotData = true;
        p.hitgroups[h.hitgroup] = (p.hitgroups[h.hitgroup] ?? 0) + 1;
      }
    }

    if (shot.isScoped) p.scopedShots += 1;

    const { position, burstSize } = bursts[i]!;
    if (position === 0) {
      p.firstShots += 1;
      if (hit) p.firstHits += 1;
    } else if (burstSize >= SPRAY_MIN_SHOTS) {
      p.sprayShots += 1;
      if (hit) p.sprayHits += 1;
    }

    const slow = shotWasSlowEnough(shot.weapon, shot.speed);
    if (slow !== null) {
      sawShotData = true;
      p.judgedShots += 1;
      if (slow) p.slowEnoughShots += 1;
    }
  });

  const out = [...players.values()].map((p) => ({
    ...p,
    accuracy: ratio(p.hits, p.shots),
    damagePerShot: ratio(p.damage, p.shots),
    headshotAccuracy: ratio(p.headshotHits, p.hits),
    firstAccuracy: ratio(p.firstHits, p.firstShots),
    sprayAccuracy: ratio(p.sprayHits, p.sprayShots),
    counterStrafe: ratio(p.slowEnoughShots, p.judgedShots),
  }));

  return {
    players: out.sort((a, b) => b.shots - a.shots),
    byWeapon: [...weapons.values()]
      .map((w) => ({ ...w, accuracy: ratio(w.hits, w.shots) }))
      .sort((a, b) => b.shots - a.shots),
    hasShotData: sawShotData,
  };
}

function blank(steamId: string): AccuracyStats {
  return {
    steamId,
    shots: 0, hits: 0, accuracy: null,
    damage: 0, damagePerShot: null,
    headshotHits: 0, headshotAccuracy: null,
    firstShots: 0, firstHits: 0, firstAccuracy: null,
    sprayShots: 0, sprayHits: 0, sprayAccuracy: null,
    scopedShots: 0,
    judgedShots: 0, slowEnoughShots: 0, counterStrafe: null,
    hitgroups: {},
  };
}
