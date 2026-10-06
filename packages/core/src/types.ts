export type Side = 'CT' | 'T';

export const TEAM_NUM_T = 2;
export const TEAM_NUM_CT = 3;

export function sideFromTeamNum(teamNum: number): Side | null {
  if (teamNum === TEAM_NUM_CT) return 'CT';
  if (teamNum === TEAM_NUM_T) return 'T';
  return null;
}

export const opposite = (side: Side): Side => (side === 'CT' ? 'T' : 'CT');

export type DemoSource = 'valve_mm' | 'faceit' | 'gamers_club' | 'hltv' | 'unknown';

export type BuyType = 'pistol' | 'full_eco' | 'eco' | 'semi_eco' | 'force_buy' | 'full_buy';

export type BulkState = 'full' | 'replay_only' | 'pruned';

export interface PlayerRef {
  steamId: string;
  name: string;
}
