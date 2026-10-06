import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseMapMeta } from '../src/meta.js';
import type { MapMeta } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
export const VENDOR_DIR = join(here, '..', '..', '..', 'vendor', 'boltobserv-maps');

const cache = new Map<string, MapMeta>();

export function loadMeta(mapName: string): MapMeta {
  const hit = cache.get(mapName);
  if (hit) return hit;
  const raw = readFileSync(join(VENDOR_DIR, mapName, 'meta.json5'), 'utf8');
  const meta = parseMapMeta(mapName, raw);
  cache.set(mapName, meta);
  return meta;
}
