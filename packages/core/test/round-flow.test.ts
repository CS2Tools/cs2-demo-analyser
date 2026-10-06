import { describe, expect, it } from 'vitest';
import {
  analyzeRound,
  summarizeFlow,
  type RoundInput,
  type RoundKillInput,
} from '../src/analytics/round-flow.js';

const CT = ['c1', 'c2', 'c3', 'c4', 'c5'];
const T = ['t1', 't2', 't3', 't4', 't5'];

const roster = () => [
  ...CT.map((steamId) => ({ steamId, side: 'CT' as const })),
  ...T.map((steamId) => ({ steamId, side: 'T' as const })),
];

const kill = (
  tick: number,
  attacker: string | null,
  victim: string,
  patch: Partial<RoundKillInput> = {},
): RoundKillInput => ({
  tick,
  attackerSteamId: attacker,
  victimSteamId: victim,
  attackerSide: attacker === null ? null : attacker.startsWith('c') ? 'CT' : 'T',
  victimSide: victim.startsWith('c') ? 'CT' : 'T',
  assisterSteamId: null,
  deathWasTraded: null,
  ...patch,
});

const round = (kills: RoundKillInput[], patch: Partial<RoundInput> = {}): RoundInput => ({
  roundNum: 1,
  winnerSide: 'CT',
  plantTick: null,
  roster: roster(),
  kills,
  ...patch,
});

describe('analyzeRound', () => {
  it('a primeira kill e do lado que abriu, e diz se aquele lado levou', () => {
    const r = analyzeRound(round([kill(100, 'c1', 't1'), kill(200, 't2', 'c2')]));
    expect(r.opener).toEqual({ steamId: 'c1', side: 'CT' });
    expect(r.openerWon).toBe(true);

    const perdeu = analyzeRound(round([kill(100, 't1', 'c1')], { winnerSide: 'CT' }));
    expect(perdeu.opener!.side).toBe('T');
    expect(perdeu.openerWon).toBe(false);
  });

  it('a ordem da consulta nao muda nada: quem manda e o tick', () => {
    const fora = analyzeRound(round([kill(300, 't1', 'c1'), kill(100, 'c2', 't2')]));
    expect(fora.opener).toEqual({ steamId: 'c2', side: 'CT' });
  });

  it('o primeiro desequilibrio e 5v4, e diz se foi convertido', () => {
    const r = analyzeRound(round([kill(100, 'c1', 't1'), kill(200, 'c1', 't2')]));

    expect(r.firstAdvantage).toEqual({
      side: 'CT', alive: 5, enemies: 4, tick: 100, cause: 'kill',
    });
    expect(r.advantageWon).toBe(true);
  });

  it('troca imediata nao cria vantagem: 4v4 continua empatado', () => {
    const r = analyzeRound(round([kill(100, 'c1', 't1'), kill(101, 't2', 'c1')]));

    expect(r.firstAdvantage).toMatchObject({ side: 'CT', alive: 5, enemies: 4 });
  });

  it('clutch: ficou sozinho contra tres', () => {
    const r = analyzeRound(
      round([
        kill(100, 't1', 'c1'), kill(200, 't1', 'c2'),
        kill(300, 't2', 'c3'), kill(400, 't2', 'c4'),
        kill(500, 'c5', 't3'), kill(600, 'c5', 't4'),
      ], { winnerSide: 'CT' }),
    );
    const ct = r.clutches.find((c) => c.side === 'CT')!;
    expect(ct).toMatchObject({ steamId: 'c5', versus: 5, tick: 400, won: true });
  });

  it('1v1: os dois lados entram em clutch, e so um ganha', () => {
    const kills = [
      ...CT.slice(1).map((c, i) => kill(100 + i, 't1', c)),
      ...T.slice(1).map((t, i) => kill(200 + i, 'c1', t)),
    ];
    const r = analyzeRound(round(kills, { winnerSide: 'CT' }));
    expect(r.clutches).toHaveLength(2);
    expect(r.clutches.find((c) => c.side === 'CT')).toMatchObject({ steamId: 'c1', won: true });
    expect(r.clutches.find((c) => c.side === 'T')).toMatchObject({ steamId: 't1', won: false });
  });

  it('round sem clutch nao inventa um', () => {
    expect(analyzeRound(round([kill(100, 'c1', 't1')])).clutches).toEqual([]);
  });

  it('morte de time tira o jogador, mas nao e kill de ninguem', () => {
    const r = analyzeRound(round([kill(100, 'c1', 'c2')]));
    expect(r.opener).toBeNull();
    expect(r.multikills).toEqual([]);

    expect(r.firstAdvantage).toMatchObject({ side: 'T', alive: 5, enemies: 4 });
  });

  it('multikill conta so 2 ou mais', () => {
    const r = analyzeRound(
      round([kill(100, 'c1', 't1'), kill(200, 'c1', 't2'), kill(300, 'c2', 't3')]),
    );
    expect(r.multikills).toEqual([{ steamId: 'c1', kills: 2 }]);
  });

  it('KAST: cada uma das quatro letras conta sozinha', () => {
    const r = analyzeRound(
      round([

        kill(100, 'c1', 't1'),

        kill(200, 't2', 'c2', { deathWasTraded: true }),

        kill(300, 't3', 'c3'),

        kill(400, 'c5', 't4', { assisterSteamId: 'c4' }),
      ]),
    );
    const of = (id: string) => r.kast.find((k) => k.steamId === id)!;
    expect(of('c1')).toMatchObject({ kill: true, kast: true });
    expect(of('c2')).toMatchObject({ survived: false, traded: true, kast: true });
    expect(of('c3')).toMatchObject({ survived: false, traded: false, kast: false });
    expect(of('c4')).toMatchObject({ assist: true, kast: true });

    expect(of('t5')).toMatchObject({ survived: true, kast: true });
  });

  it('mortes pos-plantio so existem quando houve plantio', () => {
    const kills = [kill(100, 'c1', 't1'), kill(500, 't2', 'c1')];
    expect(analyzeRound(round(kills)).postPlantDeaths).toBeNull();
    expect(analyzeRound(round(kills, { plantTick: 300 })).postPlantDeaths).toBe(1);
  });

  it('sem vencedor gravado, nao afirma quem ganhou o clutch', () => {
    const kills = [
      ...CT.slice(1).map((c, i) => kill(100 + i, 't1', c)),
    ];
    const r = analyzeRound(round(kills, { winnerSide: null }));
    expect(r.clutches[0]!.won).toBe(false);
    expect(r.openerWon).toBeNull();
    expect(r.advantageWon).toBeNull();
  });
});

describe('summarizeFlow', () => {
  const vitoriaCT = (n: number) =>
    analyzeRound(round([kill(100, 'c1', 't1'), kill(200, 'c1', 't2')], { roundNum: n }));
  const clutchPerdido = (n: number) =>
    analyzeRound(
      round(
        CT.slice(1).map((c, i) => kill(100 + i, 't1', c)),
        { roundNum: n, winnerSide: 'T' },
      ),
    );

  it('junta clutches por jogador e por numero de inimigos', () => {
    const s = summarizeFlow([clutchPerdido(1), clutchPerdido(2)]);
    const c1 = s.clutches.find((c) => c.steamId === 'c1')!;
    expect([c1.tried, c1.won]).toEqual([2, 0]);
    expect(c1.byVersus).toEqual([{ versus: 5, tried: 2, won: 0 }]);
  });

  it('conversao de vantagem por lado e por placar', () => {
    const s = summarizeFlow([vitoriaCT(1), vitoriaCT(2)]);
    const v = s.advantages.find((a) => a.label === '5v4' && a.side === 'CT')!;
    expect([v.rounds, v.won]).toEqual([2, 2]);
  });

  it('a vantagem e contada por TIME, nao so por lado', () => {
    const comTimes = (n: number, teams: { CT: string; T: string }) =>
      analyzeRound(
        round([kill(100, 'c1', 't1'), kill(200, 'c1', 't2')], { roundNum: n, teams }),
      );
    const s = summarizeFlow([
      comTimes(1, { CT: 'Alfa', T: 'Beta' }),
      comTimes(2, { CT: 'Alfa', T: 'Beta' }),

      comTimes(3, { CT: 'Beta', T: 'Alfa' }),
    ]);
    const linhas = s.advantages.filter((a) => a.label === '5v4' && a.side === 'CT');
    expect(linhas.map((l) => [l.teamName, l.rounds, l.won])).toEqual([
      ['Alfa', 2, 2],
      ['Beta', 1, 1],
    ]);
  });

  it('sem nome de time, a linha continua existindo com o time nulo', () => {
    const s = summarizeFlow([vitoriaCT(1)]);
    expect(s.advantages[0]!.teamName).toBeNull();
  });

  it('KAST e por rounds jogados, nao por partida', () => {
    const s = summarizeFlow([vitoriaCT(1), vitoriaCT(2)]);
    const c1 = s.kast.find((k) => k.steamId === 'c1')!;
    expect([c1.rounds, c1.kastRounds]).toEqual([2, 2]);
    expect(c1.kast).toBe(1);

    const t1 = s.kast.find((k) => k.steamId === 't1')!;
    expect(t1.kast).toBe(0);
  });

  it('multikills viram contagem por tamanho', () => {
    const s = summarizeFlow([vitoriaCT(1), vitoriaCT(2)]);
    expect(s.multikills[0]).toEqual({ steamId: 'c1', counts: [2, 0, 0, 0] });
  });

  it('o peso da abertura sai por lado', () => {
    const s = summarizeFlow([vitoriaCT(1), clutchPerdido(2)]);
    const ct = s.opening.find((o) => o.side === 'CT')!;
    const t = s.opening.find((o) => o.side === 'T')!;
    expect([ct.opened, ct.openedWon]).toEqual([1, 1]);
    expect([t.opened, t.openedWon]).toEqual([1, 1]);
  });
});

describe('round que ja comeca desequilibrado', () => {
  const quatroContraCinco = (kills: RoundKillInput[] = []): RoundInput => ({
    roundNum: 1,
    winnerSide: 'CT',
    plantTick: null,
    startTick: 50,
    roster: [
      ...['c1', 'c2', 'c3', 'c4', 'c5'].map((steamId) => ({ steamId, side: 'CT' as const })),
      ...['t1', 't2', 't3', 't4'].map((steamId) => ({ steamId, side: 'T' as const })),
    ],
    kills,
  });

  it('declara o elenco inicial de cada lado', () => {
    const r = analyzeRound(quatroContraCinco());
    expect(r.startingAlive).toEqual({ CT: 5, T: 4 });
  });

  it('a vantagem e por AUSENCIA, datada no comeco do round', () => {
    const r = analyzeRound(quatroContraCinco());
    expect(r.firstAdvantage).toEqual({
      side: 'CT', alive: 5, enemies: 4, tick: 50, cause: 'absence',
    });
  });

  it('a primeira kill NAO rouba o credito da vantagem', () => {
    const r = analyzeRound(quatroContraCinco([kill(100, 'c1', 't1')]));

    expect(r.firstAdvantage!.cause).toBe('absence');
    expect(r.firstAdvantage!.tick).toBe(50);
    expect(r.firstAdvantage!.enemies).toBe(4);
  });

  it('o estado inicial do round e o elenco real, e nao 5v5', () => {
    const r = analyzeRound(quatroContraCinco());
    expect(r.states[0]).toEqual({ aliveCT: 5, aliveT: 4, planted: false });
  });

  it('round cheio continua com a vantagem por KILL', () => {
    const r = analyzeRound(round([kill(100, 'c1', 't1')]));
    expect(r.startingAlive).toEqual({ CT: 5, T: 5 });
    expect(r.firstAdvantage!.cause).toBe('kill');
  });

  it('seis de um lado tambem e vantagem por ausencia', () => {
    const r = analyzeRound({
      roundNum: 1,
      winnerSide: 'CT',
      plantTick: null,
      startTick: 50,
      roster: [
        ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((steamId) => ({ steamId, side: 'CT' as const })),
        ...['t1', 't2', 't3', 't4', 't5'].map((steamId) => ({ steamId, side: 'T' as const })),
      ],
      kills: [],
    });
    expect(r.startingAlive).toEqual({ CT: 6, T: 5 });
    expect(r.firstAdvantage).toMatchObject({ side: 'CT', alive: 6, enemies: 5, cause: 'absence' });
  });
});

describe('summarizeFlow separa vantagem conquistada de vantagem por ausencia', () => {
  const cheio = (winner: 'CT' | 'T'): RoundInput => ({
    roundNum: 1,
    winnerSide: winner,
    plantTick: null,
    startTick: 50,
    roster: roster(),
    kills: [kill(100, 'c1', 't1')],
    teams: { CT: 'Nos', T: 'Eles' },
    teamSlots: { CT: 'A', T: 'B' },
  });
  const desfalcado = (winner: 'CT' | 'T', roundNum: number): RoundInput => ({
    roundNum,
    winnerSide: winner,
    plantTick: null,
    startTick: 50,
    roster: [
      ...['c1', 'c2', 'c3', 'c4', 'c5'].map((steamId) => ({ steamId, side: 'CT' as const })),
      ...['t1', 't2', 't3', 't4'].map((steamId) => ({ steamId, side: 'T' as const })),
    ],
    kills: [kill(100, 'c1', 't1')],
    teams: { CT: 'Nos', T: 'Eles' },
    teamSlots: { CT: 'A', T: 'B' },
  });

  it('as duas causas NAO caem na mesma linha', () => {
    const f = summarizeFlow([
      analyzeRound(cheio('CT')),
      analyzeRound(desfalcado('CT', 2)),
    ]);
    expect(f.advantages).toHaveLength(2);
    const causas = f.advantages.map((a) => a.cause).sort();
    expect(causas).toEqual(['absence', 'kill']);
    for (const a of f.advantages) expect(a.rounds).toBe(1);
  });

  it('rounds desfalcados do mesmo time se somam entre si', () => {
    const f = summarizeFlow([
      analyzeRound(desfalcado('CT', 1)),
      analyzeRound(desfalcado('T', 2)),
    ]);
    const porAusencia = f.advantages.filter((a) => a.cause === 'absence');
    expect(porAusencia).toHaveLength(1);
    expect(porAusencia[0]).toMatchObject({ rounds: 2, won: 1, teamSlot: 'A', label: '5v4' });
  });

  it('o time vem pela POSICAO, e o nome segue como rotulo', () => {
    const f = summarizeFlow([analyzeRound(cheio('CT'))]);
    expect(f.advantages[0]).toMatchObject({ teamSlot: 'A', teamName: 'Nos' });
  });
});
