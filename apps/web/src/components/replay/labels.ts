export type PlayerLabelMode = 'number' | 'always' | 'hover';

export const PLAYER_LABEL_MODES: PlayerLabelMode[] = ['number', 'always', 'hover'];

export function numbersBySlot(
  slots: readonly { slot: number; team: 'A' | 'B' | null }[],
): Map<number, number> {
  const out = new Map<number, number>();
  for (const team of ['A', 'B'] as const) {
    const ordered = slots
      .filter((s) => s.team === team)
      .sort((a, b) => a.slot - b.slot);
    ordered.forEach((s, i) => out.set(s.slot, i + 1));
  }
  return out;
}

export interface LabelPlan {

  inDot: string | null;

  above: string | null;
}

export function planPlayerLabel(params: {
  mode: PlayerLabelMode;
  name: string;
  number: number | null;
  highlighted: boolean;
}): LabelPlan {
  const { mode, name, number, highlighted } = params;

  if (mode === 'always') {
    return { inDot: null, above: name };
  }

  if (mode === 'number') {

    const cabe = number !== null && number <= 9;
    return {
      inDot: cabe ? String(number) : null,
      above: highlighted ? name : null,
    };
  }

  return { inDot: null, above: highlighted ? name : null };
}

export function poiColourBySlot(
  slots: readonly { slot: number; steamId: string }[],
  pois: readonly { steamId: string; colour: string }[],
): Map<number, string> {
  const byId = new Map(pois.map((p) => [p.steamId, p.colour]));
  const out = new Map<number, string>();
  for (const s of slots) {
    const colour = byId.get(s.steamId);
    if (colour) out.set(s.slot, colour);
  }
  return out;
}
