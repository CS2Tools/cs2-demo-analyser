import { parseGrenades } from '@laihoe/demoparser2';
import type { Segmentation } from '@cs2/core';
import type { DuckDb, SqlValue } from '@cs2/db';

type Row = Record<string, unknown>;

export type GrenadeKind = 'smoke' | 'flashbang' | 'he' | 'molotov' | 'decoy' | 'unknown';

export function normalizeGrenadeType(raw: string): GrenadeKind {
  const s = raw.toLowerCase();
  if (s.includes('smoke')) return 'smoke';
  if (s.includes('flashbang')) return 'flashbang';
  if (s.includes('hegrenade')) return 'he';
  if (s.includes('molotov') || s.includes('incendiary')) return 'molotov';
  if (s.includes('decoy')) return 'decoy';
  return 'unknown';
}

export const APPROX_RADIUS: Record<GrenadeKind, number> = {
  smoke: 144,
  molotov: 150,
  he: 350,
  flashbang: 0,
  decoy: 0,
  unknown: 0,
};

const DETONATION_EVENTS: Record<string, GrenadeKind> = {
  smokegrenade_detonate: 'smoke',
  flashbang_detonate: 'flashbang',
  hegrenade_detonate: 'he',
  inferno_startburn: 'molotov',
  decoy_started: 'decoy',
};

const EXPIRY_EVENTS: Record<string, GrenadeKind> = {
  smokegrenade_expired: 'smoke',
  inferno_expire: 'molotov',
};

export interface PassBResult {
  grenades: number;
  detonations: number;
  pathRows: number;
}

interface Detonation {
  entityId: number;
  kind: GrenadeKind;
  tick: number;
  expireTick: number | null;
  x: number;
  y: number;
  z: number;
  thrower: string | null;
}

function collectDetonations(events: Map<string, Row[]>): Detonation[] {
  const out: Detonation[] = [];

  for (const [eventName, kind] of Object.entries(DETONATION_EVENTS)) {
    for (const e of events.get(eventName) ?? []) {
      out.push({
        entityId: Number(e['entityid'] ?? -1),
        kind,
        tick: Number(e['tick']),
        expireTick: null,
        x: Number(e['x'] ?? 0),
        y: Number(e['y'] ?? 0),
        z: Number(e['z'] ?? 0),
        thrower: e['user_steamid'] == null ? null : String(e['user_steamid']),
      });
    }
  }

  for (const [eventName, kind] of Object.entries(EXPIRY_EVENTS)) {
    for (const e of events.get(eventName) ?? []) {
      const entityId = Number(e['entityid'] ?? -1);
      const tick = Number(e['tick']);
      const match = out
        .filter((d) => d.kind === kind && d.entityId === entityId && d.tick < tick)
        .sort((a, b) => b.tick - a.tick)[0];
      if (match) match.expireTick = tick;
    }
  }

  return out.sort((a, b) => a.tick - b.tick);
}

export async function runPassB(options: {
  demoPath: string;
  matchId: string;
  db: DuckDb;
  segmentation: Segmentation;
  events: Map<string, Row[]>;
  stride: number;
  parquetPath: string;
}): Promise<PassBResult> {
  const { demoPath, matchId, db, segmentation, events, stride, parquetPath } = options;

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

  const detonations = collectDetonations(events);

  const raw = parseGrenades(demoPath, null, false) as Row[];

  const byEntity = new Map<number, { kind: GrenadeKind; thrower: string; rows: Row[] }>();
  for (const r of raw) {
    const entityId = Number(r['grenade_entity_id'] ?? -1);
    if (entityId < 0) continue;
    if (r['x'] == null) continue;

    let track = byEntity.get(entityId);
    if (!track) {
      track = {
        kind: normalizeGrenadeType(String(r['grenade_type'] ?? '')),
        thrower: String(r['steamid'] ?? ''),
        rows: [],
      };
      byEntity.set(entityId, track);
    }
    track.rows.push(r);
  }

  const grenadeRows: SqlValue[][] = [];
  const detonationRows: SqlValue[][] = [];
  let grenadeId = 0;
  let detId = 0;
  let pathRows = 0;

  await db.exec(`CREATE OR REPLACE TABLE grenade_paths_staging (
    match_id VARCHAR, grenade_id BIGINT, round_num INTEGER, tick BIGINT,
    x FLOAT, y FLOAT, z FLOAT)`);
  const appender = await db.appender('grenade_paths_staging');

  const usedDetonations = new Set<Detonation>();

  for (const [entityId, track] of byEntity) {
    track.rows.sort((a, b) => Number(a['tick']) - Number(b['tick']));
    const throwTick = Number(track.rows[0]!['tick']);
    const roundNum = roundOf(throwTick);
    if (roundNum === null) continue;

    const lastTick = Number(track.rows[track.rows.length - 1]!['tick']);
    let det =
      detonations.find(
        (d) => d.entityId === entityId && d.kind === track.kind && !usedDetonations.has(d),
      ) ?? null;

    if (!det && track.kind === 'molotov') {
      det =
        detonations
          .filter((d) => d.kind === 'molotov' && !usedDetonations.has(d))
          .filter((d) => Math.abs(d.tick - lastTick) < 64)
          .sort((a, b) => Math.abs(a.tick - lastTick) - Math.abs(b.tick - lastTick))[0] ?? null;
    }
    if (det) usedDetonations.add(det);

    const endOfFlight = det?.tick ?? lastTick;
    grenadeId++;

    const flight = track.rows.filter((r) => Number(r['tick']) <= endOfFlight);
    const keep = decimate(flight, stride);
    for (const r of keep) {
      const tick = Number(r['tick']);
      appender.appendVarchar(matchId);
      appender.appendBigInt(BigInt(grenadeId));
      appender.appendInteger(roundNum);
      appender.appendBigInt(BigInt(tick));
      appender.appendFloat(Number(r['x']));
      appender.appendFloat(Number(r['y']));
      appender.appendFloat(Number(r['z']));
      appender.endRow();
      pathRows++;
    }

    const first = track.rows[0]!;
    grenadeRows.push([
      grenadeId, matchId, roundNum, entityId, track.thrower, track.kind,
      throwTick, det?.tick ?? null, det?.expireTick ?? null,
      Number(first['x']), Number(first['y']), Number(first['z']),
      det?.x ?? null, det?.y ?? null, det?.z ?? null,
      det ? (det.tick - throwTick) : null,
    ]);
  }

  appender.closeSync();

  for (const d of detonations) {
    const roundNum = roundOf(d.tick);
    if (roundNum === null) continue;
    detId++;
    detonationRows.push([
      detId, matchId, roundNum, d.tick, d.kind, d.thrower,
      d.x, d.y, d.z, d.expireTick,
      APPROX_RADIUS[d.kind],

      d.kind === 'smoke' ? 'disco_144u' : d.kind === 'molotov' ? 'cluster_150u' : 'raio_dano',
      true,
    ]);
  }

  await db.bulkInsert(
    'grenades',
    [
      'grenade_id', 'match_id', 'round_num', 'entity_id', 'thrower_steam_id',
      'grenade_type', 'throw_tick', 'detonate_tick', 'expire_tick',
      'throw_x', 'throw_y', 'throw_z', 'detonate_x', 'detonate_y', 'detonate_z',
      'flight_time',
    ],
    grenadeRows,
  );

  await db.bulkInsert(
    'grenade_detonations',
    [
      'det_id', 'match_id', 'round_num', 'tick', 'grenade_type', 'thrower_steam_id',
      'x', 'y', 'z', 'expire_tick', 'approx_radius', 'approx_model', 'is_approximation',
    ],
    detonationRows,
  );

  await db.exec(
    `COPY (SELECT * FROM grenade_paths_staging ORDER BY round_num, grenade_id, tick)
       TO '${parquetPath.replace(/'/g, "''")}'
       (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 100000)`,
  );
  await db.exec('DROP TABLE grenade_paths_staging');

  return { grenades: grenadeRows.length, detonations: detonationRows.length, pathRows };
}

export function decimate(rows: Row[], stride: number): Row[] {
  if (rows.length <= 2) return rows;

  const out: Row[] = [rows[0]!];
  let lastKept = Number(rows[0]!['tick']);

  for (let i = 1; i < rows.length - 1; i++) {
    const tick = Number(rows[i]!['tick']);
    if (tick - lastKept >= stride) {
      out.push(rows[i]!);
      lastKept = tick;
    }
  }

  out.push(rows[rows.length - 1]!);
  return out;
}
