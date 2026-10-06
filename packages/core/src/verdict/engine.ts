import {
  goodnessFrom,
  matchRelativeBaseline,
  MIN_HISTORY_MATCHES,
  MIN_MATCH_PEERS,
  ownHistoryBaseline,
} from './baseline.js';
import { RULES, type Rule } from './rules.js';
import type { Baseline, Confidence, Evidence, Severity, Verdict } from './types.js';

export interface MetricObservation {
  steamId: string;
  metricId: string;
  value: number;

  sampleN: number;
}

export interface EvaluateInput {
  observations: MetricObservation[];

  history: Map<string, Map<string, number[]>>;

  evidence?: (ruleId: string, steamId: string) => Evidence[];
  rules?: Rule[];
}

export const SEVERITY_THRESHOLDS = {
  critical: -2,
  warning: -1,
  positive: 1.25,
} as const;

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 1,
  warning: 0.7,
  positive: 0.6,
  neutral: 0,
};

const CONFIDENCE_WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.75, low: 0.5 };

export function severityOf(goodness: number): Severity {
  if (goodness <= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (goodness <= SEVERITY_THRESHOLDS.warning) return 'warning';
  if (goodness >= SEVERITY_THRESHOLDS.positive) return 'positive';
  return 'neutral';
}

export function confidenceOf(sampleN: number, minSample: number): Confidence {
  const ratio = sampleN / minSample;
  if (ratio >= 3) return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
}

interface Resolved {
  baseline: Baseline;
  goodness: number | null;
}

function resolve(rule: Rule, obs: MetricObservation, peers: number[], history: number[]): Resolved {
  for (const pref of rule.baselinePreference) {
    if (pref === 'own_history') {
      const b = ownHistoryBaseline(history);
      if (b) {
        return {
          baseline: b,
          goodness: goodnessFrom(obs.value, b.mean, b.sd, rule.direction, rule.spreadFloor),
        };
      }
    } else if (pref === 'match_relative') {
      const b = matchRelativeBaseline(obs.value, peers, rule.direction);
      if (b) {
        return {
          baseline: b,
          goodness: goodnessFrom(obs.value, b.mean, b.sd, rule.direction, rule.spreadFloor),
        };
      }
    } else if (rule.fixedReference) {
      const { scale, ...ref } = rule.fixedReference;
      return {
        baseline: { kind: 'fixed_reference', ...ref },
        goodness: goodnessFrom(obs.value, ref.value, scale, rule.direction, scale),
      };
    }
  }

  const first = rule.baselinePreference[0];
  const wouldBe = first === 'match_relative' ? 'match_relative' : 'own_history';
  return {
    baseline: {
      kind: 'insufficient_data',
      wouldBe,
      required: wouldBe === 'own_history' ? MIN_HISTORY_MATCHES : MIN_MATCH_PEERS,
      have: wouldBe === 'own_history' ? history.length : peers.length,
    },
    goodness: null,
  };
}

export function evaluate(input: EvaluateInput): Verdict[] {
  const rules = input.rules ?? RULES;
  const out: Verdict[] = [];

  for (const rule of rules) {

    const eligible = input.observations.filter(
      (o) => o.metricId === rule.metricId && Number.isFinite(o.value) && o.sampleN >= rule.minSample,
    );
    const peers = eligible.map((o) => o.value);

    for (const obs of eligible) {
      const history = input.history.get(obs.steamId)?.get(rule.metricId) ?? [];
      const { baseline, goodness } = resolve(rule, obs, peers, history);

      const severity = goodness === null ? 'neutral' : severityOf(goodness);
      const confidence = confidenceOf(obs.sampleN, rule.minSample);
      const tone =
        severity === 'critical' || severity === 'warning'
          ? (rule.variant?.(obs.value) ?? 'bad')
          : severity === 'positive'
            ? 'good'
            : 'neutral';
      const key = `verdict.rules.${rule.id}.${tone}`;

      out.push({
        id: `${rule.id}:${obs.steamId}`,
        ruleId: rule.id,
        family: rule.family,
        metricId: rule.metricId,
        steamId: obs.steamId,
        value: obs.value,
        unit: rule.unit,
        sampleN: obs.sampleN,
        severity,
        confidence,
        goodness,
        score:
          goodness === null
            ? 0
            : SEVERITY_WEIGHT[severity] *
              Math.min(Math.abs(goodness), 3) *
              CONFIDENCE_WEIGHT[confidence] *
              rule.importance,
        baseline,
        titleKey: `${key}.title`,
        bodyKey: `${key}.body`,
        params: { n: obs.sampleN },
        evidence:
          severity === 'neutral' ? [] : (input.evidence?.(rule.id, obs.steamId) ?? []),
      });
    }
  }

  return out;
}

export interface SummaryOptions {
  limit?: number;

  maxPerFamily?: number;

  maxPerPlayer?: number;
}

export function selectSummary<T extends Verdict>(verdicts: T[], options: SummaryOptions = {}): T[] {
  const limit = options.limit ?? 5;
  const maxPerFamily = options.maxPerFamily ?? 2;
  const maxPerPlayer = options.maxPerPlayer ?? Number.POSITIVE_INFINITY;

  const ranked = verdicts
    .filter((v) => v.severity !== 'neutral')
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const picked: T[] = [];
  const byFamily = new Map<string, number>();
  const byPlayer = new Map<string, number>();

  const fits = (v: T) =>
    (byFamily.get(v.family) ?? 0) < maxPerFamily && (byPlayer.get(v.steamId) ?? 0) < maxPerPlayer;
  const take = (v: T) => {
    picked.push(v);
    byFamily.set(v.family, (byFamily.get(v.family) ?? 0) + 1);
    byPlayer.set(v.steamId, (byPlayer.get(v.steamId) ?? 0) + 1);
  };

  for (const v of ranked) {
    if (picked.length >= limit) break;
    if (fits(v)) take(v);
  }

  if (picked.length === limit && !picked.some((v) => v.severity === 'positive')) {
    const bestPositive = ranked.find((v) => v.severity === 'positive' && !picked.includes(v));
    if (bestPositive) picked[picked.length - 1] = bestPositive;
  }

  return picked;
}
