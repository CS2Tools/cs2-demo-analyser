import { z } from 'zod';
import { sideSchema } from './match.js';
import { grenadeKindSchema } from './replay.js';

export const utilityMapSchema = z.object({
  mapName: z.string(),
  hasRadar: z.boolean(),

  saved: z.number().int(),
});
export type UtilityMap = z.infer<typeof utilityMapSchema>;

export const lineupThrowSchema = z.object({
  throwId: z.number().int(),
  matchId: z.string(),
  roundNum: z.number().int(),
  steamId: z.string().nullable(),
  playerName: z.string().nullable(),
  side: sideSchema.nullable(),
  throwTick: z.number().int().nullable(),

  x: z.number(), y: z.number(), z: z.number(),
  pitch: z.number().nullable(),
  yaw: z.number().nullable(),
  crouched: z.boolean().nullable(),
  onGround: z.boolean().nullable(),
  speed: z.number().nullable(),

  throwStrength: z.number().nullable(),
  detX: z.number().nullable(), detY: z.number().nullable(), detZ: z.number().nullable(),
  enemiesBlinded: z.number().int(),
  enemyDamage: z.number().int(),
  killsAfter: z.number().int(),

  throwPx: z.number().nullable(), throwPy: z.number().nullable(),
  detPx: z.number().nullable(), detPy: z.number().nullable(),

  canOpenReplay: z.boolean(),
});
export type LineupThrow = z.infer<typeof lineupThrowSchema>;

export const roundThrowsQuerySchema = z.object({
  matchId: z.string(),
  roundNum: z.number().int(),
});

export const roundThrowSchema = lineupThrowSchema.extend({
  grenadeType: grenadeKindSchema,

  secondsIntoRound: z.number().nullable(),

  command: z.string(),

  savedAs: z.string().nullable(),
});
export type RoundThrow = z.infer<typeof roundThrowSchema>;

export const roundThrowsSchema = z.object({
  throws: z.array(roundThrowSchema),

  extracted: z.boolean(),
});
export type RoundThrows = z.infer<typeof roundThrowsSchema>;

export const savedLineupSchema = z.object({
  lineupId: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  mapName: z.string(),
  grenadeType: grenadeKindSchema,
  side: sideSchema.nullable(),
  x: z.number(), y: z.number(), z: z.number(),
  pitch: z.number().nullable(), yaw: z.number().nullable(),
  crouched: z.boolean().nullable(),
  onGround: z.boolean().nullable(),
  speed: z.number().nullable(),
  throwStrength: z.number().nullable(),
  detX: z.number().nullable(), detY: z.number().nullable(), detZ: z.number().nullable(),
  command: z.string(),

  throwPx: z.number().nullable(), throwPy: z.number().nullable(),
  detPx: z.number().nullable(), detPy: z.number().nullable(),
  sourceMatchId: z.string().nullable(),
  sourceRound: z.number().int().nullable(),
  sourceTick: z.number().int().nullable(),

  canOpenReplay: z.boolean(),
  createdAt: z.string(),
});
export type SavedLineup = z.infer<typeof savedLineupSchema>;
