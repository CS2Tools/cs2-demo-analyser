export type MetricUnit =

  | 'deg'

  | 'ratio'

  | 'seconds'

  | 'dmg_per_1000'

  | 'adr'

  | 'money'

  | 'dmg_per_nade';

export type Direction =
  | 'higher_better'
  | 'lower_better'

  | 'closer_to_zero';

export type Family = 'aim' | 'duels' | 'utility' | 'economy' | 'combat';

export type BaselineKind = Baseline['kind'];

export interface OwnHistoryBaseline {
  kind: 'own_history';

  matches: number;
  mean: number;
  sd: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface MatchRelativeBaseline {
  kind: 'match_relative';

  sampleSize: number;
  mean: number;
  sd: number;

  rank: number;
  of: number;
}

export interface FixedReferenceBaseline {
  kind: 'fixed_reference';
  value: number;
  unit: MetricUnit;

  labelKey: string;

  rationaleKey: string;
}

export interface InsufficientBaseline {
  kind: 'insufficient_data';
  required: number;
  have: number;

  wouldBe: 'own_history' | 'match_relative';
}

export type Baseline =
  | OwnHistoryBaseline
  | MatchRelativeBaseline
  | FixedReferenceBaseline
  | InsufficientBaseline;

export type Severity = 'critical' | 'warning' | 'positive' | 'neutral';

export type Confidence = 'high' | 'medium' | 'low';

export interface Evidence {
  roundNum: number;
  tick: number;

  labelKey: string;
  params?: Record<string, string | number>;
}

export interface Verdict {

  id: string;
  ruleId: string;
  family: Family;
  metricId: string;
  steamId: string;
  value: number;
  unit: MetricUnit;

  sampleN: number;
  severity: Severity;
  confidence: Confidence;

  goodness: number | null;

  score: number;

  baseline: Baseline;
  titleKey: string;
  bodyKey: string;
  params: Record<string, string | number>;
  evidence: Evidence[];
}
