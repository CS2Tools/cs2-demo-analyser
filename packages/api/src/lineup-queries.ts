import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { practiceCommand } from '@cs2/core';
import { parseMapMeta, worldToRadarPercent, type MapMeta } from '@cs2/radar';
import type { Db } from '@cs2/db';
import type {
  GrenadeKind,
  RoundThrow,
  RoundThrows,
  SavedLineup,
  UtilityMap,
} from '@cs2/contract';

const metaCache = new Map<string, MapMeta | null>();
function loadMapMeta(mapsDir: string, mapName: string): MapMeta | null {
  if (metaCache.has(mapName)) return metaCache.get(mapName) ?? null;
  let meta: MapMeta | null = null;
  try {
    meta = parseMapMeta(mapName, readFileSync(join(mapsDir, mapName, 'meta.json5'), 'utf8'));
  } catch {
    meta = null;
  }
  metaCache.set(mapName, meta);
  return meta;
}

function percentOf(meta: MapMeta | null) {
  return (x: number | null, y: number | null, z: number | null) => {
    if (!meta || x === null || y === null) return { px: null, py: null };
    const p = worldToRadarPercent({ x: Number(x), y: Number(y), z: Number(z ?? 0) }, meta);
    return { px: p.px, py: p.py };
  };
}

export async function getUtilityMaps(db: Db): Promise<UtilityMap[]> {
  const rows = await db.query<{ map_name: string; saved: number; has_radar: boolean | null }>(
    `SELECT c.map_name,
            COUNT(*)::INTEGER AS saved,
            MAX(CASE WHEN m.has_radar THEN TRUE ELSE FALSE END) AS has_radar
       FROM lineup_collection c
       LEFT JOIN matches m ON m.map_name = c.map_name
      GROUP BY c.map_name
      ORDER BY saved DESC, c.map_name`,
    [],
  );
  return rows.map((r) => ({
    mapName: r.map_name,

    hasRadar: r.has_radar === null ? true : r.has_radar === true,
    saved: Number(r.saved),
  }));
}

interface ThrowRow {
  match_id: string; throw_id: number; round_num: number; steam_id: string | null;
  player_name: string | null; side: string | null; grenade_type: string;
  throw_tick: number | null;
  throw_x: number; throw_y: number; throw_z: number;
  pitch: number | null; yaw: number | null;
  crouched: boolean | null; on_ground: boolean | null;
  speed: number | null; throw_strength: number | null;
  det_x: number | null; det_y: number | null; det_z: number | null;
  enemies_blinded: number | null; enemy_damage: number | null; kills_after: number | null;
  map_name: string;
  bulk_state: string | null;
  freeze_end_tick: number | null;
  tick_rate: number | null;
  saved_as: string | null;
}

export async function getRoundThrows(
  db: Db,
  mapsDir: string,
  query: { matchId: string; roundNum: number },
): Promise<RoundThrows> {
  const rows = await db.query<ThrowRow>(
    `SELECT u.*, pm.name AS player_name, m.bulk_state, m.tick_rate,
            r.freeze_end_tick,
            (SELECT c.name FROM lineup_collection c
              WHERE c.source_match_id = u.match_id AND c.source_tick = u.throw_tick
              LIMIT 1) AS saved_as
       FROM utility_throws u
       LEFT JOIN player_match pm ON pm.match_id = u.match_id AND pm.steam_id = u.steam_id
       LEFT JOIN matches m ON m.match_id = u.match_id
       LEFT JOIN rounds r ON r.match_id = u.match_id AND r.round_num = u.round_num
      WHERE u.match_id = ? AND u.round_num = ?
      ORDER BY u.throw_tick`,
    [query.matchId, query.roundNum],
  );

  const extracted = await db.queryOne<{ n: number }>(
    'SELECT COUNT(*)::INTEGER AS n FROM utility_throws WHERE match_id = ?',
    [query.matchId],
  );

  const meta = loadMapMeta(mapsDir, rows[0]?.map_name ?? '');
  const percent = percentOf(meta);

  const throws: RoundThrow[] = rows.map((r) => {
    const from = percent(r.throw_x, r.throw_y, r.throw_z);
    const to = percent(r.det_x, r.det_y, r.det_z);
    const tickRate = Number(r.tick_rate ?? 64);
    const start = r.freeze_end_tick === null ? null : Number(r.freeze_end_tick);
    const tick = r.throw_tick === null ? null : Number(r.throw_tick);

    return {
      throwId: Number(r.throw_id),
      matchId: r.match_id,
      roundNum: Number(r.round_num),
      steamId: r.steam_id,
      playerName: r.player_name,
      side: (r.side as 'CT' | 'T' | null) ?? null,
      throwTick: tick,
      x: Number(r.throw_x), y: Number(r.throw_y), z: Number(r.throw_z),
      pitch: r.pitch === null ? null : Number(r.pitch),
      yaw: r.yaw === null ? null : Number(r.yaw),
      crouched: r.crouched,
      onGround: r.on_ground,
      speed: r.speed === null ? null : Number(r.speed),
      throwStrength: r.throw_strength === null ? null : Number(r.throw_strength),
      detX: r.det_x === null ? null : Number(r.det_x),
      detY: r.det_y === null ? null : Number(r.det_y),
      detZ: r.det_z === null ? null : Number(r.det_z),
      enemiesBlinded: Number(r.enemies_blinded ?? 0),
      enemyDamage: Number(r.enemy_damage ?? 0),
      killsAfter: Number(r.kills_after ?? 0),
      throwPx: from.px, throwPy: from.py,
      detPx: to.px, detPy: to.py,
      canOpenReplay: r.bulk_state !== null && r.bulk_state !== 'pruned',
      grenadeType: r.grenade_type as GrenadeKind,
      secondsIntoRound:
        start === null || tick === null
          ? null
          : Math.max(0, Math.round(((tick - start) / tickRate) * 10) / 10),
      command: practiceCommand({
        x: Number(r.throw_x), y: Number(r.throw_y), z: Number(r.throw_z),
        pitch: r.pitch === null ? null : Number(r.pitch),
        yaw: r.yaw === null ? null : Number(r.yaw),
      }),
      savedAs: r.saved_as,
    };
  });

  return { throws, extracted: Number(extracted?.n ?? 0) > 0 };
}

interface SavedRow {
  lineup_id: string; name: string; note: string | null; map_name: string;
  grenade_type: string; side: string | null;
  throw_x: number; throw_y: number; throw_z: number;
  pitch: number | null; yaw: number | null;
  crouched: boolean | null; on_ground: boolean | null;
  speed: number | null; throw_strength: number | null;
  det_x: number | null; det_y: number | null; det_z: number | null;
  source_match_id: string | null; source_round: number | null; source_tick: number | null;
  created_at: Date | string;
  bulk_state: string | null;
}

const toSaved = (r: SavedRow, mapsDir: string): SavedLineup => {
  const percent = percentOf(loadMapMeta(mapsDir, r.map_name));
  const from = percent(r.throw_x, r.throw_y, r.throw_z);
  const to = percent(r.det_x, r.det_y, r.det_z);
  return {
    lineupId: r.lineup_id,
    name: r.name,
    note: r.note,
    mapName: r.map_name,
    grenadeType: r.grenade_type as GrenadeKind,
    side: (r.side as 'CT' | 'T' | null) ?? null,
    x: Number(r.throw_x), y: Number(r.throw_y), z: Number(r.throw_z),
    pitch: r.pitch === null ? null : Number(r.pitch),
    yaw: r.yaw === null ? null : Number(r.yaw),
    crouched: r.crouched,
    onGround: r.on_ground,
    speed: r.speed === null ? null : Number(r.speed),
    throwStrength: r.throw_strength === null ? null : Number(r.throw_strength),
    detX: r.det_x === null ? null : Number(r.det_x),
    detY: r.det_y === null ? null : Number(r.det_y),
    detZ: r.det_z === null ? null : Number(r.det_z),
    command: practiceCommand({
      x: Number(r.throw_x), y: Number(r.throw_y), z: Number(r.throw_z),
      pitch: r.pitch === null ? null : Number(r.pitch),
      yaw: r.yaw === null ? null : Number(r.yaw),
    }),
    throwPx: from.px, throwPy: from.py,
    detPx: to.px, detPy: to.py,
    sourceMatchId: r.source_match_id,
    sourceRound: r.source_round === null ? null : Number(r.source_round),
    sourceTick: r.source_tick === null ? null : Number(r.source_tick),
    canOpenReplay: r.bulk_state !== null && r.bulk_state !== 'pruned',
    createdAt: new Date(r.created_at).toISOString(),
  };
};

const SAVED_SELECT = `
  SELECT c.*, m.bulk_state
    FROM lineup_collection c
    LEFT JOIN matches m ON m.match_id = c.source_match_id`;

export async function listCollection(
  db: Db,
  mapsDir: string,
  mapName?: string | null,
): Promise<SavedLineup[]> {
  const rows = mapName
    ? await db.query<SavedRow>(`${SAVED_SELECT} WHERE c.map_name = ? ORDER BY c.created_at DESC`, [mapName])
    : await db.query<SavedRow>(`${SAVED_SELECT} ORDER BY c.created_at DESC`, []);
  return rows.map((r) => toSaved(r, mapsDir));
}

export async function saveToCollection(
  db: Db,
  mapsDir: string,
  params: { matchId: string; throwId: number; name: string; note: string | null },
): Promise<SavedLineup> {
  const source = await db.queryOne<ThrowRow>(
    `SELECT * FROM utility_throws WHERE match_id = ? AND throw_id = ?`,
    [params.matchId, params.throwId],
  );
  if (!source) throw new Error('arremesso nao encontrado');

  const lineupId = randomUUID();
  await db.exec(
    `INSERT INTO lineup_collection
       (lineup_id, name, note, map_name, grenade_type, side,
        throw_x, throw_y, throw_z, pitch, yaw, crouched, on_ground, speed, throw_strength,
        det_x, det_y, det_z, source_match_id, source_round, source_tick, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lineupId, params.name, params.note, source.map_name,
      source.grenade_type, source.side,
      source.throw_x, source.throw_y, source.throw_z, source.pitch, source.yaw,
      source.crouched, source.on_ground, source.speed, source.throw_strength,
      source.det_x, source.det_y, source.det_z,
      params.matchId, source.round_num, source.throw_tick,
      new Date(),
    ],
  );

  const saved = await db.queryOne<SavedRow>(`${SAVED_SELECT} WHERE c.lineup_id = ?`, [lineupId]);
  return toSaved(saved!, mapsDir);
}

export async function renameInCollection(
  db: Db,
  mapsDir: string,
  params: { lineupId: string; name: string; note: string | null },
): Promise<SavedLineup> {
  await db.exec('UPDATE lineup_collection SET name = ?, note = ? WHERE lineup_id = ?', [
    params.name, params.note, params.lineupId,
  ]);
  const saved = await db.queryOne<SavedRow>(`${SAVED_SELECT} WHERE c.lineup_id = ?`, [params.lineupId]);
  if (!saved) throw new Error('utilitaria nao encontrada');
  return toSaved(saved, mapsDir);
}

export async function removeFromCollection(db: Db, lineupId: string): Promise<boolean> {
  const before = await db.queryOne<{ n: number }>(
    'SELECT COUNT(*)::INTEGER AS n FROM lineup_collection WHERE lineup_id = ?',
    [lineupId],
  );
  await db.exec('DELETE FROM lineup_collection WHERE lineup_id = ?', [lineupId]);
  return Number(before?.n ?? 0) > 0;
}
