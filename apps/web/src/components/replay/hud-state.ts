import type { ReplayEvent, ReplayHud, ReplaySlot } from '@cs2/contract';

type Step = [number, number, number];

export interface SlotSeries {
  frames: number[];
  values: number[];
}

export function indexSteps(steps: Step[]): Map<number, SlotSeries> {
  const out = new Map<number, SlotSeries>();
  for (const [slot, frame, value] of steps) {
    let s = out.get(slot);
    if (!s) out.set(slot, (s = { frames: [], values: [] }));
    s.frames.push(frame);
    s.values.push(value);
  }
  return out;
}

function lastAtOrBefore(frames: number[], f: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]! <= f) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function valueAt(index: Map<number, SlotSeries>, slot: number, frame: number): number | null {
  const s = index.get(slot);
  if (!s) return null;
  const i = lastAtOrBefore(s.frames, Math.floor(frame));
  return i < 0 ? null : s.values[i]!;
}

export interface InventorySeries {
  frames: number[];
  items: string[][];
}

export function indexInventory(changes: ReplayHud['inventory']): Map<number, InventorySeries> {
  const out = new Map<number, InventorySeries>();
  for (const c of changes) {
    let s = out.get(c.slot);
    if (!s) out.set(c.slot, (s = { frames: [], items: [] }));
    s.frames.push(c.frame);
    s.items.push(c.items);
  }
  return out;
}

export function inventoryAt(index: Map<number, InventorySeries>, slot: number, frame: number): string[] | null {
  const s = index.get(slot);
  if (!s) return null;
  const i = lastAtOrBefore(s.frames, Math.floor(frame));
  return i < 0 ? null : s.items[i]!;
}

export function bombAt(track: ReplayHud['bombTrack'], frame: number): ReplayHud['bombTrack'][number] | null {
  let hit: ReplayHud['bombTrack'][number] | null = null;
  for (const b of track) {
    if (b.frame > frame) break;
    hit = b;
  }
  return hit;
}

export interface RoundClock {

  phase: 'freeze' | 'live' | 'planted' | 'defused' | 'exploded' | 'over' | 'unknown';

  remaining: number | null;

  total: number | null;
  defuse: { slot: number | null; progress: number; hasKit: boolean | null } | null;
}

export const DEFUSE_SECONDS = { withKit: 5, withoutKit: 10 } as const;

export function roundClock(
  hud: ReplayHud,
  tick: number,
  tickRate: number,
  defusingNow: (slot: number) => boolean,
): RoundClock {
  const secs = (ticks: number) => ticks / tickRate;

  if (hud.outcome && tick >= hud.outcome.tick) {
    return { phase: hud.outcome.type, remaining: 0, total: null, defuse: null };
  }

  if (hud.roundEndTick !== null && tick >= hud.roundEndTick) {
    return { phase: 'over', remaining: null, total: null, defuse: null };
  }

  if (hud.plant && tick >= hud.plant.tick) {
    const remaining = Math.max(0, hud.c4TimerSeconds - secs(tick - hud.plant.tick));

    let defuse: RoundClock['defuse'] = null;
    for (const d of [...hud.defuses].reverse()) {
      if (d.tick > tick || d.slot === null || !defusingNow(d.slot)) continue;
      const dur = d.hasKit === false ? DEFUSE_SECONDS.withoutKit : DEFUSE_SECONDS.withKit;
      defuse = { slot: d.slot, progress: Math.min(1, secs(tick - d.tick) / dur), hasKit: d.hasKit };
      break;
    }
    return { phase: 'planted', remaining, total: hud.c4TimerSeconds, defuse };
  }

  if (hud.freezeEndTick !== null && tick < hud.freezeEndTick) {
    return {
      phase: 'freeze',
      remaining: secs(hud.freezeEndTick - tick),
      total: hud.freezeTimeSeconds,
      defuse: null,
    };
  }

  if (hud.freezeEndTick !== null && hud.roundTimeSeconds !== null) {
    return {
      phase: 'live',
      remaining: Math.max(0, hud.roundTimeSeconds - secs(tick - hud.freezeEndTick)),
      total: hud.roundTimeSeconds,
      defuse: null,
    };
  }

  return { phase: 'unknown', remaining: null, total: null, defuse: null };
}

export function formatClock(seconds: number | null): string {
  if (seconds === null) return '—';
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface Kda {
  kills: number;
  deaths: number;
  assists: number;
}

export function kdaAt(
  events: readonly ReplayEvent[],
  slots: readonly Pick<ReplaySlot, 'slot' | 'killsBefore' | 'deathsBefore' | 'assistsBefore'>[],
  tick: number,
): Map<number, Kda> {
  const out = new Map<number, Kda>();
  for (const s of slots) {
    out.set(s.slot, {
      kills: s.killsBefore,
      deaths: s.deathsBefore,
      assists: s.assistsBefore,
    });
  }

  const bump = (slot: number | null, key: keyof Kda) => {
    if (slot === null) return;
    const cur = out.get(slot);

    if (cur) cur[key] += 1;
  };

  for (const e of events) {
    if (e.kind !== 'kill' || e.tick > tick) continue;
    bump(e.actorSlot, 'kills');
    bump(e.targetSlot, 'deaths');
    bump(e.assisterSlot, 'assists');
  }

  return out;
}
