import { describe, expect, it } from 'vitest';
import { APPROX_RADIUS, decimate, normalizeGrenadeType } from '../src/pass-b.js';

describe('normalizeGrenadeType', () => {
  it('reconhece os projeteis reais que o parser devolve', () => {
    expect(normalizeGrenadeType('CSmokeGrenadeProjectile')).toBe('smoke');
    expect(normalizeGrenadeType('CFlashbangProjectile')).toBe('flashbang');
    expect(normalizeGrenadeType('CHEGrenadeProjectile')).toBe('he');
    expect(normalizeGrenadeType('CMolotovProjectile')).toBe('molotov');
    expect(normalizeGrenadeType('CDecoyProjectile')).toBe('decoy');
  });

  it('trata incendiaria como molotov: mesmo efeito, nomes diferentes', () => {
    expect(normalizeGrenadeType('CIncendiaryGrenade')).toBe('molotov');
  });

  it('cai em unknown em vez de explodir com uma classe nova', () => {
    expect(normalizeGrenadeType('CAlgumaCoisaNovaProjectile')).toBe('unknown');
    expect(normalizeGrenadeType('')).toBe('unknown');
  });
});

describe('APPROX_RADIUS', () => {
  it('fumaca e incendiaria tem area; flash e decoy nao', () => {
    expect(APPROX_RADIUS.smoke).toBeGreaterThan(0);
    expect(APPROX_RADIUS.molotov).toBeGreaterThan(0);
    expect(APPROX_RADIUS.he).toBeGreaterThan(0);
    expect(APPROX_RADIUS.flashbang).toBe(0);
    expect(APPROX_RADIUS.decoy).toBe(0);
  });

  it('o raio da HE e maior que o da fumaca: e o alcance do dano', () => {
    expect(APPROX_RADIUS.he).toBeGreaterThan(APPROX_RADIUS.smoke);
  });
});

const rows = (ticks: number[]) => ticks.map((tick) => ({ tick }));
const ticksOf = (out: Record<string, unknown>[]) => out.map((r) => Number(r['tick']));

describe('decimate', () => {
  it('reduz ao passo pedido', () => {
    const out = decimate(rows([0, 2, 4, 6, 8, 10, 12, 14, 16]), 8);
    expect(ticksOf(out)).toEqual([0, 8, 16]);
  });

  it('SEMPRE preserva o primeiro e o ultimo ponto', () => {

    const out = decimate(rows([100, 101, 102, 103, 199]), 8);
    expect(ticksOf(out)[0]).toBe(100);
    expect(ticksOf(out).at(-1)).toBe(199);
  });

  it('deixa passar trajetoria curta demais para decimar', () => {
    expect(ticksOf(decimate(rows([5]), 8))).toEqual([5]);
    expect(ticksOf(decimate(rows([5, 9]), 8))).toEqual([5, 9]);
  });

  it('um voo curto vira dois pontos, nao zero', () => {

    const out = decimate(rows([1000, 1002, 1004]), 8);
    expect(ticksOf(out)).toEqual([1000, 1004]);
  });

  it('nao duplica pontos quando o stride casa exatamente', () => {
    const out = decimate(rows([0, 8, 16, 24]), 8);
    expect(ticksOf(out)).toEqual([0, 8, 16, 24]);
    expect(new Set(ticksOf(out)).size).toBe(out.length);
  });
});
