import { z } from 'zod';
import {
  matchChatSchema,
  matchDetailSchema,
  matchRosterSchema,
  matchSummarySchema,
} from './match.js';
import { roundReplaySchema } from './replay.js';
import { matchAnalysisSchema } from './analysis.js';
import { matchFindingsSchema } from './findings.js';
import {
  exploreResultSchema,
  exploreSpecSchema,
  exploreSubjectSchema,
  savedQuerySchema,
} from './explore.js';
import { playerListItemSchema, playerProfileSchema } from './player.js';
import { teamLineupSchema, teamMatchReportSchema } from './team.js';
import {
  roundThrowsQuerySchema,
  roundThrowsSchema,
  savedLineupSchema,
  utilityMapSchema,
} from './lineups.js';

const steamId = z.string().regex(/^\d{17}$/, 'SteamID64 tem 17 digitos');

export const playerOfInterestSchema = z.object({
  steamId,
  displayName: z.string().min(1).max(64),
  note: z.string().max(280).default(''),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f59e0b'),
});
export type PlayerOfInterest = z.infer<typeof playerOfInterestSchema>;

export const localeSchema = z.enum(['pt-BR', 'en']);
export type Locale = z.infer<typeof localeSchema>;

export const settingsSchema = z.object({

  userSteamId: steamId.nullable().default(null),
  playersOfInterest: z.array(playerOfInterestSchema).default([]),
  locale: localeSchema.default('pt-BR'),

  retentionBulkMatches: z.number().int().min(0).default(50),

  voiceEnabled: z.boolean().default(true),
  voiceVolume: z.number().min(0).max(1).default(0.8),

  voiceMuteAboveSpeed: z.number().min(1).default(2),

  voicePlayerVolumes: z.record(steamId, z.number().min(0).max(1.5)).default({}),

  replayPlayerLabels: z.enum(['number', 'always', 'hover']).default('number'),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export const mapInfoSchema = z.object({
  name: z.string(),
  hasRadar: z.boolean(),
  resolution: z.number(),
  offset: z.object({ x: z.number(), y: z.number() }),
  splitCount: z.number().int(),
});
export type MapInfo = z.infer<typeof mapInfoSchema>;

export const healthSchema = z.object({
  ok: z.literal(true),
  appVersion: z.string(),

  transport: z.enum(['http', 'ipc']),
  offline: z.literal(true),
});
export type Health = z.infer<typeof healthSchema>;

export const exportResultSchema = z.object({

  path: z.string(),
  bytes: z.number().int().nonnegative(),
});
export type ExportResult = z.infer<typeof exportResultSchema>;

export const storageSchema = z.object({

  demos: z.number().nonnegative(),
  demoCount: z.number().int().nonnegative(),

  replays: z.number().nonnegative(),

  voice: z.number().nonnegative(),

  database: z.number().nonnegative(),
  dataDir: z.string(),
});
export type Storage = z.infer<typeof storageSchema>;

export const diagnosticsSchema = z.object({
  app: z.object({
    version: z.string(),
    transport: z.enum(['http', 'ipc']),

    schemaVersion: z.number().int(),
    rulesVersion: z.number().int(),
  }),
  storage: storageSchema,
  library: z.object({
    matches: z.number().int(),

    pruned: z.number().int(),
    pinned: z.number().int(),
    players: z.number().int(),
    oldest: z.string().nullable(),
    newest: z.string().nullable(),
  }),

  builds: z.array(z.object({
    build: z.string().nullable(),
    format: z.string().nullable(),
    matches: z.number().int(),
    newest: z.string().nullable(),
  })),
  voice: z.object({

    extractorInstalled: z.boolean(),
    extractorDir: z.string().nullable(),
    withVoice: z.number().int(),
    withoutVoice: z.number().int(),
  }),

  radars: z.array(z.object({
    name: z.string(),
    matches: z.number().int(),
    splitCount: z.number().int(),
  })),

  mapsWithoutRadar: z.array(z.object({
    name: z.string(),
    matches: z.number().int(),
  })),
});
export type Diagnostics = z.infer<typeof diagnosticsSchema>;

export const SQL_CONSOLE_MAX_ROWS = 2000;

export const sqlResultSchema = z.object({
  columns: z.array(z.object({ name: z.string(), type: z.string() })),
  rows: z.array(z.array(z.unknown())),
  rowCount: z.number().int(),
  elapsedMs: z.number(),
  truncated: z.boolean(),
});
export type SqlResult = z.infer<typeof sqlResultSchema>;

export const ingestStageSchema = z.enum([
  'hash',
  'probe',
  'events',
  'grenades',
  'replay_ticks',
  'analysis_ticks',
  'economy',
  'derive',
  'voice',
  'merge',
]);
export type IngestStage = z.infer<typeof ingestStageSchema>;

export const INGEST_STAGE_WEIGHTS: Record<IngestStage, number> = {
  hash: 4,
  probe: 2,
  events: 12,
  grenades: 6,
  replay_ticks: 18,
  analysis_ticks: 32,
  economy: 4,
  derive: 14,

  voice: 30,
  merge: 4,
};

export const ingestStateSchema = z.enum([
  'queued',
  'running',
  'done',
  'error',
  'rejected',
  'cancelled',
  'interrupted',
]);
export type IngestState = z.infer<typeof ingestStateSchema>;

export const ingestProgressSchema = z.object({
  jobId: z.string(),
  fileName: z.string(),
  state: ingestStateSchema,
  stage: ingestStageSchema.nullable(),

  progress: z.number().min(0).max(1),
  message: z.string().nullable(),
  error: z.string().nullable(),
  matchId: z.string().nullable(),
  elapsedMs: z.number().int().nonnegative(),
  etaMs: z.number().int().nonnegative().nullable(),

  rejectedReason: z.enum(['pov', 'unsupported']).nullable().default(null),

  duplicateOf: z.string().nullable().default(null),
});
export type IngestProgress = z.infer<typeof ingestProgressSchema>;

export const ingestJobSchema = z.object({
  jobId: z.string(),
  fileName: z.string(),
  state: ingestStateSchema,
  error: z.string().nullable(),
  matchId: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type IngestJob = z.infer<typeof ingestJobSchema>;

export const channels = {
  ingest: ingestProgressSchema,
} as const;

export type Channels = typeof channels;
export type ChannelKey = keyof Channels;
export type ChannelMsg<C extends ChannelKey> = z.infer<Channels[C]>;

export const routes = {
  'app.health': { params: z.object({}), result: healthSchema },
  'app.storage': { params: z.object({}), result: storageSchema },

  'app.diagnostics': { params: z.object({}), result: diagnosticsSchema },
  'settings.get': { params: z.object({}), result: settingsSchema },
  'settings.set': { params: settingsSchema.partial(), result: settingsSchema },
  'maps.list': { params: z.object({}), result: z.array(mapInfoSchema) },

  'explore.catalog': { params: z.object({}), result: z.array(exploreSubjectSchema) },

  'explore.query': { params: exploreSpecSchema, result: exploreResultSchema },
  'explore.examples': { params: z.object({}), result: z.array(savedQuerySchema) },
  'queries.list': { params: z.object({}), result: z.array(savedQuerySchema) },
  'queries.save': {
    params: z.object({ name: z.string().min(1).max(120), spec: exploreSpecSchema }),
    result: savedQuerySchema,
  },
  'queries.remove': {
    params: z.object({ queryId: z.string() }),
    result: z.object({ removed: z.boolean() }),
  },

  'utility.maps': { params: z.object({}), result: z.array(utilityMapSchema) },

  'utility.roundThrows': { params: roundThrowsQuerySchema, result: roundThrowsSchema },

  'collection.list': {
    params: z.object({ mapName: z.string().nullable().default(null) }),
    result: z.array(savedLineupSchema),
  },
  'collection.save': {
    params: z.object({
      matchId: z.string(),
      throwId: z.number().int(),
      name: z.string().min(1).max(120),
      note: z.string().max(2000).nullable().default(null),
    }),
    result: savedLineupSchema,
  },
  'collection.rename': {
    params: z.object({
      lineupId: z.string(),
      name: z.string().min(1).max(120),
      note: z.string().max(2000).nullable().default(null),
    }),
    result: savedLineupSchema,
  },
  'collection.remove': {
    params: z.object({ lineupId: z.string() }),
    result: z.object({ removed: z.boolean() }),
  },

  'matches.list': {
    params: z.object({ filter: z.enum(['all', 'mine', 'poi']).default('all') }),
    result: z.array(matchSummarySchema),
  },

  'players.list': {
    params: z.object({
      query: z.string().max(64).default(''),
      limit: z.number().int().min(1).max(200).default(60),
    }),
    result: z.array(playerListItemSchema),
  },

  'player.profile': {
    params: z.object({
      steamId: z.string(),
      lastMatches: z.number().int().min(3).max(50).default(10),
    }),
    result: playerProfileSchema,
  },
  'match.get': { params: z.object({ matchId: z.string() }), result: matchDetailSchema },
  'match.analysis': { params: z.object({ matchId: z.string() }), result: matchAnalysisSchema },
  'match.findings': { params: z.object({ matchId: z.string() }), result: matchFindingsSchema },
  'match.chat': { params: z.object({ matchId: z.string() }), result: matchChatSchema },

  'match.roster': { params: z.object({ matchId: z.string() }), result: matchRosterSchema },

  'team.match': { params: z.object({ matchId: z.string() }), result: teamMatchReportSchema },
  'team.lineups': { params: z.object({}), result: z.array(teamLineupSchema) },

  'match.pin': {
    params: z.object({ matchId: z.string(), pinned: z.boolean() }),
    result: z.object({ ok: z.boolean(), pruned: z.array(z.string()) }),
  },

  'match.reprocess': {
    params: z.object({ matchId: z.string() }),
    result: z.object({
      jobId: z.string().nullable(),

      source: z.enum(['stored', 'original', 'missing']),
      originalPath: z.string().nullable(),
    }),
  },
  'match.delete': { params: z.object({ matchId: z.string() }), result: z.object({ ok: z.boolean() }) },

  'ingest.submit': {
    params: z.object({ path: z.string().min(1), force: z.boolean().default(false) }),
    result: z.object({
      jobId: z.string(),
      state: z.enum(['queued', 'duplicate']),
      matchId: z.string().nullable(),
    }),
  },
  'ingest.cancel': {
    params: z.object({ jobId: z.string() }),
    result: z.object({ cancelled: z.boolean() }),
  },
  'ingest.jobs': { params: z.object({}), result: z.array(ingestJobSchema) },

  'replay.round': {
    params: z.object({ matchId: z.string(), roundNum: z.number().int() }),
    result: roundReplaySchema,
  },

  'export.match': { params: z.object({ matchId: z.string() }), result: exportResultSchema },
  'export.library': { params: z.object({}), result: exportResultSchema },

  'app.reveal': { params: z.object({ path: z.string() }), result: z.object({ ok: z.boolean() }) },

  'sql.tables': { params: z.object({}), result: z.array(z.string()) },
  'sql.query': {
    params: z.object({
      sql: z.string().min(1).max(20_000),
      maxRows: z.number().int().min(1).max(SQL_CONSOLE_MAX_ROWS).default(500),
    }),
    result: sqlResultSchema,
  },
} as const;

export type Routes = typeof routes;
export type RouteKey = keyof Routes;
export type RouteParams<K extends RouteKey> = z.infer<Routes[K]['params']>;
export type RouteResult<K extends RouteKey> = z.infer<Routes[K]['result']>;

export const ROUTE_KEYS = Object.keys(routes) as RouteKey[];

export function isRouteKey(value: string): value is RouteKey {
  return Object.prototype.hasOwnProperty.call(routes, value);
}
