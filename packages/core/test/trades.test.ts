import { describe, expect, it } from 'vitest';
import {
  summarizeTrades,
  type TradeDamageInput,
  type TradeKillInput,
  type TradeRoundInput,
} from '../src/analytics/trades.js';

const WINDOW = 3 * 64;

const CT = ['c1', 'c2', 'c3'];
const T = ['t1', 't2', 't3'];

const roster = () => [
  ...CT.map((steamId) => ({ steamId, side: 'CT' as const })),
  ...T.map((steamId) => ({ steamId, side: 'T' as const })),
];

const kill = (tick: number, attacker: string, victim: string): TradeKillInput => ({
  tick,
  attackerSteamId: attacker,
  victimSteamId: victim,
  attackerSide: attacker.startsWith('c') ? 'CT' : 'T',
  victimSide: victim.startsWith('c') ? 'CT' : 'T',
});

const dano = (tick: number, attacker: string, victim: string): TradeDamageInput => ({
  tick,
  attackerSteamId: attacker,
  victimSteamId: victim,
});

const round = (
  kills: TradeKillInput[],
  damages: TradeDamageInput[] = [],
): TradeRoundInput => ({ roundNum: 1, roster: roster(), kills, damages });

const of = (tallies: ReturnType<typeof summarizeTrades>, id: string) =>
  tallies.find((t) => t.steamId === id)!;

describe('cadeia da troca', () => {
  it('quem estava vivo teve a oportunidade; quem ja morreu, nao', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1'), kill(2000, 't1', 'c2')])],
      WINDOW,
    );

    expect(of(t, 'c3').opportunities).toBe(2);
    expect(of(t, 'c2').opportunities).toBe(1);

    expect(of(t, 'c1').opportunities).toBe(0);
  });

  it('acertar o assassino dentro da janela e tentativa', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1')], [dano(1050, 'c2', 't1')])],
      WINDOW,
    );
    expect(of(t, 'c2')).toMatchObject({ opportunities: 1, attempts: 1, successes: 0 });

    expect(of(t, 'c3')).toMatchObject({ opportunities: 1, attempts: 0 });
  });

  it('dano fora da janela nao conta', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1')], [dano(1000 + WINDOW + 1, 'c2', 't1')])],
      WINDOW,
    );
    expect(of(t, 'c2').attempts).toBe(0);
  });

  it('dano em OUTRO inimigo nao e tentativa de vinganca', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1')], [dano(1050, 'c2', 't2')])],
      WINDOW,
    );
    expect(of(t, 'c2').attempts).toBe(0);
  });

  it('matar e ter tentado, mesmo sem dano anterior registrado', () => {
    const t = summarizeTrades([round([kill(1000, 't1', 'c1'), kill(1100, 'c2', 't1')])], WINDOW);
    expect(of(t, 'c2')).toMatchObject({ opportunities: 1, attempts: 1, successes: 1 });
  });

  it('vinganca depois da janela nao e troca', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1'), kill(1000 + WINDOW + 10, 'c2', 't1')])],
      WINDOW,
    );
    expect(of(t, 'c2').successes).toBe(0);
  });

  it('do lado de quem morreu: teve chance, alguem tentou, alguem vingou', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1'), kill(1100, 'c2', 't1')], [dano(1050, 'c3', 't1')])],
      WINDOW,
    );
    expect(of(t, 'c1')).toMatchObject({
      deaths: 1,
      deathsWithOpportunity: 1,
      deathsWithAttempt: 1,
      deathsTraded: 1,
    });
  });

  it('morrer por ultimo do time: morte sem oportunidade nenhuma', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1'), kill(2000, 't1', 'c2'), kill(3000, 't1', 'c3')])],
      WINDOW,
    );
    expect(of(t, 'c3')).toMatchObject({ deaths: 1, deathsWithOpportunity: 0, deathsTraded: 0 });
  });

  it('kill de time nao gera oportunidade de troca', () => {
    const t = summarizeTrades([round([kill(1000, 'c1', 'c2')])], WINDOW);
    expect(of(t, 'c3').opportunities).toBe(0);

    const t2 = summarizeTrades(
      [round([kill(1000, 'c1', 'c2'), kill(2000, 't1', 'c3')])],
      WINDOW,
    );
    expect(of(t2, 'c1').opportunities).toBe(1);
    expect(of(t2, 'c2').opportunities).toBe(0);
  });

  it('a ordem da consulta nao muda nada', () => {
    const fora = round([kill(2000, 't1', 'c2'), kill(1000, 't1', 'c1')]);
    const t = summarizeTrades([fora], WINDOW);
    expect(of(t, 'c1').opportunities).toBe(0);
    expect(of(t, 'c3').opportunities).toBe(2);
  });

  it('soma varios rounds e devolve todo mundo do elenco', () => {
    const t = summarizeTrades(
      [round([kill(1000, 't1', 'c1')]), round([kill(1000, 't1', 'c1')])],
      WINDOW,
    );
    expect(of(t, 'c1').deaths).toBe(2);
    expect(t).toHaveLength(6);
  });
});
