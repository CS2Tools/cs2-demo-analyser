import type { UtilityThrow } from '@cs2/contract';

export interface ThrowFilters {
  kinds: UtilityThrow['kind'][];
  steamId: string | null;
  side: 'todos' | 'CT' | 'T';

  effectiveOnly: boolean;

  minDamage: number;

  minBlindSeconds: number;

  minEnemies: number;
}

export const DEFAULT_FILTERS: ThrowFilters = {
  kinds: ['smoke', 'flash', 'fire', 'he', 'decoy'],
  steamId: null,
  side: 'todos',
  effectiveOnly: false,
  minDamage: 0,
  minBlindSeconds: 0,
  minEnemies: 0,
};

const MEASURED = new Set<UtilityThrow['kind']>(['he', 'fire', 'flash']);
const DAMAGING = new Set<UtilityThrow['kind']>(['he', 'fire']);

export function hadEffect(g: UtilityThrow): boolean {
  return g.damage > 0 || g.enemiesBlinded > 0;
}

export function filterThrows(throws: UtilityThrow[], f: ThrowFilters): UtilityThrow[] {
  return throws.filter((g) => {
    if (!f.kinds.includes(g.kind)) return false;
    if (f.steamId !== null && g.steamId !== f.steamId) return false;
    if (f.side !== 'todos' && g.side !== f.side) return false;
    if (f.effectiveOnly && !hadEffect(g)) return false;
    if (f.minDamage > 0 && DAMAGING.has(g.kind) && g.damage < f.minDamage) return false;
    if (f.minBlindSeconds > 0 && g.kind === 'flash' && g.bestBlindSeconds < f.minBlindSeconds) {
      return false;
    }
    if (f.minEnemies > 0 && MEASURED.has(g.kind)) {
      if (Math.max(g.enemiesHit, g.enemiesBlinded) < f.minEnemies) return false;
    }
    return true;
  });
}

export function isFiltered(f: ThrowFilters): boolean {
  return (
    f.steamId !== null ||
    f.side !== 'todos' ||
    f.effectiveOnly ||
    f.minDamage > 0 ||
    f.minBlindSeconds > 0 ||
    f.minEnemies > 0
  );
}
