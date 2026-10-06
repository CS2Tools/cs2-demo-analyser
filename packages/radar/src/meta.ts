import { z } from 'zod';
import type { MapMeta } from './types.js';

export const SUPPORTED_FORMAT_VERSION = 4;

const xy = z.object({ x: z.number(), y: z.number() });
const range = z.object({ min: z.number(), max: z.number() });

const splitSchema = z.object({
  bounds: z.object({ top: z.number(), bottom: z.number() }),
  offset: xy,
  zRange: range.optional(),
  survivableDistance: z.array(z.number()).optional(),
});

export const mapMetaSchema = z.object({
  version: z.object({ radar: z.number(), format: z.number() }),
  resolution: z.number().positive(),
  offset: xy,
  splits: z.array(splitSchema).default([]),
  zRange: range.optional(),
  advisoryPosition: xy.optional(),
  survivableDistance: z.array(z.number()).optional(),
});

export function stripLineComments(text: string): string {
  return text.replace(/^\s*\/\/.*$/gm, '');
}

export class UnsupportedMapMetaError extends Error {
  constructor(readonly mapName: string, readonly found: number) {
    super(
      `meta.json5 de "${mapName}" usa formato versao ${found}; ` +
        `so a versao ${SUPPORTED_FORMAT_VERSION} e suportada.`,
    );
    this.name = 'UnsupportedMapMetaError';
  }
}

export function parseMapMeta(mapName: string, raw: string): MapMeta {
  const parsed: unknown = JSON.parse(stripLineComments(raw));
  const meta = mapMetaSchema.parse(parsed);
  if (meta.version.format !== SUPPORTED_FORMAT_VERSION) {
    throw new UnsupportedMapMetaError(mapName, meta.version.format);
  }
  return { name: mapName, ...meta };
}

export function normalizeMapName(raw: string): string {
  const trimmed = raw.trim();
  const idx = trimmed.lastIndexOf('/');
  return (idx === -1 ? trimmed : trimmed.slice(idx + 1)).toLowerCase();
}

export const AVAILABLE_MAPS = [
  'de_ancient',
  'de_anubis',
  'de_cache',
  'de_dust2',
  'de_inferno',
  'de_mirage',
  'de_nuke',
  'de_overpass',
  'de_train',
  'de_vertigo',
] as const;

export type AvailableMap = (typeof AVAILABLE_MAPS)[number];

export function hasRadar(mapName: string): boolean {
  return (AVAILABLE_MAPS as readonly string[]).includes(normalizeMapName(mapName));
}
