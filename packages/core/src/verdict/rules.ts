import { CALIBRATION_MEDIAN_DEG } from '../aim.js';
import type { FixedReferenceSpec } from './baseline.js';
import type { Direction, Family, MetricUnit } from './types.js';

export const RULES_VERSION = 4;

export type BaselinePreference = 'own_history' | 'match_relative' | 'fixed_reference';

export interface Rule {
  id: string;
  family: Family;
  metricId: string;
  unit: MetricUnit;
  direction: Direction;

  importance: number;

  minSample: number;
  baselinePreference: BaselinePreference[];
  fixedReference?: FixedReferenceSpec;

  spreadFloor: number;

  variant?: (value: number) => string;
}

export const METRICS = {
  preaim: 'aim.preaim_deg',
  preaimPitch: 'aim.preaim_pitch_deg',
  firstShot: 'aim.firstshot_deg',
  entrySuccess: 'duels.entry_success',
  tradedDeathRate: 'duels.traded_death_rate',
  flashNet: 'utility.flash_net_seconds',
  dmgPer1000: 'economy.dmg_per_1000',
  adr: 'combat.adr',

  unusedUtility: 'utility.unused_on_death',
  nadeDamage: 'utility.nade_damage',
  leftOnTable: 'economy.left_on_table',
  forceDamage: 'economy.force_damage',

  accuracy: 'aim.accuracy',
  counterStrafe: 'aim.counter_strafe',
  kast: 'duels.kast',
  tradeAttempt: 'duels.trade_attempt_rate',
} as const;

export const PITCH_BIAS_THRESHOLD_DEG = CALIBRATION_MEDIAN_DEG;

export const RULES: Rule[] = [
  {
    id: 'aim.preaim',
    family: 'aim',
    metricId: METRICS.preaim,
    unit: 'deg',
    direction: 'lower_better',
    importance: 1,
    minSample: 5,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 0.5,
  },
  {
    id: 'aim.pitch_bias',
    family: 'aim',
    metricId: METRICS.preaimPitch,
    unit: 'deg',
    direction: 'closer_to_zero',
    importance: 0.9,
    minSample: 5,

    baselinePreference: ['fixed_reference'],
    fixedReference: {
      value: PITCH_BIAS_THRESHOLD_DEG,
      unit: 'deg',
      labelKey: 'verdict.ref.pitchBias.label',
      rationaleKey: 'verdict.ref.pitchBias.rationale',
      scale: 1,
    },
    spreadFloor: 1,
    variant: (v) => (v < 0 ? 'low' : 'high'),
  },
  {
    id: 'aim.firstshot',
    family: 'aim',
    metricId: METRICS.firstShot,
    unit: 'deg',
    direction: 'lower_better',
    importance: 0.7,
    minSample: 5,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 0.5,
  },
  {
    id: 'duels.entry_success',
    family: 'duels',
    metricId: METRICS.entrySuccess,
    unit: 'ratio',
    direction: 'higher_better',
    importance: 0.9,
    minSample: 4,
    baselinePreference: ['own_history', 'fixed_reference'],
    fixedReference: {
      value: 0.5,
      unit: 'ratio',
      labelKey: 'verdict.ref.coinFlip.label',
      rationaleKey: 'verdict.ref.coinFlip.rationale',
      scale: 0.15,
    },
    spreadFloor: 0.1,
  },
  {
    id: 'duels.traded_death_rate',
    family: 'duels',
    metricId: METRICS.tradedDeathRate,
    unit: 'ratio',
    direction: 'higher_better',
    importance: 0.8,
    minSample: 8,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 0.08,
  },
  {
    id: 'utility.flash_net',
    family: 'utility',
    metricId: METRICS.flashNet,
    unit: 'seconds',
    direction: 'higher_better',
    importance: 0.6,
    minSample: 3,

    baselinePreference: ['fixed_reference'],
    fixedReference: {
      value: 0,
      unit: 'seconds',
      labelKey: 'verdict.ref.flashZero.label',
      rationaleKey: 'verdict.ref.flashZero.rationale',
      scale: 3,
    },
    spreadFloor: 3,
  },
  {
    id: 'economy.dmg_per_1000',
    family: 'economy',
    metricId: METRICS.dmgPer1000,
    unit: 'dmg_per_1000',
    direction: 'higher_better',
    importance: 0.6,
    minSample: 10,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 10,
  },
  {

    id: 'utility.unused_on_death',
    family: 'utility',
    metricId: METRICS.unusedUtility,
    unit: 'money',
    direction: 'lower_better',
    importance: 0.5,
    minSample: 5,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 150,
  },
  {

    id: 'utility.nade_damage',
    family: 'utility',
    metricId: METRICS.nadeDamage,
    unit: 'dmg_per_nade',
    direction: 'higher_better',
    importance: 0.5,
    minSample: 5,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 5,
  },
  {

    id: 'economy.left_on_table',
    family: 'economy',
    metricId: METRICS.leftOnTable,
    unit: 'money',
    direction: 'lower_better',
    importance: 0.5,
    minSample: 5,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 400,
  },
  {

    id: 'economy.force_damage',
    family: 'economy',
    metricId: METRICS.forceDamage,
    unit: 'adr',
    direction: 'higher_better',
    importance: 0.6,
    minSample: 4,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 15,
  },
  {

    id: 'aim.accuracy',
    family: 'aim',
    metricId: METRICS.accuracy,
    unit: 'ratio',
    direction: 'higher_better',
    importance: 0.9,

    minSample: 40,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 0.03,
  },
  {

    id: 'aim.counter_strafe',
    family: 'aim',
    metricId: METRICS.counterStrafe,
    unit: 'ratio',
    direction: 'higher_better',
    importance: 0.7,
    minSample: 30,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 0.05,
  },
  {

    id: 'duels.kast',
    family: 'duels',
    metricId: METRICS.kast,
    unit: 'ratio',
    direction: 'higher_better',
    importance: 0.8,
    minSample: 10,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 0.07,
  },
  {

    id: 'duels.trade_attempt_rate',
    family: 'duels',
    metricId: METRICS.tradeAttempt,
    unit: 'ratio',
    direction: 'higher_better',
    importance: 0.6,
    minSample: 12,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 0.05,
  },
  {
    id: 'combat.adr',
    family: 'combat',
    metricId: METRICS.adr,
    unit: 'adr',
    direction: 'higher_better',
    importance: 0.8,
    minSample: 10,
    baselinePreference: ['own_history', 'match_relative'],
    spreadFloor: 8,
  },
];
