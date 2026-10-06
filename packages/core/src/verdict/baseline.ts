import type {
  Direction,
  FixedReferenceBaseline,
  MatchRelativeBaseline,
  OwnHistoryBaseline,
} from './types.js';

export const MIN_HISTORY_MATCHES = 5;

export const MIN_MATCH_PEERS = 6;

export const PEER_ROUND_SHARE = 0.5;

export function hasEnoughPresence(roundsPlayed: number, liveRounds: number): boolean {
  if (liveRounds <= 0) return true;
  return roundsPlayed >= liveRounds * PEER_ROUND_SHARE;
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export function ownHistoryBaseline(history: number[]): OwnHistoryBaseline | null {
  if (history.length < MIN_HISTORY_MATCHES) return null;
  return {
    kind: 'own_history',
    matches: history.length,
    mean: mean(history),
    sd: sd(history),
    p25: quantile(history, 0.25),
    p50: quantile(history, 0.5),
    p75: quantile(history, 0.75),
  };
}

export function matchRelativeBaseline(
  value: number,
  peers: number[],
  direction: Direction,
): MatchRelativeBaseline | null {
  if (peers.length < MIN_MATCH_PEERS) return null;
  const key = (v: number) =>
    direction === 'higher_better' ? -v : direction === 'lower_better' ? v : Math.abs(v);
  const better = peers.filter((p) => key(p) < key(value)).length;
  return {
    kind: 'match_relative',
    sampleSize: peers.length,
    mean: mean(peers),
    sd: sd(peers),
    rank: better + 1,
    of: peers.length,
  };
}

export interface FixedReferenceSpec extends Omit<FixedReferenceBaseline, 'kind'> {

  scale: number;
}

export function goodnessFrom(
  value: number,
  center: number,
  spread: number,
  direction: Direction,
  floor: number,
): number {
  const s = Math.max(spread, floor);
  switch (direction) {
    case 'higher_better':
      return (value - center) / s;
    case 'lower_better':
      return (center - value) / s;
    case 'closer_to_zero':
      return (Math.abs(center) - Math.abs(value)) / s;
  }
}
