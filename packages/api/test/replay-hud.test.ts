import { describe, expect, it } from 'vitest';
import { buildBombTrack, buildHudSeries, C4_NAME, type HudRow } from '../src/replay-hud.js';

const row = (frame: number, slot: number, patch: Partial<HudRow> = {}): HudRow => ({
  frame, slot, weapon: 'Glock-18', money: 800, armor: 0, helmet: false, defuser: false,
  inventory: 'knife_t|Glock-18', defusing: false, ...patch,
});

describe('buildHudSeries', () => {
  it('arma na mao vira indice num dicionario, por frame*slotsPerFrame+slot', () => {
    const s = buildHudSeries(
      [row(0, 0), row(0, 1, { weapon: 'AK-47' }), row(1, 0, { weapon: 'AK-47' }), row(1, 1, { weapon: null })],
      2,
      '|',
      10,
    );
    expect(s.weaponNames).toEqual(['Glock-18', 'AK-47']);
    expect(s.weaponIdx[0]).toBe(0);
    expect(s.weaponIdx[1]).toBe(1);
    expect(s.weaponIdx[10]).toBe(1);
    expect(s.weaponIdx[11]).toBe(-1);
  });

  it('dinheiro so aparece quando muda: a compra, nao os 600 quadros', () => {
    const rows = [0, 1, 2, 3].map((f) => row(f, 0, { money: f < 2 ? 800 : 100 }));
    expect(buildHudSeries(rows, 4, '|', 10).money).toEqual([[0, 0, 800], [0, 2, 100]]);
  });

  it('inventario so nas mudancas, com a lista completa', () => {
    const rows = [
      row(0, 0, { inventory: `knife_t|Glock-18|${C4_NAME}` }),
      row(1, 0, { inventory: `knife_t|Glock-18|${C4_NAME}` }),
      row(2, 0, { inventory: 'knife_t|Glock-18' }),
    ];
    expect(buildHudSeries(rows, 3, '|', 10).inventory).toEqual([
      { frame: 0, slot: 0, items: ['knife_t', 'Glock-18', C4_NAME] },
      { frame: 2, slot: 0, items: ['knife_t', 'Glock-18'] },
    ]);
  });

  it('sem dado (partida antiga) nao inventa mudanca', () => {
    const s = buildHudSeries([row(0, 0, { money: null, helmet: null, inventory: null })], 1, '|', 10);
    expect(s.money).toEqual([]);
    expect(s.helmet).toEqual([]);
    expect(s.inventory).toEqual([]);
  });
});

describe('buildBombTrack', () => {
  const pos = (frame: number, slot: number) => ({ x: slot * 10 + frame, y: 50, split: 0 });

  it('com o portador, depois no chao onde ele estava, depois com quem pegou, depois plantada', () => {
    const inventory = [
      { frame: 0, slot: 5, items: [C4_NAME] },
      { frame: 3, slot: 5, items: [] },
      { frame: 6, slot: 7, items: [C4_NAME] },
      { frame: 9, slot: 7, items: [] },
    ];
    const track = buildBombTrack(12, inventory, pos, { frame: 9, slot: 7 });
    expect(track).toEqual([
      { frame: 0, state: 'carried', slot: 5, pos: null, approx: false },
      { frame: 3, state: 'dropped', slot: null, pos: { x: 52, y: 50, split: 0 }, approx: true },
      { frame: 6, state: 'carried', slot: 7, pos: null, approx: false },
      { frame: 9, state: 'planted', slot: 7, pos: { x: 79, y: 50, split: 0 }, approx: false },
    ]);
  });

  it('round sem plantio: termina com a C4 onde estiver', () => {
    const track = buildBombTrack(5, [{ frame: 0, slot: 5, items: [C4_NAME] }], pos, null);
    expect(track).toEqual([{ frame: 0, state: 'carried', slot: 5, pos: null, approx: false }]);
  });

  it('sem dado de inventario (partida antiga): nada e inventado', () => {
    expect(buildBombTrack(5, [], pos, null)).toEqual([]);
  });
});

describe('buildHudSeries com mais de dez slots', () => {
  it('o indice acompanha o passo da partida', () => {
    const s = buildHudSeries(
      [row(0, 10, { weapon: 'AK-47' }), row(1, 0, { weapon: 'Glock-18' })],
      2,
      '|',
      11,
    );

    expect(s.weaponIdx[10]).toBe(0);
    expect(s.weaponIdx[11]).toBe(1);
    expect(s.weaponIdx).toHaveLength(22);
  });

  it('com passo de dez, o slot 10 cairia no quadro seguinte', () => {
    const s = buildHudSeries([row(0, 10, { weapon: 'AK-47' })], 2, '|', 10);

    expect(s.weaponIdx[10]).toBe(0);
  });
});
