import type { Side } from '../types.js';

export interface TradeKillInput {
  tick: number;
  attackerSteamId: string | null;
  victimSteamId: string | null;
  attackerSide: Side | null;
  victimSide: Side | null;
}

export interface TradeDamageInput {
  tick: number;
  attackerSteamId: string | null;
  victimSteamId: string | null;
}

export interface TradeRoundInput {
  roundNum: number;
  roster: { steamId: string; side: Side }[];
  kills: TradeKillInput[];
  damages: TradeDamageInput[];
}

export interface TradeTally {
  steamId: string;

  opportunities: number;

  attempts: number;

  successes: number;

  deaths: number;

  deathsWithOpportunity: number;

  deathsWithAttempt: number;

  deathsTraded: number;
}

const blank = (steamId: string): TradeTally => ({
  steamId,
  opportunities: 0,
  attempts: 0,
  successes: 0,
  deaths: 0,
  deathsWithOpportunity: 0,
  deathsWithAttempt: 0,
  deathsTraded: 0,
});

export function summarizeTrades(
  rounds: readonly TradeRoundInput[],
  windowTicks: number,
): TradeTally[] {
  const out = new Map<string, TradeTally>();
  const of = (steamId: string): TradeTally => {
    const t = out.get(steamId) ?? blank(steamId);
    out.set(steamId, t);
    return t;
  };

  for (const round of rounds) {
    const alive: Record<Side, Set<string>> = { CT: new Set(), T: new Set() };
    for (const p of round.roster) {
      alive[p.side].add(p.steamId);
      of(p.steamId);
    }

    const kills = [...round.kills].sort((a, b) => a.tick - b.tick);

    for (const k of kills) {
      const killer = k.attackerSteamId;
      const victim = k.victimSteamId;
      if (victim === null) continue;

      const victimSide = k.victimSide;
      const enemyKill =
        killer !== null && k.attackerSide !== null && victimSide !== null && k.attackerSide !== victimSide;

      if (enemyKill && victimSide !== null) {

        const mates = [...alive[victimSide]].filter((id) => id !== victim);

        let anyAttempt = false;
        let anySuccess = false;

        for (const mate of mates) {
          const t = of(mate);
          t.opportunities += 1;

          const attempted = round.damages.some(
            (d) =>
              d.attackerSteamId === mate &&
              d.victimSteamId === killer &&
              d.tick > k.tick &&
              d.tick <= k.tick + windowTicks,
          );
          const avenged = kills.some(
            (x) =>
              x.attackerSteamId === mate &&
              x.victimSteamId === killer &&
              x.tick > k.tick &&
              x.tick <= k.tick + windowTicks,
          );

          if (attempted || avenged) {
            t.attempts += 1;
            anyAttempt = true;
          }
          if (avenged) {
            t.successes += 1;
            anySuccess = true;
          }
        }

        const dead = of(victim);
        dead.deaths += 1;
        if (mates.length > 0) dead.deathsWithOpportunity += 1;
        if (anyAttempt) dead.deathsWithAttempt += 1;
        if (anySuccess) dead.deathsTraded += 1;
      }

      if (victimSide !== null) alive[victimSide].delete(victim);
      else {
        alive.CT.delete(victim);
        alive.T.delete(victim);
      }
    }
  }

  return [...out.values()].sort((a, b) => b.opportunities - a.opportunities);
}
