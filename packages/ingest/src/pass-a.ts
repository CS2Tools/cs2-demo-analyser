import { parseEvents, parseTicks } from '@laihoe/demoparser2';
import { parseResilient } from './props.js';
import {
  colorTeamsFromRoster,
  segmentRounds,
  sideFromTeamNum,
  type RawRoundEnd,
  type Segmentation,
  type Side,
} from '@cs2/core';

type Row = Record<string, unknown>;

export const WANTED_EVENTS = [
  'round_start',
  'round_freeze_end',
  'round_end',
  'round_officially_ended',
  'round_announce_match_start',
  'player_death',
  'player_hurt',
  'weapon_fire',
  'player_blind',
  'flashbang_detonate',
  'hegrenade_detonate',
  'smokegrenade_detonate',
  'smokegrenade_expired',
  'inferno_startburn',
  'inferno_expire',
  'bomb_planted',
  'bomb_defused',
  'bomb_exploded',
  'bomb_begindefuse',
  'round_mvp',

  'player_chat',
  'chat_message',
] as const;

export interface PassAResult {
  events: Map<string, Row[]>;
  lastTick: number;
  segmentation: Segmentation;

  sideByRound: Map<number, Map<string, Side>>;
  teams: TeamAssignment;
}

export interface TeamAssignment {

  teamOf: Map<string, 'A' | 'B'>;
  scoreA: number;
  scoreB: number;
  nameA: string;
  nameB: string;
  startingSideA: Side | null;

  unresolved: string[];

  winnerByRound: Map<number, 'A' | 'B'>;
}

export function runPassA(demoPath: string): Omit<PassAResult, 'teams'> & { teams: null } {
  const raw = parseEvents(
    demoPath,
    [...WANTED_EVENTS],

    ['team_num', 'last_place_name'],
    ['total_rounds_played'],
  ) as Row[];

  const events = new Map<string, Row[]>();
  let lastTick = 0;
  for (const ev of raw) {
    const name = String(ev['event_name']);
    let bucket = events.get(name);
    if (!bucket) events.set(name, (bucket = []));
    bucket.push(ev);
    const t = Number(ev['tick']);
    if (t > lastTick) lastTick = t;
  }

  const tickOf = (e: Row) => Number(e['tick']);
  const ends: RawRoundEnd[] = (events.get('round_end') ?? []).map((e) => ({
    tick: tickOf(e),
    winner: e['winner'] == null ? null : String(e['winner']),
    reason: e['reason'] == null ? null : String(e['reason']),
    gameRound: e['round'] == null ? null : Number(e['round']),
  }));

  const segmentation = segmentRounds({
    matchStartTicks: (events.get('round_announce_match_start') ?? []).map(tickOf),
    startTicks: (events.get('round_start') ?? []).map(tickOf),
    freezeEndTicks: (events.get('round_freeze_end') ?? []).map(tickOf),
    officialEndTicks: (events.get('round_officially_ended') ?? []).map(tickOf),
    ends,
  });

  return { events, lastTick, segmentation, sideByRound: new Map(), teams: null };
}

export function readClanNames(demoPath: string, tick: number): Map<string, string> {
  const out = new Map<string, string>();
  let rows: Row[];
  try {
    rows = parseTicks(demoPath, ['team_clan_name'], [tick]) as Row[];
  } catch {

    return out;
  }
  for (const row of rows) {
    const steamId = String(row['steamid'] ?? '');
    const name = cleanTeamName(String(row['team_clan_name'] ?? ''));
    if (!steamId || steamId === '0' || !name) continue;
    out.set(steamId, name);
  }
  return out;
}

const GENERIC_TEAM_NAMES = new Set([
  '', 'ct', 't', 'terrorist', 'terrorists', 'counter-terrorist', 'counter-terrorists',
  'unassigned', 'spectator', 'spectators', 'time ct', 'time t',
]);

export function cleanTeamName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (GENERIC_TEAM_NAMES.has(trimmed.toLowerCase())) return null;
  const withoutPrefix = trimmed.replace(/^team\s+/i, '').trim();
  const name = withoutPrefix.length >= 2 ? withoutPrefix : trimmed;
  return GENERIC_TEAM_NAMES.has(name.toLowerCase()) ? null : (name || null);
}

export function majorityName(names: string[]): string | null {
  const count = new Map<string, number>();
  for (const name of names) count.set(name, (count.get(name) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, n] of count) {
    if (n > bestCount) {
      best = name;
      bestCount = n;
    }
  }
  return best;
}

const TEAM_COLOR_PROP = 'CCSPlayerController.m_iCompTeammateColor';

export function teamColorFrom(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim().toLowerCase();
  if (color === '' || color === '-1') return null;
  return color;
}

export interface SidesAndColors {
  sideByRound: Map<number, Map<string, Side>>;

  colorOf: Map<string, string>;

  colorMissing: boolean;
}

export function readSidesPerRound(
  demoPath: string,
  segmentation: Segmentation,
): SidesAndColors {
  const live = segmentation.rounds.filter((r) => r.phase === 'live');
  const ticks = live
    .map((r) => r.freezeEndTick ?? r.startTick)
    .filter((t): t is number => t !== null);

  const out = new Map<number, Map<string, Side>>();
  const colorOf = new Map<string, string>();
  if (ticks.length === 0) {
    return { sideByRound: out, colorOf, colorMissing: false };
  }

  const parsed = parseResilient<Row>(
    (props) => parseTicks(demoPath, props, ticks) as Row[],
    { required: ['team_num'], optional: [TEAM_COLOR_PROP] },
  );
  const rows = parsed.rows;

  for (const row of rows) {
    const steamId = String(row['steamid'] ?? '');
    if (!steamId || steamId === '0') continue;
    const color = teamColorFrom(row[TEAM_COLOR_PROP]);
    if (color !== null) colorOf.set(steamId, color);
  }

  const byTick = new Map<number, Map<string, Side>>();
  for (const row of rows) {
    const side = sideFromTeamNum(Number(row['team_num']));
    const steamId = String(row['steamid'] ?? '');
    if (!side || !steamId || steamId === '0') continue;
    const tick = Number(row['tick']);
    let m = byTick.get(tick);
    if (!m) byTick.set(tick, (m = new Map()));
    m.set(steamId, side);
  }

  for (const round of live) {
    const tick = round.freezeEndTick ?? round.startTick;
    if (tick === null || round.roundNum === null) continue;
    const m = byTick.get(tick);
    if (m) out.set(round.roundNum, m);
  }
  return { sideByRound: out, colorOf, colorMissing: parsed.dropped.includes(TEAM_COLOR_PROP) };
}

export function teamNamesFromFileName(fileName: string): [string, string] | null {
  const match = /team-([^_]+)__vs__team-([^_.]+)/i.exec(fileName);
  if (!match) return null;
  return [match[1]!, match[2]!];
}

export function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function pickTeamName(slugs: [string, string], memberNames: string[]): string | null {
  const normalizedMembers = memberNames.map((n) => normalizeForMatch(cleanPlayerName(n)));
  for (const slug of slugs) {
    const key = normalizeForMatch(slug);
    if (key.length < 3) continue;
    const hit = normalizedMembers.some((m) => m === key || m.includes(key) || key.includes(m));
    if (hit) return slug;
  }
  return null;
}

export function cleanPlayerName(name: string): string {
  return name.replace(/^[^\p{L}\p{Nd}]+/u, '').trim() || name.trim();
}

export function assignTeams(
  segmentation: Segmentation,
  sideByRound: Map<number, Map<string, Side>>,
  playerNames: Map<string, string>,
  fileName = '',

  clanNames: Map<string, string> = new Map(),
): TeamAssignment {
  const live = segmentation.rounds.filter((r) => r.phase === 'live' && r.roundNum !== null);
  const { teamOf, startingSideA, unresolved } = colorTeamsFromRoster(sideByRound);

  let scoreA = 0;
  let scoreB = 0;
  const winnerByRound = new Map<number, 'A' | 'B'>();

  for (const round of live) {
    if (!round.winnerSide || round.roundNum === null) continue;
    const sides = sideByRound.get(round.roundNum);
    if (!sides) continue;

    let winningTeam: 'A' | 'B' | null = null;
    for (const [steamId, side] of sides) {
      if (side !== round.winnerSide) continue;
      const team = teamOf.get(steamId);
      if (team) {
        winningTeam = team;
        break;
      }
    }
    if (winningTeam === 'A') scoreA++;
    else if (winningTeam === 'B') scoreB++;
    if (winningTeam) winnerByRound.set(round.roundNum, winningTeam);
  }

  const slugs = teamNamesFromFileName(fileName);
  const membersOf = (team: 'A' | 'B'): string[] =>
    [...teamOf.entries()]
      .filter(([, t]) => t === team)
      .map(([steamId]) => playerNames.get(steamId) ?? steamId);

  const membersIdsOf = (team: 'A' | 'B'): string[] =>
    [...teamOf.entries()].filter(([, t]) => t === team).map(([steamId]) => steamId);

  const nameOf = (team: 'A' | 'B'): string => {

    const fromDemo = majorityName(
      membersIdsOf(team)
        .map((steamId) => clanNames.get(steamId))
        .filter((n): n is string => Boolean(n)),
    );
    if (fromDemo) return fromDemo;

    const fromFile = slugs ? pickTeamName(slugs, membersOf(team)) : null;
    if (fromFile) return fromFile;

    const side = team === 'A' ? startingSideA : startingSideA === 'CT' ? 'T' : 'CT';
    return side ? `Time ${side}` : team === 'A' ? 'Time A' : 'Time B';
  };

  return {
    teamOf,
    scoreA,
    scoreB,
    nameA: nameOf('A'),
    nameB: nameOf('B'),
    startingSideA,
    unresolved,
    winnerByRound,
  };
}
