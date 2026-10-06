import { z } from 'zod';
import { metricUnitSchema } from './findings.js';

export const playerListItemSchema = z.object({
  steamId: z.string(),

  name: z.string(),
  matches: z.number().int(),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),

  isUser: z.boolean(),
  isPoi: z.boolean(),

  colour: z.string().nullable(),
});
export type PlayerListItem = z.infer<typeof playerListItemSchema>;

export const playerMetricPointSchema = z.object({
  matchId: z.string(),
  mapName: z.string(),
  playedAt: z.string(),
  opponent: z.string().nullable(),
  value: z.number(),
  sampleN: z.number().int(),

  enough: z.boolean(),

  priorMedian: z.number().nullable(),
});
export type PlayerMetricPoint = z.infer<typeof playerMetricPointSchema>;

export const playerMetricSeriesSchema = z.object({
  ruleId: z.string(),
  metricId: z.string(),
  family: z.enum(['aim', 'duels', 'utility', 'economy', 'combat']),
  unit: metricUnitSchema,
  direction: z.enum(['higher_better', 'lower_better', 'closer_to_zero']),

  minSample: z.number().int(),

  points: z.array(playerMetricPointSchema),
});
export type PlayerMetricSeries = z.infer<typeof playerMetricSeriesSchema>;

export const playerTrainItemSchema = z.object({
  ruleId: z.string(),
  metricId: z.string(),
  unit: metricUnitSchema,

  times: z.number().int(),

  of: z.number().int(),
  worst: z.enum(['critical', 'warning']),

  trend: z.enum(['better', 'worse', 'flat']).nullable(),
  matches: z.array(z.object({
    matchId: z.string(),
    mapName: z.string(),
    playedAt: z.string(),
    severity: z.enum(['critical', 'warning']),
    value: z.number(),
  })),
});
export type PlayerTrainItem = z.infer<typeof playerTrainItemSchema>;

export const playerMapRowSchema = z.object({
  mapName: z.string(),
  matches: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
  roundsPlayed: z.number().int(),
  adr: z.number().nullable(),
  kd: z.number().nullable(),

  entrySuccess: z.number().nullable(),
});
export type PlayerMapRow = z.infer<typeof playerMapRowSchema>;

export const playerWeaponRowSchema = z.object({
  weapon: z.string(),
  kills: z.number().int(),
  headshotPct: z.number().nullable(),

  medianDistance: z.number().nullable(),

  damage: z.number().int().nullable(),
});
export type PlayerWeaponRow = z.infer<typeof playerWeaponRowSchema>;

export const playerProfileSchema = z.object({
  steamId: z.string(),
  name: z.string(),

  aliases: z.array(z.string()),
  matches: z.number().int(),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  maps: z.array(z.string()),

  windowMatches: z.number().int(),

  prunedMatches: z.number().int(),
  series: z.array(playerMetricSeriesSchema),
  train: z.array(playerTrainItemSchema),
  byMap: z.array(playerMapRowSchema),
  byWeapon: z.array(playerWeaponRowSchema),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
