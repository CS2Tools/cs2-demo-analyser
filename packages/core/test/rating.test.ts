import { describe, expect, it } from 'vitest';
import {
  changeSwing,
  impactApprox,
  playerImpact,
  rating2Approx,
  stateKey,
  WinProbability,
  type StateObservation,
} from '../src/analytics/rating.js';
import {
  analyzeRound,
  type RoundInput,
  type RoundKillInput,
  type StateChange,
} from '../src/analytics/round-flow.js';

describe('rating2Approx', () => {

  it('reproduz a combinacao linear, termo a termo', () => {
    const r = rating2Approx({ kastPct: 72, kpr: 0.7, dpr: 0.65, apr: 0.12, adr: 78 });
    const esperado =
      0.0073 * 72 + 0.3591 * 0.7 - 0.5329 * 0.65 + 0.2372 * (2.13 * 0.7 + 0.42 * 0.12 - 0.41) +
      0.0032 * 78 + 0.1587;
    expect(r).toBeCloseTo(esperado, 10);

    expect(r).toBeCloseTo(1.107, 3);
  });

  it('o KAST entra em porcentagem, e nao em fracao', () => {
    const emPorcento = rating2Approx({ kastPct: 70, kpr: 0.7, dpr: 0.65, apr: 0.1, adr: 78 });
    const emFracao = rating2Approx({ kastPct: 0.7, kpr: 0.7, dpr: 0.65, apr: 0.1, adr: 78 });
    expect(emPorcento - emFracao).toBeCloseTo(0.0073 * 69.3, 6);
  });

  it('morrer menos sobe o rating; morrer mais desce', () => {
    const base = { kastPct: 70, kpr: 0.7, apr: 0.1, adr: 78 };
    expect(rating2Approx({ ...base, dpr: 0.5 })).toBeGreaterThan(
      rating2Approx({ ...base, dpr: 0.8 }),
    );
  });

  it('o Impact e a mesma regressao publicada', () => {
    expect(impactApprox({ kpr: 0.8, apr: 0.15 })).toBeCloseTo(2.13 * 0.8 + 0.42 * 0.15 - 0.41, 10);
  });
});

describe('WinProbability', () => {
  const obs = (n: number, s: Partial<StateObservation>, ctWon: boolean): StateObservation[] =>
    Array.from({ length: n }, () => ({ aliveCT: 4, aliveT: 5, planted: false, ctWon, ...s }));

  it('estado com amostra vira probabilidade', () => {
    const p = new WinProbability([...obs(12, {}, true), ...obs(8, {}, false)], 20);
    const r = p.ctWinRate({ aliveCT: 4, aliveT: 5, planted: false })!;
    expect(r.ctWinRate).toBeCloseTo(0.6, 10);
    expect(r.sample).toBe(20);
    expect(r.from).toBe('exact');
  });

  it('amostra pequena NAO vira probabilidade: devolve nulo', () => {
    const p = new WinProbability(obs(5, {}, true), 20);
    expect(p.ctWinRate({ aliveCT: 4, aliveT: 5, planted: false })).toBeNull();
  });

  it('sem amostra no estado exato, cai para o degrau sem a bomba', () => {
    const p = new WinProbability(
      [
        ...obs(3, { planted: true }, false),
        ...obs(10, { planted: false }, true),
        ...obs(10, { planted: false }, false),
      ],
      20,
    );
    const r = p.ctWinRate({ aliveCT: 4, aliveT: 5, planted: true })!;
    expect(r.from).toBe('coarse');

    expect(r.sample).toBe(23);
    expect(r.ctWinRate).toBeCloseTo(10 / 23, 10);
  });

  it('a chave separa com e sem bomba', () => {
    expect(stateKey({ aliveCT: 3, aliveT: 2, planted: true })).toBe('3v2+bomba');
    expect(stateKey({ aliveCT: 3, aliveT: 2, planted: false })).toBe('3v2');
  });
});

describe('changeSwing', () => {
  const p = new WinProbability(
    [
      ...Array.from({ length: 20 }, (_, i) => ({ aliveCT: 5, aliveT: 5, planted: false, ctWon: i < 10 })),
      ...Array.from({ length: 20 }, (_, i) => ({ aliveCT: 5, aliveT: 4, planted: false, ctWon: i < 16 })),
    ],
    20,
  );
  const mudanca = (side: 'CT' | 'T'): StateChange => ({
    tick: 1, steamId: 'x', side,
    before: { aliveCT: 5, aliveT: 5, planted: false },
    after: { aliveCT: 5, aliveT: 4, planted: false },
  });

  it('a kill do CT vale o quanto ela subiu a chance do CT', () => {
    expect(changeSwing(mudanca('CT'), p)).toBeCloseTo(0.8 - 0.5, 10);
  });

  it('o mesmo delta, visto do lado T, tem o sinal trocado', () => {
    expect(changeSwing(mudanca('T'), p)).toBeCloseTo(-(0.8 - 0.5), 10);
  });

  it('o plantio nao tem autor, entao nao vira impacto de ninguem', () => {
    expect(changeSwing({ ...mudanca('CT'), steamId: null, side: null }, p)).toBeNull();
  });

  it('estado sem amostra devolve nulo em vez de zero', () => {
    const vazia = new WinProbability([], 20);
    expect(changeSwing(mudanca('CT'), vazia)).toBeNull();
  });
});

describe('playerImpact', () => {
  const CT = ['c1', 'c2'];
  const T = ['t1', 't2'];
  const roster = () => [
    ...CT.map((steamId) => ({ steamId, side: 'CT' as const })),
    ...T.map((steamId) => ({ steamId, side: 'T' as const })),
  ];
  const kill = (tick: number, attacker: string, victim: string): RoundKillInput => ({
    tick,
    attackerSteamId: attacker,
    victimSteamId: victim,
    attackerSide: attacker.startsWith('c') ? 'CT' : 'T',
    victimSide: victim.startsWith('c') ? 'CT' : 'T',
    assisterSteamId: null,
    deathWasTraded: null,
  });
  const round = (kills: RoundKillInput[], patch: Partial<RoundInput> = {}) =>
    analyzeRound({ roundNum: 1, winnerSide: 'CT', plantTick: null, roster: roster(), kills, ...patch });

  const probabilidade = () => {
    const linha = (aliveCT: number, aliveT: number, taxa: number) =>
      Array.from({ length: 20 }, (_, i) => ({
        aliveCT, aliveT, planted: false, ctWon: i < taxa * 20,
      }));
    return new WinProbability(
      [...linha(2, 2, 0.5), ...linha(2, 1, 0.75), ...linha(1, 2, 0.25), ...linha(1, 1, 0.5)],
      20,
    );
  };

  it('soma o swing das kills e divide pelos rounds jogados', () => {
    const r = round([kill(100, 'c1', 't1')]);
    const impact = playerImpact({ rounds: [{ stateChanges: r.stateChanges, roster: roster() }], probability: probabilidade() });
    const c1 = impact.find((i) => i.steamId === 'c1')!;
    expect(c1.swing).toBeCloseTo(0.25, 10);
    expect(c1.rounds).toBe(1);
    expect(c1.swingPerRound).toBeCloseTo(0.25, 10);
  });

  it('quem nao matou fica em zero, e continua na lista', () => {
    const r = round([kill(100, 'c1', 't1')]);
    const impact = playerImpact({ rounds: [{ stateChanges: r.stateChanges, roster: roster() }], probability: probabilidade() });
    expect(impact.find((i) => i.steamId === 'c2')!.swing).toBe(0);
  });

  it('kill em estado sem amostra e CONTADA como pulada, nao como zero', () => {
    const r = round([kill(100, 'c1', 't1')]);
    const impact = playerImpact({
      rounds: [{ stateChanges: r.stateChanges, roster: roster() }],
      probability: new WinProbability([], 20),
    });
    const c1 = impact.find((i) => i.steamId === 'c1')!;
    expect(c1.skipped).toBe(1);
    expect(c1.swing).toBe(0);
  });
});

describe('estados do round', () => {
  const roster = [
    { steamId: 'c1', side: 'CT' as const },
    { steamId: 'c2', side: 'CT' as const },
    { steamId: 't1', side: 'T' as const },
    { steamId: 't2', side: 'T' as const },
  ];
  const kill = (tick: number, attacker: string, victim: string): RoundKillInput => ({
    tick, attackerSteamId: attacker, victimSteamId: victim,
    attackerSide: attacker.startsWith('c') ? 'CT' : 'T',
    victimSide: victim.startsWith('c') ? 'CT' : 'T',
    assisterSteamId: null, deathWasTraded: null,
  });

  it('o primeiro estado e o round cheio, antes de qualquer morte', () => {
    const r = analyzeRound({ roundNum: 1, winnerSide: 'CT', plantTick: null, roster, kills: [kill(10, 'c1', 't1')] });
    expect(r.states[0]).toEqual({ aliveCT: 2, aliveT: 2, planted: false });
    expect(r.states.at(-1)).toEqual({ aliveCT: 2, aliveT: 1, planted: false });
  });

  it('o plantio entra na ordem do tick, entre as mortes', () => {
    const r = analyzeRound({
      roundNum: 1, winnerSide: 'T', plantTick: 50, roster,
      kills: [kill(10, 't1', 'c1'), kill(90, 't1', 'c2')],
    });
    expect(r.states).toEqual([
      { aliveCT: 2, aliveT: 2, planted: false },
      { aliveCT: 1, aliveT: 2, planted: false },
      { aliveCT: 1, aliveT: 2, planted: true },
      { aliveCT: 0, aliveT: 2, planted: true },
    ]);
  });

  it('plantio depois da ultima morte ainda vira estado', () => {
    const r = analyzeRound({
      roundNum: 1, winnerSide: 'T', plantTick: 500, roster, kills: [kill(10, 't1', 'c1')],
    });
    expect(r.states.at(-1)).toEqual({ aliveCT: 1, aliveT: 2, planted: true });
  });

  it('morte de time muda o estado mas nao tem autor', () => {
    const teamKill: RoundKillInput = {
      tick: 10, attackerSteamId: 'c1', victimSteamId: 'c2',
      attackerSide: 'CT', victimSide: 'CT', assisterSteamId: null, deathWasTraded: null,
    };
    const r = analyzeRound({ roundNum: 1, winnerSide: 'T', plantTick: null, roster, kills: [teamKill] });
    expect(r.states.at(-1)).toEqual({ aliveCT: 1, aliveT: 2, planted: false });
    expect(r.stateChanges[0]!.steamId).toBeNull();
  });
});
