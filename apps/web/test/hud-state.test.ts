import { describe, expect, it } from 'vitest';
import type { ReplayHud } from '@cs2/contract';
import {
  bombAt,
  formatClock,
  indexInventory,
  indexSteps,
  inventoryAt,
  roundClock,
  valueAt,
} from '../src/components/replay/hud-state';

const hud = (patch: Partial<ReplayHud> = {}): ReplayHud => ({
  dataVersion: 3,
  roundEndTick: null,
  roundTimeSeconds: 115,
  freezeTimeSeconds: 15,
  freezeEndTick: 29426,
  c4TimerSeconds: 41,
  c4TimerSource: 'measured',
  weaponNames: [], weaponIdx: [], money: [], armor: [], helmet: [], defuser: [], defusing: [],
  inventory: [],
  plant: { tick: 33105, site: 'A', place: 'BombsiteA', slot: 7 },
  defuses: [{ tick: 34208, slot: 2, hasKit: false }],
  outcome: { type: 'exploded', tick: 35729 },
  bombTrack: [],
  ...patch,
});

describe('valueAt / inventoryAt', () => {
  const idx = indexSteps([[0, 0, 800], [1, 0, 4000], [0, 5, 100], [0, 9, 3100]]);

  it('pega a ultima mudanca ate o quadro', () => {
    expect(valueAt(idx, 0, 0)).toBe(800);
    expect(valueAt(idx, 0, 4.9)).toBe(800);
    expect(valueAt(idx, 0, 5)).toBe(100);
    expect(valueAt(idx, 0, 100)).toBe(3100);
    expect(valueAt(idx, 1, 50)).toBe(4000);
  });

  it('antes da primeira mudanca, ou slot sem dado: nulo', () => {
    expect(valueAt(indexSteps([[0, 3, 1]]), 0, 2)).toBeNull();
    expect(valueAt(idx, 7, 10)).toBeNull();
  });

  it('inventario funciona igual', () => {
    const inv = indexInventory([
      { frame: 0, slot: 0, items: ['knife_t', 'Glock-18'] },
      { frame: 4, slot: 0, items: ['knife_t', 'Glock-18', 'AK-47'] },
    ]);
    expect(inventoryAt(inv, 0, 3)).toEqual(['knife_t', 'Glock-18']);
    expect(inventoryAt(inv, 0, 4)).toContain('AK-47');
  });
});

describe('bombAt', () => {
  it('o estado da C4 vale ate a proxima mudanca', () => {
    const track: ReplayHud['bombTrack'] = [
      { frame: 0, state: 'carried', slot: 5, pos: null, approx: false },
      { frame: 10, state: 'dropped', slot: null, pos: { x: 1, y: 2, split: 0 }, approx: true },
    ];
    expect(bombAt(track, 9)?.state).toBe('carried');
    expect(bombAt(track, 10)?.state).toBe('dropped');
  });
});

describe('roundClock (ticks reais do round 4)', () => {
  const never = () => false;

  it('freezetime conta os 15 s', () => {
    const c = roundClock(hud(), 29426 - 64 * 15, 64, never);
    expect(c).toMatchObject({ phase: 'freeze', remaining: 15, total: 15 });
  });

  it('round conta 1:55 a partir do fim do freezetime', () => {
    expect(roundClock(hud(), 29426, 64, never)).toMatchObject({ phase: 'live', remaining: 115 });

    expect(roundClock(hud(), 29426 + 64 * 30, 64, never).remaining).toBe(85);

    expect(roundClock(hud(), 29426 + 64 * 60, 64, never).phase).toBe('planted');
  });

  it('C4 plantada vira o timer de 41 s', () => {
    const c = roundClock(hud(), 33105 + 64 * 11, 64, never);
    expect(c).toMatchObject({ phase: 'planted', remaining: 30, total: 41 });
  });

  it('desarme largado nao enche a barra: o caso real do round 4', () => {

    const c = roundClock(hud(), 34208 + 64 * 3, 64, never);
    expect(c.defuse).toBeNull();
  });

  it('desarme de verdade: sem kit, 10 s', () => {
    const c = roundClock(hud(), 34208 + 64 * 5, 64, (slot) => slot === 2);
    expect(c.defuse).toEqual({ slot: 2, progress: 0.5, hasKit: false });
  });

  it('com kit, 5 s', () => {
    const h = hud({ defuses: [{ tick: 107179, slot: 9, hasKit: true }], plant: { tick: 106660, site: 'B', place: 'BombsiteB', slot: 2 }, outcome: { type: 'defused', tick: 107499 } });
    expect(roundClock(h, 107179 + 160, 64, () => true).defuse?.progress).toBe(0.5);
  });

  it('depois do desfecho, a fase e o desfecho', () => {
    expect(roundClock(hud(), 35729, 64, never).phase).toBe('exploded');
  });

  it('depois do round_end, o relogio diz que o round ja foi decidido', () => {
    const c = roundClock(hud({ roundEndTick: 35729, outcome: null }), 35729 + 64 * 3, 64, never);
    expect(c).toMatchObject({ phase: 'over', remaining: null, total: null });
  });

  it('a C4 nao continua contando num round ja decidido', () => {

    const c = roundClock(hud({ roundEndTick: 34000, outcome: null }), 34500, 64, never);
    expect(c.phase).toBe('over');
  });

  it('bomba que explode manda no lugar do pos-round', () => {

    const c = roundClock(hud({ roundEndTick: 35729 }), 35729 + 64, 64, never);
    expect(c.phase).toBe('exploded');
  });

  it('antes do round_end nada muda', () => {
    expect(roundClock(hud({ roundEndTick: 35729, outcome: null }), 29426, 64, never).phase).toBe('live');
  });

  it('sem os tempos (partida antiga), nao inventa relogio', () => {
    const c = roundClock(hud({ roundTimeSeconds: null, freezeEndTick: null, plant: null, outcome: null }), 30000, 64, never);
    expect(c.phase).toBe('unknown');
  });
});

describe('formatClock', () => {
  it('arredonda para cima, como o relogio do jogo', () => {
    expect(formatClock(115)).toBe('1:55');
    expect(formatClock(6.2)).toBe('0:07');
    expect(formatClock(null)).toBe('—');
  });
});
