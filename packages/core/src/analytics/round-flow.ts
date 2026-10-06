import type { Side } from '../types.js';

export interface RoundKillInput {
  tick: number;
  attackerSteamId: string | null;
  victimSteamId: string | null;
  attackerSide: Side | null;
  victimSide: Side | null;
  assisterSteamId: string | null;

  deathWasTraded: boolean | null;
}

export interface RoundInput {
  roundNum: number;
  winnerSide: Side | null;

  plantTick: number | null;

  startTick?: number | null;

  roster: { steamId: string; side: Side }[];
  kills: RoundKillInput[];

  teams?: { CT: string | null; T: string | null };

  teamSlots?: { CT: 'A' | 'B' | null; T: 'A' | 'B' | null };
}

export interface Clutch {
  steamId: string;
  side: Side;

  versus: number;
  tick: number;
  won: boolean;
}

export interface KastFlags {
  steamId: string;
  kill: boolean;
  assist: boolean;

  assists: number;
  survived: boolean;
  traded: boolean;

  kast: boolean;
}

export interface RoundState {
  aliveCT: number;
  aliveT: number;
  planted: boolean;
}

export interface StateChange {
  tick: number;

  steamId: string | null;
  side: Side | null;
  before: RoundState;
  after: RoundState;
}

export interface RoundFlow {
  roundNum: number;
  winnerSide: Side | null;

  opener: { steamId: string; side: Side } | null;

  openerWon: boolean | null;

  startingAlive: Record<Side, number>;

  firstAdvantage:
    | { side: Side; alive: number; enemies: number; tick: number; cause: 'kill' | 'absence' }
    | null;
  advantageWon: boolean | null;

  teams: { CT: string | null; T: string | null };

  teamSlots: { CT: 'A' | 'B' | null; T: 'A' | 'B' | null };

  roster: { steamId: string; side: Side }[];

  states: RoundState[];

  stateChanges: StateChange[];

  clutches: Clutch[];

  multikills: { steamId: string; kills: number }[];
  kast: KastFlags[];

  postPlantDeaths: number | null;
}

function isEnemyKill(k: RoundKillInput): boolean {
  return (
    k.attackerSteamId !== null &&
    k.victimSteamId !== null &&
    k.attackerSide !== null &&
    k.victimSide !== null &&
    k.attackerSide !== k.victimSide
  );
}

export function analyzeRound(round: RoundInput): RoundFlow {
  const kills = [...round.kills].sort((a, b) => a.tick - b.tick);

  const alive: Record<Side, Set<string>> = { CT: new Set(), T: new Set() };
  for (const p of round.roster) alive[p.side].add(p.steamId);

  const other = (side: Side): Side => (side === 'CT' ? 'T' : 'CT');

  let opener: RoundFlow['opener'] = null;
  let firstAdvantage: RoundFlow['firstAdvantage'] = null;
  const clutches: Clutch[] = [];
  const clutchedSides = new Set<Side>();
  const killCount = new Map<string, number>();
  const assistCount = new Map<string, number>();
  const died = new Set<string>();
  const tradedDeath = new Set<string>();
  let postPlantDeaths = 0;

  let planted = false;
  let plantEmitted = round.plantTick === null;
  const snapshot = (): RoundState => ({
    aliveCT: alive.CT.size,
    aliveT: alive.T.size,
    planted,
  });
  const startingAlive: Record<Side, number> = { CT: alive.CT.size, T: alive.T.size };

  if (startingAlive.CT !== startingAlive.T) {
    const side: Side = startingAlive.CT > startingAlive.T ? 'CT' : 'T';
    firstAdvantage = {
      side,
      alive: startingAlive[side],
      enemies: startingAlive[other(side)],
      tick: round.startTick ?? 0,
      cause: 'absence',
    };
  }

  const states: RoundState[] = [snapshot()];
  const stateChanges: StateChange[] = [];
  const emitPlant = (tick: number) => {
    const before = snapshot();
    planted = true;
    const after = snapshot();
    states.push(after);
    stateChanges.push({ tick, steamId: null, side: null, before, after });
    plantEmitted = true;
  };

  for (const k of kills) {
    if (!plantEmitted && round.plantTick !== null && k.tick >= round.plantTick) {
      emitPlant(round.plantTick);
    }
    const before = snapshot();
    const enemyKill = isEnemyKill(k);

    if (enemyKill && opener === null) {
      opener = { steamId: k.attackerSteamId!, side: k.attackerSide! };
    }
    if (enemyKill) {
      killCount.set(k.attackerSteamId!, (killCount.get(k.attackerSteamId!) ?? 0) + 1);
    }
    if (k.assisterSteamId) {
      assistCount.set(k.assisterSteamId, (assistCount.get(k.assisterSteamId) ?? 0) + 1);
    }

    if (k.victimSteamId !== null) {
      died.add(k.victimSteamId);
      if (k.deathWasTraded === true) tradedDeath.add(k.victimSteamId);
      if (k.victimSide !== null) alive[k.victimSide].delete(k.victimSteamId);
      else {
        alive.CT.delete(k.victimSteamId);
        alive.T.delete(k.victimSteamId);
      }
    }

    if (round.plantTick !== null && k.tick >= round.plantTick) postPlantDeaths += 1;

    if (k.victimSteamId !== null) {
      const after = snapshot();
      states.push(after);
      stateChanges.push({
        tick: k.tick,
        steamId: enemyKill ? k.attackerSteamId : null,
        side: enemyKill ? k.attackerSide : null,
        before,
        after,
      });
    }

    if (firstAdvantage === null && alive.CT.size !== alive.T.size) {
      const side: Side = alive.CT.size > alive.T.size ? 'CT' : 'T';
      firstAdvantage = {
        side,
        alive: alive[side].size,
        enemies: alive[other(side)].size,
        tick: k.tick,
        cause: 'kill',
      };
    }

    for (const side of ['CT', 'T'] as const) {
      if (clutchedSides.has(side)) continue;
      if (alive[side].size !== 1 || alive[other(side)].size < 1) continue;
      const steamId = [...alive[side]][0]!;
      clutchedSides.add(side);
      clutches.push({
        steamId,
        side,
        versus: alive[other(side)].size,
        tick: k.tick,
        won: round.winnerSide === side,
      });
    }
  }

  if (!plantEmitted && round.plantTick !== null) emitPlant(round.plantTick);

  const kast: KastFlags[] = round.roster.map((p) => {
    const kill = (killCount.get(p.steamId) ?? 0) > 0;
    const assists = assistCount.get(p.steamId) ?? 0;
    const survived = !died.has(p.steamId);
    const traded = tradedDeath.has(p.steamId);
    return {
      steamId: p.steamId,
      kill,
      assist: assists > 0,
      assists,
      survived,
      traded,
      kast: kill || assists > 0 || survived || traded,
    };
  });

  return {
    roundNum: round.roundNum,
    winnerSide: round.winnerSide,
    opener,
    openerWon: opener === null || round.winnerSide === null ? null : opener.side === round.winnerSide,
    firstAdvantage,
    advantageWon:
      firstAdvantage === null || round.winnerSide === null
        ? null
        : firstAdvantage.side === round.winnerSide,
    startingAlive,
    teams: round.teams ?? { CT: null, T: null },
    teamSlots: round.teamSlots ?? { CT: null, T: null },
    roster: [...round.roster],
    states,
    stateChanges,
    clutches,
    multikills: [...killCount.entries()]
      .filter(([, n]) => n >= 2)
      .map(([steamId, n]) => ({ steamId, kills: n }))
      .sort((a, b) => b.kills - a.kills),
    kast,
    postPlantDeaths: round.plantTick === null ? null : postPlantDeaths,
  };
}

export interface ClutchTally {
  steamId: string;
  tried: number;
  won: number;

  byVersus: { versus: number; tried: number; won: number }[];
}

export interface AdvantageTally {

  label: string;
  side: Side;

  teamName: string | null;

  teamSlot: 'A' | 'B' | null;

  cause: 'kill' | 'absence';
  rounds: number;
  won: number;
}

export interface MultikillTally {
  steamId: string;

  counts: number[];
}

export interface KastTally {
  steamId: string;
  rounds: number;
  kastRounds: number;
  kast: number | null;
}

export interface OpeningImpact {
  side: Side;

  opened: number;
  openedWon: number;
}

export interface MatchFlow {
  rounds: RoundFlow[];
  clutches: ClutchTally[];
  advantages: AdvantageTally[];
  multikills: MultikillTally[];
  kast: KastTally[];
  opening: OpeningImpact[];
}

export function summarizeFlow(rounds: readonly RoundFlow[]): MatchFlow {
  const clutches = new Map<string, ClutchTally>();
  const advantages = new Map<string, AdvantageTally>();
  const multikills = new Map<string, MultikillTally>();
  const kast = new Map<string, KastTally>();
  const opening = new Map<Side, OpeningImpact>();

  for (const r of rounds) {
    for (const c of r.clutches) {
      const t = clutches.get(c.steamId) ?? { steamId: c.steamId, tried: 0, won: 0, byVersus: [] };
      t.tried += 1;
      if (c.won) t.won += 1;
      const slot = t.byVersus.find((v) => v.versus === c.versus)
        ?? (t.byVersus.push({ versus: c.versus, tried: 0, won: 0 }), t.byVersus[t.byVersus.length - 1]!);
      slot.tried += 1;
      if (c.won) slot.won += 1;
      clutches.set(c.steamId, t);
    }

    if (r.firstAdvantage) {
      const { side, alive, enemies } = r.firstAdvantage;
      const label = `${alive}v${enemies}`;

      const teamName = r.teams[side];
      const teamSlot = r.teamSlots[side];
      const cause = r.firstAdvantage.cause;
      const key = `${teamSlot ?? teamName ?? '?'}|${side}|${label}|${cause}`;
      const t = advantages.get(key)
        ?? { label, side, teamName, teamSlot, cause, rounds: 0, won: 0 };
      t.rounds += 1;
      if (r.advantageWon) t.won += 1;
      advantages.set(key, t);
    }

    for (const m of r.multikills) {
      const t = multikills.get(m.steamId) ?? { steamId: m.steamId, counts: [0, 0, 0, 0] };

      const i = m.kills - 2;
      if (i >= 0) {
        while (t.counts.length <= i) t.counts.push(0);
        t.counts[i] = (t.counts[i] ?? 0) + 1;
      }
      multikills.set(m.steamId, t);
    }

    for (const k of r.kast) {
      const t = kast.get(k.steamId) ?? { steamId: k.steamId, rounds: 0, kastRounds: 0, kast: null };
      t.rounds += 1;
      if (k.kast) t.kastRounds += 1;
      kast.set(k.steamId, t);
    }

    if (r.opener) {
      const t = opening.get(r.opener.side) ?? { side: r.opener.side, opened: 0, openedWon: 0 };
      t.opened += 1;
      if (r.openerWon) t.openedWon += 1;
      opening.set(r.opener.side, t);
    }
  }

  return {
    rounds: [...rounds],
    clutches: [...clutches.values()]
      .map((c) => ({ ...c, byVersus: c.byVersus.sort((a, b) => a.versus - b.versus) }))
      .sort((a, b) => b.won - a.won || b.tried - a.tried),
    advantages: [...advantages.values()].sort(
      (a, b) =>
        (a.teamName ?? '').localeCompare(b.teamName ?? '') ||
        a.side.localeCompare(b.side) ||
        a.label.localeCompare(b.label),
    ),
    multikills: [...multikills.values()].sort(
      (a, b) => score(b.counts) - score(a.counts),
    ),
    kast: [...kast.values()]
      .map((k) => ({ ...k, kast: k.rounds > 0 ? k.kastRounds / k.rounds : null }))
      .sort((a, b) => (b.kast ?? 0) - (a.kast ?? 0)),
    opening: [...opening.values()],
  };
}

const score = (c: readonly number[]): number =>
  c[0]! + c[1]! * 10 + c[2]! * 100 + c[3]! * 1000;
