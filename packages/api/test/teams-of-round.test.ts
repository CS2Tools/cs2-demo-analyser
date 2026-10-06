import { describe, expect, it } from 'vitest';
import type { Side } from '@cs2/core';
import { teamsOfRound } from '../src/round-flow-queries.js';

const roster = (pares: [string, Side][]) => pares.map(([steamId, side]) => ({ steamId, side }));

describe('teamsOfRound', () => {
  const time = new Map<string, string | null>([
    ['c1', 'Alfa'], ['c2', 'Alfa'], ['c3', 'Alfa'], ['c4', 'Alfa'], ['c5', 'Alfa'],
    ['t1', 'Beta'], ['t2', 'Beta'], ['t3', 'Beta'], ['t4', 'Beta'], ['t5', 'Beta'],
  ]);

  it('elenco inteiro do mesmo time resolve os dois lados', () => {
    const r = roster([['c1', 'CT'], ['c2', 'CT'], ['t1', 'T'], ['t2', 'T']]);
    expect(teamsOfRound(r, time)).toEqual({ CT: 'Alfa', T: 'Beta' });
  });

  it('depois da troca de metade, o mesmo time aparece do outro lado', () => {
    const r = roster([['c1', 'T'], ['c2', 'T'], ['t1', 'CT'], ['t2', 'CT']]);
    expect(teamsOfRound(r, time)).toEqual({ CT: 'Beta', T: 'Alfa' });
  });

  it('um jogador de fora nao muda o time do lado: vale a maioria', () => {
    const r = roster([['c1', 'CT'], ['c2', 'CT'], ['t1', 'CT']]);
    expect(teamsOfRound(r, time).CT).toBe('Alfa');
  });

  it('empate nao inventa dono: devolve nulo', () => {
    const r = roster([['c1', 'CT'], ['t1', 'CT']]);
    expect(teamsOfRound(r, time).CT).toBeNull();
  });

  it('elenco sem nome de time devolve nulo, e nao string vazia', () => {
    const semNome = new Map<string, string | null>([['x1', null], ['x2', null]]);
    const r = roster([['x1', 'CT'], ['x2', 'CT']]);
    expect(teamsOfRound(r, semNome)).toEqual({ CT: null, T: null });
  });

  it('nome faltando em um jogador nao apaga o resto', () => {
    const parcial = new Map<string, string | null>([['c1', 'Alfa'], ['c2', null]]);
    const r = roster([['c1', 'CT'], ['c2', 'CT']]);
    expect(teamsOfRound(r, parcial).CT).toBe('Alfa');
  });
});
