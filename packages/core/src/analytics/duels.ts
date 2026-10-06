import type { Side } from '../types.js';

export interface KillInput {
  killId: number;
  roundNum: number;
  tick: number;
  attackerSteamId: string | null;
  victimSteamId: string | null;
  attackerSide: Side | null;
  victimSide: Side | null;

  timeInRound: number;
}

export interface DuelFlags {
  killId: number;
  isFirstKillOfRound: boolean;

  isEntry: boolean;

  isTradeKill: boolean;
  tradedKillId: number | null;

  deathWasTraded: boolean;
  tradedByKillId: number | null;
}

export const DEFAULT_TRADE_WINDOW_SECONDS = 3;

export const ENTRY_MAX_SECONDS = 45;

export const ENTRY_MAX_LOSSES = 1;

export const ENTRY_MIN_ALIVE = 5 - ENTRY_MAX_LOSSES;

export interface DuelOptions {
  tradeWindowSeconds?: number;
  tickRate: number;

  rosterBySide?: Map<number, { CT: number; T: number }>;
}

export function classifyDuels(kills: KillInput[], options: DuelOptions): DuelFlags[] {
  const windowTicks = (options.tradeWindowSeconds ?? DEFAULT_TRADE_WINDOW_SECONDS) * options.tickRate;

  const sorted = [...kills].sort((a, b) => a.tick - b.tick || a.killId - b.killId);

  const flags = new Map<number, DuelFlags>();
  for (const k of sorted) {
    flags.set(k.killId, {
      killId: k.killId,
      isFirstKillOfRound: false,
      isEntry: false,
      isTradeKill: false,
      tradedKillId: null,
      deathWasTraded: false,
      tradedByKillId: null,
    });
  }

  const isTeamKill = (k: KillInput) =>
    k.attackerSide !== null && k.attackerSide === k.victimSide;

  const byRound = new Map<number, KillInput[]>();
  for (const k of sorted) {
    const list = byRound.get(k.roundNum) ?? [];
    list.push(k);
    byRound.set(k.roundNum, list);
  }

  for (const [, roundKills] of byRound) {
    const first = roundKills[0];
    if (first) flags.get(first.killId)!.isFirstKillOfRound = true;

    const roundNum = roundKills[0]?.roundNum;
    const elenco = (roundNum === undefined ? undefined : options.rosterBySide?.get(roundNum))
      ?? { CT: 5, T: 5 };
    const startingAlive = new Map<Side, number>([['CT', elenco.CT], ['T', elenco.T]]);
    const aliveBySide = new Map<Side, number>(startingAlive);
    const entryDone = new Set<Side>();

    for (const k of roundKills) {
      if (!isTeamKill(k) && k.attackerSide && !entryDone.has(k.attackerSide)) {
        const attackersAlive = aliveBySide.get(k.attackerSide) ?? 0;
        const defendersAlive = aliveBySide.get(k.attackerSide === 'CT' ? 'T' : 'CT') ?? 0;

        const defenderSide: Side = k.attackerSide === 'CT' ? 'T' : 'CT';
        const perdasAtacante = (startingAlive.get(k.attackerSide) ?? 5) - attackersAlive;
        const perdasDefensor = (startingAlive.get(defenderSide) ?? 5) - defendersAlive;
        if (
          k.timeInRound <= ENTRY_MAX_SECONDS &&
          perdasAtacante <= ENTRY_MAX_LOSSES &&
          perdasDefensor <= ENTRY_MAX_LOSSES
        ) {
          flags.get(k.killId)!.isEntry = true;
        }
        entryDone.add(k.attackerSide);
      }

      if (k.victimSide) {
        aliveBySide.set(k.victimSide, Math.max(0, (aliveBySide.get(k.victimSide) ?? 0) - 1));
      }
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const k2 = sorted[i]!;
    if (isTeamKill(k2) || !k2.victimSteamId) continue;

    for (let j = i - 1; j >= 0; j--) {
      const k1 = sorted[j]!;
      if (k2.tick - k1.tick > windowTicks) break;
      if (k1.roundNum !== k2.roundNum) continue;
      if (isTeamKill(k1)) continue;

      const vingouAlguem = k1.attackerSteamId === k2.victimSteamId;
      const mesmoLadoDaVitima =
        k1.victimSide !== null && k2.attackerSide === k1.victimSide;

      if (vingouAlguem && mesmoLadoDaVitima) {
        const f2 = flags.get(k2.killId)!;
        const f1 = flags.get(k1.killId)!;
        f2.isTradeKill = true;
        f2.tradedKillId = k1.killId;
        f1.deathWasTraded = true;
        f1.tradedByKillId = k2.killId;
        break;
      }
    }
  }

  return sorted.map((k) => flags.get(k.killId)!);
}

export interface DuelSummary {
  entryAttempts: number;
  entryKills: number;
  entryDeaths: number;
  tradeKills: number;
  tradedDeaths: number;
  deaths: number;

  tradedDeathRate: number | null;
}

export function summarizeDuels(
  kills: KillInput[],
  flags: DuelFlags[],
  steamId: string,
): DuelSummary {
  const byId = new Map(flags.map((f) => [f.killId, f]));

  let entryKills = 0;
  let entryDeaths = 0;
  let tradeKills = 0;
  let tradedDeaths = 0;
  let deaths = 0;

  for (const k of kills) {
    const f = byId.get(k.killId);
    if (!f) continue;

    if (k.attackerSteamId === steamId) {
      if (f.isEntry) entryKills++;
      if (f.isTradeKill) tradeKills++;
    }
    if (k.victimSteamId === steamId) {
      deaths++;
      if (f.isEntry) entryDeaths++;
      if (f.deathWasTraded) tradedDeaths++;
    }
  }

  return {
    entryAttempts: entryKills + entryDeaths,
    entryKills,
    entryDeaths,
    tradeKills,
    tradedDeaths,
    deaths,
    tradedDeathRate: deaths > 0 ? tradedDeaths / deaths : null,
  };
}
