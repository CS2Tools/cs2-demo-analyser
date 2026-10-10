import { z } from 'zod';
import { sideSchema } from './match.js';

export const replaySlotSchema = z.object({

  slot: z.number().int().min(0),
  steamId: z.string(),
  name: z.string(),
  team: z.enum(['A', 'B']).nullable(),

  side: sideSchema.nullable(),
  isUser: z.boolean(),
  isPoi: z.boolean(),

  teamColor: z.string().nullable().default(null),

  killsBefore: z.number().int().default(0),
  deathsBefore: z.number().int().default(0),
  assistsBefore: z.number().int().default(0),
});
export type ReplaySlot = z.infer<typeof replaySlotSchema>;

export const replayEventSchema = z.object({
  tick: z.number(),
  kind: z.enum(['kill', 'bomb_planted', 'bomb_defused', 'bomb_exploded']),

  actorSlot: z.number().int().nullable(),

  targetSlot: z.number().int().nullable(),
  weapon: z.string().nullable(),
  headshot: z.boolean().nullable(),

  x: z.number().nullable(),
  y: z.number().nullable(),
  split: z.number().int().nullable(),

  penetrated: z.boolean().nullable().default(null),
  thruSmoke: z.boolean().nullable().default(null),
  attackerBlind: z.boolean().nullable().default(null),
  noscope: z.boolean().nullable().default(null),
  assisterSlot: z.number().int().nullable().default(null),
  flashAssist: z.boolean().nullable().default(null),
});
export type ReplayEvent = z.infer<typeof replayEventSchema>;

export const grenadeKindSchema = z.enum(['smoke', 'flashbang', 'he', 'molotov', 'decoy', 'unknown']);
export type GrenadeKind = z.infer<typeof grenadeKindSchema>;

export const grenadeTrackSchema = z.object({
  grenadeId: z.number().int(),
  kind: grenadeKindSchema,
  throwerSlot: z.number().int().nullable(),
  throwTick: z.number(),
  detonateTick: z.number().nullable(),

  path: z.array(z.object({
    tick: z.number(),
    x: z.number(),
    y: z.number(),
    split: z.number().int(),
  })),
});
export type GrenadeTrack = z.infer<typeof grenadeTrackSchema>;

export const detonationSchema = z.object({
  kind: grenadeKindSchema,
  tick: z.number(),
  expireTick: z.number().nullable(),
  x: z.number(),
  y: z.number(),
  split: z.number().int(),

  radiusPercent: z.number(),
  approxModel: z.string(),
  isApproximation: z.literal(true),
});
export type Detonation = z.infer<typeof detonationSchema>;

export const shotSchema = z.object({
  tick: z.number(),
  slot: z.number().int(),
  weapon: z.string().nullable(),
});
export type Shot = z.infer<typeof shotSchema>;

export const voiceTrackSchema = z.object({
  steamId: z.string(),

  slot: z.number().int().nullable(),

  fileId: z.string(),
  segments: z.array(z.object({
    startTick: z.number(),
    endTick: z.number(),

    offsetMs: z.number().int(),
    durationMs: z.number().int(),
  })),
});
export type VoiceTrack = z.infer<typeof voiceTrackSchema>;

const stepSchema = z.tuple([z.number().int(), z.number().int(), z.number()]);

const bombPosSchema = z.object({ x: z.number(), y: z.number(), split: z.number().int() });

const sparseCoords = z.array(
  z.union([z.number(), z.nan(), z.null()]).transform((v) => (v === null ? Number.NaN : v)),
);

export const replayHudSchema = z.object({
  dataVersion: z.number().int(),

  roundEndTick: z.number().nullable().default(null),
  roundTimeSeconds: z.number().nullable(),
  freezeTimeSeconds: z.number().nullable(),
  freezeEndTick: z.number().nullable(),
  c4TimerSeconds: z.number(),

  c4TimerSource: z.enum(['measured', 'reference']),
  weaponNames: z.array(z.string()),
  weaponIdx: z.array(z.number().int()),
  money: z.array(stepSchema),
  armor: z.array(stepSchema),
  helmet: z.array(stepSchema),
  defuser: z.array(stepSchema),

  defusing: z.array(stepSchema).default([]),
  inventory: z.array(z.object({
    frame: z.number().int(),
    slot: z.number().int(),
    items: z.array(z.string()),
  })),
  plant: z.object({
    tick: z.number(),
    site: z.enum(['A', 'B']).nullable(),
    place: z.string().nullable(),
    slot: z.number().int().nullable(),
  }).nullable(),
  defuses: z.array(z.object({
    tick: z.number(),
    slot: z.number().int().nullable(),
    hasKit: z.boolean().nullable(),
  })),
  outcome: z.object({ type: z.enum(['defused', 'exploded']), tick: z.number() }).nullable(),
  bombTrack: z.array(z.object({
    frame: z.number().int(),
    state: z.enum(['carried', 'dropped', 'planted']),
    slot: z.number().int().nullable(),
    pos: bombPosSchema.nullable(),
    approx: z.boolean(),
  })),
});
export type ReplayHud = z.infer<typeof replayHudSchema>;

export const roundReplaySchema = z.object({
  matchId: z.string(),
  roundNum: z.number().int(),
  mapName: z.string(),
  hasRadar: z.boolean(),
  tickRate: z.number(),
  startTick: z.number(),
  endTick: z.number(),

  stride: z.number().int(),
  frames: z.number().int(),

  score: z.object({
    a: z.number().int(),
    b: z.number().int(),
    teamAName: z.string().nullable(),
    teamBName: z.string().nullable(),
  }).default({ a: 0, b: 0, teamAName: null, teamBName: null }),
  slots: z.array(replaySlotSchema),

  x: sparseCoords,
  y: sparseCoords,
  z: sparseCoords,
  yaw: sparseCoords,
  split: z.array(z.number()),
  health: z.array(z.number()),

  lifeState: z.array(z.number()),
  flash: z.array(z.number()),

  events: z.array(replayEventSchema),
  grenades: z.array(grenadeTrackSchema),
  detonations: z.array(detonationSchema),

  shots: z.array(shotSchema),

  voice: z.array(voiceTrackSchema).default([]),

  hud: replayHudSchema,

  slotsPerFrame: z.number().int().min(1).default(10),
});
export type RoundReplay = z.infer<typeof roundReplaySchema>;

export const SLOTS_PER_FRAME = 10;

export const REPLAY_SLOTS_SINCE_DATA_VERSION = 6;
