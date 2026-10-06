import { parseTicks } from '@laihoe/demoparser2';
import { sideFromTeamNum, TickClock, type Side } from '@cs2/core';
import type { Segmentation } from '@cs2/core';
import type { DuckDb } from '@cs2/db';
import { parseResilient } from './props.js';

export const REPLAY_HZ = 8;

const CHUNK_TICKS = 4000;

const PROPS_REPLAY = {
  required: ['X', 'Y', 'Z', 'yaw', 'pitch', 'health', 'life_state', 'team_num'],
  optional: [
    'armor_value',
    'flash_duration',
    'is_scoped',
    'duck_amount',
    'active_weapon_name',

    'balance',
    'has_helmet',
    'has_defuser',
    'inventory',

    'CCSPlayerPawn.m_bIsDefusing',
  ],
} as const;

export const HUD_PROPS = ['balance', 'has_helmet', 'has_defuser', 'inventory'] as const;

export const INVENTORY_SEPARATOR = '|';

export function assignSlots(teamOf: Map<string, 'A' | 'B'>): Map<string, number> {
  const teamA = [...teamOf.entries()].filter(([, t]) => t === 'A').map(([id]) => id).sort();
  const teamB = [...teamOf.entries()].filter(([, t]) => t === 'B').map(([id]) => id).sort();

  const slots = new Map<string, number>();
  teamA.forEach((id, i) => slots.set(id, i));
  teamB.forEach((id, i) => slots.set(id, teamA.length + i));

  let next = teamA.length + teamB.length;
  for (const id of teamOf.keys()) if (!slots.has(id)) slots.set(id, next++);
  return slots;
}

export function replayEndTick(round: { endTick: number; officialEndTick: number | null }): number {

  return Math.max(round.endTick, round.officialEndTick ?? round.endTick);
}

export function sampleTicks(segmentation: Segmentation, stride: number): number[] {
  const ticks = new Set<number>();

  for (const round of segmentation.rounds) {
    if (round.phase !== 'live') continue;
    const from = round.startTick ?? round.freezeEndTick;
    if (from === null) continue;

    const to = replayEndTick(round);
    for (let t = from; t <= to; t += stride) ticks.add(t);
    ticks.add(to);
  }

  return [...ticks].sort((a, b) => a - b);
}

export interface PassCResult {
  parquetPath: string;

  droppedProps: string[];
  rows: number;
  sampledTicks: number;
  stride: number;
  slots: Map<string, number>;

  slotCount: number;
}

function roundIndexer(segmentation: Segmentation): (tick: number) => number | null {
  const ranges = segmentation.rounds
    .filter((r) => r.phase === 'live' && r.roundNum !== null)
    .map((r) => ({
      roundNum: r.roundNum!,
      from: r.startTick ?? r.freezeEndTick ?? r.endTick,

      to: replayEndTick(r),
    }));

  return (tick: number) => {
    for (const r of ranges) if (tick >= r.from && tick <= r.to) return r.roundNum;
    return null;
  };
}

export async function runPassC(options: {
  demoPath: string;
  matchId: string;
  db: DuckDb;
  clock: TickClock;
  segmentation: Segmentation;
  teamOf: Map<string, 'A' | 'B'>;
  parquetPath: string;
  onProgress: (fraction: number) => void;
}): Promise<PassCResult> {
  const { demoPath, matchId, db, clock, segmentation, teamOf, parquetPath } = options;

  const stride = clock.strideForHz(REPLAY_HZ);
  const ticks = sampleTicks(segmentation, stride);
  const slots = assignSlots(teamOf);
  const roundOf = roundIndexer(segmentation);

  await db.exec(`CREATE OR REPLACE TABLE ticks_replay_staging (
    match_id VARCHAR, round_num INTEGER, tick BIGINT, steam_id VARCHAR, slot TINYINT,
    x FLOAT, y FLOAT, z FLOAT, yaw FLOAT, pitch FLOAT,
    health SMALLINT, armor SMALLINT, life_state TINYINT,
    flash_duration FLOAT, is_scoped BOOLEAN, duck_amount FLOAT,
    weapon VARCHAR, side TINYINT,
    money INTEGER, has_helmet BOOLEAN, has_defuser BOOLEAN, inventory VARCHAR,
    is_defusing BOOLEAN)`);

  const appender = await db.appender('ticks_replay_staging');
  let rows = 0;

  const num = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  let droppedProps: string[] | null = null;
  let activeProps: string[] = [...PROPS_REPLAY.required, ...PROPS_REPLAY.optional];

  for (let i = 0; i < ticks.length; i += CHUNK_TICKS) {
    const chunk = ticks.slice(i, i + CHUNK_TICKS);
    let batch: Record<string, unknown>[];
    if (droppedProps === null) {
      const first = parseResilient<Record<string, unknown>>(
        (props) => parseTicks(demoPath, props, chunk) as Record<string, unknown>[],
        PROPS_REPLAY,
      );
      batch = first.rows;
      droppedProps = first.dropped;
      activeProps = [
        ...PROPS_REPLAY.required,
        ...PROPS_REPLAY.optional.filter((prop) => !first.dropped.includes(prop)),
      ];
    } else {
      batch = parseTicks(demoPath, activeProps, chunk) as Record<string, unknown>[];
    }

    for (const row of batch) {
      const steamId = String(row['steamid'] ?? '');
      const slot = slots.get(steamId);

      if (slot === undefined) continue;

      const tick = num(row['tick']);
      const roundNum = roundOf(tick);
      if (roundNum === null) continue;

      const side: Side | null = sideFromTeamNum(num(row['team_num']));

      appender.appendVarchar(matchId);
      appender.appendInteger(roundNum);
      appender.appendBigInt(BigInt(tick));
      appender.appendVarchar(steamId);
      appender.appendTinyInt(slot);
      appender.appendFloat(num(row['X']));
      appender.appendFloat(num(row['Y']));
      appender.appendFloat(num(row['Z']));
      appender.appendFloat(num(row['yaw']));
      appender.appendFloat(num(row['pitch']));
      appender.appendSmallInt(Math.max(0, Math.min(32767, Math.round(num(row['health'])))));
      appender.appendSmallInt(Math.max(0, Math.min(32767, Math.round(num(row['armor_value'])))));
      appender.appendTinyInt(Math.max(0, Math.min(127, Math.round(num(row['life_state'])))));
      appender.appendFloat(num(row['flash_duration']));
      appender.appendBoolean(row['is_scoped'] === true);
      appender.appendFloat(num(row['duck_amount']));
      if (row['active_weapon_name'] == null) appender.appendNull();
      else appender.appendVarchar(String(row['active_weapon_name']));
      appender.appendTinyInt(side === 'CT' ? 3 : side === 'T' ? 2 : 0);
      appender.appendInteger(Math.max(0, Math.round(num(row['balance']))));
      appender.appendBoolean(row['has_helmet'] === true);
      appender.appendBoolean(row['has_defuser'] === true);
      const inv = row['inventory'];
      if (Array.isArray(inv)) appender.appendVarchar(inv.map(String).join(INVENTORY_SEPARATOR));
      else appender.appendNull();
      appender.appendBoolean(row['CCSPlayerPawn.m_bIsDefusing'] === true);
      appender.endRow();
      rows++;
    }

    appender.flushSync();
    options.onProgress(Math.min(1, (i + CHUNK_TICKS) / Math.max(1, ticks.length)));

  }

  appender.closeSync();

  await db.exec(
    `COPY (SELECT * FROM ticks_replay_staging ORDER BY round_num, tick, slot)
       TO '${parquetPath.replace(/'/g, "''")}'
       (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000)`,
  );
  await db.exec('DROP TABLE ticks_replay_staging');

  return {
    parquetPath, rows, sampledTicks: ticks.length, stride, slots, slotCount: slots.size,
    droppedProps: droppedProps ?? [],
  };
}
