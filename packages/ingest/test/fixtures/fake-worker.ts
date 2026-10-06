import { readFileSync } from 'node:fs';
import { DuckDb, migrate } from '@cs2/db';

interface Spec {
  matchId: string;
  sha256: string;
  fileName: string;
  stagingPath: string;
}

const spec = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Spec;

const db = await DuckDb.open(spec.stagingPath);
await migrate(db);
await db.exec(
  `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar,
                        tick_rate, tick_rate_source, ingested_at, schema_version,
                        bulk_state, pinned)
   VALUES (?, ?, ?, 'de_teste', TRUE, 64, 'inferred', ?, 1, 'pruned', FALSE)`,
  [spec.matchId, spec.sha256, spec.fileName, new Date()],
);
await db.close();

process.send?.({
  type: 'done',
  summary: {
    matchId: spec.matchId,
    mapName: 'de_teste',
    tickRate: 64,
    liveRounds: 1,
    discardedRounds: 0,
    knifeRoundTick: null,
    restartCount: 0,
    durationMs: 1,
    peakRssMb: 1,
    replayRows: 0,
    replayStride: 8,
    grenades: 0,
    detonations: 0,
    windowRows: 0,
    interestTicks: 0,
    economyRows: 0,
    engagements: 0,
    heatmapBins: 0,
    voice: { status: 'unavailable', talkers: 0, segments: 0, speechSeconds: 0, bytes: 0, detail: 'teste' },
    bulkState: 'pruned',
    tables: ['matches'],
    validation: [],
  },
});
