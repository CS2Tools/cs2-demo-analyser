import { RULES_VERSION } from '@cs2/core';
import type { Diagnostics, MapInfo } from '@cs2/contract';
import { SCHEMA_VERSION, type Db } from '@cs2/db';
import { VOICE_EXE, voiceExtractorAvailable } from '@cs2/ingest';
import { getStorage } from './storage.js';

const iso = (v: Date | string | null): string | null =>
  v === null || v === undefined ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();

export interface DiagnosticsInput {
  db: Db;
  dataDir: string;
  appVersion: string;
  transport: 'http' | 'ipc';
  voiceExtractorDir?: string;

  maps: MapInfo[];
}

export async function getDiagnostics(input: DiagnosticsInput): Promise<Diagnostics> {
  const { db } = input;

  const library = await db.queryOne<{
    matches: number; pruned: number; pinned: number;
    with_voice: number; oldest: Date | string | null; newest: Date | string | null;
  }>(
    `SELECT COUNT(*)::INTEGER AS matches,
            SUM(CASE WHEN bulk_state = 'pruned' THEN 1 ELSE 0 END)::INTEGER AS pruned,
            SUM(CASE WHEN pinned THEN 1 ELSE 0 END)::INTEGER AS pinned,
            SUM(CASE WHEN has_voice THEN 1 ELSE 0 END)::INTEGER AS with_voice,
            MIN(COALESCE(played_at, ingested_at)) AS oldest,
            MAX(COALESCE(played_at, ingested_at)) AS newest
       FROM matches`,
  );

  const players = await db.queryOne<{ n: number }>(
    'SELECT COUNT(DISTINCT steam_id)::INTEGER AS n FROM player_match',
  );

  const builds = await db.query<{
    build: string | null; format: string | null; matches: number; newest: Date | string | null;
  }>(
    `SELECT demo_build AS build, demo_format AS format,
            COUNT(*)::INTEGER AS matches,
            MAX(COALESCE(played_at, ingested_at)) AS newest
       FROM matches
      GROUP BY demo_build, demo_format
      ORDER BY newest DESC NULLS LAST`,
  );

  const byMap = new Map<string, number>();
  for (const r of await db.query<{ map_name: string; n: number }>(
    'SELECT map_name, COUNT(*)::INTEGER AS n FROM matches GROUP BY map_name',
  )) {
    byMap.set(r.map_name, Number(r.n));
  }

  const known = new Set(input.maps.map((m) => m.name));
  const matches = Number(library?.matches ?? 0);
  const withVoice = Number(library?.with_voice ?? 0);

  return {
    app: {
      version: input.appVersion,
      transport: input.transport,
      schemaVersion: SCHEMA_VERSION,
      rulesVersion: RULES_VERSION,
    },
    storage: getStorage(input.dataDir),
    library: {
      matches,
      pruned: Number(library?.pruned ?? 0),
      pinned: Number(library?.pinned ?? 0),
      players: Number(players?.n ?? 0),
      oldest: iso(library?.oldest ?? null),
      newest: iso(library?.newest ?? null),
    },
    builds: builds.map((b) => ({
      build: b.build,
      format: b.format,
      matches: Number(b.matches),
      newest: iso(b.newest),
    })),
    voice: {
      extractorInstalled: voiceExtractorAvailable(input.voiceExtractorDir),
      extractorDir: input.voiceExtractorDir ?? null,
      withVoice,
      withoutVoice: matches - withVoice,
    },

    radars: input.maps.map((m) => ({
      name: m.name,
      matches: byMap.get(m.name) ?? 0,
      splitCount: m.splitCount,
    })),
    mapsWithoutRadar: [...byMap.entries()]
      .filter(([name]) => !known.has(name))
      .map(([name, n]) => ({ name, matches: n }))
      .sort((a, b) => b.matches - a.matches),
  };
}

export { VOICE_EXE };
