import { describe, expect, it } from 'vitest';
import {
  aimError,
  anglesToDirection,
  directionToAngles,
  EYE_HEIGHT_DUCKED,
  EYE_HEIGHT_STANDING,
  eyeHeight,
  eyePosition,
  lerpAngle,
  wrap180,
} from '../src/geometry.js';

describe('anglesToDirection', () => {
  it('yaw 0 aponta para +X', () => {
    const d = anglesToDirection(0, 0);
    expect(d.x).toBeCloseTo(1, 9);
    expect(d.y).toBeCloseTo(0, 9);
    expect(d.z).toBeCloseTo(0, 9);
  });

  it('yaw 90 aponta para +Y', () => {
    const d = anglesToDirection(0, 90);
    expect(d.x).toBeCloseTo(0, 9);
    expect(d.y).toBeCloseTo(1, 9);
  });

  it('pitch POSITIVO olha para baixo (convencao do Source)', () => {
    expect(anglesToDirection(90, 0).z).toBeCloseTo(-1, 9);
    expect(anglesToDirection(-90, 0).z).toBeCloseTo(1, 9);
  });

  it('sempre devolve vetor unitario', () => {
    for (const [p, y] of [
      [0, 0],
      [45, 137],
      [-89, -12],
      [30, 359],
    ]) {
      const d = anglesToDirection(p!, y!);
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 12);
    }
  });

  it('directionToAngles e o inverso', () => {
    for (const [p, y] of [
      [0, 0],
      [22.5, 45],
      [-60, 170],
      [10, -170],
    ]) {
      const back = directionToAngles(anglesToDirection(p!, y!));
      expect(back.pitch).toBeCloseTo(p!, 9);
      expect(back.yaw).toBeCloseTo(wrap180(y!), 9);
    }
  });
});

describe('wrap180', () => {
  it('normaliza para (-180, 180]', () => {
    expect(wrap180(0)).toBe(0);
    expect(wrap180(190)).toBe(-170);
    expect(wrap180(-190)).toBe(170);
    expect(wrap180(360)).toBe(0);
    expect(wrap180(180)).toBe(180);
    expect(wrap180(-180)).toBe(180);
    expect(wrap180(540)).toBe(180);
  });
});

describe('eyeHeight', () => {
  it('interpola entre em pe e agachado', () => {
    expect(eyeHeight(0)).toBeCloseTo(EYE_HEIGHT_STANDING, 9);
    expect(eyeHeight(1)).toBeCloseTo(EYE_HEIGHT_DUCKED, 9);
    expect(eyeHeight(0.5)).toBeCloseTo((EYE_HEIGHT_STANDING + EYE_HEIGHT_DUCKED) / 2, 9);
  });

  it('trunca valores fora de [0,1] em vez de extrapolar', () => {
    expect(eyeHeight(-3)).toBeCloseTo(EYE_HEIGHT_STANDING, 9);
    expect(eyeHeight(9)).toBeCloseTo(EYE_HEIGHT_DUCKED, 9);
  });

  it('eyePosition soma a altura so em Z', () => {
    const p = eyePosition({ x: 10, y: 20, z: 30 }, 0);
    expect(p).toEqual({ x: 10, y: 20, z: 30 + EYE_HEIGHT_STANDING });
  });
});

describe('aimError', () => {
  const eye = { x: 0, y: 0, z: 64 };

  it('mira perfeita da erro zero', () => {
    const alvo = { x: 1000, y: 0, z: 64 };
    const e = aimError(eye, anglesToDirection(0, 0), alvo);
    expect(e.totalDeg).toBeCloseTo(0, 6);
    expect(e.pitchDeg).toBeCloseTo(0, 6);
    expect(e.yawDeg).toBeCloseTo(0, 6);
    expect(e.distance).toBeCloseTo(1000, 6);
    expect(e.missUnits).toBeCloseTo(0, 6);
  });

  it('erro horizontal puro de 10 graus', () => {
    const alvo = { x: 1000, y: 0, z: 64 };
    const e = aimError(eye, anglesToDirection(0, 10), alvo);
    expect(e.totalDeg).toBeCloseTo(10, 6);
    expect(e.pitchDeg).toBeCloseTo(0, 6);
    expect(Math.abs(e.yawDeg)).toBeCloseTo(10, 6);
  });

  it('pitchDeg POSITIVO significa mirando ACIMA do alvo', () => {
    const alvo = { x: 1000, y: 0, z: 64 };

    const acima = aimError(eye, anglesToDirection(-10, 0), alvo);
    expect(acima.pitchDeg).toBeGreaterThan(0);
    expect(acima.pitchDeg).toBeCloseTo(10, 6);

    const abaixo = aimError(eye, anglesToDirection(10, 0), alvo);
    expect(abaixo.pitchDeg).toBeCloseTo(-10, 6);
  });

  it('missUnits traduz angulo em unidades na distancia do alvo', () => {
    const alvo = { x: 1000, y: 0, z: 64 };
    const e = aimError(eye, anglesToDirection(0, 10), alvo);

    expect(e.missUnits).toBeCloseTo(1000 * Math.tan((10 * Math.PI) / 180), 6);
  });

  it('alvo na mesma posicao do olho nao gera NaN', () => {
    const e = aimError(eye, anglesToDirection(0, 0), { ...eye });
    expect(e.totalDeg).toBe(0);
    expect(Number.isNaN(e.missUnits)).toBe(false);
  });

  it('alvo exatamente atras da mira da 180 graus', () => {
    const alvo = { x: -1000, y: 0, z: 64 };
    const e = aimError(eye, anglesToDirection(0, 0), alvo);
    expect(e.totalDeg).toBeCloseTo(180, 6);
  });
});

describe('lerpAngle', () => {
  it('interpola pelo caminho mais curto atravessando +/-180', () => {
    expect(lerpAngle(170, -170, 0.5)).toBeCloseTo(180, 9);
    expect(lerpAngle(-170, 170, 0.5)).toBeCloseTo(180, 9);
  });

  it('nao faz a volta longa', () => {

    expect(wrap180(lerpAngle(10, 350, 0.5))).toBeCloseTo(0, 9);
  });

  it('t=0 e t=1 devolvem os extremos', () => {
    expect(lerpAngle(30, 120, 0)).toBeCloseTo(30, 9);
    expect(lerpAngle(30, 120, 1)).toBeCloseTo(120, 9);
  });
});
