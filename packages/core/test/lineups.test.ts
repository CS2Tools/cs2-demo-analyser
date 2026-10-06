import { describe, expect, it } from 'vitest';
import { describeThrow, practiceCommand } from '../src/analytics/lineups.js';

describe('practiceCommand', () => {
  it('monta setpos e setang prontos para colar no console', () => {
    expect(practiceCommand({ x: -203.5, y: -1326.25, z: 64, pitch: -0.6, yaw: 60.2 }))
      .toBe('setpos -203.5 -1326.25 64; setang -0.6 60.2');
  });

  it('sem angulo, so a posicao — nunca um angulo inventado', () => {
    expect(practiceCommand({ x: 1, y: 2, z: 3, pitch: null, yaw: null })).toBe('setpos 1 2 3');
  });
});

describe('describeThrow', () => {

  it('separa jumpthrow de run jumpthrow pela velocidade no ar', () => {
    const air = (v: number | null) =>
      describeThrow({ crouched: false, onGround: false, speed: v, throwStrength: 1 }).movement;
    expect(air(0)).toBe('jumpthrow');
    expect(air(120)).toBe('jumpthrow');
    expect(air(250)).toBe('run jumpthrow');

    expect(air(null)).toBe('jumpthrow');
  });

  it('separa parado, andando e correndo no chao', () => {
    const speed = (v: number) =>
      describeThrow({ crouched: false, onGround: true, speed: v, throwStrength: null }).movement;
    expect(speed(0)).toBe('parado');
    expect(speed(90)).toBe('andando');
    expect(speed(240)).toBe('correndo');
  });

  it('o botao sai da forca do arremesso, e sao tres', () => {
    const click = (v: number | null) =>
      describeThrow({ crouched: null, onGround: true, speed: 0, throwStrength: v }).click;
    expect(click(1)).toBe('esquerdo');
    expect(click(0.98)).toBe('esquerdo');
    expect(click(0.5)).toBe('os dois');
    expect(click(0.48)).toBe('os dois');
    expect(click(0)).toBe('direito');
    expect(click(null)).toBeNull();
  });

  it('sem velocidade registrada no chao, nao chuta movimento', () => {
    expect(describeThrow({ crouched: null, onGround: true, speed: null, throwStrength: null }).movement)
      .toBe('desconhecido');
  });

  it('agachado continua sendo uma marca a parte, nao um movimento', () => {
    expect(describeThrow({ crouched: true, onGround: true, speed: 0, throwStrength: 1 }))
      .toEqual({ movement: 'parado', crouched: true, click: 'esquerdo' });
  });
});
