export const C4_TIMER_REFERENCE_SECONDS = 41;

export const DEFUSE_SECONDS = { withKit: 5, withoutKit: 10 } as const;

export function siteFromPlace(place: string | null | undefined): 'A' | 'B' | null {
  const m = /bombsite\s*([AB])\b/i.exec(place ?? '') ?? /\b([AB])\s*site\b/i.exec(place ?? '');
  return m ? (m[1]!.toUpperCase() as 'A' | 'B') : null;
}

export interface BombEventInput {
  tick: number;
  type: 'planted' | 'defused' | 'exploded' | 'begindefuse';
}

export interface RoundWindow {
  startTick: number;
  endTick: number;
}

export function plantForRound<T extends BombEventInput>(events: T[], round: RoundWindow): T | null {
  const plants = events.filter(
    (e) => e.type === 'planted' && e.tick >= round.startTick && e.tick <= round.endTick,
  );
  return plants.length > 0 ? plants.reduce((a, b) => (b.tick > a.tick ? b : a)) : null;
}

export interface C4Timer {
  seconds: number;
  source: 'measured' | 'reference';

  samples: number;
}

export function measureC4Timer(
  rounds: RoundWindow[],
  events: BombEventInput[],
  tickRate: number,
): C4Timer {
  const deltas: number[] = [];
  for (const r of rounds) {
    const explosion = events.find(
      (e) => e.type === 'exploded' && e.tick >= r.startTick && e.tick <= r.endTick,
    );
    if (!explosion) continue;
    const plant = plantForRound(
      events.filter((e) => e.tick <= explosion.tick),
      r,
    );
    if (plant) deltas.push((explosion.tick - plant.tick) / tickRate);
  }
  if (deltas.length === 0) {
    return { seconds: C4_TIMER_REFERENCE_SECONDS, source: 'reference', samples: 0 };
  }
  const s = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const median = s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  return { seconds: Math.round(median * 1000) / 1000, source: 'measured', samples: deltas.length };
}

export interface BombRoundInput {
  roundNum: number;

  site: 'A' | 'B' | null;
  plantTick: number | null;
  defuseTick: number | null;
  explodeTick: number | null;

  freezeEndTick: number | null;
  winnerSide: 'CT' | 'T' | null;

  defuseWithKit: boolean | null;
}

export interface BombSiteTally {

  site: 'A' | 'B' | null;
  plants: number;

  tWon: number;

  ctWon: number;
  defused: number;
  exploded: number;

  medianPlantSeconds: number | null;
}

export interface BombSummary {
  bySite: BombSiteTally[];
  plants: number;
  defused: number;
  exploded: number;
  defusedWithKit: number;
  defusedWithoutKit: number;

  medianSecondsLeftOnDefuse: number | null;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
};

export function summarizeBomb(
  rounds: readonly BombRoundInput[],
  tickRate: number,
  c4TimerSeconds: number,
): BombSummary {
  const planted = rounds.filter((r) => r.plantTick !== null);
  const bySite = new Map<string, BombSiteTally & { plantSeconds: number[] }>();

  let defusedWithKit = 0;
  let defusedWithoutKit = 0;
  const secondsLeft: number[] = [];

  for (const r of planted) {
    const key = r.site ?? '?';
    const t = bySite.get(key) ?? {
      site: r.site,
      plants: 0, tWon: 0, ctWon: 0, defused: 0, exploded: 0,
      medianPlantSeconds: null,
      plantSeconds: [],
    };

    t.plants += 1;
    if (r.winnerSide === 'T') t.tWon += 1;
    if (r.winnerSide === 'CT') t.ctWon += 1;
    if (r.defuseTick !== null) t.defused += 1;
    if (r.explodeTick !== null) t.exploded += 1;
    if (r.freezeEndTick !== null && r.plantTick !== null) {
      t.plantSeconds.push((r.plantTick - r.freezeEndTick) / tickRate);
    }
    bySite.set(key, t);

    if (r.defuseTick !== null) {
      if (r.defuseWithKit === true) defusedWithKit += 1;
      else if (r.defuseWithKit === false) defusedWithoutKit += 1;
      if (r.plantTick !== null) {
        secondsLeft.push(c4TimerSeconds - (r.defuseTick - r.plantTick) / tickRate);
      }
    }
  }

  return {
    bySite: [...bySite.values()]
      .map(({ plantSeconds, ...rest }) => ({
        ...rest,
        medianPlantSeconds: median(plantSeconds),
      }))
      .sort((a, b) => (a.site ?? 'Z').localeCompare(b.site ?? 'Z')),
    plants: planted.length,
    defused: planted.filter((r) => r.defuseTick !== null).length,
    exploded: planted.filter((r) => r.explodeTick !== null).length,
    defusedWithKit,
    defusedWithoutKit,
    medianSecondsLeftOnDefuse: median(secondsLeft),
  };
}
