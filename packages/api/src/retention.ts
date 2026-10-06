import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '@cs2/db';
import { sweepStoredDemos } from '@cs2/ingest';

export interface RetentionResult {

  pruned: string[];

  demosRemoved: number;

  kept: number;
}

export async function applyRetention(db: Db, dataDir: string, keep: number): Promise<RetentionResult> {
  const rows = await db.query<{ match_id: string; bulk_state: string; pinned: boolean }>(
    `SELECT match_id, bulk_state, pinned FROM matches
      ORDER BY ingested_at DESC, match_id`,
  );

  if (keep <= 0) {
    return { pruned: [], kept: rows.length, demosRemoved: await sweepDemos(db, dataDir) };
  }

  const unpinned = rows.filter((r) => !r.pinned);
  const victims = unpinned.slice(keep).filter((r) => r.bulk_state !== 'pruned');

  for (const v of victims) {

    rmSync(bulkDir(dataDir, v.match_id), { recursive: true, force: true });
    await db.exec(`UPDATE matches SET bulk_state = 'pruned' WHERE match_id = ?`, [v.match_id]);
  }

  const alreadyPruned = rows.filter((r) => r.bulk_state === 'pruned').length;
  return {
    pruned: victims.map((v) => v.match_id),
    kept: rows.length - alreadyPruned - victims.length,
    demosRemoved: await sweepDemos(db, dataDir),
  };
}

async function sweepDemos(db: Db, dataDir: string): Promise<number> {
  const keep = await db.query<{ sha: string }>(
    `SELECT demo_sha256 AS sha FROM matches WHERE bulk_state <> 'pruned'
     UNION
     SELECT sha256 AS sha FROM ingest_jobs WHERE state IN ('queued', 'running')`,
  );
  return sweepStoredDemos(dataDir, new Set(keep.map((k) => k.sha))).length;
}

export function bulkDir(dataDir: string, matchId: string): string {
  return join(dataDir, 'bulk', matchId);
}

export async function refreshPlayerFlags(
  db: Db,
  userSteamId: string | null,
  poiSteamIds: string[],
): Promise<void> {
  const poi = poiSteamIds.length > 0 ? `steam_id IN (${poiSteamIds.map(() => '?').join(', ')})` : 'FALSE';
  await db.exec(
    `UPDATE player_match
        SET is_user = COALESCE(steam_id = ?, FALSE),
            is_poi  = ${poi}`,
    [userSteamId, ...poiSteamIds],
  );
}
