import { describe, expect, it } from 'vitest';
import { assignSlots } from '../src/pass-c.js';

const times = (a: string[], b: string[]): Map<string, 'A' | 'B'> =>
  new Map([
    ...a.map((id) => [id, 'A'] as const),
    ...b.map((id) => [id, 'B'] as const),
  ]);

const A5 = ['a1', 'a2', 'a3', 'a4', 'a5'];
const B5 = ['b1', 'b2', 'b3', 'b4', 'b5'];

describe('assignSlots', () => {

  it('5v5 recebe exatamente os slots de antes da F6: 0-4 e 5-9', () => {
    const slots = assignSlots(times(A5, B5));
    expect(slots.size).toBe(10);
    for (const [i, id] of A5.entries()) expect(slots.get(id)).toBe(i);
    for (const [i, id] of B5.entries()) expect(slots.get(id)).toBe(5 + i);
  });

  it('SEIS no time A nao colidem com o primeiro do time B', () => {
    const slots = assignSlots(times([...A5, 'a6'], B5));
    expect(slots.size).toBe(11);

    expect(slots.get('a6')).toBe(5);
    expect(slots.get('b1')).toBe(6);
    expect(slots.get('b5')).toBe(10);

    expect(new Set(slots.values()).size).toBe(11);
  });

  it('seis no time B tambem ficam contiguos', () => {
    const slots = assignSlots(times(A5, [...B5, 'b6']));
    expect(slots.get('b6')).toBe(10);
    expect(new Set(slots.values()).size).toBe(11);
  });

  it('varias trocas nos dois times continuam sem buraco nem repeticao', () => {
    const slots = assignSlots(times([...A5, 'a6', 'a7'], [...B5, 'b6']));
    expect(slots.size).toBe(13);
    expect([...slots.values()].sort((x, y) => x - y)).toEqual(
      Array.from({ length: 13 }, (_, i) => i),
    );
  });

  it('a ordem dentro do time e por steamId, para o slot ser deterministico', () => {
    const embaralhado = times(['a3', 'a1', 'a2'], ['b2', 'b1']);
    const slots = assignSlots(embaralhado);
    expect(slots.get('a1')).toBe(0);
    expect(slots.get('a2')).toBe(1);
    expect(slots.get('a3')).toBe(2);
    expect(slots.get('b1')).toBe(3);
    expect(slots.get('b2')).toBe(4);
  });

  it('quem nao tem time entra no fim, sem colidir', () => {
    const mapa = times(A5, B5) as Map<string, 'A' | 'B'>;

    mapa.set('x1', undefined as unknown as 'A');
    const slots = assignSlots(mapa);
    expect(slots.get('x1')).toBe(10);
    expect(new Set(slots.values()).size).toBe(11);
  });

  it('partida vazia nao quebra', () => {
    expect(assignSlots(new Map()).size).toBe(0);
  });
});
