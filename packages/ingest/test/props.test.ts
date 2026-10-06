import { describe, expect, it, vi } from 'vitest';
import { parseResilient } from '../src/props.js';

const SET = {
  required: ['X', 'Y', 'health'],
  optional: ['balance', 'inventory', 'has_defuser'],
} as const;

const parserThatKnows = (known: string[]) => (props: string[]) => {
  const unknown = props.filter((p) => !known.includes(p));
  if (unknown.length > 0) throw new Error(`unknown field: ${unknown[0]}`);
  return [Object.fromEntries(props.map((p) => [p, 1]))];
};

describe('parseResilient', () => {
  it('caminho feliz: tudo presente, nada descartado', () => {
    const out = parseResilient(parserThatKnows([...SET.required, ...SET.optional]), SET);
    expect(out.dropped).toEqual([]);
    expect(out.rows[0]).toHaveProperty('inventory');
  });

  it('opcional que o parser RECUSA sai da lista e a importacao continua', () => {
    const parse = vi.fn(parserThatKnows([...SET.required, 'balance', 'has_defuser']));
    const out = parseResilient(parse, SET);
    expect(out.dropped).toEqual(['inventory']);
    expect(out.rows[0]).toHaveProperty('balance');
    expect(out.rows[0]).not.toHaveProperty('inventory');
  });

  it('opcional que o parser aceita mas nao devolve tambem conta como perdida', () => {
    const parse = (props: string[]) => [
      Object.fromEntries(props.filter((p) => p !== 'balance').map((p) => [p, 1])),
    ];
    expect(parseResilient(parse, SET).dropped).toEqual(['balance']);
  });

  it('varias opcionais quebradas de uma vez', () => {
    const out = parseResilient(parserThatKnows([...SET.required, 'balance']), SET);
    expect(out.dropped.sort()).toEqual(['has_defuser', 'inventory']);
  });

  it('essencial que some vira erro com os nomes, nao erro cru do parser', () => {
    const parse = parserThatKnows(['X', 'Y']);
    expect(() => parseResilient(parse, SET)).toThrow(/X, Y, health/);
    expect(() => parseResilient(parse, SET)).toThrow(/atualizacao do CS2/);
  });

  it('nao paga o preco de descobrir culpado quando nada quebrou', () => {
    const parse = vi.fn(parserThatKnows([...SET.required, ...SET.optional]));
    parseResilient(parse, SET);
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
