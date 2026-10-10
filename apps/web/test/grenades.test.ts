import { describe, expect, it } from 'vitest';
import type { Detonation, GrenadeKind } from '@cs2/contract';
import { detonationEnd } from '../src/components/replay/draw-grenades';

const STRIDE = 8;
const ROUND_END = 10_000;

const det = (kind: GrenadeKind, tick: number, expireTick: number | null): Detonation =>
  ({
    kind,
    tick,
    expireTick,
    x: 50,
    y: 50,
    radiusPercent: 5,
    approxModel: 'disco_144u',
    isApproximation: true,
  }) as Detonation;

describe('detonationEnd', () => {
  it('com expireTick medido, o fim e o medido — em qualquer tipo', () => {
    expect(detonationEnd(det('smoke', 1000, 2412), ROUND_END, STRIDE)).toBe(2412);
    expect(detonationEnd(det('molotov', 1000, 1350), ROUND_END, STRIDE)).toBe(1350);
  });

  it('fumaca sem expireTick fica ate o fim do round, nao dois quadros', () => {

    expect(detonationEnd(det('smoke', 9500, null), ROUND_END, STRIDE)).toBe(ROUND_END);
  });

  it('incendiaria sem expireTick segue a mesma regra da fumaca', () => {
    expect(detonationEnd(det('molotov', 9700, null), ROUND_END, STRIDE)).toBe(ROUND_END);
  });

  it('HE, flash e decoy continuam instantaneas: dois quadros e so', () => {
    for (const kind of ['he', 'flashbang', 'decoy', 'unknown'] as const) {
      expect(detonationEnd(det(kind, 5000, null), ROUND_END, STRIDE)).toBe(5000 + STRIDE * 2);
    }
  });

  it('a reserva nunca passa do fim do round, mesmo com a fumaca recem-jogada', () => {
    expect(detonationEnd(det('smoke', 9990, null), ROUND_END, STRIDE)).toBe(ROUND_END);
    expect(detonationEnd(det('smoke', 100, null), ROUND_END, STRIDE)).toBe(ROUND_END);
  });
});
