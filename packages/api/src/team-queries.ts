import { groupLineups, type Lineup, type RosterInstance, type Side } from '@cs2/core';
import type { Db } from '@cs2/db';
import type { BuyType, TeamLineup, TeamMatchReport, TeamMatchSide } from '@cs2/contract';
import { getMatchAnalysis } from './analysis-queries.js';
import { computeMatchFlow } from './round-flow-queries.js';

export async function getTeamMatchReport(
  db: Db,
  matchId: string,
  mapsDir?: string,
): Promise<TeamMatchReport> {
  const analysis = await getMatchAnalysis(db, matchId, mapsDir);
  const flow = await computeMatchFlow(db, matchId);

  const match = await db.queryOne<{
    map_name: string; played_at: string | null; team_a_name: string | null;
    team_b_name: string | null;
  }>(
    'SELECT map_name, played_at, team_a_name, team_b_name FROM matches WHERE match_id = ?',
    [matchId],
  );
  if (!match) throw new Error(`Partida nao encontrada: ${matchId}`);

  const names = [match.team_a_name, match.team_b_name];
  const empty = (teamName: string | null): TeamMatchSide => ({
    teamName,
    players: [],
    roundsWon: 0,
    roundsPlayed: 0,
    bySide: [],
    buys: [],
    openings: { opened: 0, openedWon: 0 },
    advantages: { rounds: 0, won: 0 },
    advantagesByAbsence: { rounds: 0, won: 0 },
    bomb: { plants: 0, defuses: 0, bySite: [] },
    utility: { thrown: 0, damage: 0, roundsPlayed: 0 },
  });

  const teams: [TeamMatchSide, TeamMatchSide] = [empty(names[0]!), empty(names[1]!)];
  const indexOf = (slot: string | null): 0 | 1 | null =>
    slot === 'A' ? 0 : slot === 'B' ? 1 : null;

  const slotFromName = (teamName: string | null): 'A' | 'B' | null => {
    if (teamName === null) return null;
    if (names[0] !== null && teamName === names[0]) return 'A';
    if (names[1] !== null && teamName === names[1]) return 'B';
    return null;
  };

  const pick = (slot: string | null) => {
    const i = indexOf(slot);
    return i === null ? undefined : teams[i];
  };

  const elenco = await db.query<{
    steam_id: string; name: string; team_slot: string | null; team_name: string | null;
  }>(
    `SELECT steam_id, name, team_slot, team_name FROM player_match
      WHERE match_id = ? ORDER BY kills DESC`,
    [matchId],
  );
  const slotByPlayer = new Map(
    elenco.map((p) => [p.steam_id, p.team_slot ?? slotFromName(p.team_name)]),
  );

  const bySide: Map<Side, { rounds: number; won: number }>[] = [new Map(), new Map()];
  for (const round of flow) {
    for (const side of ['CT', 'T'] as const) {
      const i = indexOf(round.teamSlots[side] ?? slotFromName(round.teams[side]));
      if (i === null) continue;
      const team = teams[i];
      team.roundsPlayed += 1;
      if (round.winnerSide === side) team.roundsWon += 1;

      const cur = bySide[i]!.get(side) ?? { rounds: 0, won: 0 };
      cur.rounds += 1;
      if (round.winnerSide === side) cur.won += 1;
      bySide[i]!.set(side, cur);
    }

    if (round.opener) {
      const team = pick(
        round.teamSlots[round.opener.side] ?? slotFromName(round.teams[round.opener.side]),
      );
      if (team) {
        team.openings.opened += 1;
        if (round.openerWon) team.openings.openedWon += 1;
      }
    }
  }
  bySide.forEach((sides, i) => {
    teams[i]!.bySide = [...sides.entries()].map(([side, v]) => ({ side, ...v }));
  });

  const buys: Map<BuyType, { rounds: number; won: number }>[] = [new Map(), new Map()];
  const teamOfRound = new Map(
    flow.map((r) => [r.roundNum, {
      CT: r.teamSlots.CT ?? slotFromName(r.teams.CT),
      T: r.teamSlots.T ?? slotFromName(r.teams.T),
    }]),
  );
  for (const r of analysis.economy.rounds) {
    const sides = teamOfRound.get(r.roundNum);
    if (!sides) continue;
    for (const side of ['CT', 'T'] as const) {
      const buyType = side === 'CT' ? r.ctBuyType : r.tBuyType;
      const i = indexOf(sides[side]);
      if (i === null || buyType === null) continue;
      const cur = buys[i]!.get(buyType) ?? { rounds: 0, won: 0 };
      cur.rounds += 1;
      if (r.winnerSide === side) cur.won += 1;
      buys[i]!.set(buyType, cur);
    }
  }
  buys.forEach((porTipo, i) => {
    teams[i]!.buys = [...porTipo.entries()].map(([buyType, v]) => ({ buyType, ...v }));
  });

  for (const a of analysis.rounds.advantages) {
    const team = pick(a.teamSlot ?? slotFromName(a.teamName));
    if (!team) continue;
    const alvo = a.cause === 'absence' ? team.advantagesByAbsence : team.advantages;
    alvo.rounds += a.rounds;
    alvo.won += a.won;
  }

  for (const p of analysis.bomb.points) {
    const sides = teamOfRound.get(p.roundNum);
    const planter = pick(sides?.T ?? null);
    if (planter) {
      planter.bomb.plants += 1;
      const site = planter.bomb.bySite.find((s) => s.site === p.site);
      if (site) site.plants += 1;
      else planter.bomb.bySite.push({ site: p.site, plants: 1, defusedByEnemy: 0 });
      if (p.outcome === 'defused') {
        const s = planter.bomb.bySite.find((x) => x.site === p.site);
        if (s) s.defusedByEnemy += 1;
      }
    }
    if (p.outcome === 'defused') {
      const defuser = pick(sides?.CT ?? null);
      if (defuser) defuser.bomb.defuses += 1;
    }
  }

  for (const p of analysis.utility.players) {
    const team = pick(slotByPlayer.get(p.steamId) ?? null);
    if (!team) continue;
    team.utility.thrown +=
      p.he.grenades + p.fire.grenades + p.smoke.smokes + p.flash.flashes;
    team.utility.damage += p.he.damage + p.fire.damage;
  }
  for (const team of teams.values()) team.utility.roundsPlayed = team.roundsPlayed;

  for (const p of elenco) {
    const team = pick(slotByPlayer.get(p.steam_id) ?? null);
    if (team) team.players.push({ steamId: p.steam_id, name: p.name });
  }

  return {
    matchId,
    mapName: match.map_name,
    playedAt: match.played_at === null ? null : String(match.played_at),
    teams,
  };
}

export async function getLineups(db: Db): Promise<TeamLineup[]> {
  const rows = await db.query<{
    match_id: string; map_name: string; played_at: string | null;
    ingested_at: string; team_name: string | null; team_slot: string | null;
    steam_id: string;
  }>(
    `SELECT m.match_id, m.map_name, m.played_at, m.ingested_at,
            pm.team_name, pm.team_slot, pm.steam_id
       FROM player_match pm
       JOIN matches m USING (match_id)
      ORDER BY COALESCE(m.played_at, m.ingested_at), pm.steam_id`,
  );

  const instances: RosterInstance[] = [];
  const index = new Map<string, RosterInstance>();
  const matchInfo = new Map<string, { mapName: string; playedAt: string | null }>();
  for (const r of rows) {
    matchInfo.set(r.match_id, {
      mapName: r.map_name,
      playedAt: r.played_at === null ? null : String(r.played_at),
    });

    const key = `${r.match_id}|${r.team_slot ?? r.team_name ?? '?'}`;
    let instance = index.get(key);
    if (!instance) {
      instance = { matchId: r.match_id, teamName: r.team_name, steamIds: [] };
      index.set(key, instance);
      instances.push(instance);
    }
    instance.steamIds.push(r.steam_id);
  }

  const lineups = groupLineups(instances);
  if (lineups.length === 0) return [];

  const roundRows = await db.query<{
    match_id: string; round_num: number; winner_side: string | null;
    team_name: string | null; side: string | null;
  }>(
    `SELECT r.match_id, r.round_num, r.winner_side, pm.team_name, prs.side
       FROM rounds r
       JOIN player_round_stats prs
         ON prs.match_id = r.match_id AND prs.round_num = r.round_num
       JOIN player_match pm
         ON pm.match_id = r.match_id AND pm.steam_id = prs.steam_id
      WHERE r.phase = 'live' AND prs.side IS NOT NULL`,
  );

  const tally = new Map<string, { rounds: Set<number>; won: Set<number>; side: Side }>();
  for (const r of roundRows) {
    if (r.side !== 'CT' && r.side !== 'T') continue;
    const key = `${r.match_id}|${r.team_name ?? ''}|${r.side}`;
    const cur = tally.get(key) ?? { rounds: new Set<number>(), won: new Set<number>(), side: r.side };
    cur.rounds.add(Number(r.round_num));
    if (r.winner_side === r.side) cur.won.add(Number(r.round_num));
    tally.set(key, cur);
  }

  const names = new Map<string, string>();
  for (const p of await db.query<{ steam_id: string; name: string }>(
    `SELECT steam_id, MAX(name) AS name FROM player_match GROUP BY steam_id`,
  )) {
    names.set(p.steam_id, p.name);
  }

  return lineups
    .map((lineup): TeamLineup => {
      const byMap = new Map<string, { matches: number; roundsWon: number; roundsLost: number }>();
      const sideTally = new Map<Side, { rounds: number; won: number }>();
      let roundsWon = 0;
      let roundsLost = 0;
      let wins = 0;

      for (const instance of lineup.instances) {
        const info = matchInfo.get(instance.matchId);
        let matchWon = 0;
        let matchLost = 0;
        for (const side of ['CT', 'T'] as const) {
          const t = tally.get(`${instance.matchId}|${instance.teamName ?? ''}|${side}`);
          if (!t) continue;
          const won = t.won.size;
          const rounds = t.rounds.size;
          matchWon += won;
          matchLost += rounds - won;
          const cur = sideTally.get(side) ?? { rounds: 0, won: 0 };
          cur.rounds += rounds;
          cur.won += won;
          sideTally.set(side, cur);
        }
        roundsWon += matchWon;
        roundsLost += matchLost;
        if (matchWon > matchLost) wins += 1;

        const mapName = info?.mapName ?? '?';
        const m = byMap.get(mapName) ?? { matches: 0, roundsWon: 0, roundsLost: 0 };
        m.matches += 1;
        m.roundsWon += matchWon;
        m.roundsLost += matchLost;
        byMap.set(mapName, m);
      }

      return {
        id: lineup.id,
        name: lineup.name,
        matches: lineup.instances.length,
        wins,
        roundsWon,
        roundsLost,
        players: lineup.players.map((p) => ({
          steamId: p.steamId,
          name: names.get(p.steamId) ?? p.steamId,
          matches: p.matches,
        })),
        maps: [...byMap.entries()]
          .map(([mapName, v]) => ({ mapName, ...v }))
          .sort((a, b) => b.matches - a.matches || a.mapName.localeCompare(b.mapName)),
        bySide: [...sideTally.entries()].map(([side, v]) => ({ side, ...v })),
        matchIds: lineup.instances.map((i) => i.matchId),
      };
    })
    .sort((a, b) => b.matches - a.matches || (a.name ?? '').localeCompare(b.name ?? ''));
}
