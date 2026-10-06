import type { Db } from '@cs2/db';
import { TickClock } from '@cs2/core';
import type {
  MatchDetail,
  MatchSummary,
  RoundRow,
  ScoreboardRow,
  ValidationResult,
} from '@cs2/contract';

interface MatchRow {
  match_id: string;
  file_name: string;
  map_name: string;
  has_radar: boolean;
  source: string | null;
  server_name: string | null;
  tick_rate: number;
  team_a_name: string | null;
  team_b_name: string | null;
  score_a: number | null;
  score_b: number | null;
  rounds_played: number | null;
  duration_seconds: number | null;
  ingested_at: string;
  played_at: string | null;
  played_at_source: string | null;
  restart_count: number;
  knife_round_tick: number | null;
  match_start_tick: number | null;
  bulk_state: string;
  pinned: boolean;
  has_voice: boolean;
  demo_build: string | null;
  demo_format: string | null;
  validation_json: string | null;
}

function parseValidation(json: string | null): ValidationResult[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as ValidationResult[];
  } catch {
    return [];
  }
}

function toSummary(row: MatchRow): MatchSummary {
  const validation = parseValidation(row.validation_json);
  return {
    matchId: row.match_id,
    fileName: row.file_name,
    mapName: row.map_name,
    hasRadar: row.has_radar,
    source: row.source,
    serverName: row.server_name,
    tickRate: row.tick_rate,
    teamAName: row.team_a_name,
    teamBName: row.team_b_name,
    scoreA: row.score_a,
    scoreB: row.score_b,
    roundsPlayed: row.rounds_played,
    durationSeconds: row.duration_seconds,
    ingestedAt: String(row.ingested_at),
    playedAt: row.played_at === null ? null : String(row.played_at),
    playedAtSource: row.played_at_source ?? null,
    restartCount: row.restart_count,
    hasKnifeRound: row.knife_round_tick !== null,
    bulkState: row.bulk_state,
    pinned: Boolean(row.pinned),
    hasVoice: Boolean(row.has_voice),
    demoBuild: row.demo_build,
    demoFormat: row.demo_format,
    hasWarnings: validation.some((v) => !v.ok),
  };
}

const MATCH_COLUMNS = `
  match_id, file_name, map_name, has_radar, source, server_name, tick_rate,
  team_a_name, team_b_name, score_a, score_b, rounds_played, duration_seconds,
  ingested_at, played_at, played_at_source, restart_count, knife_round_tick, match_start_tick, bulk_state, pinned, has_voice,
  demo_build, demo_format,
  validation_json`;

export type MatchFilter = 'all' | 'mine' | 'poi';

export async function listMatches(db: Db, filter: MatchFilter = 'all'): Promise<MatchSummary[]> {

  const flag = filter === 'mine' ? 'is_user' : 'is_poi';
  const where =
    filter === 'all'
      ? ''
      : `WHERE EXISTS (SELECT 1 FROM player_match pm
                        WHERE pm.match_id = matches.match_id AND pm.${flag})`;

  const rows = await db.query<MatchRow>(

    `SELECT ${MATCH_COLUMNS} FROM matches ${where}
      ORDER BY COALESCE(played_at, ingested_at) DESC`,
  );
  return rows.map(toSummary);
}

export async function getMatch(db: Db, matchId: string): Promise<MatchDetail> {
  const row = await db.queryOne<MatchRow>(
    `SELECT ${MATCH_COLUMNS} FROM matches WHERE match_id = ?`,
    [matchId],
  );
  if (!row) throw new Error(`Partida nao encontrada: ${matchId}`);

  const clock = new TickClock(row.tick_rate);

  const scoreboard = await db.query<{
    steam_id: string; name: string; team_name: string | null; starting_side: string | null;
    is_user: boolean; is_poi: boolean; rounds_played: number; kills: number; deaths: number;
    assists: number; headshots: number; damage_total: number; adr: number | null;
    kast_pct: number | null;
    utility_damage: number; enemies_flashed: number; teammates_flashed: number;
  }>(
    `SELECT steam_id, name, team_name, starting_side, is_user, is_poi,
            rounds_played, kills, deaths, assists, headshots, damage_total, adr, kast_pct,
            utility_damage, enemies_flashed, teammates_flashed
       FROM player_match
      WHERE match_id = ?
      ORDER BY kills DESC, damage_total DESC`,
    [matchId],
  );

  const janelas = new Map<string, { first: number; last: number; spells: number }>();
  for (const r of await db.query<{
    steam_id: string; first_round: number; last_round: number; n: number;
  }>(
    `SELECT steam_id, MIN(first_round)::INTEGER AS first_round,
            MAX(last_round)::INTEGER AS last_round, COUNT(*)::INTEGER AS n
       FROM roster_spells WHERE match_id = ? GROUP BY steam_id`,
    [matchId],
  )) {
    janelas.set(r.steam_id, {
      first: Number(r.first_round),
      last: Number(r.last_round),
      spells: Number(r.n),
    });
  }
  const liveSpan = await db.queryOne<{ lo: number | null; hi: number | null }>(
    `SELECT MIN(round_num)::INTEGER AS lo, MAX(round_num)::INTEGER AS hi
       FROM rounds WHERE match_id = ? AND phase = 'live'`,
    [matchId],
  );

  const killsPerRound = new Map<number, number>();
  for (const r of await db.query<{ round_num: number; n: number }>(
    `SELECT round_num, COUNT(*)::INTEGER AS n FROM kills
      WHERE match_id = ? AND round_num IS NOT NULL GROUP BY round_num`,
    [matchId],
  )) {
    killsPerRound.set(Number(r.round_num), Number(r.n));
  }

  const roundRows = await db.query<{
    round_num: number; phase: string; half: number | null; is_overtime: boolean;
    start_tick: number | null; freeze_end_tick: number | null; end_tick: number;
    winner_side: string | null; win_reason: string | null;
    ct_score_after: number | null; t_score_after: number | null;
    score_a_after: number | null; score_b_after: number | null;
    winner_team: string | null;
    bomb_plant_tick: number | null; bomb_defuse_tick: number | null;
    bomb_explode_tick: number | null;
    roster_ct: number | null; roster_t: number | null;
  }>(
    `SELECT round_num, phase, half, is_overtime, start_tick, freeze_end_tick, end_tick,
            winner_side, win_reason, ct_score_after, t_score_after,
            score_a_after, score_b_after, winner_team,
            bomb_plant_tick, bomb_defuse_tick, bomb_explode_tick,
            roster_ct, roster_t
       FROM rounds WHERE match_id = ? ORDER BY end_tick`,
    [matchId],
  );

  const toRound = (r: (typeof roundRows)[number]): RoundRow => {
    const from = r.freeze_end_tick ?? r.start_tick;
    return {
      roundNum: Number(r.round_num),
      phase: r.phase as RoundRow['phase'],
      half: r.half === null ? null : Number(r.half),
      isOvertime: Boolean(r.is_overtime),
      startTick: r.start_tick,
      freezeEndTick: r.freeze_end_tick,
      endTick: Number(r.end_tick),
      durationSeconds: from === null ? null : clock.durationSeconds(from, Number(r.end_tick)),
      winnerSide: (r.winner_side as RoundRow['winnerSide']) ?? null,
      winReason: r.win_reason,
      ctScoreAfter: r.ct_score_after,
      tScoreAfter: r.t_score_after,
      scoreAAfter: r.score_a_after,
      scoreBAfter: r.score_b_after,
      winnerTeam: (r.winner_team as 'A' | 'B' | null) ?? null,
      bombPlantTick: r.bomb_plant_tick,
      bombDefuseTick: r.bomb_defuse_tick,
      bombExplodeTick: r.bomb_explode_tick,
      kills: killsPerRound.get(Number(r.round_num)) ?? 0,
      rosterCt: r.roster_ct === null ? null : Number(r.roster_ct),
      rosterT: r.roster_t === null ? null : Number(r.roster_t),
    };
  };

  const all = roundRows.map(toRound);

  return {
    summary: toSummary(row),
    scoreboard: scoreboard.map((p): ScoreboardRow => {
      const kills = Number(p.kills);
      const deaths = Number(p.deaths);
      return {
        steamId: p.steam_id,
        name: p.name,
        teamName: p.team_name,
        startingSide: (p.starting_side as ScoreboardRow['startingSide']) ?? null,
        isUser: Boolean(p.is_user),
        isPoi: Boolean(p.is_poi),
        roundsPlayed: Number(p.rounds_played),
        kills,
        deaths,
        assists: Number(p.assists),
        headshots: Number(p.headshots),
        headshotPct: kills > 0 ? Number(p.headshots) / kills : null,
        damageTotal: Number(p.damage_total),
        adr: p.adr === null ? null : Number(p.adr),
        kastPct: p.kast_pct === null ? null : Number(p.kast_pct),
        kd: deaths > 0 ? kills / deaths : kills > 0 ? kills : null,
        plusMinus: kills - deaths,
        utilityDamage: Number(p.utility_damage),
        enemiesFlashed: Number(p.enemies_flashed),
        teammatesFlashed: Number(p.teammates_flashed),
        firstRound: janelas.get(p.steam_id)?.first ?? null,
        lastRound: janelas.get(p.steam_id)?.last ?? null,
        spells: janelas.get(p.steam_id)?.spells ?? 1,

        playedAllRounds: (() => {
          const j = janelas.get(p.steam_id);
          if (!j || liveSpan?.lo === null || liveSpan?.hi === null) return true;
          return j.spells === 1 && j.first <= Number(liveSpan?.lo) && j.last >= Number(liveSpan?.hi);
        })(),
      };
    }),
    rounds: all.filter((r) => r.phase === 'live'),
    discardedRounds: all.filter((r) => r.phase !== 'live'),
    validation: parseValidation(row.validation_json),
    matchStartTick: row.match_start_tick,
    knifeRoundTick: row.knife_round_tick,
  };
}

const MATCH_OWNED_TABLES = [
  'player_match', 'rounds', 'kills', 'damages', 'weapon_fires', 'blinds',
  'bomb_events', 'grenades', 'grenade_detonations', 'chat_messages',
  'voice_segments', 'economy', 'engagements', 'heatmap_bins',
  'player_round_stats', 'match_findings', 'player_metric_history',

  'utility_throws',
];

export async function deleteMatchRows(db: Db, matchId: string): Promise<void> {
  for (const t of MATCH_OWNED_TABLES) {
    await db.exec(`DELETE FROM ${t} WHERE match_id = ?`, [matchId]);
  }
  await db.exec('DELETE FROM matches WHERE match_id = ?', [matchId]);
}

export async function deleteMatch(db: Db, matchId: string): Promise<void> {
  await db.transaction((tx) => deleteMatchRows(tx, matchId));
}
