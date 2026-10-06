import type { MapMeta, RadarPosition } from './types.js';

export interface WorldPos {
  x: number;
  y: number;
  z?: number;
}

export const NOMINAL_RADAR_SIZE = 1024;

export function splitIndexForZ(meta: MapMeta, z: number | undefined): number {
  if (meta.splits.length === 0 || typeof z !== 'number') return -1;
  for (let i = 0; i < meta.splits.length; i++) {
    const b = meta.splits[i]!.bounds;

    if (z > b.bottom && z < b.top) return i;
  }
  return -1;
}

export function worldToRadarPercent(world: WorldPos, meta: MapMeta): RadarPosition {
  const split = splitIndexForZ(meta, world.z);
  const s = split >= 0 ? meta.splits[split] : undefined;

  const pct = (axis: 'x' | 'y'): number => {
    const game = world[axis] + meta.offset[axis];
    const pixel = game / meta.resolution;
    const percent = (pixel / NOMINAL_RADAR_SIZE) * 100;
    return percent + (s ? s.offset[axis] : 0);
  };

  return { px: pct('x'), py: pct('y'), split };
}

export function radarToPixel(
  pos: Pick<RadarPosition, 'px' | 'py'>,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  return {
    x: (pos.px / 100) * imageWidth,
    y: ((100 - pos.py) / 100) * imageHeight,
  };
}

export function worldToPixel(
  world: WorldPos,
  meta: MapMeta,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; split: number } {
  const p = worldToRadarPercent(world, meta);
  const { x, y } = radarToPixel(p, imageWidth, imageHeight);
  return { x, y, split: p.split };
}

export function radarPercentToWorld(
  pos: { px: number; py: number },
  meta: MapMeta,
  split = -1,
): { x: number; y: number } {
  const s = split >= 0 ? meta.splits[split] : undefined;
  const un = (axis: 'x' | 'y', percent: number): number => {
    const base = percent - (s ? s.offset[axis] : 0);
    return (base / 100) * NOMINAL_RADAR_SIZE * meta.resolution - meta.offset[axis];
  };
  return { x: un('x', pos.px), y: un('y', pos.py) };
}

export function heightFraction(meta: MapMeta, z: number, split: number): number | null {
  const range = split >= 0 ? meta.splits[split]?.zRange : meta.zRange;
  if (!range) return null;
  const span = Math.abs(range.max - range.min);
  if (span === 0) return 0;
  if (z < range.min) return 0;
  return Math.min(1, Math.max(0, Math.abs(z - range.min) / span));
}

export function survivableDistance(meta: MapMeta, health: number, split = -1): number | null {
  const table = (split >= 0 ? meta.splits[split]?.survivableDistance : undefined) ?? meta.survivableDistance;
  if (!table || table.length === 0) return null;
  const idx = Math.min(table.length - 1, Math.max(0, Math.floor(health / 5)));
  return table[idx] ?? null;
}
