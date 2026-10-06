import { describe, expect, it } from 'vitest';
import {
  evaluate,
  hasEnoughPresence,
  matchRelativeBaseline,
  METRICS,
  MIN_HISTORY_MATCHES,
  ownHistoryBaseline,
  quantile,
  RULES,
  selectSummary,
  severityOf,
  type MetricObservation,
  type Verdict,
} from '../src/index.js';

const players = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((n) => n.padStart(17, '7'));

function preaimObs(values: number[], sampleN = 12): MetricObservation[] {
  return values.map((value, i) => ({
    steamId: players[i]!,
    metricId: METRICS.preaim,
    value,
    sampleN,
  }));
}

const noHistory = new Map<string, Map<string, number[]>>();

describe('bases', () => {
  it('quantil interpola como o quantile_cont', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.9)).toBe(10);
  });

  it('historico proprio exige o minimo de partidas', () => {
    expect(ownHistoryBaseline([1, 2, 3, 4])).toBeNull();
    const b = ownHistoryBaseline([1, 2, 3, 4, 5]);
    expect(b?.matches).toBe(MIN_HISTORY_MATCHES);
    expect(b?.p50).toBe(3);
  });

  it('o ranking respeita o sentido da metrica', () => {

    expect(matchRelativeBaseline(1, [1, 2, 3, 4, 5, 6], 'lower_better')?.rank).toBe(1);
    expect(matchRelativeBaseline(1, [1, 2, 3, 4, 5, 6], 'higher_better')?.rank).toBe(6);

    expect(matchRelativeBaseline(-0.2, [-3, -0.2, 1, 2, 4, 5], 'closer_to_zero')?.rank).toBe(1);
  });

  it('partida com poucos jogadores elegiveis nao vira base', () => {
    expect(matchRelativeBaseline(1, [1, 2, 3], 'lower_better')).toBeNull();
  });
});

describe('severidade', () => {
  it('os limiares sao orientados: positivo e bom', () => {
    expect(severityOf(-2.5)).toBe('critical');
    expect(severityOf(-1.2)).toBe('warning');
    expect(severityOf(0)).toBe('neutral');
    expect(severityOf(1.5)).toBe('positive');
  });
});

describe('evaluate', () => {
  it('TODO veredicto tem base — a regra central do projeto', () => {
    const verdicts = evaluate({
      observations: preaimObs([1.5, 2, 2.2, 2.4, 2.5, 2.7, 3, 3.1, 3.3, 6]),
      history: noHistory,
    });
    expect(verdicts.length).toBeGreaterThan(0);
    for (const v of verdicts) {
      expect(v.baseline).toBeDefined();
      expect(['own_history', 'match_relative', 'fixed_reference', 'insufficient_data'])
        .toContain(v.baseline.kind);
    }
  });

  it('sem historico, o pre-aim cai para a comparacao com a partida', () => {
    const verdicts = evaluate({
      observations: preaimObs([1.5, 2, 2.2, 2.4, 2.5, 2.7, 3, 3.1, 3.3, 6]),
      history: noHistory,
    });
    const worst = verdicts.find((v) => v.steamId === players[9] && v.ruleId === 'aim.preaim')!;
    expect(worst.baseline.kind).toBe('match_relative');
    if (worst.baseline.kind === 'match_relative') {
      expect(worst.baseline.rank).toBe(10);
      expect(worst.baseline.of).toBe(10);
    }
    expect(['critical', 'warning']).toContain(worst.severity);
    expect(worst.titleKey).toBe('verdict.rules.aim.preaim.bad.title');
  });

  it('com historico suficiente, o historico proprio tem preferencia', () => {
    const history = new Map([[players[0]!, new Map([[METRICS.preaim, [4, 4.2, 3.8, 4.1, 3.9]]])]]);
    const verdicts = evaluate({
      observations: preaimObs([1.5, 2, 2.2, 2.4, 2.5, 2.7, 3, 3.1, 3.3, 6]),
      history,
    });
    const v = verdicts.find((x) => x.steamId === players[0] && x.ruleId === 'aim.preaim')!;
    expect(v.baseline.kind).toBe('own_history');

    expect(v.severity).toBe('positive');
  });

  it('amostra abaixo do minimo cala a regra', () => {
    const verdicts = evaluate({
      observations: preaimObs([1.5, 2, 2.2, 2.4, 2.5, 2.7, 3, 3.1, 3.3, 6], 2),
      history: noHistory,
    });
    expect(verdicts.filter((v) => v.ruleId === 'aim.preaim')).toEqual([]);
  });

  it('sem nenhuma base disponivel, o veredicto CONFESSA em vez de sumir', () => {

    const verdicts = evaluate({
      observations: preaimObs([1.5, 2, 6]),
      history: noHistory,
    });
    const v = verdicts.find((x) => x.ruleId === 'aim.preaim')!;
    expect(v.baseline.kind).toBe('insufficient_data');
    if (v.baseline.kind === 'insufficient_data') {
      expect(v.baseline.wouldBe).toBe('own_history');
      expect(v.baseline.required).toBe(MIN_HISTORY_MATCHES);
      expect(v.baseline.have).toBe(0);
    }
    expect(v.goodness).toBeNull();
    expect(v.score).toBe(0);
  });

  it('vies vertical usa referencia fixa e sabe se a mira esta alta ou baixa', () => {
    const verdicts = evaluate({
      observations: [
        { steamId: players[0]!, metricId: METRICS.preaimPitch, value: -4, sampleN: 10 },
        { steamId: players[1]!, metricId: METRICS.preaimPitch, value: 3.2, sampleN: 10 },
        { steamId: players[2]!, metricId: METRICS.preaimPitch, value: 0.1, sampleN: 10 },
      ],
      history: noHistory,
    });
    const low = verdicts.find((v) => v.steamId === players[0])!;
    const high = verdicts.find((v) => v.steamId === players[1])!;
    const ok = verdicts.find((v) => v.steamId === players[2])!;
    expect(low.baseline.kind).toBe('fixed_reference');
    expect(low.titleKey).toBe('verdict.rules.aim.pitch_bias.low.title');
    expect(high.titleKey).toBe('verdict.rules.aim.pitch_bias.high.title');
    expect(ok.severity).toBe('positive');
  });

  it('flash com valor liquido negativo e critica contra o zero definicional', () => {
    const [v] = evaluate({
      observations: [{ steamId: players[0]!, metricId: METRICS.flashNet, value: -7.2, sampleN: 5 }],
      history: noHistory,
    });
    expect(v!.baseline.kind).toBe('fixed_reference');
    expect(v!.severity).toBe('critical');
  });

  it('o historico nunca inclui a propria partida: e responsabilidade de quem chama', () => {

    const history = new Map([[players[0]!, new Map([[METRICS.preaim, [1, 1, 1, 1]]])]]);
    const verdicts = evaluate({ observations: preaimObs([1.5, 2, 6]), history });
    const v = verdicts.find((x) => x.steamId === players[0])!;
    expect(v.baseline.kind).toBe('insufficient_data');
    if (v.baseline.kind === 'insufficient_data') expect(v.baseline.have).toBe(4);
  });
});

describe('selectSummary', () => {
  const mk = (id: string, family: Verdict['family'], score: number, severity: Verdict['severity'], steamId = 'a'): Verdict => ({
    id, ruleId: id, family, metricId: id, steamId, value: 1, unit: 'deg', sampleN: 10,
    severity, confidence: 'high', goodness: -2, score,
    baseline: { kind: 'fixed_reference', value: 0, unit: 'deg', labelKey: 'x', rationaleKey: 'y' },
    titleKey: 't', bodyKey: 'b', params: {}, evidence: [],
  });

  it('no maximo dois achados da mesma familia', () => {
    const picked = selectSummary([
      mk('a1', 'aim', 9, 'critical'),
      mk('a2', 'aim', 8, 'critical'),
      mk('a3', 'aim', 7, 'critical'),
      mk('d1', 'duels', 1, 'warning'),
    ]);
    expect(picked.map((v) => v.id)).toEqual(['a1', 'a2', 'd1']);
  });

  it('neutros nunca entram no resumo', () => {
    expect(selectSummary([mk('n', 'aim', 5, 'neutral')])).toEqual([]);
  });

  it('reserva o ultimo lugar para um positivo, se houver', () => {
    const picked = selectSummary([
      mk('a1', 'aim', 9, 'critical'),
      mk('a2', 'aim', 8, 'critical'),
      mk('d1', 'duels', 7, 'critical'),
      mk('d2', 'duels', 6, 'critical'),
      mk('e1', 'economy', 5, 'critical'),
      mk('u1', 'utility', 1, 'positive'),
    ]);
    expect(picked).toHaveLength(5);
    expect(picked.at(-1)!.id).toBe('u1');
  });

  it('limita por jogador quando o foco e a partida inteira', () => {
    const picked = selectSummary(
      [
        mk('a1', 'aim', 9, 'critical', 'p1'),
        mk('d1', 'duels', 8, 'critical', 'p1'),
        mk('e1', 'economy', 7, 'critical', 'p1'),
        mk('u1', 'utility', 1, 'warning', 'p2'),
      ],
      { maxPerPlayer: 2 },
    );
    expect(picked.map((v) => v.id)).toEqual(['a1', 'd1', 'u1']);
  });

  it('toda regra declara um sentido e ao menos uma base', () => {
    for (const r of RULES) {
      expect(r.baselinePreference.length, r.id).toBeGreaterThan(0);
      if (r.baselinePreference.includes('fixed_reference')) {
        expect(r.fixedReference, `${r.id} pede referencia fixa sem declarar qual`).toBeDefined();
      }
    }
  });
});

describe('hasEnoughPresence', () => {
  it('quem jogou tudo passa', () => {
    expect(hasEnoughPresence(24, 24)).toBe(true);
  });

  it('metade exata passa: o limiar e inclusivo', () => {
    expect(hasEnoughPresence(12, 24)).toBe(true);
  });

  it('abaixo da metade nao passa', () => {
    expect(hasEnoughPresence(11, 24)).toBe(false);
  });

  it('os casos reais das demos ficam de fora', () => {
    expect(hasEnoughPresence(7, 19)).toBe(false);
    expect(hasEnoughPresence(10, 37)).toBe(false);
    expect(hasEnoughPresence(6, 38)).toBe(false);
    expect(hasEnoughPresence(6, 17)).toBe(false);
  });

  it('quem entrou cedo e jogou a maior parte continua valendo', () => {
    expect(hasEnoughPresence(14, 19)).toBe(true);
    expect(hasEnoughPresence(26, 37)).toBe(true);
    expect(hasEnoughPresence(31, 38)).toBe(true);
  });

  it('sem round live medido, nao se cala por presenca', () => {
    expect(hasEnoughPresence(0, 0)).toBe(true);
  });
});
