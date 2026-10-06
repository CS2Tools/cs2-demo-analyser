import { z } from 'zod';
import { sideSchema } from './match.js';
import { buyTypeSchema } from './analysis.js';

export const teamMatchSideSchema = z.object({

  teamName: z.string().nullable(),
  players: z.array(z.object({ steamId: z.string(), name: z.string() })),
  roundsWon: z.number().int(),
  roundsPlayed: z.number().int(),
  bySide: z.array(z.object({
    side: sideSchema,
    rounds: z.number().int(),
    won: z.number().int(),
  })),

  buys: z.array(z.object({
    buyType: buyTypeSchema,
    rounds: z.number().int(),
    won: z.number().int(),
  })),

  openings: z.object({ opened: z.number().int(), openedWon: z.number().int() }),

  advantages: z.object({ rounds: z.number().int(), won: z.number().int() }),

  advantagesByAbsence: z.object({
    rounds: z.number().int(),
    won: z.number().int(),
  }).default({ rounds: 0, won: 0 }),
  bomb: z.object({
    plants: z.number().int(),
    defuses: z.number().int(),
    bySite: z.array(z.object({
      site: z.enum(['A', 'B']).nullable(),
      plants: z.number().int(),

      defusedByEnemy: z.number().int(),
    })),
  }),
  utility: z.object({
    thrown: z.number().int(),
    damage: z.number().int(),
    roundsPlayed: z.number().int(),
  }),
});
export type TeamMatchSide = z.infer<typeof teamMatchSideSchema>;

export const teamMatchReportSchema = z.object({
  matchId: z.string(),
  mapName: z.string(),
  playedAt: z.string().nullable(),

  teams: z.array(teamMatchSideSchema).length(2),
});
export type TeamMatchReport = z.infer<typeof teamMatchReportSchema>;

export const teamLineupSchema = z.object({

  id: z.string(),
  name: z.string().nullable(),
  matches: z.number().int(),
  wins: z.number().int(),
  roundsWon: z.number().int(),
  roundsLost: z.number().int(),
  players: z.array(z.object({
    steamId: z.string(),
    name: z.string(),

    matches: z.number().int(),
  })),
  maps: z.array(z.object({
    mapName: z.string(),
    matches: z.number().int(),
    roundsWon: z.number().int(),
    roundsLost: z.number().int(),
  })),
  bySide: z.array(z.object({
    side: sideSchema,
    rounds: z.number().int(),
    won: z.number().int(),
  })),

  matchIds: z.array(z.string()),
});
export type TeamLineup = z.infer<typeof teamLineupSchema>;
