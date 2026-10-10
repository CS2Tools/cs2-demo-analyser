import { describe, expect, it } from 'vitest';
import { numbersBySlot, planPlayerLabel, poiColourBySlot } from '../src/components/replay/labels';

const slots = Array.from({ length: 10 }, (_, slot) => ({
  slot,
  team: (slot < 5 ? 'A' : 'B') as 'A' | 'B',
}));

describe('numbersBySlot', () => {
  it('numera de 1 a 5 DENTRO de cada time', () => {
    const n = numbersBySlot(slots);
    expect([...n.entries()].slice(0, 5)).toEqual([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
    expect(n.get(5)).toBe(1);
    expect(n.get(9)).toBe(5);
  });

  it('a ordem dos slots na lista nao muda o numero de ninguem', () => {
    const embaralhado = [...slots].reverse();
    expect(numbersBySlot(embaralhado)).toEqual(numbersBySlot(slots));
  });

  it('quem nao tem time fica sem numero — numero errado e pior que nenhum', () => {
    const n = numbersBySlot([{ slot: 0, team: null }, { slot: 1, team: 'A' }]);
    expect(n.has(0)).toBe(false);
    expect(n.get(1)).toBe(1);
  });

  it('time incompleto numera quem existe', () => {
    const n = numbersBySlot([{ slot: 3, team: 'A' }, { slot: 7, team: 'B' }]);
    expect(n.get(3)).toBe(1);
    expect(n.get(7)).toBe(1);
  });

  it('com um slot ausente, a numeracao fecha em 1..n sem buraco', () => {
    const n = numbersBySlot(slots.filter((s) => s.slot !== 2));
    expect([...n.entries()].slice(0, 4)).toEqual([[0, 1], [1, 2], [3, 3], [4, 4]]);
    expect(n.has(2)).toBe(false);

    expect(n.get(5)).toBe(1);
    expect(n.get(9)).toBe(5);
  });
});

describe('planPlayerLabel', () => {
  const base = { name: 'jorge', number: 3, highlighted: false };

  it('modo numero: o numero no ponto, sem nome poluindo', () => {
    expect(planPlayerLabel({ ...base, mode: 'number' })).toEqual({ inDot: '3', above: null });
  });

  it('modo nome: o nome acima de todos, o tempo todo', () => {
    expect(planPlayerLabel({ ...base, mode: 'always' })).toEqual({ inDot: null, above: 'jorge' });
  });

  it('modo hover: nada ate o mouse chegar', () => {
    expect(planPlayerLabel({ ...base, mode: 'hover' })).toEqual({ inDot: null, above: null });
    expect(planPlayerLabel({ ...base, mode: 'hover', highlighted: true }))
      .toEqual({ inDot: null, above: 'jorge' });
  });

  it('o mouse em cima mostra o nome mesmo no modo numero', () => {
    expect(planPlayerLabel({ ...base, mode: 'number', highlighted: true }))
      .toEqual({ inDot: '3', above: 'jorge' });
  });

  it('sem numero (jogador sem time), o modo numero nao inventa nada', () => {
    expect(planPlayerLabel({ ...base, number: null, mode: 'number' }))
      .toEqual({ inDot: null, above: null });
  });
});

describe('poiColourBySlot', () => {
  const slots = [
    { slot: 0, steamId: '1' },
    { slot: 1, steamId: '2' },
    { slot: 5, steamId: '3' },
  ];

  it('a cor cadastrada chega no slot certo', () => {
    const out = poiColourBySlot(slots, [{ steamId: '3', colour: '#ff0000' }]);
    expect(out.get(5)).toBe('#ff0000');
    expect(out.size).toBe(1);
  });

  it('sem jogador de interesse, ninguem ganha cor', () => {
    expect(poiColourBySlot(slots, []).size).toBe(0);
  });

  it('jogador de interesse fora desta partida nao pinta ninguem', () => {
    expect(poiColourBySlot(slots, [{ steamId: '99', colour: '#ff0000' }]).size).toBe(0);
  });
});

describe('numeracao com elenco maior que cinco', () => {
  const slot = (n: number, team: 'A' | 'B' | null) => ({ slot: n, team });

  it('seis no time recebem 1 a 6', () => {
    const n = numbersBySlot([0, 1, 2, 3, 4, 5].map((i) => slot(i, 'A')));
    expect([...n.values()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('a numeracao e por TIME, e nao corrida na partida', () => {
    const n = numbersBySlot([
      ...[0, 1, 2, 3, 4, 5].map((i) => slot(i, 'A')),
      ...[6, 7, 8, 9, 10].map((i) => slot(i, 'B')),
    ]);
    expect(n.get(5)).toBe(6);
    expect(n.get(6)).toBe(1);
    expect(n.get(10)).toBe(5);
  });

  it('o sexto cabe no ponto; o decimo nao', () => {
    expect(planPlayerLabel({ mode: 'number', name: 'x', number: 6, highlighted: false }).inDot)
      .toBe('6');
    expect(planPlayerLabel({ mode: 'number', name: 'x', number: 9, highlighted: false }).inDot)
      .toBe('9');

    expect(planPlayerLabel({ mode: 'number', name: 'x', number: 10, highlighted: false }).inDot)
      .toBeNull();
  });

  it('sem numero no ponto, o nome ainda aparece ao passar o mouse', () => {
    const p = planPlayerLabel({ mode: 'number', name: 'ana', number: 10, highlighted: true });
    expect(p.inDot).toBeNull();
    expect(p.above).toBe('ana');
  });
});
