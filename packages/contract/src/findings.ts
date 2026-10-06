import { z } from 'zod';

export const metricUnitSchema = z.enum([
  'deg', 'ratio', 'seconds', 'dmg_per_1000', 'adr',

  'money', 'dmg_per_nade',
]);

export const baselineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('own_history'),
    matches: z.number().int(),
    mean: z.number(),
    sd: z.number(),
    p25: z.number(),
    p50: z.number(),
    p75: z.number(),
  }),
  z.object({
    kind: z.literal('match_relative'),
    sampleSize: z.number().int(),
    mean: z.number(),
    sd: z.number(),
    rank: z.number().int(),
    of: z.number().int(),
  }),
  z.object({
    kind: z.literal('fixed_reference'),
    value: z.number(),
    unit: metricUnitSchema,
    labelKey: z.string(),
    rationaleKey: z.string(),
  }),
  z.object({
    kind: z.literal('insufficient_data'),
    required: z.number().int(),
    have: z.number().int(),
    wouldBe: z.enum(['own_history', 'match_relative']),
  }),
]);
export type BaselineWire = z.infer<typeof baselineSchema>;

const paramsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const evidenceSchema = z.object({
  roundNum: z.number().int(),
  tick: z.number(),
  labelKey: z.string(),
  params: paramsSchema.optional(),
});
export type EvidenceWire = z.infer<typeof evidenceSchema>;

export const verdictSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  family: z.enum(['aim', 'duels', 'utility', 'economy', 'combat']),
  metricId: z.string(),
  steamId: z.string(),
  playerName: z.string(),
  value: z.number(),
  unit: metricUnitSchema,
  sampleN: z.number().int(),
  severity: z.enum(['critical', 'warning', 'positive', 'neutral']),
  confidence: z.enum(['high', 'medium', 'low']),
  goodness: z.number().nullable(),
  score: z.number(),
  baseline: baselineSchema,
  titleKey: z.string(),
  bodyKey: z.string(),
  params: paramsSchema,
  evidence: z.array(evidenceSchema),
});
export type VerdictWire = z.infer<typeof verdictSchema>;

export const matchFindingsSchema = z.object({
  matchId: z.string(),

  focus: z.object({
    kind: z.enum(['user', 'poi', 'match']),
    steamIds: z.array(z.string()),
  }),

  summary: z.array(verdictSchema),

  all: z.array(verdictSchema),

  history: z.array(z.object({
    steamId: z.string(),
    name: z.string(),
    priorMatches: z.number().int(),
    required: z.number().int(),
  })),

  insufficientPresence: z.array(z.object({
    steamId: z.string(),
    name: z.string(),
    roundsPlayed: z.number().int(),
    liveRounds: z.number().int(),
  })).default([]),
  rulesVersion: z.number().int(),
});
export type MatchFindings = z.infer<typeof matchFindingsSchema>;
