import { describe, expect, it } from 'vitest';
import type { VerdictWire } from '@cs2/contract';
import { cellKey, groupFindings, worstSeverity } from '../src/components/verdict/grid-model';

const v = (
  steamId: string,
  family: VerdictWire['family'],
  severity: VerdictWire['severity'],
): VerdictWire =>
  ({
    id: `${steamId}-${family}-${severity}`,
    ruleId: `${family}.regra`,
    family,
    metricId: 'm',
    steamId,
    playerName: steamId,
    value: 1,
    unit: 'ratio',
    sampleN: 10,
    severity,
    confidence: 'high',
    goodness: null,
    score: 0,
    baseline: { kind: 'insufficient_data', required: 3, have: 0, wouldBe: 'own_history' },
    titleKey: 't',
    bodyKey: 'b',
    params: {},
    evidence: [],
  }) satisfies VerdictWire;

describe('groupFindings', () => {
  const all = [
    v('a', 'aim', 'critical'),
    v('a', 'aim', 'neutral'),
    v('a', 'duels', 'positive'),
    v('b', 'economy', 'warning'),
  ];

  it('as duas leituras saem do mesmo conjunto, sem perder nem duplicar', () => {
    const { byPlayer, byCell } = groupFindings(all);
    const emCelulas = [...byCell.values()].reduce((n, l) => n + l.length, 0);
    const emJogadores = [...byPlayer.values()].reduce((n, l) => n + l.length, 0);
    expect(emCelulas).toBe(all.length);
    expect(emJogadores).toBe(all.length);
  });

  it('a celula cruza jogador E assunto', () => {
    const { byCell } = groupFindings(all);
    expect(byCell.get(cellKey('a', 'aim'))).toHaveLength(2);
    expect(byCell.get(cellKey('a', 'duels'))).toHaveLength(1);
    expect(byCell.get(cellKey('b', 'aim'))).toBeUndefined();
  });
});

describe('worstSeverity — a cor da celula', () => {
  it('critico manda em tudo', () => {
    expect(worstSeverity([v('a', 'aim', 'neutral'), v('a', 'aim', 'critical')])).toBe('critical');
    expect(worstSeverity([v('a', 'aim', 'critical'), v('a', 'aim', 'warning')])).toBe('critical');
  });

  it('ponto forte vence o neutro: e informacao, e o neutro nao', () => {
    expect(worstSeverity([v('a', 'aim', 'neutral'), v('a', 'aim', 'positive')])).toBe('positive');
  });

  it('atencao vence ponto forte', () => {
    expect(worstSeverity([v('a', 'aim', 'positive'), v('a', 'aim', 'warning')])).toBe('warning');
  });

  it('grupo vazio nao inventa gravidade', () => {
    expect(worstSeverity([])).toBe('neutral');
  });
});
