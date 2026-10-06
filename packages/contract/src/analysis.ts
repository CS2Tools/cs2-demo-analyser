import { z } from 'zod';
import { sideSchema } from './match.js';

export const buyTypeSchema = z.enum([
  'pistol', 'full_eco', 'eco', 'semi_eco', 'force_buy', 'full_buy',
]);
export type BuyType = z.infer<typeof buyTypeSchema>;

export const economyRoundSchema = z.object({
  roundNum: z.number().int(),
  ctEquipValue: z.number().int().nullable(),
  tEquipValue: z.number().int().nullable(),
  ctBuyType: buyTypeSchema.nullable(),
  tBuyType: buyTypeSchema.nullable(),
  winnerSide: sideSchema.nullable(),
});
export type EconomyRound = z.infer<typeof economyRoundSchema>;

export const buyMatchupSchema = z.object({
  buyType: buyTypeSchema,
  enemyBuyType: buyTypeSchema,
  rounds: z.number().int(),
  won: z.number().int(),
});
export type BuyMatchup = z.infer<typeof buyMatchupSchema>;

export const deepEconomyRoundSchema = z.object({
  roundNum: z.number().int(),
  half: z.number().int().nullable(),

  ctMoney: z.number().int(),
  tMoney: z.number().int(),

  ctLossBonus: z.number().int(),
  tLossBonus: z.number().int(),
  ctLossStep: z.number().int(),
  tLossStep: z.number().int(),

  ctBreak: z.boolean(),
  tBreak: z.boolean(),
});

export const forceBuyCostSchema = z.object({
  roundNum: z.number().int(),
  side: sideSchema,
  won: z.boolean(),

  roundsUntilFullBuy: z.number().int().nullable(),
});

export const econTotalsSchema = z.object({
  equipDestroyed: z.number().int(),
  equipSaved: z.number().int(),
  leftOnTable: z.number().int(),
  spent: z.number().int(),
});

export const deepEconomySchema = z.object({
  rounds: z.array(deepEconomyRoundSchema),

  lossBonusSteps: z.array(z.number().int()),
  conversion: z.array(z.object({
    side: sideSchema,
    buyType: buyTypeSchema,
    rounds: z.number().int(),
    won: z.number().int(),
  })),
  forceBuys: z.array(forceBuyCostSchema),
  bySide: z.array(econTotalsSchema.extend({ side: sideSchema })),
  byPlayer: z.array(econTotalsSchema.extend({
    steamId: z.string(),
    name: z.string(),
    teamName: z.string().nullable(),
  })),
});
export type DeepEconomy = z.infer<typeof deepEconomySchema>;

export const economyAnalysisSchema = z.object({
  rounds: z.array(economyRoundSchema),
  matchups: z.array(buyMatchupSchema),

  damagePerThousand: z.array(z.object({
    steamId: z.string(),
    name: z.string(),
    damage: z.number().int(),
    spent: z.number().int(),
    perThousand: z.number().nullable(),
  })),
  deep: deepEconomySchema,
});

export const heatmapBinSchema = z.object({
  binX: z.number().int(),
  binY: z.number().int(),
  split: z.number().int(),
  count: z.number().int(),

  steamId: z.string().nullable(),
  side: sideSchema.nullable(),
});

export const heatmapAnalysisSchema = z.object({
  gridSize: z.number().int(),
  deaths: z.array(heatmapBinSchema),
  kills: z.array(heatmapBinSchema),
  maxCount: z.number().int(),

  players: z.array(z.object({
    steamId: z.string(),
    name: z.string(),
    teamName: z.string().nullable().default(null),
  })).default([]),
});

export const bombSiteSchema = z.object({

  site: z.enum(['A', 'B']).nullable(),
  plants: z.number().int(),
  tWon: z.number().int(),
  ctWon: z.number().int(),
  defused: z.number().int(),
  exploded: z.number().int(),

  medianPlantSeconds: z.number().nullable(),
});

export const plantPointSchema = z.object({
  roundNum: z.number().int(),
  site: z.enum(['A', 'B']).nullable(),
  px: z.number(),
  py: z.number(),
  split: z.number().int(),
  outcome: z.enum(['defused', 'exploded', 'unknown']),
});

export const bombAnalysisSchema = z.object({
  bySite: z.array(bombSiteSchema),
  plants: z.number().int(),
  defused: z.number().int(),
  exploded: z.number().int(),
  defusedWithKit: z.number().int(),
  defusedWithoutKit: z.number().int(),

  medianSecondsLeftOnDefuse: z.number().nullable(),

  c4TimerSeconds: z.number(),
  c4TimerSource: z.enum(['measured', 'reference']),
  points: z.array(plantPointSchema),

  postPlantDeaths: z.array(z.object({ side: sideSchema, deaths: z.number().int() })),
});
export type BombAnalysis = z.infer<typeof bombAnalysisSchema>;

export const duelStatsSchema = z.object({
  steamId: z.string(),
  name: z.string(),
  teamName: z.string().nullable(),
  entryKills: z.number().int(),
  entryDeaths: z.number().int(),

  entrySuccess: z.number().nullable(),
  tradeKills: z.number().int(),
  tradedDeaths: z.number().int(),
  deaths: z.number().int(),

  tradedDeathRate: z.number().nullable(),
});

export const tradeChainSchema = z.object({
  steamId: z.string(),
  name: z.string(),

  teamName: z.string().nullable().default(null),

  opportunities: z.number().int(),
  attempts: z.number().int(),
  successes: z.number().int(),
  deaths: z.number().int(),
  deathsWithOpportunity: z.number().int(),
  deathsWithAttempt: z.number().int(),
  deathsTraded: z.number().int(),
});
export type TradeChain = z.infer<typeof tradeChainSchema>;

export const duelAnalysisSchema = z.object({
  players: z.array(duelStatsSchema),

  tradeWindowSeconds: z.number(),
  trades: z.array(tradeChainSchema).default([]),
});

export const aimStatsSchema = z.object({
  steamId: z.string(),
  name: z.string(),

  teamName: z.string().nullable().default(null),
  duels: z.number().int(),

  preaimMedianDeg: z.number().nullable(),

  preaimPitchMedianDeg: z.number().nullable(),

  firstShotMedianDeg: z.number().nullable(),

  medianMissUnits: z.number().nullable(),
});

export const aimAnalysisSchema = z.object({
  players: z.array(aimStatsSchema),

  punchModel: z.string(),
  calibrationMedianDeg: z.number(),
});

export const accuracyStatsSchema = z.object({
  steamId: z.string(),
  name: z.string(),

  teamName: z.string().nullable().default(null),
  shots: z.number().int(),
  hits: z.number().int(),
  accuracy: z.number().nullable(),
  damage: z.number().int(),
  damagePerShot: z.number().nullable(),

  headshotHits: z.number().int(),
  headshotAccuracy: z.number().nullable(),

  firstShots: z.number().int(),
  firstHits: z.number().int(),
  firstAccuracy: z.number().nullable(),

  sprayShots: z.number().int(),
  sprayHits: z.number().int(),
  sprayAccuracy: z.number().nullable(),
  scopedShots: z.number().int(),

  judgedShots: z.number().int(),
  slowEnoughShots: z.number().int(),
  counterStrafe: z.number().nullable(),

  hitgroups: z.record(z.string(), z.number().int()),
});
export type AccuracyStatsWire = z.infer<typeof accuracyStatsSchema>;

export const weaponAccuracySchema = z.object({
  steamId: z.string(),
  weapon: z.string(),
  shots: z.number().int(),
  hits: z.number().int(),
  accuracy: z.number().nullable(),
  headshotHits: z.number().int(),
  damage: z.number().int(),
});

export const accuracyAnalysisSchema = z.object({
  players: z.array(accuracyStatsSchema),
  byWeapon: z.array(weaponAccuracySchema),

  hasShotData: z.boolean(),

  accurateSpeedFraction: z.number(),
});
export type AccuracyAnalysis = z.infer<typeof accuracyAnalysisSchema>;

export const clutchTallySchema = z.object({
  steamId: z.string(),
  name: z.string(),

  teamName: z.string().nullable().default(null),
  tried: z.number().int(),
  won: z.number().int(),

  byVersus: z.array(z.object({
    versus: z.number().int(),
    tried: z.number().int(),
    won: z.number().int(),
  })),
});

export const advantageTallySchema = z.object({

  label: z.string(),
  side: sideSchema,

  teamName: z.string().nullable().default(null),

  teamSlot: z.enum(['A', 'B']).nullable().default(null),

  cause: z.enum(['kill', 'absence']).default('kill'),
  rounds: z.number().int(),
  won: z.number().int(),
});

export const multikillTallySchema = z.object({
  steamId: z.string(),
  name: z.string(),

  teamName: z.string().nullable().default(null),

  counts: z.array(z.number().int()).min(4),
});

export const kastTallySchema = z.object({
  steamId: z.string(),
  name: z.string(),

  teamName: z.string().nullable().default(null),
  rounds: z.number().int(),
  kastRounds: z.number().int(),

  kast: z.number().nullable(),
});

export const openingImpactSchema = z.object({
  side: sideSchema,

  opened: z.number().int(),
  openedWon: z.number().int(),
});

export const roundsAnalysisSchema = z.object({
  clutches: z.array(clutchTallySchema),
  advantages: z.array(advantageTallySchema),
  multikills: z.array(multikillTallySchema),
  kast: z.array(kastTallySchema),
  opening: z.array(openingImpactSchema),

  rounds: z.number().int(),
});
export type RoundsAnalysis = z.infer<typeof roundsAnalysisSchema>;

export const flashStatsSchema = z.object({
  steamId: z.string(),
  name: z.string(),

  teamName: z.string().nullable().default(null),
  thrown: z.number().int(),
  enemiesFlashed: z.number().int(),
  effectiveFlashes: z.number().int(),
  teammatesFlashed: z.number().int(),
  enemyBlindSeconds: z.number(),
  teamBlindSeconds: z.number(),

  netValueSeconds: z.number(),
});

export const flashAnalysisSchema = z.object({
  players: z.array(flashStatsSchema),

  effectiveThresholdSeconds: z.number(),
  teamFlashPenalty: z.number(),
});

export const utilityPlayerSchema = z.object({
  steamId: z.string(),
  name: z.string(),
  teamName: z.string().nullable(),
  he: z.object({
    grenades: z.number().int(),
    damage: z.number().int(),

    enemiesHit: z.number().int(),

    bestMultiHit: z.number().int(),
    teamDamage: z.number().int(),
  }),
  fire: z.object({
    grenades: z.number().int(),
    damage: z.number().int(),
    enemiesHit: z.number().int(),
    kills: z.number().int(),
    teamDamage: z.number().int(),
  }),
  smoke: z.object({
    smokes: z.number().int(),

    medianSecondsIntoRound: z.number().nullable(),
    killsThroughSmoke: z.number().int(),
  }),
  flash: z.object({
    flashes: z.number().int(),

    effectiveBlinds: z.number().int(),
    teamFlashes: z.number().int(),
    flashAssists: z.number().int(),

    blindedFacingAway: z.number().int(),

    medianDistance: z.number().nullable(),
  }),

  unusedUtility: z.object({
    value: z.number().int(),
    count: z.number().int(),
    deaths: z.number().int(),
  }),
});
export type UtilityPlayer = z.infer<typeof utilityPlayerSchema>;

export const utilityThrowSchema = z.object({
  grenadeId: z.number().int(),
  roundNum: z.number().int(),
  steamId: z.string().nullable(),

  kind: z.enum(['smoke', 'flash', 'fire', 'he', 'decoy']),
  side: sideSchema.nullable(),
  throwPx: z.number().nullable(),
  throwPy: z.number().nullable(),
  detPx: z.number().nullable(),
  detPy: z.number().nullable(),

  split: z.number().int(),

  damage: z.number(),
  enemiesHit: z.number().int(),
  enemiesBlinded: z.number().int(),

  blindSeconds: z.number(),

  bestBlindSeconds: z.number(),
});
export type UtilityThrow = z.infer<typeof utilityThrowSchema>;

export const utilityAnalysisSchema = z.object({
  players: z.array(utilityPlayerSchema),
  throws: z.array(utilityThrowSchema),

  facingAwayDegrees: z.number(),

  hasDeepData: z.boolean(),

  unattributedDamage: z.number(),
  unattributedBlindSeconds: z.number(),
});
export type UtilityAnalysis = z.infer<typeof utilityAnalysisSchema>;

export const ratingRowSchema = z.object({
  steamId: z.string(),
  name: z.string(),
  teamName: z.string().nullable(),
  rounds: z.number().int(),

  rating: z.number().nullable(),
  kast: z.number().nullable(),
  kpr: z.number(),
  dpr: z.number(),
  apr: z.number(),
  adr: z.number(),

  swingPerRound: z.number().nullable(),

  skippedKills: z.number().int(),
});
export type RatingRow = z.infer<typeof ratingRowSchema>;

export const ratingAnalysisSchema = z.object({
  players: z.array(ratingRowSchema),

  baseline: z.object({

    states: z.number().int(),

    observations: z.number().int(),
    minSample: z.number().int(),
  }),
});
export type RatingAnalysis = z.infer<typeof ratingAnalysisSchema>;

export const matchAnalysisSchema = z.object({
  matchId: z.string(),
  mapName: z.string(),
  hasRadar: z.boolean(),

  teams: z.object({
    a: z.string().nullable(),
    b: z.string().nullable(),
  }).default({ a: null, b: null }),
  economy: economyAnalysisSchema,
  heatmap: heatmapAnalysisSchema,
  duels: duelAnalysisSchema,
  aim: aimAnalysisSchema,
  accuracy: accuracyAnalysisSchema,
  rounds: roundsAnalysisSchema,
  bomb: bombAnalysisSchema,
  flashes: flashAnalysisSchema,
  utility: utilityAnalysisSchema,
  rating: ratingAnalysisSchema,
});
export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;
export type EconomyAnalysis = z.infer<typeof economyAnalysisSchema>;
export type HeatmapAnalysis = z.infer<typeof heatmapAnalysisSchema>;
export type DuelAnalysis = z.infer<typeof duelAnalysisSchema>;
export type AimAnalysis = z.infer<typeof aimAnalysisSchema>;
export type FlashAnalysis = z.infer<typeof flashAnalysisSchema>;
export type AimStats = z.infer<typeof aimStatsSchema>;
export type DuelStats = z.infer<typeof duelStatsSchema>;
export type FlashStats = z.infer<typeof flashStatsSchema>;
