import { describe, expect, it } from 'vitest';
import { TickClock } from '../src/tick-clock.js';

describe('TickClock', () => {
  it('converte ticks para segundos e de volta', () => {
    const c = new TickClock(64);
    expect(c.toSeconds(128)).toBe(2);
    expect(c.toTicks(2)).toBe(128);
    expect(c.toMs(64)).toBe(1000);
  });

  it('rejeita tick rate invalido em vez de produzir NaN silencioso', () => {
    expect(() => new TickClock(0)).toThrow(RangeError);
    expect(() => new TickClock(-64)).toThrow(RangeError);
    expect(() => new TickClock(Number.NaN)).toThrow(RangeError);
  });

  it('strideForHz da 8 a 64 tick e 16 a 128 tick para o replay de 8 Hz', () => {
    expect(new TickClock(64).strideForHz(8)).toBe(8);
    expect(new TickClock(128).strideForHz(8)).toBe(16);
  });

  it('strideForHz nunca devolve zero, mesmo pedindo mais Hz que o tick rate', () => {
    expect(new TickClock(64).strideForHz(1000)).toBe(1);
  });

  it('formata o relogio do round', () => {
    const c = new TickClock(64);
    expect(c.formatClock(0)).toBe('0:00');
    expect(c.formatClock(64 * 107)).toBe('1:47');
    expect(c.formatClock(-50)).toBe('0:00');
  });
});

describe('64 vs 128 tick produzem o mesmo tempo', () => {
  const cenas = [
    { nome: 'janela de trade de 3s', segundos: 3 },
    { nome: 'pre-aim 250ms antes do tiro', segundos: 0.25 },
    { nome: 'flash efetiva de 1.1s', segundos: 1.1 },
    { nome: 'round de 1m55', segundos: 115 },
  ];

  for (const { nome, segundos } of cenas) {
    it(nome, () => {
      const c64 = new TickClock(64);
      const c128 = new TickClock(128);

      const t64 = c64.toTicks(segundos);
      const t128 = c128.toTicks(segundos);

      expect(Math.abs(t128 - t64 * 2)).toBeLessThanOrEqual(1);

      const meioTick = 0.5 / 64;
      expect(Math.abs(c64.toSeconds(t64) - segundos)).toBeLessThanOrEqual(meioTick);
      expect(Math.abs(c128.toSeconds(t128) - segundos)).toBeLessThanOrEqual(meioTick);
      expect(Math.abs(c64.toSeconds(t64) - c128.toSeconds(t128))).toBeLessThanOrEqual(meioTick);
      expect(c64.formatClock(t64)).toBe(c128.formatClock(t128));
    });
  }

  it('o replay amostra a mesma taxa em Hz nos dois tick rates', () => {
    const c64 = new TickClock(64);
    const c128 = new TickClock(128);
    const duracaoSegundos = 100;

    const amostras64 = c64.toTicks(duracaoSegundos) / c64.strideForHz(8);
    const amostras128 = c128.toTicks(duracaoSegundos) / c128.strideForHz(8);

    expect(amostras64).toBe(amostras128);
    expect(amostras64).toBe(800);
  });
});
