import { TickClock } from '@cs2/core';
import type { Db } from '@cs2/db';
import type { MatchChat } from '@cs2/contract';

interface RoundWindow {
  roundNum: number;
  startTick: number;
  endTick: number | null;
  freezeEndTick: number | null;
}

export const CHAT_SINCE_DATA_VERSION = 5;

export async function getMatchChat(db: Db, matchId: string): Promise<MatchChat> {
  const match = await db.queryOne<{ tick_rate: number; replay_data_version: number | null }>(
    'SELECT tick_rate, replay_data_version FROM matches WHERE match_id = ?',
    [matchId],
  );
  if (!match) throw new Error(`Partida nao encontrada: ${matchId}`);
  const clock = new TickClock(Number(match.tick_rate ?? 64));

  const rounds = (
    await db.query<{
      round_num: number; start_tick: number | null;
      end_tick: number | null; freeze_end_tick: number | null;
    }>(
      `SELECT round_num, start_tick, end_tick, freeze_end_tick
         FROM rounds
        WHERE match_id = ? AND phase = 'live' AND round_num IS NOT NULL
        ORDER BY round_num`,
      [matchId],
    )
  ).map(
    (r): RoundWindow => ({
      roundNum: Number(r.round_num),
      startTick: Number(r.start_tick ?? r.freeze_end_tick ?? 0),
      endTick: r.end_tick === null ? null : Number(r.end_tick),
      freezeEndTick: r.freeze_end_tick === null ? null : Number(r.freeze_end_tick),
    }),
  );

  const roundOf = (tick: number): RoundWindow | null => {
    let found: RoundWindow | null = null;
    for (const r of rounds) {
      if (tick >= r.startTick) found = r;
      else break;
    }
    return found;
  };

  const rows = await db.query<{
    tick: number; steam_id: string | null; name: string | null;
    text: string | null; is_team_only: boolean | null;
    team_name: string | null;
  }>(
    `SELECT c.tick, c.steam_id, c.name, c.text, c.is_team_only, pm.team_name
       FROM chat_messages c
       LEFT JOIN player_match pm
         ON pm.match_id = c.match_id AND pm.steam_id = c.steam_id
      WHERE c.match_id = ?
      ORDER BY c.tick`,
    [matchId],
  );

  const messages = rows.map((r) => {
    const tick = Number(r.tick);
    const round = roundOf(tick);
    const from = round?.freezeEndTick ?? round?.startTick ?? null;
    return {
      tick,
      steamId: r.steam_id,
      name: r.name ?? r.steam_id,
      teamName: r.team_name,
      text: r.text ?? '',
      isTeamOnly: r.is_team_only,
      roundNum: round?.roundNum ?? null,

      secondsIntoRound: from === null ? null : clock.toSeconds(tick - from),
    };
  });

  return {
    messages,

    unknownScope: messages.filter((m) => m.isTeamOnly === null).length,
    needsReprocess: Number(match.replay_data_version ?? 0) < CHAT_SINCE_DATA_VERSION,
  };
}
