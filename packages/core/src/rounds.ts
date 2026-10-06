import type { Side } from './types.js';

export type RoundPhase = 'live' | 'knife' | 'warmup' | 'restart_discarded';

export interface RawRoundEnd {
  tick: number;

  winner: string | null;
  reason: string | null;

  gameRound: number | null;
}

export interface SegmentationInput {

  matchStartTicks: number[];

  startTicks: number[];

  freezeEndTicks: number[];

  ends: RawRoundEnd[];

  officialEndTicks?: number[];

  knifeRoundTicks?: number[];

  roundsPerHalf?: number;
}

export interface SegmentedRound {

  roundNum: number | null;
  gameRoundNum: number | null;
  phase: RoundPhase;
  startTick: number | null;
  freezeEndTick: number | null;
  endTick: number;
  officialEndTick: number | null;
  winnerSide: Side | null;
  winReason: string | null;
  half: number | null;
  isOvertime: boolean;
}

export interface Segmentation {

  matchStartTick: number;

  restartCount: number;
  knifeRoundTick: number | null;
  rounds: SegmentedRound[];
  liveRoundCount: number;

  ctRoundsWon: number;
  tRoundsWon: number;
}

const DEFAULT_ROUNDS_PER_HALF = 12;

function isRealRoundEnd(e: RawRoundEnd): boolean {
  return e.tick > 1 && (e.winner === 'CT' || e.winner === 'T');
}

function lastBefore(sorted: number[], limit: number, floor: number): number | null {
  let found: number | null = null;
  for (const t of sorted) {
    if (t > limit) break;
    if (t > floor) found = t;
  }
  return found;
}

function firstAtOrAfter(sorted: number[], from: number): number | null {
  for (const t of sorted) if (t >= from) return t;
  return null;
}

export function segmentRounds(input: SegmentationInput): Segmentation {
  const roundsPerHalf = input.roundsPerHalf ?? DEFAULT_ROUNDS_PER_HALF;

  const matchStarts = [...input.matchStartTicks].sort((a, b) => a - b);
  const starts = [...input.startTicks].sort((a, b) => a - b);
  const freezeEnds = [...input.freezeEndTicks].sort((a, b) => a - b);
  const officialEnds = [...(input.officialEndTicks ?? [])].sort((a, b) => a - b);
  const knifeHints = new Set(input.knifeRoundTicks ?? []);

  const ends = input.ends.filter(isRealRoundEnd).sort((a, b) => a.tick - b.tick);

  const matchStartTick = matchStarts.length
    ? matchStarts[matchStarts.length - 1]!
    : (freezeEnds[0] ?? 0);
  const firstMatchStart = matchStarts[0] ?? matchStartTick;
  const restartCount = Math.max(0, matchStarts.length - 1);

  const preMatch = ends.filter((e) => e.tick <= matchStartTick);

  let knifeRoundTick: number | null = null;
  if (knifeHints.size > 0) {
    knifeRoundTick = preMatch.map((e) => e.tick).filter((t) => knifeHints.has(t)).pop() ?? null;
  } else if (matchStarts.length > 1) {
    knifeRoundTick =
      preMatch.filter((e) => e.tick > firstMatchStart).map((e) => e.tick).pop() ?? null;
  }

  const rounds: SegmentedRound[] = [];
  let liveIndex = 0;
  let previousEnd = 0;
  let ctRoundsWon = 0;
  let tRoundsWon = 0;

  for (const end of ends) {
    const isLive = end.tick > matchStartTick;

    let phase: RoundPhase;
    if (isLive) phase = 'live';
    else if (end.tick === knifeRoundTick) phase = 'knife';
    else if (end.tick <= firstMatchStart) phase = 'warmup';
    else phase = 'restart_discarded';

    const winnerSide = end.winner === 'CT' || end.winner === 'T' ? (end.winner as Side) : null;

    let roundNum: number | null = null;
    let half: number | null = null;
    let isOvertime = false;

    if (isLive) {
      roundNum = ++liveIndex;
      half = Math.floor((roundNum - 1) / roundsPerHalf) + 1;
      isOvertime = roundNum > roundsPerHalf * 2;
      if (winnerSide === 'CT') ctRoundsWon++;
      else if (winnerSide === 'T') tRoundsWon++;
    }

    rounds.push({
      roundNum,
      gameRoundNum: end.gameRound,
      phase,
      startTick: lastBefore(starts, end.tick, previousEnd),
      freezeEndTick: lastBefore(freezeEnds, end.tick, previousEnd),
      endTick: end.tick,
      officialEndTick: firstAtOrAfter(officialEnds, end.tick),
      winnerSide,
      winReason: end.reason,
      half,
      isOvertime,
    });

    previousEnd = end.tick;
  }

  return {
    matchStartTick,
    restartCount,
    knifeRoundTick,
    rounds,
    liveRoundCount: liveIndex,
    ctRoundsWon,
    tRoundsWon,
  };
}

export const liveRounds = (s: Segmentation): SegmentedRound[] =>
  s.rounds.filter((r) => r.phase === 'live');

export function scoreBeforeRound(
  rounds: readonly {
    roundNum: number | null;
    scoreAAfter: number | null;
    scoreBAfter: number | null;
    winnerTeam: 'A' | 'B' | null;
  }[],
  roundNum: number,
): { a: number; b: number } {
  const earlier = rounds
    .filter((r) => r.roundNum !== null && r.roundNum < roundNum)
    .sort((x, y) => x.roundNum! - y.roundNum!);

  const last = [...earlier].reverse()
    .find((r) => r.scoreAAfter !== null && r.scoreBAfter !== null);
  if (last) return { a: Number(last.scoreAAfter), b: Number(last.scoreBAfter) };

  return {
    a: earlier.filter((r) => r.winnerTeam === 'A').length,
    b: earlier.filter((r) => r.winnerTeam === 'B').length,
  };
}
