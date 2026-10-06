import {
  analyzeRound,
  DEFAULT_TRADE_WINDOW_SECONDS,
  summarizeTrades,
  summarizeFlow,
  type MatchFlow,
  type RoundFlow,
  type Side,
  type TradeTally,
} from '@cs2/core';
import type { Db, SqlValue } from '@cs2/db';

export const ROUND_STATS_VERSION = 2;

interface RosterRow {
  round_num: number;
  steam_id: string;
  side: string | null;
}

interface KillRow {
  round_num: number;
  tick: number;
  attacker_steam_id: string | null;
  victim_steam_id: string | null;
  attacker_side: string | null;
  victim_side: string | null;
  assister_steam_id: string | null;
  death_was_traded: boolean | null;
}

interface RoundRow {
  round_num: number;
  winner_side: string | null;
  bomb_plant_tick: number | null;
  freeze_end_tick: number | null;
}

export async function computeMatchFlow(db: Db, matchId: string): Promise<RoundFlow[]> {
  const rounds = await db.query<RoundRow>(
    `SELECT round_num, winner_side, bomb_plant_tick, freeze_end_tick
       FROM rounds
      WHERE match_id = ? AND phase = 'live' AND round_num IS NOT NULL
      ORDER BY round_num`,
    [matchId],
  );
  if (rounds.length === 0) return [];

  const roster = await db.query<RosterRow>(
    `SELECT round_num, steam_id, side
       FROM player_round_stats WHERE match_id = ? AND side IS NOT NULL`,
    [matchId],
  );

  const kills = await db.query<KillRow>(
    `SELECT round_num, tick, attacker_steam_id, victim_steam_id,
            attacker_side, victim_side, assister_steam_id, death_was_traded
       FROM kills
      WHERE match_id = ? AND round_num IS NOT NULL
      ORDER BY round_num, tick`,
    [matchId],
  );

  const teamOf = new Map<string, string | null>();

  const slotOf = new Map<string, string | null>();
  for (const p of await db.query<{
    steam_id: string; team_name: string | null; team_slot: string | null;
  }>(
    'SELECT steam_id, team_name, team_slot FROM player_match WHERE match_id = ?',
    [matchId],
  )) {
    teamOf.set(p.steam_id, p.team_name);
    slotOf.set(p.steam_id, p.team_slot);
  }

  const rosterOf = new Map<number, { steamId: string; side: Side }[]>();
  for (const r of roster) {
    const n = Number(r.round_num);
    const list = rosterOf.get(n) ?? [];
    list.push({ steamId: r.steam_id, side: r.side as Side });
    rosterOf.set(n, list);
  }

  const killsOf = new Map<number, KillRow[]>();
  for (const k of kills) {
    const n = Number(k.round_num);
    const list = killsOf.get(n) ?? [];
    list.push(k);
    killsOf.set(n, list);
  }

  return rounds.map((r) => {
    const n = Number(r.round_num);
    return analyzeRound({
      roundNum: n,
      winnerSide: (r.winner_side as Side | null) ?? null,
      plantTick: r.bomb_plant_tick === null ? null : Number(r.bomb_plant_tick),
      startTick: r.freeze_end_tick === null ? null : Number(r.freeze_end_tick),
      roster: rosterOf.get(n) ?? [],
      teams: teamsOfRound(rosterOf.get(n) ?? [], teamOf),
      teamSlots: teamsOfRound(rosterOf.get(n) ?? [], slotOf) as {
        CT: 'A' | 'B' | null; T: 'A' | 'B' | null;
      },
      kills: (killsOf.get(n) ?? []).map((k) => ({
        tick: Number(k.tick),
        attackerSteamId: k.attacker_steam_id,
        victimSteamId: k.victim_steam_id,
        attackerSide: (k.attacker_side as Side | null) ?? null,
        victimSide: (k.victim_side as Side | null) ?? null,
        assisterSteamId: k.assister_steam_id,
        deathWasTraded: k.death_was_traded,
      })),
    });
  });
}

export async function getRoundsAnalysis(db: Db, matchId: string): Promise<MatchFlow> {
  return summarizeFlow(await computeMatchFlow(db, matchId));
}

export async function ensureRoundStats(db: Db): Promise<{ updated: string[] }> {
  const pending = await db.query<{ match_id: string }>(
    `SELECT match_id FROM matches WHERE COALESCE(round_stats_version, 0) <> ?`,
    [ROUND_STATS_VERSION],
  );

  const updated: string[] = [];
  for (const m of pending) {
    const flow = await computeMatchFlow(db, m.match_id);
    await materialize(db, m.match_id, flow);
    updated.push(m.match_id);
  }
  return { updated };
}

async function materialize(db: Db, matchId: string, flow: RoundFlow[]): Promise<void> {
  const perRound: SqlValue[][] = [];
  const assists = new Map<string, number>();
  const kastRounds = new Map<string, number>();
  const roundsPlayed = new Map<string, number>();
  const clutchTried = new Map<string, number>();
  const clutchWon = new Map<string, number>();

  for (const r of flow) {
    const clutchOf = new Map(r.clutches.map((c) => [c.steamId, c]));

    for (const k of r.kast) {
      roundsPlayed.set(k.steamId, (roundsPlayed.get(k.steamId) ?? 0) + 1);
      if (k.kast) kastRounds.set(k.steamId, (kastRounds.get(k.steamId) ?? 0) + 1);
      if (k.assists > 0) assists.set(k.steamId, (assists.get(k.steamId) ?? 0) + k.assists);

      const c = clutchOf.get(k.steamId);
      if (c) {
        clutchTried.set(k.steamId, (clutchTried.get(k.steamId) ?? 0) + 1);
        if (c.won) clutchWon.set(k.steamId, (clutchWon.get(k.steamId) ?? 0) + 1);
      }

      perRound.push([
        k.kast, k.traded, k.assists,
        c ? `1v${c.versus}` : null,
        c ? c.won : null,
        matchId, r.roundNum, k.steamId,
      ]);
    }
  }

  const stateRows: SqlValue[][] = [];
  for (const r of flow) {
    const ctWon = r.winnerSide === null ? null : r.winnerSide === 'CT';
    r.states.forEach((st, seq) => {
      stateRows.push([matchId, r.roundNum, seq, st.aliveCT, st.aliveT, st.planted, ctWon]);
    });
  }

  await db.transaction(async (tx) => {
    await tx.exec('DELETE FROM round_states WHERE match_id = ?', [matchId]);
    for (const row of stateRows) {
      await tx.exec(
        `INSERT INTO round_states
           (match_id, round_num, seq, alive_ct, alive_t, planted, ct_won)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row,
      );
    }

    for (const row of perRound) {
      await tx.exec(
        `UPDATE player_round_stats
            SET kast = ?, traded = ?, assists = ?, clutch_type = ?, clutch_won = ?
          WHERE match_id = ? AND round_num = ? AND steam_id = ?`,
        row,
      );
    }

    for (const [steamId, rounds] of roundsPlayed) {
      const hits = kastRounds.get(steamId) ?? 0;
      await tx.exec(

        `UPDATE player_match
            SET kast_rounds = ?, kast_pct = ?,
                clutches_tried = ?, clutches_won = ?
          WHERE match_id = ? AND steam_id = ?`,
        [
          hits,
          rounds > 0 ? hits / rounds : null,
          clutchTried.get(steamId) ?? 0,
          clutchWon.get(steamId) ?? 0,
          matchId,
          steamId,
        ],
      );
    }

    await tx.exec('UPDATE matches SET round_stats_version = ? WHERE match_id = ?', [
      ROUND_STATS_VERSION,
      matchId,
    ]);
  });
}

export async function getTradeChains(
  db: Db,
  matchId: string,
  tickRate: number,
): Promise<TradeTally[]> {
  const roster = await db.query<{ round_num: number; steam_id: string; side: string | null }>(
    `SELECT round_num, steam_id, side
       FROM player_round_stats WHERE match_id = ? AND side IS NOT NULL`,
    [matchId],
  );
  if (roster.length === 0) return [];

  const kills = await db.query<{
    round_num: number; tick: number;
    attacker_steam_id: string | null; victim_steam_id: string | null;
    attacker_side: string | null; victim_side: string | null;
  }>(
    `SELECT round_num, tick, attacker_steam_id, victim_steam_id, attacker_side, victim_side
       FROM kills WHERE match_id = ? AND round_num IS NOT NULL`,
    [matchId],
  );

  const damages = await db.query<{
    round_num: number; tick: number;
    attacker_steam_id: string | null; victim_steam_id: string | null;
  }>(
    `SELECT round_num, tick, attacker_steam_id, victim_steam_id
       FROM damages
      WHERE match_id = ? AND round_num IS NOT NULL AND NOT is_team_damage
        AND attacker_steam_id IS NOT NULL AND victim_steam_id IS NOT NULL`,
    [matchId],
  );

  const byRound = new Map<number, { roster: { steamId: string; side: Side }[];
    kills: typeof kills; damages: typeof damages }>();
  const slot = (n: number) => {
    const found = byRound.get(n) ?? { roster: [], kills: [], damages: [] };
    byRound.set(n, found);
    return found;
  };

  for (const r of roster) slot(Number(r.round_num)).roster.push({ steamId: r.steam_id, side: r.side as Side });
  for (const k of kills) slot(Number(k.round_num)).kills.push(k);
  for (const d of damages) slot(Number(d.round_num)).damages.push(d);

  return summarizeTrades(
    [...byRound.entries()].map(([roundNum, v]) => ({
      roundNum,
      roster: v.roster,
      kills: v.kills.map((k) => ({
        tick: Number(k.tick),
        attackerSteamId: k.attacker_steam_id,
        victimSteamId: k.victim_steam_id,
        attackerSide: (k.attacker_side as Side | null) ?? null,
        victimSide: (k.victim_side as Side | null) ?? null,
      })),
      damages: v.damages.map((d) => ({
        tick: Number(d.tick),
        attackerSteamId: d.attacker_steam_id,
        victimSteamId: d.victim_steam_id,
      })),
    })),
    DEFAULT_TRADE_WINDOW_SECONDS * tickRate,
  );
}

export function teamsOfRound(
  roster: { steamId: string; side: Side }[],
  teamOf: Map<string, string | null>,
): { CT: string | null; T: string | null } {
  const pick = (side: Side): string | null => {
    const votes = new Map<string, number>();
    for (const p of roster) {
      if (p.side !== side) continue;
      const team = teamOf.get(p.steamId);
      if (!team) continue;
      votes.set(team, (votes.get(team) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    let tied = false;
    for (const [team, n] of votes) {
      if (n > bestN) {
        best = team;
        bestN = n;
        tied = false;
      } else if (n === bestN) {
        tied = true;
      }
    }
    return tied ? null : best;
  };
  return { CT: pick('CT'), T: pick('T') };
}
