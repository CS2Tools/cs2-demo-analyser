import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import {
  routes,
  type MapInfo,
  type RouteKey,
  type RouteParams,
  type RouteResult,
} from '@cs2/contract';
import { hasRadar, parseMapMeta } from '@cs2/radar';
import { deleteMatch, getMatch, listMatches } from './match-queries.js';
import { ensurePlayedAt } from './played-at-backfill.js';
import { ensureRoster, getMatchRoster } from './roster-queries.js';
import { getMatchChat } from './chat-queries.js';
import { getLineups, getTeamMatchReport } from './team-queries.js';
import { getRoundReplay } from './replay-queries.js';
import {
  EXAMPLE_QUERIES,
  exploreCatalog,
  listSavedQueries,
  removeSavedQuery,
  runExplore,
  saveQuery,
} from './explore/queries.js';
import {
  getRoundThrows,
  getUtilityMaps,
  listCollection,
  removeFromCollection,
  renameInCollection,
  saveToCollection,
} from './lineup-queries.js';
import { getMatchAnalysis } from './analysis-queries.js';
import { getMatchFindings } from './findings-queries.js';
import { getPlayerProfile, listPlayers } from './player-queries.js';
import { applyRetention, refreshPlayerFlags } from './retention.js';
import { exportLibrary, exportMatch } from './export.js';
import { getStorage } from './storage.js';
import { getDiagnostics } from './diagnostics.js';
import type { ApiContext } from './context.js';

export type Handler<K extends RouteKey> = (
  params: RouteParams<K>,
  ctx: ApiContext,
) => Promise<RouteResult<K>>;

export type Handlers = { [K in RouteKey]: Handler<K> };

let mapCache: MapInfo[] | null = null;

function listMaps(mapsDir: string): MapInfo[] {
  if (mapCache) return mapCache;
  const dirs = readdirSync(mapsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  mapCache = dirs.map((name) => {
    const meta = parseMapMeta(name, readFileSync(join(mapsDir, name, 'meta.json5'), 'utf8'));
    return {
      name,
      hasRadar: hasRadar(name),
      resolution: meta.resolution,
      offset: meta.offset,
      splitCount: meta.splits.length,
    };
  });
  return mapCache;
}

export const handlers: Handlers = {
  'app.health': async (_params, ctx) => ({
    ok: true,
    appVersion: ctx.appVersion,
    transport: ctx.transportKind,
    offline: true,
  }),

  'app.storage': async (_params, ctx) => getStorage(ctx.dataDir),

  'app.diagnostics': async (_params, ctx) =>
    getDiagnostics({
      db: ctx.db,
      dataDir: ctx.dataDir,
      appVersion: ctx.appVersion,
      transport: ctx.transportKind,
      voiceExtractorDir: ctx.voiceExtractorDir,
      maps: listMaps(ctx.mapsDir),
    }),

  'settings.get': async (_params, ctx) => ctx.settings.get(),

  'settings.set': async (patch, ctx) => {
    const next = ctx.settings.set(patch);

    await refreshPlayerFlags(
      ctx.db,
      next.userSteamId,
      next.playersOfInterest.map((p) => p.steamId),
    );
    await applyRetention(ctx.db, ctx.dataDir, next.retentionBulkMatches);
    return next;
  },

  'maps.list': async (_params, ctx) => listMaps(ctx.mapsDir),

  'explore.catalog': async () => exploreCatalog(),

  'explore.query': async (spec, ctx) => runExplore(ctx.db, spec),

  'explore.examples': async () =>
    EXAMPLE_QUERIES.map((q, i) => ({
      queryId: `exemplo-${i}`,
      name: q.name,
      spec: q.spec,
      createdAt: new Date(0).toISOString(),
    })),

  'queries.list': async (_params, ctx) => listSavedQueries(ctx.db),

  'queries.save': async (params, ctx) => saveQuery(ctx.db, params),

  'queries.remove': async ({ queryId }, ctx) => ({
    removed: await removeSavedQuery(ctx.db, queryId),
  }),

  'utility.maps': async (_params, ctx) => getUtilityMaps(ctx.db),

  'utility.roundThrows': async (query, ctx) => getRoundThrows(ctx.db, ctx.mapsDir, query),

  'collection.list': async ({ mapName }, ctx) => listCollection(ctx.db, ctx.mapsDir, mapName),

  'collection.save': async (params, ctx) => saveToCollection(ctx.db, ctx.mapsDir, params),

  'collection.rename': async (params, ctx) => renameInCollection(ctx.db, ctx.mapsDir, params),

  'collection.remove': async ({ lineupId }, ctx) => ({
    removed: await removeFromCollection(ctx.db, lineupId),
  }),

  'matches.list': async ({ filter }, ctx) => {

    await ensurePlayedAt(ctx.db);

    await ensureRoster(ctx.db);
    return listMatches(ctx.db, filter);
  },

  'players.list': async (params, ctx) => listPlayers(ctx.db, ctx.settings.get(), params),

  'player.profile': async ({ steamId, lastMatches }, ctx) =>
    getPlayerProfile(ctx.db, steamId, lastMatches, ctx.settings.get()),

  'match.get': async ({ matchId }, ctx) => getMatch(ctx.db, matchId),

  'match.analysis': async ({ matchId }, ctx) => getMatchAnalysis(ctx.db, matchId, ctx.mapsDir),

  'match.findings': async ({ matchId }, ctx) =>
    getMatchFindings(ctx.db, matchId, ctx.settings.get()),

  'match.chat': async ({ matchId }, ctx) => getMatchChat(ctx.db, matchId),

  'match.roster': async ({ matchId }, ctx) => {
    await ensureRoster(ctx.db);
    return getMatchRoster(ctx.db, matchId);
  },

  'team.match': async ({ matchId }, ctx) => {
    await ensureRoster(ctx.db);
    return getTeamMatchReport(ctx.db, matchId, ctx.mapsDir);
  },
  'team.lineups': async (_params, ctx) => {
    await ensureRoster(ctx.db);
    return getLineups(ctx.db);
  },

  'match.pin': async ({ matchId, pinned }, ctx) => {
    await ctx.db.exec('UPDATE matches SET pinned = ? WHERE match_id = ?', [pinned, matchId]);

    const { pruned } = await applyRetention(
      ctx.db, ctx.dataDir, ctx.settings.get().retentionBulkMatches,
    );
    return { ok: true, pruned };
  },

  'match.reprocess': async ({ matchId }, ctx) => {
    const m = await ctx.db.queryOne<{
      stored_demo_path: string | null; file_path: string | null; file_name: string;
    }>(
      'SELECT stored_demo_path, file_path, file_name FROM matches WHERE match_id = ?',
      [matchId],
    );
    if (!m) throw new Error(`Partida nao encontrada: ${matchId}`);

    const source = m.stored_demo_path && existsSync(m.stored_demo_path)
      ? 'stored'
      : m.file_path && existsSync(m.file_path)
        ? 'original'
        : 'missing';
    if (source === 'missing') return { jobId: null, source, originalPath: m.file_path };
    const path = source === 'stored' ? m.stored_demo_path! : m.file_path!;

    const r = await ctx.ingest.submit(path, true, {
      fileName: m.file_name,
      originalPath: m.file_path ?? path,
    });
    return { jobId: r.jobId, source, originalPath: m.file_path };
  },

  'match.delete': async ({ matchId }, ctx) => {
    await deleteMatch(ctx.db, matchId);
    return { ok: true };
  },

  'ingest.submit': async ({ path, force }, ctx) => ctx.ingest.submit(path, force),

  'ingest.cancel': async ({ jobId }, ctx) => ({ cancelled: ctx.ingest.cancel(jobId) }),

  'ingest.jobs': async (_params, ctx) => ctx.ingest.recentJobs(20),

  'replay.round': async ({ matchId, roundNum }, ctx) =>
    getRoundReplay(ctx.db, ctx.dataDir, ctx.mapsDir, matchId, roundNum),

  'export.match': async ({ matchId }, ctx) => exportMatch(ctx, matchId),

  'export.library': async (_params, ctx) => exportLibrary(ctx),

  'app.reveal': async ({ path }, ctx) => {

    const target = resolve(path);
    const root = resolve(ctx.exportsDir);
    if (!ctx.reveal || !(target === root || target.startsWith(root + sep))) {
      return { ok: false };
    }
    ctx.reveal(target);
    return { ok: true };
  },

  'sql.tables': async (_params, ctx) => ctx.db.listTables(),

  'sql.query': async ({ sql, maxRows }, ctx) => ctx.db.rawConsoleQuery(sql, maxRows),
};

export async function invoke<K extends RouteKey>(
  route: K,
  rawParams: unknown,
  ctx: ApiContext,
): Promise<RouteResult<K>> {
  const def = routes[route];
  const params = def.params.parse(rawParams) as RouteParams<K>;
  const result = await handlers[route](params, ctx);
  return def.result.parse(result) as RouteResult<K>;
}
