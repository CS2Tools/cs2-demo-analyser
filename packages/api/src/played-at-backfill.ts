import { playedAtFromFileName } from '@cs2/ingest';
import { toSqlTimestamp, type Db } from '@cs2/db';

export interface PlayedAtBackfill {

  filled: string[];

  unknown: number;
}

export async function ensurePlayedAt(db: Db): Promise<PlayedAtBackfill> {
  const pending = await db.query<{ match_id: string; file_name: string }>(
    `SELECT match_id, file_name FROM matches
      WHERE played_at IS NULL AND played_at_source IS NULL`,
  );
  if (pending.length === 0) return { filled: [], unknown: 0 };

  const filled: string[] = [];
  let unknown = 0;

  for (const m of pending) {
    const at = playedAtFromFileName(m.file_name);
    if (at === null) {
      unknown += 1;
      continue;
    }
    const stamp = toSqlTimestamp(at);
    await db.transaction(async (tx) => {
      await tx.exec(
        `UPDATE matches SET played_at = ?, played_at_source = 'filename' WHERE match_id = ?`,
        [stamp, m.match_id],
      );

      await tx.exec('UPDATE player_metric_history SET played_at = ? WHERE match_id = ?', [
        stamp,
        m.match_id,
      ]);
    });
    filled.push(m.match_id);
  }

  return { filled, unknown };
}
