import { describe, expect, it } from 'vitest';
import {
  colorTeamsFromRoster,
  computeHandoffs,
  computeSpells,
  type SideByRound,
} from '../src/analytics/teams.js';
import type { Side } from '../src/types.js';

function roster(rounds: { ct: string[]; t: string[] }[], from = 1): SideByRound {
  const out: SideByRound = new Map();
  rounds.forEach((r, i) => {
    const m = new Map<string, Side>();
    for (const id of r.ct) m.set(id, 'CT');
    for (const id of r.t) m.set(id, 'T');
    out.set(from + i, m);
  });
  return out;
}

const A = ['a1', 'a2', 'a3', 'a4', 'a5'];
const B = ['b1', 'b2', 'b3', 'b4', 'b5'];

describe('colorTeamsFromRoster', () => {
  it('time A e quem comecou de CT, e a troca de lado nao muda isso', () => {

    const r = roster([
      ...Array.from({ length: 12 }, () => ({ ct: A, t: B })),
      ...Array.from({ length: 12 }, () => ({ ct: B, t: A })),
    ]);

    const { teamOf, startingSideA, unresolved } = colorTeamsFromRoster(r);
    expect(startingSideA).toBe('CT');
    expect(unresolved).toEqual([]);
    for (const id of A) expect(teamOf.get(id)).toBe('A');
    for (const id of B) expect(teamOf.get(id)).toBe('B');
  });

  it('substituto que estreia depois da troca de lado cai no time certo', () => {
    const titulares = ['a1', 'a2', 'a3', 'a4'];
    const r = roster([
      ...Array.from({ length: 12 }, () => ({ ct: [...titulares, 'sai'], t: B })),

      ...Array.from({ length: 6 }, () => ({ ct: B, t: [...titulares, 'sai'] })),
      ...Array.from({ length: 6 }, () => ({ ct: B, t: [...titulares, 'entra'] })),
    ]);

    const { teamOf, unresolved } = colorTeamsFromRoster(r);
    expect(unresolved).toEqual([]);
    expect(teamOf.get('sai')).toBe('A');
    expect(teamOf.get('entra')).toBe('A');
    for (const id of B) expect(teamOf.get(id)).toBe('B');

    expect(teamOf.size).toBe(11);
  });

  it('round desfalcado por ausencia nao confunde a cor', () => {
    const r = roster([
      { ct: A, t: B },

      { ct: A, t: ['b1', 'b2', 'b3', 'b4'] },
      { ct: A, t: ['b1', 'b2', 'b3', 'b4', 'b6'] },
    ]);

    const { teamOf, unresolved } = colorTeamsFromRoster(r);
    expect(unresolved).toEqual([]);
    expect(teamOf.get('b6')).toBe('B');
    expect(teamOf.get('b5')).toBe('B');
  });

  it('seis de um lado no mesmo round: os seis sao do mesmo time', () => {
    const r = roster([
      { ct: A, t: B },
      { ct: [...A, 'a6'], t: B },
      { ct: ['a2', 'a3', 'a4', 'a5', 'a6'], t: B },
    ]);

    const { teamOf } = colorTeamsFromRoster(r);
    expect(teamOf.get('a6')).toBe('A');
    expect(teamOf.get('a1')).toBe('A');
  });

  it('quem nao compartilha round com o nucleo fica SEM time, e e declarado', () => {
    const r = roster([{ ct: A, t: B }]);

    r.set(99, new Map<string, Side>([['x1', 'CT'], ['x2', 'T']]));

    const { teamOf, unresolved } = colorTeamsFromRoster(r);
    expect(teamOf.has('x1')).toBe(false);
    expect(teamOf.has('x2')).toBe(false);
    expect([...unresolved].sort()).toEqual(['x1', 'x2']);
    expect(teamOf.size).toBe(10);
  });

  it('sem round com os dois lados, ninguem recebe time', () => {
    const r = roster([{ ct: A, t: [] }]);
    const { teamOf, startingSideA, unresolved } = colorTeamsFromRoster(r);
    expect(teamOf.size).toBe(0);
    expect(startingSideA).toBeNull();
    expect([...unresolved].sort()).toEqual([...A].sort());
  });

  it('sem round nenhum, devolve vazio sem quebrar', () => {
    const { teamOf, startingSideA, unresolved } = colorTeamsFromRoster(new Map());
    expect(teamOf.size).toBe(0);
    expect(startingSideA).toBeNull();
    expect(unresolved).toEqual([]);
  });

  it('prorrogacao com troca a cada tres rounds continua certa', () => {
    const blocos = [0, 1, 2, 3].flatMap((i) =>
      Array.from({ length: 3 }, () =>
        i % 2 === 0 ? { ct: A, t: B } : { ct: B, t: A },
      ),
    );
    const { teamOf, unresolved } = colorTeamsFromRoster(roster(blocos));
    expect(unresolved).toEqual([]);
    for (const id of A) expect(teamOf.get(id)).toBe('A');
    for (const id of B) expect(teamOf.get(id)).toBe('B');
  });
});

describe('computeSpells', () => {
  const times = new Map<string, 'A' | 'B'>([['p', 'A'], ['q', 'A']]);

  it('rounds seguidos viram uma janela so', () => {
    const s = computeSpells(new Map([['p', [1, 2, 3, 4, 5]]]), times);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ spellSeq: 0, firstRound: 1, lastRound: 5, rounds: 5, teamSlot: 'A' });
  });

  it('um round de buraco NAO corta a janela: e desconexao de meio round', () => {
    const s = computeSpells(new Map([['p', [1, 2, 4, 5]]]), times);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ firstRound: 1, lastRound: 5, rounds: 4 });
  });

  it('dois rounds fora cortam em duas janelas', () => {
    const s = computeSpells(new Map([['p', [1, 2, 6, 7]]]), times);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ spellSeq: 0, firstRound: 1, lastRound: 2 });
    expect(s[1]).toMatchObject({ spellSeq: 1, firstRound: 6, lastRound: 7 });
  });

  it('jogador sem time entra com teamSlot nulo em vez de ficar fora', () => {
    const s = computeSpells(new Map([['x', [3, 4]]]), new Map());
    expect(s[0]!.teamSlot).toBeNull();
  });
});

describe('computeHandoffs', () => {
  const LIVE = Array.from({ length: 24 }, (_, i) => i + 1);
  const spell = (
    steamId: string,
    firstRound: number,
    lastRound: number,
    teamSlot: 'A' | 'B' = 'A',
  ) => ({
    steamId,
    spellSeq: 0,
    teamSlot,
    firstRound,
    lastRound,
    rounds: lastRound - firstRound + 1,
  });

  it('quem jogou de ponta a ponta nao gera troca nenhuma', () => {
    const h = computeHandoffs([spell('p', 1, 24), spell('q', 1, 24, 'B')], LIVE);
    expect(h).toEqual([]);
  });

  it('troca entre rounds tem gapRounds zero', () => {
    const h = computeHandoffs([spell('sai', 1, 12), spell('entra', 13, 24)], LIVE);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({
      teamSlot: 'A',
      outSteamId: 'sai',
      outLastRound: 12,
      inSteamId: 'entra',
      inFirstRound: 13,
      gapRounds: 0,
      inference: 'adjacent_window',
    });
  });

  it('um round desfalcado entre a saida e a entrada da gapRounds 1', () => {
    const h = computeHandoffs([spell('sai', 1, 10), spell('entra', 12, 24)], LIVE);
    expect(h[0]!.gapRounds).toBe(1);
  });

  it('janelas sobrepostas dao gapRounds NEGATIVO', () => {
    const h = computeHandoffs([spell('sai', 1, 9), spell('entra', 9, 24)], LIVE);
    expect(h).toHaveLength(1);
    expect(h[0]!.gapRounds).toBe(-1);
  });

  it('nunca pareia alguem consigo mesmo: sair e voltar nao e substituicao', () => {
    const h = computeHandoffs(
      [
        { ...spell('p', 1, 8), spellSeq: 0 },
        { ...spell('p', 14, 24), spellSeq: 1 },
      ],
      LIVE,
    );
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ outSteamId: 'p', inSteamId: null, gapRounds: null });
    expect(h[1]).toMatchObject({ outSteamId: null, inSteamId: 'p', inFirstRound: 14 });
  });

  it('saiu e ninguem entrou: a linha existe com a entrada nula', () => {
    const h = computeHandoffs([spell('sai', 1, 10)], LIVE);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ outSteamId: 'sai', inSteamId: null, gapRounds: null });
  });

  it('duas trocas no mesmo time sao pareadas em ordem de round', () => {
    const h = computeHandoffs(
      [spell('a', 1, 6), spell('b', 7, 14), spell('c', 15, 24)],
      LIVE,
    );
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ outSteamId: 'a', inSteamId: 'b', gapRounds: 0 });
    expect(h[1]).toMatchObject({ outSteamId: 'b', inSteamId: 'c', gapRounds: 0 });
  });

  it('cada time pareia so dentro de si', () => {
    const h = computeHandoffs(
      [spell('a', 1, 12), spell('b', 13, 24, 'B')],
      LIVE,
    );
    expect(h).toHaveLength(2);
    expect(h.find((x) => x.teamSlot === 'A')).toMatchObject({ outSteamId: 'a', inSteamId: null });
    expect(h.find((x) => x.teamSlot === 'B')).toMatchObject({ outSteamId: null, inSteamId: 'b' });
  });

  it('sem round live nenhum, devolve vazio', () => {
    expect(computeHandoffs([spell('p', 1, 5)], [])).toEqual([]);
  });
});
