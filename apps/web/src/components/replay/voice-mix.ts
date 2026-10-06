export type TeamKey = 'A' | 'B';

export interface ChannelState {

  volume: number;
  muted: boolean;
}

export interface MixState {
  teams: Record<TeamKey, ChannelState>;

  players: Record<string, ChannelState>;

  solo: string | null;
}

export interface MixGains {
  team: Record<TeamKey, number>;
  player: Record<string, number>;
}

export const MAX_PLAYER_VOLUME = 1.5;

export const DEFAULT_CHANNEL: ChannelState = { volume: 1, muted: false };

export function emptyMix(): MixState {
  return {
    teams: { A: { ...DEFAULT_CHANNEL }, B: { ...DEFAULT_CHANNEL } },
    players: {},
    solo: null,
  };
}

export function computeMix(
  state: MixState,
  talkers: { steamId: string; team: TeamKey | null }[],
): MixGains {
  const player: Record<string, number> = {};
  const clamp = (v: number) => Math.max(0, Math.min(MAX_PLAYER_VOLUME, v));
  const soloTeam = state.solo ? (talkers.find((t) => t.steamId === state.solo)?.team ?? null) : null;

  const team: Record<TeamKey, number> = {
    A: channelGain(state.teams.A, state.solo !== null && soloTeam === 'A'),
    B: channelGain(state.teams.B, state.solo !== null && soloTeam === 'B'),
  };

  for (const t of talkers) {
    const ch = state.players[t.steamId] ?? DEFAULT_CHANNEL;
    if (state.solo !== null) {
      player[t.steamId] = t.steamId === state.solo ? clamp(ch.volume) : 0;
    } else {
      player[t.steamId] = ch.muted ? 0 : clamp(ch.volume);
    }
  }
  return { team, player };
}

function channelGain(ch: ChannelState, forcedOpenBySolo: boolean): number {
  if (forcedOpenBySolo) return Math.max(0, ch.volume);
  return ch.muted ? 0 : Math.max(0, ch.volume);
}

export function isAudible(gains: MixGains, steamId: string, team: TeamKey | null): boolean {
  const p = gains.player[steamId] ?? 1;
  const t = team ? gains.team[team] : 1;
  return p > 0 && t > 0;
}
