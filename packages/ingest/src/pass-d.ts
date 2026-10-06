import { parseTicks } from '@laihoe/demoparser2';
import { TickClock, type Segmentation } from '@cs2/core';
import type { DuckDb } from '@cs2/db';

type Row = Record<string, unknown>;

export const VIEW_PUNCH_PROP = 'CCSPlayerPawn.CCSPlayer_CameraServices.m_vecCsViewPunchAngle';
export const SHOTS_FIRED_PROP = 'CCSPlayerPawn.m_iShotsFired';

export const ACCURACY_PENALTY_PROP = 'Weapon.m_fAccuracyPenalty';

const PROPS_AIM = [
  'X', 'Y', 'Z',
  'pitch', 'yaw',
  'duck_amount',
  'health', 'life_state',
  'active_weapon_name',
  'is_scoped',
  'flash_duration',
  'team_num',
  VIEW_PUNCH_PROP,
  SHOTS_FIRED_PROP,
  ACCURACY_PENALTY_PROP,
];

const CHUNK_TICKS = 3000;

export const MAX_SPEED_GAP_TICKS = 2;

export const WINDOWS = {

  beforeShot: 0.6,
  afterShot: 0.15,

  beforeDeath: 1.0,
  afterBlind: 0.3,
};

export function interestTicks(options: {
  clock: TickClock;
  shotTicks: number[];
  deathTicks: number[];
  blindTicks: number[];
  bombTicks: number[];

  inLiveRound: (tick: number) => boolean;
}): number[] {
  const { clock, inLiveRound } = options;
  const ranges: [number, number][] = [];

  for (const t of options.shotTicks) {
    ranges.push([t - clock.toTicksCeil(WINDOWS.beforeShot), t + clock.toTicksCeil(WINDOWS.afterShot)]);
  }
  for (const t of options.deathTicks) {
    ranges.push([t - clock.toTicksCeil(WINDOWS.beforeDeath), t]);
  }
  for (const t of options.blindTicks) {
    ranges.push([t, t + clock.toTicksCeil(WINDOWS.afterBlind)]);
  }
  for (const t of options.bombTicks) ranges.push([t, t]);

  ranges.sort((a, b) => a[0] - b[0]);

  const out: number[] = [];
  let cursor = -1;
  for (const [from, to] of ranges) {
    for (let t = Math.max(from, cursor + 1, 0); t <= to; t++) {
      if (inLiveRound(t)) out.push(t);
    }
    cursor = Math.max(cursor, to);
  }
  return out;
}

export interface PassDResult {
  rows: number;
  interestTicks: number;
  totalTicks: number;
  chunks: number;
}

export async function runPassD(options: {
  demoPath: string;
  matchId: string;
  db: DuckDb;
  clock: TickClock;
  segmentation: Segmentation;
  events: Map<string, Row[]>;
  slots: Map<string, number>;
  lastTick: number;
  parquetPath: string;
  onProgress: (fraction: number) => void;
}): Promise<PassDResult> {
  const { demoPath, matchId, db, clock, segmentation, events, slots, parquetPath } = options;

  const liveRanges = segmentation.rounds
    .filter((r) => r.phase === 'live' && r.roundNum !== null)
    .map((r) => ({
      roundNum: r.roundNum!,
      from: r.startTick ?? r.freezeEndTick ?? r.endTick,
      to: r.endTick,
    }));

  const roundOf = (tick: number): number | null => {
    for (const r of liveRanges) if (tick >= r.from && tick <= r.to) return r.roundNum;
    return null;
  };

  const ticksOf = (name: string) => (events.get(name) ?? []).map((e) => Number(e['tick']));

  const ticks = interestTicks({
    clock,
    shotTicks: ticksOf('weapon_fire'),
    deathTicks: ticksOf('player_death'),
    blindTicks: ticksOf('player_blind'),
    bombTicks: [
      ...ticksOf('bomb_planted'),
      ...ticksOf('bomb_defused'),
      ...ticksOf('bomb_exploded'),
    ],
    inLiveRound: (t) => roundOf(t) !== null,
  });

  await db.exec(`CREATE OR REPLACE TABLE ticks_window_staging (
    match_id VARCHAR, round_num INTEGER, tick BIGINT, steam_id VARCHAR, slot TINYINT,
    x FLOAT, y FLOAT, z FLOAT,
    pitch FLOAT, yaw FLOAT, punch_pitch FLOAT, punch_yaw FLOAT,
    duck_amount FLOAT, health SMALLINT, life_state TINYINT,
    is_scoped BOOLEAN, flash_duration FLOAT,
    shots_fired SMALLINT, accuracy_penalty FLOAT,
    weapon VARCHAR, side TINYINT)`);

  const appender = await db.appender('ticks_window_staging');
  let rows = 0;

  const num = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const vec = (v: unknown, i: number): number => (Array.isArray(v) ? num(v[i]) : 0);
  const clampInt = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, Math.round(v)));

  const chunks = Math.ceil(ticks.length / CHUNK_TICKS);

  for (let i = 0; i < ticks.length; i += CHUNK_TICKS) {
    const chunk = ticks.slice(i, i + CHUNK_TICKS);
    const batch = parseTicks(demoPath, PROPS_AIM, chunk) as Row[];

    for (const row of batch) {
      const steamId = String(row['steamid'] ?? '');
      const slot = slots.get(steamId);

      if (slot === undefined) continue;

      const tick = num(row['tick']);
      const roundNum = roundOf(tick);
      if (roundNum === null) continue;

      appender.appendVarchar(matchId);
      appender.appendInteger(roundNum);
      appender.appendBigInt(BigInt(tick));
      appender.appendVarchar(steamId);
      appender.appendTinyInt(slot);
      appender.appendFloat(num(row['X']));
      appender.appendFloat(num(row['Y']));
      appender.appendFloat(num(row['Z']));
      appender.appendFloat(num(row['pitch']));
      appender.appendFloat(num(row['yaw']));
      appender.appendFloat(vec(row[VIEW_PUNCH_PROP], 0));
      appender.appendFloat(vec(row[VIEW_PUNCH_PROP], 1));
      appender.appendFloat(num(row['duck_amount']));
      appender.appendSmallInt(clampInt(num(row['health']), 0, 32767));
      appender.appendTinyInt(clampInt(num(row['life_state']), 0, 127));
      appender.appendBoolean(row['is_scoped'] === true);
      appender.appendFloat(num(row['flash_duration']));
      appender.appendSmallInt(clampInt(num(row[SHOTS_FIRED_PROP]), 0, 32767));
      appender.appendFloat(num(row[ACCURACY_PENALTY_PROP]));
      if (row['active_weapon_name'] == null) appender.appendNull();
      else appender.appendVarchar(String(row['active_weapon_name']));
      appender.appendTinyInt(clampInt(num(row['team_num']), 0, 127));
      appender.endRow();
      rows++;
    }

    appender.flushSync();
    options.onProgress(Math.min(1, (i + CHUNK_TICKS) / Math.max(1, ticks.length)));
  }

  appender.closeSync();

  await db.exec(
    `COPY (SELECT * FROM ticks_window_staging ORDER BY round_num, tick, slot)
       TO '${parquetPath.replace(/'/g, "''")}'
       (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000)`,
  );

  await db.exec(`
    UPDATE weapon_fires AS wf
       SET x = t.x, y = t.y, z = t.z,
           pitch = t.pitch, yaw = t.yaw,
           punch_pitch = t.punch_pitch, punch_yaw = t.punch_yaw,
           is_scoped = t.is_scoped
      FROM ticks_window_staging AS t
     WHERE wf.match_id = t.match_id
       AND wf.tick = t.tick
       AND wf.steam_id = t.steam_id`);

  await db.exec(`CREATE OR REPLACE TABLE shot_speed AS
    WITH passo AS (
      SELECT match_id, steam_id, tick, x, y,
             LAG(tick) OVER w AS tick_ant,
             LAG(x) OVER w AS x_ant,
             LAG(y) OVER w AS y_ant
        FROM ticks_window_staging
      WINDOW w AS (PARTITION BY match_id, steam_id ORDER BY tick)
    )
    SELECT match_id, steam_id, tick,
           sqrt((x - x_ant) * (x - x_ant) + (y - y_ant) * (y - y_ant))
             / ((tick - tick_ant) / ${clock.tickRate}) AS speed
      FROM passo
     WHERE tick_ant IS NOT NULL AND tick - tick_ant <= ${MAX_SPEED_GAP_TICKS}`);

  await db.exec(`
    UPDATE weapon_fires AS wf
       SET speed = s.speed
      FROM shot_speed AS s
     WHERE wf.match_id = s.match_id
       AND wf.tick = s.tick
       AND wf.steam_id = s.steam_id`);

  await db.exec('DROP TABLE shot_speed');

  await db.exec(`
    UPDATE bomb_events AS b
       SET x = t.x, y = t.y, z = t.z
      FROM ticks_window_staging AS t
     WHERE b.match_id = t.match_id
       AND b.tick = t.tick
       AND b.steam_id = t.steam_id`);
  await db.exec('DROP TABLE ticks_window_staging');

  return {
    rows,
    interestTicks: ticks.length,
    totalTicks: options.lastTick,
    chunks,
  };
}
