import type { VerdictWire } from '@cs2/contract';

export const FAMILIES = ['aim', 'duels', 'utility', 'economy', 'combat'] as const;
export type Family = (typeof FAMILIES)[number];

export const SEVERITY_ORDER: Record<VerdictWire['severity'], number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  neutral: 3,
};

export const cellKey = (steamId: string, family: Family) => `${steamId}|${family}`;

export function groupFindings(all: VerdictWire[]): {
  byPlayer: Map<string, VerdictWire[]>;
  byCell: Map<string, VerdictWire[]>;
} {
  const byPlayer = new Map<string, VerdictWire[]>();
  const byCell = new Map<string, VerdictWire[]>();
  for (const v of all) {
    const player = byPlayer.get(v.steamId) ?? [];
    player.push(v);
    byPlayer.set(v.steamId, player);
    const key = cellKey(v.steamId, v.family);
    const cell = byCell.get(key) ?? [];
    cell.push(v);
    byCell.set(key, cell);
  }
  return { byPlayer, byCell };
}

export function worstSeverity(verdicts: VerdictWire[]): VerdictWire['severity'] {
  return verdicts.reduce<VerdictWire['severity']>(
    (acc, v) => (SEVERITY_ORDER[v.severity] < SEVERITY_ORDER[acc] ? v.severity : acc),
    'neutral',
  );
}

export function sortBySeverity(verdicts: VerdictWire[]): VerdictWire[] {
  return [...verdicts].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.ruleId.localeCompare(b.ruleId),
  );
}
