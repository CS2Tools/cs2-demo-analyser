import { describe, expect, it } from 'vitest';
import { scoreBeforeRound } from '../src/rounds.js';

const r = (
  roundNum: number,
  a: number | null,
  b: number | null,
  winner: 'A' | 'B' | null = null,
) => ({ roundNum, scoreAAfter: a, scoreBAfter: b, winnerTeam: winner });

describe('placar antes do round', () => {
  it('round 1 comeca zerado', () => {
    expect(scoreBeforeRound([r(1, 1, 0, 'A')], 1)).toEqual({ a: 0, b: 0 });
  });

  it('usa o placar depois do round anterior, nao o deste', () => {
    const rounds = [r(1, 1, 0, 'A'), r(2, 1, 1, 'B'), r(3, 2, 1, 'A')];
    expect(scoreBeforeRound(rounds, 3)).toEqual({ a: 1, b: 1 });
    expect(scoreBeforeRound(rounds, 2)).toEqual({ a: 1, b: 0 });
  });

  it('a ordem da consulta nao importa', () => {
    const fora = [r(3, 2, 1, 'A'), r(1, 1, 0, 'A'), r(2, 1, 1, 'B')];
    expect(scoreBeforeRound(fora, 3)).toEqual({ a: 1, b: 1 });
  });

  it('sem placar gravado, reconstroi contando quem venceu', () => {
    const rounds = [
      r(1, null, null, 'A'),
      r(2, null, null, 'A'),
      r(3, null, null, 'B'),
    ];
    expect(scoreBeforeRound(rounds, 4)).toEqual({ a: 2, b: 1 });
  });

  it('um buraco no meio nao zera o placar: vale o ultimo round que tem', () => {
    const rounds = [r(1, 1, 0, 'A'), r(2, null, null, 'B'), r(3, null, null, 'A')];

    expect(scoreBeforeRound(rounds, 4)).toEqual({ a: 1, b: 0 });
  });

  it('round fora da partida (nulo) nao entra na conta', () => {
    const rounds = [
      { roundNum: null, scoreAAfter: 9, scoreBAfter: 9, winnerTeam: 'A' as const },
      r(1, 1, 0, 'A'),
    ];
    expect(scoreBeforeRound(rounds, 2)).toEqual({ a: 1, b: 0 });
  });
});
