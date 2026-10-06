import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDb, migrate } from '@cs2/db';
import type { IngestProgress } from '@cs2/contract';
import { IngestQueue } from '../src/runner.js';

let dir: string;
let db: DuckDb;
let queue: IngestQueue;
const published: IngestProgress[] = [];
const deleted: string[] = [];

const here = dirname(fileURLToPath(import.meta.url));

function fakeDemo(name: string): string {
  const path = join(dir, name);
  writeFileSync(path, `demo ${name} ${'x'.repeat(1024)}`, 'utf8');
  return path;
}

const QUEUE_TIMEOUT = 60_000;

async function waitForQueue(): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    const rows = await db.query<{ n: number }>(
      `SELECT COUNT(*)::INTEGER AS n FROM ingest_jobs WHERE state IN ('queued', 'running')`,
    );
    if (Number(rows[0]!.n) === 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('a fila nao terminou em 60 s');
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2queue-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
  published.length = 0;
  deleted.length = 0;
  mkdirSync(join(dir, 'maps'), { recursive: true });

  queue = new IngestQueue({
    db,
    dataDir: dir,
    mapsDir: join(dir, 'maps'),
    appVersion: '0.0.0-test',
    parserVersion: '0.0.0',
    getUserSteamId: () => null,
    getPoiSteamIds: () => [],
    publish: (p) => published.push(p),
    deleteMatch: async (tx, matchId) => {
      deleted.push(matchId);
      await tx.exec('DELETE FROM matches WHERE match_id = ?', [matchId]);
    },
    workerLauncher: {
      execPath: process.execPath,
      entry: join(here, 'fixtures', 'fake-worker.ts'),
      execArgv: ['--import', 'tsx'],
      env: process.env,
      schemaDir: join(here, '..', '..', 'db', 'src', 'schema'),
    },
  });
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('fila de importacao', () => {

  it('cada demo entra com o proprio hash, mesmo enfileiradas juntas', async () => {
    await queue.submit(fakeDemo('a.dem'));
    await queue.submit(fakeDemo('b.dem'));
    await queue.submit(fakeDemo('c.dem'));
    await waitForQueue();

    const matches = await db.query<{ file_name: string; demo_sha256: string }>(
      'SELECT file_name, demo_sha256 FROM matches',
    );
    expect(matches.map((m) => m.file_name).sort()).toEqual(['a.dem', 'b.dem', 'c.dem']);
    expect(new Set(matches.map((m) => m.demo_sha256)).size).toBe(3);

    expect(deleted).toEqual([]);
  }, QUEUE_TIMEOUT);

  it('a mesma demo de novo substitui a partida anterior, e so ela', async () => {
    const path = fakeDemo('a.dem');
    await queue.submit(path);
    await queue.submit(fakeDemo('b.dem'));
    await waitForQueue();

    const first = await db.queryOne<{ match_id: string }>(
      `SELECT match_id FROM matches WHERE file_name = 'a.dem'`,
    );

    await queue.submit(path, true);
    await waitForQueue();

    expect(deleted).toEqual([first!.match_id]);
    const rows = await db.query<{ file_name: string }>('SELECT file_name FROM matches');
    expect(rows.map((r) => r.file_name).sort()).toEqual(['a.dem', 'b.dem']);
  }, QUEUE_TIMEOUT);
});
