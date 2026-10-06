import {
  classifyDuels,
  classifyTeamBuy,
  colorTeamsFromRoster,
  computeHandoffs,
  computeSpells,
  TickClock,
  type KillInput,
  type RosterHandoff,
  type RosterSpell,
  type Side,
  type SideByRound,
  type TeamId,
} from '@cs2/core';
import type { MatchRosterWire } from '@cs2/contract';
import type { Db, SqlValue } from '@cs2/db';

export const ROSTER_VERSION = 1;

interface RosterRow {
  round_num: number;
  steam_id: string;
  side: string | null;
}

export interface MatchRoster {
  teamOf: Map<string, TeamId>;
  unresolved: string[];
  spells: RosterSpell[];
  handoffs: RosterHandoff[];

  countsByRound: Map<number, { ct: number; t: number }>;
  liveRounds: number[];
}

export async function computeMatchRoster(db: Db, matchId: string): Promise<MatchRoster> {
  const rows = await db.query<RosterRow>(
    `SELECT prs.round_num, prs.steam_id, prs.side
       FROM player_round_stats prs
       JOIN rounds r ON r.match_id = prs.match_id AND r.round_num = prs.round_num
      WHERE prs.match_id = ? AND prs.side IS NOT NULL AND r.phase = 'live'`,
    [matchId],
  );

  const sideByRound: SideByRound = new Map();
  const roundsOf = new Map<string, number[]>();
  const countsByRound = new Map<number, { ct: number; t: number }>();

  for (const r of rows) {
    const side = r.side === 'CT' ? 'CT' : r.side === 'T' ? 'T' : null;
    if (!side) continue;
    const roundNum = Number(r.round_num);

    let m = sideByRound.get(roundNum);
    if (!m) sideByRound.set(roundNum, (m = new Map<string, Side>()));
    m.set(r.steam_id, side);

    const mine = roundsOf.get(r.steam_id);
    if (mine) mine.push(roundNum);
    else roundsOf.set(r.steam_id, [roundNum]);

    let c = countsByRound.get(roundNum);
    if (!c) countsByRound.set(roundNum, (c = { ct: 0, t: 0 }));
    if (side === 'CT') c.ct += 1;
    else c.t += 1;
  }

  const coloring = colorTeamsFromRoster(sideByRound);
  const teamOf = await orient(db, matchId, coloring.teamOf);
  const liveRounds = [...sideByRound.keys()].sort((a, b) => a - b);
  const spells = computeSpells(roundsOf, teamOf);

  return {
    teamOf,
    unresolved: coloring.unresolved,
    spells,
    handoffs: computeHandoffs(spells, liveRounds),
    countsByRound,
    liveRounds,
  };
}

async function orient(
  db: Db,
  matchId: string,
  teamOf: Map<string, TeamId>,
): Promise<Map<string, TeamId>> {
  const rows = await db.query<{ steam_id: string; team_name: string | null; a: string | null }>(
    `SELECT pm.steam_id, pm.team_name, m.team_a_name AS a
       FROM player_match pm JOIN matches m USING (match_id)
      WHERE pm.match_id = ?`,
    [matchId],
  );
  const aName = rows[0]?.a ?? null;
  if (aName === null) return teamOf;

  let votosA = 0;
  let votosB = 0;
  for (const r of rows) {
    if (r.team_name !== aName) continue;
    const cor = teamOf.get(r.steam_id);
    if (cor === 'A') votosA += 1;
    else if (cor === 'B') votosB += 1;
  }
  if (votosB <= votosA) return teamOf;

  const flipped = new Map<string, TeamId>();
  for (const [steamId, cor] of teamOf) flipped.set(steamId, cor === 'A' ? 'B' : 'A');
  return flipped;
}

export async function ensureRoster(db: Db): Promise<{ updated: string[] }> {
  const pending = await db.query<{ match_id: string }>(
    `SELECT match_id FROM matches WHERE COALESCE(roster_version, 0) <> ?`,
    [ROSTER_VERSION],
  );

  const updated: string[] = [];
  for (const m of pending) {
    await materializeRoster(db, m.match_id);
    updated.push(m.match_id);
  }
  return { updated };
}

export async function materializeRoster(db: Db, matchId: string): Promise<void> {
  const roster = await computeMatchRoster(db, matchId);

  const names = await db.queryOne<{ a: string | null; b: string | null }>(
    'SELECT team_a_name AS a, team_b_name AS b FROM matches WHERE match_id = ?',
    [matchId],
  );
  const nameOf = (slot: TeamId): string | null => (slot === 'A' ? names?.a ?? null : names?.b ?? null);

  const winners = await db.query<{ round_num: number; winner_side: string | null }>(
    `SELECT round_num, winner_side FROM rounds
      WHERE match_id = ? AND phase = 'live' ORDER BY round_num`,
    [matchId],
  );
  const sides = await db.query<RosterRow>(
    `SELECT round_num, steam_id, side FROM player_round_stats
      WHERE match_id = ? AND side IS NOT NULL`,
    [matchId],
  );
  const sideOf = new Map<string, string>();
  for (const r of sides) sideOf.set(`${r.round_num}|${r.steam_id}`, String(r.side));

  const roundRows: SqlValue[][] = [];
  let scoreA = 0;
  let scoreB = 0;
  for (const r of winners) {
    const roundNum = Number(r.round_num);
    let winnerTeam: TeamId | null = null;
    if (r.winner_side !== null) {
      for (const [steamId, slot] of roster.teamOf) {
        if (sideOf.get(`${roundNum}|${steamId}`) === r.winner_side) {
          winnerTeam = slot;
          break;
        }
      }
    }
    if (winnerTeam === 'A') scoreA += 1;
    else if (winnerTeam === 'B') scoreB += 1;

    const counts = roster.countsByRound.get(roundNum) ?? { ct: 0, t: 0 };
    roundRows.push([winnerTeam, scoreA, scoreB, counts.ct, counts.t, matchId, roundNum]);
  }

  await db.transaction(async (tx) => {
    for (const [steamId, slot] of roster.teamOf) {
      await tx.exec(
        'UPDATE player_match SET team_slot = ?, team_name = ? WHERE match_id = ? AND steam_id = ?',
        [slot, nameOf(slot), matchId, steamId],
      );
    }

    for (const steamId of roster.unresolved) {
      await tx.exec(
        'UPDATE player_match SET team_slot = NULL, team_name = NULL WHERE match_id = ? AND steam_id = ?',
        [matchId, steamId],
      );
    }

    for (const row of roundRows) {
      await tx.exec(
        `UPDATE rounds
            SET winner_team = ?, score_a_after = ?, score_b_after = ?,
                roster_ct = ?, roster_t = ?
          WHERE match_id = ? AND round_num = ?`,
        row,
      );
    }
    await tx.exec('UPDATE matches SET score_a = ?, score_b = ? WHERE match_id = ?', [
      scoreA,
      scoreB,
      matchId,
    ]);

    await tx.exec('DELETE FROM roster_spells WHERE match_id = ?', [matchId]);
    for (const s of roster.spells) {
      await tx.exec(
        `INSERT INTO roster_spells
           (match_id, steam_id, spell_seq, team_slot, first_round, last_round, rounds)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [matchId, s.steamId, s.spellSeq, s.teamSlot, s.firstRound, s.lastRound, s.rounds],
      );
    }

    await tx.exec('DELETE FROM roster_handoffs WHERE match_id = ?', [matchId]);
    for (const h of roster.handoffs) {
      await tx.exec(
        `INSERT INTO roster_handoffs
           (match_id, handoff_seq, team_slot, out_steam_id, out_last_round,
            in_steam_id, in_first_round, gap_rounds, inference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          matchId, h.handoffSeq, h.teamSlot, h.outSteamId, h.outLastRound,
          h.inSteamId, h.inFirstRound, h.gapRounds, h.inference,
        ],
      );
    }

    await tx.exec('UPDATE matches SET roster_version = ? WHERE match_id = ?', [
      ROSTER_VERSION,
      matchId,
    ]);
  });

  await recomputeRosterDependent(db, matchId, roster);
}

async function recomputeRosterDependent(
  db: Db,
  matchId: string,
  roster: MatchRoster,
): Promise<void> {
  const match = await db.queryOne<{ tick_rate: number }>(
    'SELECT tick_rate FROM matches WHERE match_id = ?',
    [matchId],
  );
  const clock = new TickClock(Number(match?.tick_rate ?? 64));

  const freezeEnd = new Map<number, number>();
  for (const r of await db.query<{ round_num: number; from_tick: number | null }>(
    `SELECT round_num, COALESCE(freeze_end_tick, start_tick) AS from_tick
       FROM rounds WHERE match_id = ? AND phase = 'live' AND round_num IS NOT NULL`,
    [matchId],
  )) {
    if (r.from_tick !== null) freezeEnd.set(Number(r.round_num), Number(r.from_tick));
  }

  const kills: KillInput[] = (
    await db.query<{
      kill_id: number; round_num: number; tick: number;
      attacker_steam_id: string | null; victim_steam_id: string | null;
      attacker_side: string | null; victim_side: string | null;
    }>(
      `SELECT kill_id, round_num, tick, attacker_steam_id, victim_steam_id,
              attacker_side, victim_side
         FROM kills WHERE match_id = ? AND round_num IS NOT NULL`,
      [matchId],
    )
  ).map((k) => ({
    killId: Number(k.kill_id),
    roundNum: Number(k.round_num),
    tick: Number(k.tick),
    attackerSteamId: k.attacker_steam_id,
    victimSteamId: k.victim_steam_id,
    attackerSide: (k.attacker_side as Side | null) ?? null,
    victimSide: (k.victim_side as Side | null) ?? null,
    timeInRound: clock.durationSeconds(
      freezeEnd.get(Number(k.round_num)) ?? 0,
      Number(k.tick),
    ),
  }));

  const rosterBySide = new Map(
    [...roster.countsByRound].map(([roundNum, c]) => [roundNum, { CT: c.ct, T: c.t }]),
  );
  const flags = kills.length === 0
    ? []
    : classifyDuels(kills, { tickRate: clock.tickRate, rosterBySide });

  const buys = await db.query<{ round_num: number; side: string; total: number; n: number }>(
    `SELECT round_num, side, SUM(equip_value)::INTEGER AS total,
            COUNT(DISTINCT steam_id)::INTEGER AS n
       FROM economy WHERE match_id = ? AND side IS NOT NULL
      GROUP BY round_num, side`,
    [matchId],
  );
  const pistol = new Set<number>();
  for (const r of await db.query<{ round_num: number }>(
    `SELECT round_num FROM economy
      WHERE match_id = ? AND buy_type = 'pistol' GROUP BY round_num`,
    [matchId],
  )) {
    pistol.add(Number(r.round_num));
  }

  await db.transaction(async (tx) => {
    for (const f of flags) {
      await tx.exec('UPDATE kills SET is_entry = ? WHERE match_id = ? AND kill_id = ?', [
        f.isEntry, matchId, f.killId,
      ]);
    }

    for (const b of buys) {
      const roundNum = Number(b.round_num);
      const tipo = classifyTeamBuy(Number(b.total), pistol.has(roundNum), Number(b.n));
      await tx.exec(
        'UPDATE economy SET team_buy_type = ? WHERE match_id = ? AND round_num = ? AND side = ?',
        [tipo, matchId, roundNum, b.side],
      );
      await tx.exec(
        `UPDATE rounds SET ${b.side === 'CT' ? 'ct_buy_type' : 't_buy_type'} = ?
          WHERE match_id = ? AND round_num = ?`,
        [tipo, matchId, roundNum],
      );
    }

    await tx.exec(
      `UPDATE player_round_stats AS prs
          SET opening_kill = COALESCE(s.entries, 0) > 0,
              opening_death = COALESCE(s.entry_deaths, 0) > 0
         FROM (SELECT p.round_num, p.steam_id,
                      SUM(CASE WHEN k.is_entry AND k.attacker_steam_id = p.steam_id
                               THEN 1 ELSE 0 END)::INTEGER entries,
                      SUM(CASE WHEN k.is_entry AND k.victim_steam_id = p.steam_id
                               THEN 1 ELSE 0 END)::INTEGER entry_deaths
                 FROM player_round_stats p
                 JOIN kills k ON k.match_id = p.match_id AND k.round_num = p.round_num
                WHERE p.match_id = ? AND k.match_id = ?
                GROUP BY p.round_num, p.steam_id) s
        WHERE prs.match_id = ? AND prs.round_num = s.round_num
          AND prs.steam_id = s.steam_id`,
      [matchId, matchId, matchId],
    );

    await tx.exec(
      `UPDATE player_match AS pm
          SET opening_kills = s.entries, opening_deaths = s.entry_deaths
         FROM (SELECT p.steam_id,
                      SUM(CASE WHEN k.is_entry AND k.attacker_steam_id = p.steam_id
                               THEN 1 ELSE 0 END)::INTEGER entries,
                      SUM(CASE WHEN k.is_entry AND k.victim_steam_id = p.steam_id
                               THEN 1 ELSE 0 END)::INTEGER entry_deaths
                 FROM player_match p
                 CROSS JOIN kills k
                WHERE p.match_id = ? AND k.match_id = ? AND k.round_num IS NOT NULL
                GROUP BY p.steam_id) s
        WHERE pm.match_id = ? AND pm.steam_id = s.steam_id`,
      [matchId, matchId, matchId],
    );
  });
}

export async function getMatchRoster(db: Db, matchId: string): Promise<MatchRosterWire> {
  const nomes = new Map<string, string>();
  for (const p of await db.query<{ steam_id: string; name: string }>(
    'SELECT steam_id, name FROM player_match WHERE match_id = ?',
    [matchId],
  )) {
    nomes.set(p.steam_id, p.name);
  }
  const times = await db.queryOne<{ a: string | null; b: string | null }>(
    'SELECT team_a_name AS a, team_b_name AS b FROM matches WHERE match_id = ?',
    [matchId],
  );
  const nomeDoTime = (slot: string | null): string | null =>
    slot === 'A' ? times?.a ?? null : slot === 'B' ? times?.b ?? null : null;

  const spells = (
    await db.query<{
      steam_id: string; team_slot: string | null;
      first_round: number; last_round: number; rounds: number;
    }>(
      `SELECT steam_id, team_slot, first_round, last_round, rounds
         FROM roster_spells WHERE match_id = ?
        ORDER BY team_slot, first_round, steam_id`,
      [matchId],
    )
  ).map((r) => ({
    steamId: r.steam_id,
    name: nomes.get(r.steam_id) ?? r.steam_id,
    teamSlot: (r.team_slot === 'A' || r.team_slot === 'B' ? r.team_slot : null) as 'A' | 'B' | null,
    teamName: nomeDoTime(r.team_slot),
    firstRound: Number(r.first_round),
    lastRound: Number(r.last_round),
    rounds: Number(r.rounds),
  }));

  const handoffs = (
    await db.query<{
      team_slot: string; out_steam_id: string | null; out_last_round: number | null;
      in_steam_id: string | null; in_first_round: number | null;
      gap_rounds: number | null; inference: string;
    }>(
      `SELECT team_slot, out_steam_id, out_last_round, in_steam_id, in_first_round,
              gap_rounds, inference
         FROM roster_handoffs WHERE match_id = ? ORDER BY handoff_seq`,
      [matchId],
    )
  ).map((h) => ({
    teamSlot: h.team_slot as 'A' | 'B',
    teamName: nomeDoTime(h.team_slot),
    outSteamId: h.out_steam_id,
    outName: h.out_steam_id === null ? null : nomes.get(h.out_steam_id) ?? h.out_steam_id,
    outLastRound: h.out_last_round === null ? null : Number(h.out_last_round),
    inSteamId: h.in_steam_id,
    inName: h.in_steam_id === null ? null : nomes.get(h.in_steam_id) ?? h.in_steam_id,
    inFirstRound: h.in_first_round === null ? null : Number(h.in_first_round),
    gapRounds: h.gap_rounds === null ? null : Number(h.gap_rounds),
    inference: h.inference,
  }));

  const understaffedRounds = (
    await db.query<{ round_num: number; roster_ct: number; roster_t: number }>(
      `SELECT round_num, roster_ct, roster_t FROM rounds
        WHERE match_id = ? AND phase = 'live'
          AND roster_ct IS NOT NULL AND roster_t IS NOT NULL
          AND roster_ct <> roster_t
        ORDER BY round_num`,
      [matchId],
    )
  ).map((r) => ({
    roundNum: Number(r.round_num),
    rosterCt: Number(r.roster_ct),
    rosterT: Number(r.roster_t),
  }));

  return { matchId, spells, handoffs, understaffedRounds };
}
