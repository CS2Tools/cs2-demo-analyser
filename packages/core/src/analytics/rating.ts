import type { Side } from '../types.js';
import type { RoundState, StateChange } from './round-flow.js';

export const RATING2_COEFFICIENTS = {
  kast: 0.0073,
  kpr: 0.3591,
  dpr: -0.5329,
  impact: 0.2372,
  adr: 0.0032,
  intercept: 0.1587,
} as const;

export const IMPACT_COEFFICIENTS = { kpr: 2.13, apr: 0.42, intercept: -0.41 } as const;

export interface RatingInput {

  kastPct: number;

  kpr: number;

  dpr: number;

  apr: number;

  adr: number;
}

export function impactApprox(input: Pick<RatingInput, 'kpr' | 'apr'>): number {
  return (
    IMPACT_COEFFICIENTS.kpr * input.kpr +
    IMPACT_COEFFICIENTS.apr * input.apr +
    IMPACT_COEFFICIENTS.intercept
  );
}

export function rating2Approx(input: RatingInput): number {
  const c = RATING2_COEFFICIENTS;
  return (
    c.kast * input.kastPct +
    c.kpr * input.kpr +
    c.dpr * input.dpr +
    c.impact * impactApprox(input) +
    c.adr * input.adr +
    c.intercept
  );
}

export const MIN_STATE_SAMPLE = 20;

export interface StateObservation {
  aliveCT: number;
  aliveT: number;
  planted: boolean;
  ctWon: boolean;
}

export const stateKey = (s: RoundState): string =>
  `${s.aliveCT}v${s.aliveT}${s.planted ? '+bomba' : ''}`;

const coarseKey = (s: RoundState): string => `${s.aliveCT}v${s.aliveT}`;

export interface StateProbability {

  ctWinRate: number;

  sample: number;

  from: 'exact' | 'coarse';
}

export class WinProbability {
  private readonly exact = new Map<string, { won: number; n: number }>();
  private readonly coarse = new Map<string, { won: number; n: number }>();

  constructor(
    observations: readonly StateObservation[],
    private readonly minSample: number = MIN_STATE_SAMPLE,
  ) {
    for (const o of observations) {
      const state = { aliveCT: o.aliveCT, aliveT: o.aliveT, planted: o.planted };
      for (const [map, key] of [
        [this.exact, stateKey(state)],
        [this.coarse, coarseKey(state)],
      ] as const) {
        const cur = map.get(key) ?? { won: 0, n: 0 };
        cur.n += 1;
        if (o.ctWon) cur.won += 1;
        map.set(key, cur);
      }
    }
  }

  ctWinRate(state: RoundState): StateProbability | null {
    const hit = this.exact.get(stateKey(state));
    if (hit && hit.n >= this.minSample) {
      return { ctWinRate: hit.won / hit.n, sample: hit.n, from: 'exact' };
    }
    const fallback = this.coarse.get(coarseKey(state));
    if (fallback && fallback.n >= this.minSample) {
      return { ctWinRate: fallback.won / fallback.n, sample: fallback.n, from: 'coarse' };
    }
    return null;
  }

  get coverage(): { states: number; observations: number } {
    let states = 0;
    let observations = 0;
    for (const v of this.exact.values()) {
      observations += v.n;
      if (v.n >= this.minSample) states += 1;
    }
    return { states, observations };
  }
}

export interface PlayerImpact {
  steamId: string;

  swing: number;

  rounds: number;

  swingPerRound: number;

  counted: number;

  skipped: number;
}

export function changeSwing(
  change: StateChange,
  probability: WinProbability,
): number | null {
  if (change.side === null) return null;
  const before = probability.ctWinRate(change.before);
  const after = probability.ctWinRate(change.after);
  if (before === null || after === null) return null;
  const delta = after.ctWinRate - before.ctWinRate;

  return change.side === 'CT' ? delta : -delta;
}

export function playerImpact(input: {
  rounds: readonly { stateChanges: readonly StateChange[]; roster: readonly { steamId: string; side: Side }[] }[];
  probability: WinProbability;
}): PlayerImpact[] {
  const acc = new Map<string, { swing: number; rounds: number; counted: number; skipped: number }>();
  const get = (id: string) => {
    const cur = acc.get(id) ?? { swing: 0, rounds: 0, counted: 0, skipped: 0 };
    acc.set(id, cur);
    return cur;
  };

  for (const r of input.rounds) {
    for (const p of r.roster) get(p.steamId).rounds += 1;
    for (const c of r.stateChanges) {
      if (c.steamId === null) continue;
      const swing = changeSwing(c, input.probability);
      if (swing === null) get(c.steamId).skipped += 1;
      else {
        const p = get(c.steamId);
        p.swing += swing;
        p.counted += 1;
      }
    }
  }

  return [...acc.entries()]
    .map(([steamId, v]) => ({
      steamId,
      swing: v.swing,
      rounds: v.rounds,
      swingPerRound: v.rounds > 0 ? v.swing / v.rounds : 0,
      counted: v.counted,
      skipped: v.skipped,
    }))
    .sort((a, b) => b.swingPerRound - a.swingPerRound);
}
