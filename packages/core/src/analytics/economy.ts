import type { Side } from '../types.js';
import type { BuyCategory } from '../weapons.js';

export const LOSS_BONUS_STEPS = [1400, 1900, 2400, 2900, 3400] as const;

export const LOSS_BONUS_START_STEP = 1;

export interface BuyRound {
  roundNum: number;

  half: number | null;
  winnerSide: Side | null;
  ctBuyType: BuyCategory | null;
  tBuyType: BuyCategory | null;
}

export interface LossBonusRow {
  roundNum: number;

  ct: number;
  t: number;
  ctStep: number;
  tStep: number;
}

const stepValue = (step: number): number =>
  LOSS_BONUS_STEPS[Math.max(0, Math.min(LOSS_BONUS_STEPS.length - 1, step))]!;

export function lossBonusSeries(rounds: BuyRound[]): LossBonusRow[] {
  const ordered = [...rounds].sort((a, b) => a.roundNum - b.roundNum);
  const out: LossBonusRow[] = [];
  let step: Record<Side, number> = { CT: LOSS_BONUS_START_STEP, T: LOSS_BONUS_START_STEP };
  let half: number | null = null;

  for (const round of ordered) {
    if (round.half !== half) {
      half = round.half;
      step = { CT: LOSS_BONUS_START_STEP, T: LOSS_BONUS_START_STEP };
    }

    out.push({
      roundNum: round.roundNum,
      ct: stepValue(step.CT),
      t: stepValue(step.T),
      ctStep: step.CT,
      tStep: step.T,
    });

    if (round.winnerSide) {
      const loser: Side = round.winnerSide === 'CT' ? 'T' : 'CT';
      step[round.winnerSide] = Math.max(0, step[round.winnerSide] - 1);
      step[loser] = Math.min(LOSS_BONUS_STEPS.length - 1, step[loser] + 1);
    }
  }
  return out;
}

const buyOf = (round: BuyRound, side: Side): BuyCategory | null =>
  side === 'CT' ? round.ctBuyType : round.tBuyType;

const SIDES: Side[] = ['CT', 'T'];

export interface BreakPoint {

  roundNum: number;
  side: Side;
  nextBuyType: BuyCategory;
}

export function breakPoints(rounds: BuyRound[]): BreakPoint[] {
  const ordered = [...rounds].sort((a, b) => a.roundNum - b.roundNum);
  const out: BreakPoint[] = [];

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const cur = ordered[i]!;
    const next = ordered[i + 1]!;
    if (cur.half !== next.half) continue;
    for (const side of SIDES) {
      const nextBuy = buyOf(next, side);
      if (buyOf(cur, side) !== 'full_buy' || !nextBuy) continue;
      if (nextBuy === 'full_buy' || nextBuy === 'force_buy') continue;
      out.push({ roundNum: cur.roundNum, side, nextBuyType: nextBuy });
    }
  }
  return out;
}

export interface ForceBuyCost {
  roundNum: number;
  side: Side;
  won: boolean;

  roundsUntilFullBuy: number | null;
}

export function forceBuyCosts(rounds: BuyRound[]): ForceBuyCost[] {
  const ordered = [...rounds].sort((a, b) => a.roundNum - b.roundNum);
  const out: ForceBuyCost[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const cur = ordered[i]!;
    for (const side of SIDES) {
      if (buyOf(cur, side) !== 'force_buy') continue;
      let until: number | null = null;
      for (let j = i + 1; j < ordered.length; j += 1) {
        const later = ordered[j]!;
        if (later.half !== cur.half) break;
        if (buyOf(later, side) === 'full_buy') {
          until = later.roundNum - cur.roundNum;
          break;
        }
      }
      out.push({
        roundNum: cur.roundNum,
        side,
        won: cur.winnerSide === side,
        roundsUntilFullBuy: until,
      });
    }
  }
  return out;
}

export interface BuyConversion {
  side: Side;
  buyType: BuyCategory;
  rounds: number;
  won: number;
}

export function buyConversion(rounds: BuyRound[]): BuyConversion[] {
  const acc = new Map<string, BuyConversion>();
  for (const round of rounds) {
    for (const side of SIDES) {
      const buyType = buyOf(round, side);
      if (!buyType) continue;
      const key = `${side}|${buyType}`;
      const cur = acc.get(key) ?? { side, buyType, rounds: 0, won: 0 };
      cur.rounds += 1;
      if (round.winnerSide === side) cur.won += 1;
      acc.set(key, cur);
    }
  }
  return [...acc.values()];
}

export interface EconPlayerRound {
  roundNum: number;
  steamId: string;
  side: Side | null;

  startBalance: number;

  spent: number;

  equipValue: number;
  survived: boolean;
}

export interface EconKill {
  roundNum: number;
  victimSteamId: string;
  attackerSteamId: string | null;
  attackerSide: Side | null;
}

export interface EconTotals {

  equipDestroyed: number;

  equipSaved: number;

  leftOnTable: number;
}

export interface EconomicImpact {
  bySide: (EconTotals & { side: Side; spent: number })[];
  byPlayer: (EconTotals & { steamId: string; spent: number })[];
}

export function economicImpact(input: {
  players: EconPlayerRound[];
  kills: EconKill[];
  teamBuyType: { roundNum: number; side: Side; buyType: BuyCategory | null }[];
}): EconomicImpact {
  const { players, kills, teamBuyType } = input;

  const sideOf = new Map<string, Side | null>();
  const equipOf = new Map<string, number>();
  for (const p of players) {
    sideOf.set(`${p.roundNum}|${p.steamId}`, p.side);
    equipOf.set(`${p.roundNum}|${p.steamId}`, p.equipValue);
  }
  const teamBuy = new Map(teamBuyType.map((t) => [`${t.roundNum}|${t.side}`, t.buyType]));

  const empty = (): EconTotals & { spent: number } =>
    ({ equipDestroyed: 0, equipSaved: 0, leftOnTable: 0, spent: 0 });
  const bySide = new Map<Side, EconTotals & { spent: number }>(
    SIDES.map((s) => [s, empty()]),
  );
  const byPlayer = new Map<string, EconTotals & { spent: number }>();
  const player = (id: string) => {
    const cur = byPlayer.get(id) ?? empty();
    byPlayer.set(id, cur);
    return cur;
  };

  for (const k of kills) {
    const victimSide = sideOf.get(`${k.roundNum}|${k.victimSteamId}`) ?? null;
    if (!k.attackerSide || !victimSide || k.attackerSide === victimSide) continue;
    const value = equipOf.get(`${k.roundNum}|${k.victimSteamId}`) ?? 0;
    bySide.get(k.attackerSide)!.equipDestroyed += value;
    if (k.attackerSteamId) player(k.attackerSteamId).equipDestroyed += value;
  }

  for (const p of players) {
    const acc = player(p.steamId);
    acc.spent += p.spent;
    if (p.side) bySide.get(p.side)!.spent += p.spent;

    if (p.survived) {
      acc.equipSaved += p.equipValue;
      if (p.side) bySide.get(p.side)!.equipSaved += p.equipValue;
    }

    const isFullBuy = p.side && teamBuy.get(`${p.roundNum}|${p.side}`) === 'full_buy';
    if (isFullBuy) {
      const left = Math.max(0, p.startBalance - p.spent);
      acc.leftOnTable += left;
      bySide.get(p.side!)!.leftOnTable += left;
    }
  }

  return {
    bySide: SIDES.map((side) => ({ side, ...bySide.get(side)! })),
    byPlayer: [...byPlayer.entries()].map(([steamId, totals]) => ({ steamId, ...totals })),
  };
}
