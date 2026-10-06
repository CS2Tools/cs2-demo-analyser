import { z } from 'zod';

export const roundPhaseSchema = z.enum(['live', 'knife', 'warmup', 'restart_discarded']);
export type RoundPhase = z.infer<typeof roundPhaseSchema>;

export const sideSchema = z.enum(['CT', 'T']);

export const validationResultSchema = z.object({
  check: z.string(),
  ok: z.boolean(),
  detail: z.string(),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

export const matchSummarySchema = z.object({
  matchId: z.string(),
  fileName: z.string(),
  mapName: z.string(),
  hasRadar: z.boolean(),
  source: z.string().nullable(),
  serverName: z.string().nullable(),
  tickRate: z.number(),
  teamAName: z.string().nullable(),
  teamBName: z.string().nullable(),
  scoreA: z.number().int().nullable(),
  scoreB: z.number().int().nullable(),
  roundsPlayed: z.number().int().nullable(),
  durationSeconds: z.number().nullable(),
  ingestedAt: z.string(),

  playedAt: z.string().nullable().default(null),

  playedAtSource: z.string().nullable().default(null),

  restartCount: z.number().int(),
  hasKnifeRound: z.boolean(),

  bulkState: z.string(),

  pinned: z.boolean(),

  hasVoice: z.boolean(),

  demoBuild: z.string().nullable(),
  demoFormat: z.string().nullable(),

  hasWarnings: z.boolean(),
});
export type MatchSummary = z.infer<typeof matchSummarySchema>;

export const chatMessageSchema = z.object({
  tick: z.number(),
  steamId: z.string().nullable(),
  name: z.string().nullable(),

  teamName: z.string().nullable(),
  text: z.string(),
  isTeamOnly: z.boolean().nullable(),
  roundNum: z.number().int().nullable(),

  secondsIntoRound: z.number().nullable(),
});
export type ChatMessageWire = z.infer<typeof chatMessageSchema>;

export const matchChatSchema = z.object({
  messages: z.array(chatMessageSchema),

  unknownScope: z.number().int(),

  needsReprocess: z.boolean().default(false),
});
export type MatchChat = z.infer<typeof matchChatSchema>;

export const scoreboardRowSchema = z.object({
  steamId: z.string(),
  name: z.string(),
  teamName: z.string().nullable(),
  startingSide: sideSchema.nullable(),
  isUser: z.boolean(),
  isPoi: z.boolean(),
  roundsPlayed: z.number().int(),
  kills: z.number().int(),
  deaths: z.number().int(),
  assists: z.number().int(),
  headshots: z.number().int(),
  headshotPct: z.number().nullable(),
  damageTotal: z.number().int(),
  adr: z.number().nullable(),

  kastPct: z.number().nullable(),
  kd: z.number().nullable(),
  plusMinus: z.number().int(),
  utilityDamage: z.number().int(),
  enemiesFlashed: z.number().int(),
  teammatesFlashed: z.number().int(),

  firstRound: z.number().int().nullable().default(null),
  lastRound: z.number().int().nullable().default(null),

  spells: z.number().int().default(1),

  playedAllRounds: z.boolean().default(true),
});
export type ScoreboardRow = z.infer<typeof scoreboardRowSchema>;

export const rosterSpellSchema = z.object({
  steamId: z.string(),
  name: z.string(),
  teamName: z.string().nullable(),
  teamSlot: z.enum(['A', 'B']).nullable(),
  firstRound: z.number().int(),
  lastRound: z.number().int(),
  rounds: z.number().int(),
});

export const rosterHandoffSchema = z.object({
  teamName: z.string().nullable(),
  teamSlot: z.enum(['A', 'B']),
  outSteamId: z.string().nullable(),
  outName: z.string().nullable(),
  outLastRound: z.number().int().nullable(),
  inSteamId: z.string().nullable(),
  inName: z.string().nullable(),
  inFirstRound: z.number().int().nullable(),

  gapRounds: z.number().int().nullable(),

  inference: z.string(),
});

export const matchRosterSchema = z.object({
  matchId: z.string(),
  spells: z.array(rosterSpellSchema),
  handoffs: z.array(rosterHandoffSchema),

  understaffedRounds: z.array(z.object({
    roundNum: z.number().int(),
    rosterCt: z.number().int(),
    rosterT: z.number().int(),
  })),
});
export type MatchRosterWire = z.infer<typeof matchRosterSchema>;
export type RosterHandoffWire = z.infer<typeof rosterHandoffSchema>;

export const roundRowSchema = z.object({
  roundNum: z.number().int(),
  phase: roundPhaseSchema,
  half: z.number().int().nullable(),
  isOvertime: z.boolean(),
  startTick: z.number().nullable(),
  freezeEndTick: z.number().nullable(),
  endTick: z.number(),
  durationSeconds: z.number().nullable(),
  winnerSide: sideSchema.nullable(),
  winReason: z.string().nullable(),

  ctScoreAfter: z.number().int().nullable(),
  tScoreAfter: z.number().int().nullable(),

  scoreAAfter: z.number().int().nullable(),
  scoreBAfter: z.number().int().nullable(),
  winnerTeam: z.enum(['A', 'B']).nullable(),
  bombPlantTick: z.number().nullable(),
  bombDefuseTick: z.number().nullable(),
  bombExplodeTick: z.number().nullable(),
  kills: z.number().int(),

  rosterCt: z.number().int().nullable().default(null),
  rosterT: z.number().int().nullable().default(null),
});
export type RoundRow = z.infer<typeof roundRowSchema>;

export const matchDetailSchema = z.object({
  summary: matchSummarySchema,
  scoreboard: z.array(scoreboardRowSchema),
  rounds: z.array(roundRowSchema),

  discardedRounds: z.array(roundRowSchema),
  validation: z.array(validationResultSchema),
  matchStartTick: z.number().nullable(),
  knifeRoundTick: z.number().nullable(),
});
export type MatchDetail = z.infer<typeof matchDetailSchema>;
