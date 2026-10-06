export const C4_NAME = 'C4 Explosive';

export type Step = [number, number, number];

export interface HudRow {
  frame: number;
  slot: number;
  weapon: string | null;
  money: number | null;
  armor: number | null;
  helmet: boolean | null;
  defuser: boolean | null;
  inventory: string | null;
  defusing: boolean | null;
}

export interface HudSeries {
  weaponNames: string[];

  weaponIdx: number[];
  money: Step[];
  armor: Step[];
  helmet: Step[];
  defuser: Step[];

  defusing: Step[];

  inventory: { frame: number; slot: number; items: string[] }[];
}

function steps(rows: HudRow[], pick: (r: HudRow) => number | null): Step[] {
  const last = new Map<number, number>();
  const out: Step[] = [];
  for (const r of rows) {
    const v = pick(r);
    if (v === null) continue;
    if (last.get(r.slot) === v) continue;
    last.set(r.slot, v);
    out.push([r.slot, r.frame, v]);
  }
  return out;
}

export function buildHudSeries(
  rows: HudRow[],
  frames: number,
  separator: string,

  slotsPerFrame: number,
): HudSeries {
  const weaponNames: string[] = [];
  const dict = new Map<string, number>();
  const weaponIdx = new Array<number>(frames * slotsPerFrame).fill(-1);
  for (const r of rows) {
    if (!r.weapon) continue;
    let idx = dict.get(r.weapon);
    if (idx === undefined) {
      idx = weaponNames.length;
      weaponNames.push(r.weapon);
      dict.set(r.weapon, idx);
    }
    weaponIdx[r.frame * slotsPerFrame + r.slot] = idx;
  }

  const inventory: HudSeries['inventory'] = [];
  const lastInv = new Map<number, string>();
  for (const r of rows) {
    if (r.inventory === null) continue;
    if (lastInv.get(r.slot) === r.inventory) continue;
    lastInv.set(r.slot, r.inventory);
    inventory.push({ frame: r.frame, slot: r.slot, items: r.inventory ? r.inventory.split(separator) : [] });
  }

  const b = (v: boolean | null) => (v === null ? null : v ? 1 : 0);
  return {
    weaponNames,
    weaponIdx,
    money: steps(rows, (r) => r.money),
    armor: steps(rows, (r) => r.armor),
    helmet: steps(rows, (r) => b(r.helmet)),
    defuser: steps(rows, (r) => b(r.defuser)),
    defusing: steps(rows, (r) => b(r.defusing)),
    inventory,
  };
}

export interface BombPosition {
  x: number;
  y: number;
  split: number;
}

export interface BombState {
  frame: number;
  state: 'carried' | 'dropped' | 'planted';

  slot: number | null;

  pos: BombPosition | null;

  approx: boolean;
}

export function buildBombTrack(
  frames: number,
  inventory: HudSeries['inventory'],
  positionAt: (frame: number, slot: number) => BombPosition | null,
  plant: { frame: number; slot: number | null } | null,
): BombState[] {

  const bySlot = new Map<number, string[]>();
  let k = 0;
  const out: BombState[] = [];
  let lastKey = '';
  let lastCarrier: number | null = null;

  const push = (s: BombState) => {
    const key = `${s.state}|${s.slot}`;
    if (key === lastKey) return;
    lastKey = key;
    out.push(s);
  };

  for (let f = 0; f < frames; f++) {
    while (k < inventory.length && inventory[k]!.frame <= f) {
      bySlot.set(inventory[k]!.slot, inventory[k]!.items);
      k++;
    }

    if (plant && f >= plant.frame) {
      const pos = plant.slot === null ? null : positionAt(plant.frame, plant.slot);
      push({ frame: f, state: 'planted', slot: plant.slot, pos, approx: false });
      break;
    }

    let carrier: number | null = null;
    for (const [slot, items] of bySlot) if (items.includes(C4_NAME)) carrier = slot;

    if (carrier !== null) {
      lastCarrier = carrier;
      push({ frame: f, state: 'carried', slot: carrier, pos: null, approx: false });
    } else if (lastCarrier !== null) {

      const pos = positionAt(Math.max(0, f - 1), lastCarrier);
      push({ frame: f, state: 'dropped', slot: null, pos, approx: true });
    }
  }
  return out;
}
