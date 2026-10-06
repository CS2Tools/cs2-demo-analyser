import {
  MIN_STATE_SAMPLE,
  playerImpact,
  rating2Approx,
  WinProbability,
  type StateObservation,
} from '@cs2/core';
import type { Db } from '@cs2/db';
import type { RatingAnalysis } from '@cs2/contract';
import { computeMatchFlow } from './round-flow-queries.js';

export async function loadWinProbability(db: Db): Promise<WinProbability> {
  const rows = await db.query<{
    alive_ct: number; alive_t: number; planted: boolean; ct_won: boolean;
  }>(
    `SELECT alive_ct, alive_t, planted, ct_won
       FROM round_states WHERE ct_won IS NOT NULL`,
  );
  const observations: StateObservation[] = rows.map((r) => ({
    aliveCT: Number(r.alive_ct),
    aliveT: Number(r.alive_t),
    planted: r.planted === true,
    ctWon: r.ct_won === true,
  }));
  return new WinProbability(observations);
}

interface PlayerRow {
  steam_id: string;
  name: string;
  team_name: string | null;
  rounds_played: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number | null;
  kast_pct: number | null;
}

export async function getRatingAnalysis(db: Db, matchId: string): Promise<RatingAnalysis> {
  const players = await db.query<PlayerRow>(
    `SELECT steam_id, name, team_name, rounds_played, kills, deaths, assists, adr, kast_pct
       FROM player_match WHERE match_id = ?`,
    [matchId],
  );

  const probability = await loadWinProbability(db);
  const flow = await computeMatchFlow(db, matchId);
  const impacts = new Map(
    playerImpact({ rounds: flow, probability }).map((i) => [i.steamId, i]),
  );

  const rows = players.map((p) => {
    const rounds = Number(p.rounds_played);
    const perRound = (n: number) => (rounds > 0 ? Number(n) / rounds : 0);
    const impact = impacts.get(p.steam_id);

    const rating =
      p.kast_pct === null
        ? null
        : rating2Approx({
            kastPct: Number(p.kast_pct) * 100,
            kpr: perRound(p.kills),
            dpr: perRound(p.deaths),
            apr: perRound(p.assists),
            adr: Number(p.adr ?? 0),
          });

    return {
      steamId: p.steam_id,
      name: p.name,
      teamName: p.team_name,
      rounds,
      rating,
      kast: p.kast_pct === null ? null : Number(p.kast_pct),
      kpr: perRound(p.kills),
      dpr: perRound(p.deaths),
      apr: perRound(p.assists),
      adr: Number(p.adr ?? 0),

      swingPerRound:
        impact === undefined
          ? null
          : impact.counted === 0 && impact.skipped > 0
            ? null
            : impact.swingPerRound,
      skippedKills: impact?.skipped ?? 0,
    };
  });

  const coverage = probability.coverage;
  return {
    players: rows.sort((a, b) => (b.rating ?? -9) - (a.rating ?? -9)),

    baseline: {
      states: coverage.states,
      observations: coverage.observations,
      minSample: MIN_STATE_SAMPLE,
    },
  };
}
