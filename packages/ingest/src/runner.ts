import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INGEST_STAGE_WEIGHTS,
  type IngestProgress,
  type IngestStage,
} from '@cs2/contract';
import type { Db } from '@cs2/db';
import type { IngestJob } from '@cs2/contract';
import type { IngestSummary, JobSpec, WorkerMessage } from './types.js';
import { ensureStoredDemo } from './demo-store.js';

export interface WorkerLauncher {
  execPath: string;
  entry: string;
  execArgv: string[];
  env: NodeJS.ProcessEnv;

  schemaDir?: string;
}

export function devWorkerLauncher(): WorkerLauncher {
  let here: string;
  try {
    here = dirname(fileURLToPath(import.meta.url));
  } catch {

    throw new Error(
      'devWorkerLauncher() nao funciona num build empacotado. ' +
        'Informe um workerLauncher proprio em IngestDeps.',
    );
  }
  return {
    execPath: process.execPath,
    entry: join(here, 'worker.ts'),
    execArgv: ['--import', 'tsx', '--max-old-space-size=4096'],
    env: process.env,
  };
}

const RSS_CEILING_MB = 3000;

const ACTIVE_STAGES: IngestStage[] = ['hash', 'probe', 'events', 'derive', 'merge'];
const TOTAL_WEIGHT = ACTIVE_STAGES.reduce((a, s) => a + INGEST_STAGE_WEIGHTS[s], 0);

function weightedProgress(stage: IngestStage, fraction: number): number {
  let done = 0;
  for (const s of ACTIVE_STAGES) {
    if (s === stage) break;
    done += INGEST_STAGE_WEIGHTS[s];
  }
  return Math.min(1, (done + INGEST_STAGE_WEIGHTS[stage] * fraction) / TOTAL_WEIGHT);
}

export function processAlive(pid: number | null | undefined): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export interface RecoveryReport {
  interruptedJobs: number;
  orphanStagingFiles: number;
}

export function removeStaging(stagingPath: string, jobFile?: string, bulkDir?: string): void {
  rmSync(stagingPath, { force: true });
  rmSync(`${stagingPath}.wal`, { force: true });
  if (jobFile) rmSync(jobFile, { force: true });

  if (bulkDir) rmSync(bulkDir, { recursive: true, force: true });
}

export async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export function voiceNote(v: IngestSummary['voice']): string {
  switch (v.status) {
    case 'ok':
      return `; voz de ${v.talkers} jogador(es), ${Math.round(v.speechSeconds / 60)} min de fala`;
    case 'failed':
      return `; sem voz (${v.detail ?? 'falha do extrator'})`;
    default:
      return '';
  }
}

export function killTree(pid: number | undefined, fallback: () => void): void {
  if (pid === undefined) return fallback();
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      return;
    } catch {

    }
  }
  fallback();
}

export interface IngestDeps {
  db: Db;
  dataDir: string;

  mapsDir: string;
  appVersion: string;
  parserVersion: string;
  getUserSteamId: () => string | null;
  getPoiSteamIds: () => string[];
  publish: (progress: IngestProgress) => void;

  deleteMatch: (tx: Db, matchId: string) => Promise<void>;

  workerLauncher?: WorkerLauncher;

  afterMerge?: (matchId: string) => Promise<void>;

  voiceExtractorDir?: string;
}

export interface SubmitResult {
  jobId: string;
  state: 'queued' | 'duplicate';
  matchId: string | null;
}

interface QueueItem {
  jobId: string;

  demoPath: string;

  fileName: string;

  originalPath: string;

  sha256: string;

  originalMtimeMs: number | null;
}

export interface OriginalIdentity {
  fileName: string;
  originalPath: string;
}

export class IngestQueue {
  #queue: QueueItem[] = [];
  #current: { jobId: string; child: ChildProcess } | null = null;
  #currentStaging: { stagingPath: string; jobFile: string } | null = null;
  #cancelled = new Set<string>();

  constructor(private readonly deps: IngestDeps) {}

  get isBusy(): boolean {
    return this.#current !== null;
  }

  async recoverInterrupted(): Promise<RecoveryReport> {
    const running = await this.deps.db.query<{ job_id: string; pid: number | null }>(
      `SELECT job_id, pid FROM ingest_jobs WHERE state IN ('running', 'queued')`,
    );

    let interruptedJobs = 0;
    for (const job of running) {

      if (processAlive(job.pid)) {
        killTree(job.pid!, () => {
          try {
            process.kill(job.pid!, 'SIGKILL');
          } catch {

          }
        });
      }
      await this.deps.db.exec(
        `UPDATE ingest_jobs SET state='interrupted', error=?, finished_at=? WHERE job_id=?`,
        ['O app foi encerrado durante a ingestao.', new Date(), job.job_id],
      );
      interruptedJobs++;
    }

    const orphanStagingFiles = this.#sweepStaging();
    return { interruptedJobs, orphanStagingFiles };
  }

  #sweepStaging(): number {
    const dir = join(this.deps.dataDir, 'staging');
    if (!existsSync(dir)) return 0;

    let removed = 0;
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.duckdb') && !entry.endsWith('.job.json') && !entry.endsWith('.wal')) {
        continue;
      }

      if (this.#currentStaging) {
        const active = [this.#currentStaging.stagingPath, this.#currentStaging.jobFile];
        if (active.some((p) => p.endsWith(entry))) continue;
      }
      rmSync(join(dir, entry), { force: true });
      removed++;
    }
    return removed;
  }

  async submit(demoPath: string, force = false, original?: OriginalIdentity): Promise<SubmitResult> {
    const fileName = original?.fileName ?? basename(demoPath);
    const originalPath = original?.originalPath ?? demoPath;
    const jobId = randomUUID();

    this.#emit({ jobId, fileName, state: 'running', stage: 'hash', progress: 0 });

    let sha256: string;
    try {
      sha256 = await hashFile(demoPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#emit({
        jobId, fileName, state: 'error', stage: null, progress: 0,
        error: `Nao foi possivel ler o arquivo: ${message}`,
      });
      throw err;
    }

    if (!force) {
      const existing = await this.deps.db.queryOne<{ match_id: string }>(
        'SELECT match_id FROM matches WHERE demo_sha256 = ?',
        [sha256],
      );
      if (existing) {

        this.#emit({
          jobId, fileName, state: 'done', stage: null, progress: 1,
          matchId: existing.match_id,
          duplicateOf: existing.match_id,
          message: 'Esta demo ja esta na biblioteca.',
        });
        return { jobId, state: 'duplicate', matchId: existing.match_id };
      }
    }

    await this.deps.db.exec(
      `INSERT INTO ingest_jobs (job_id, demo_path, file_name, sha256, state, progress, started_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?)`,
      [jobId, demoPath, fileName, sha256, new Date()],
    );

    let originalMtimeMs: number | null = null;
    try {
      originalMtimeMs = statSync(demoPath).mtimeMs;
    } catch {
      originalMtimeMs = null;
    }

    this.#queue.push({ jobId, demoPath, fileName, originalPath, sha256, originalMtimeMs });
    this.#emit({ jobId, fileName, state: 'queued', stage: null, progress: 0 });
    void this.#pump();
    return { jobId, state: 'queued', matchId: null };
  }

  cancel(jobId: string): boolean {
    this.#cancelled.add(jobId);
    if (this.#current?.jobId === jobId) {

      killTree(this.#current.child.pid, () => this.#current?.child.kill('SIGKILL'));
      return true;
    }
    const before = this.#queue.length;
    this.#queue = this.#queue.filter((q) => q.jobId !== jobId);
    return this.#queue.length < before;
  }

  async #pump(): Promise<void> {
    if (this.#current || this.#queue.length === 0) return;
    const item = this.#queue.shift()!;
    if (this.#cancelled.has(item.jobId)) return void this.#pump();

    try {
      await this.#run(item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.#finish(item.jobId, 'error', message);
      this.#emit({
        jobId: item.jobId, fileName: item.fileName, state: 'error',
        stage: null, progress: 0, error: message,
      });
    } finally {
      this.#current = null;
      void this.#pump();
    }
  }

  async #run(item: QueueItem): Promise<void> {
    const { sha256 } = item;
    const matchId = randomUUID();
    const stagingDir = join(this.deps.dataDir, 'staging');
    mkdirSync(stagingDir, { recursive: true });
    const stagingPath = join(stagingDir, `${matchId}.duckdb`);
    const jobFile = join(stagingDir, `${item.jobId}.job.json`);

    const bulkDir = join(this.deps.dataDir, 'bulk', matchId);

    this.#emitStage(item, 'hash', 0.5, Date.now(), 'copiando para a biblioteca');
    const stored = ensureStoredDemo(this.deps.dataDir, item.demoPath, sha256);

    const spec: JobSpec = {
      jobId: item.jobId,
      demoPath: stored,
      originalPath: item.originalPath,
      originalMtimeMs: item.originalMtimeMs ?? null,
      fileName: item.fileName,
      fileSizeBytes: statSync(stored).size,
      sha256,
      stagingPath,
      bulkDir,
      matchId,
      appVersion: this.deps.appVersion,
      parserVersion: this.deps.parserVersion,
      userSteamId: this.deps.getUserSteamId(),
      poiSteamIds: this.deps.getPoiSteamIds(),
      schemaDir: this.deps.workerLauncher?.schemaDir,
      mapsDir: this.deps.mapsDir,
      voiceExtractorDir: this.deps.voiceExtractorDir,
    };
    writeFileSync(jobFile, JSON.stringify(spec), 'utf8');

    const startedAt = Date.now();
    await this.deps.db.exec(
      `UPDATE ingest_jobs SET state='running', match_id=?, started_at=? WHERE job_id=?`,
      [matchId, new Date(), item.jobId],
    );
    this.#currentStaging = { stagingPath, jobFile };

    const summary = await this.#spawnWorker(item, spec, jobFile, startedAt, bulkDir);
    if (!summary) return;

    this.#emitStage(item, 'merge', 0, startedAt);
    const replaced = await this.deps.db.queryOne<{ match_id: string }>(
      'SELECT match_id FROM matches WHERE demo_sha256 = ?',
      [sha256],
    );
    await this.deps.db.attachAndMerge(stagingPath, summary.tables, async (tx) => {
      if (replaced) await this.deps.deleteMatch(tx, replaced.match_id);
    });

    const landed = await this.deps.db.queryOne<{ n: number }>(
      'SELECT COUNT(*)::INTEGER AS n FROM matches WHERE match_id = ?',
      [matchId],
    );
    if (Number(landed?.n ?? 0) !== 1) {
      throw new Error(
        'a importacao terminou sem gravar a partida na biblioteca ' +
          `(match_id ${matchId}). Nada foi perdido: tente importar de novo.`,
      );
    }
    if (replaced) {
      rmSync(join(this.deps.dataDir, 'bulk', replaced.match_id), {
        recursive: true,
        force: true,
      });
    }
    await this.#refreshPlayers(matchId);

    await this.deps.afterMerge?.(matchId).catch(() => undefined);
    this.#emitStage(item, 'merge', 1, startedAt);

    removeStaging(stagingPath, jobFile);

    await this.#finish(item.jobId, 'done', null, matchId);
    this.#emit({
      jobId: item.jobId, fileName: item.fileName, state: 'done',
      stage: null, progress: 1, matchId,
      message:
        `${summary.liveRounds} rounds` +
        (summary.discardedRounds > 0 ? `, ${summary.discardedRounds} descartado(s)` : '') +
        (summary.knifeRoundTick !== null ? ' incluindo o round faca' : '') +
        voiceNote(summary.voice),
      elapsedMs: Date.now() - startedAt,
    });
  }

  #spawnWorker(
    item: QueueItem,
    spec: JobSpec,
    jobFile: string,
    startedAt: number,
    bulkDir: string,
  ): Promise<IngestSummary | null> {
    return new Promise((resolve, reject) => {

      const launcher = this.deps.workerLauncher ?? devWorkerLauncher();
      const child = spawn(
        launcher.execPath,
        [...launcher.execArgv, launcher.entry, jobFile],
        { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: launcher.env },
      );
      this.#current = { jobId: item.jobId, child };

      if (child.pid !== undefined) {
        void this.deps.db.exec('UPDATE ingest_jobs SET pid=? WHERE job_id=?', [
          child.pid,
          item.jobId,
        ]);
      }

      let summary: IngestSummary | null = null;
      let failure: string | null = null;
      let rejection: { reason: 'pov' | 'unsupported'; message: string } | null = null;
      let stderr = '';

      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      child.on('message', (raw: unknown) => {
        const msg = raw as WorkerMessage;
        switch (msg.type) {
          case 'progress':
            this.#emitStage(item, msg.stage, msg.fraction, startedAt, msg.message);
            break;
          case 'rejected':

            rejection = { reason: msg.reason, message: msg.message };
            break;
          case 'done':
            summary = msg.summary;
            break;
          case 'error':
            failure = msg.message;
            break;
        }
      });

      child.on('close', (code, signal) => {
        this.#current = null;

        if (this.#cancelled.has(item.jobId)) {
          removeStaging(spec.stagingPath, jobFile, bulkDir);
          void this.#finish(item.jobId, 'cancelled', null);
          this.#emit({
            jobId: item.jobId, fileName: item.fileName, state: 'cancelled',
            stage: null, progress: 0,
          });
          return resolve(null);
        }

        if (rejection) {
          removeStaging(spec.stagingPath, jobFile, bulkDir);
          void this.#finish(item.jobId, 'rejected', rejection.message);
          this.#emit({
            jobId: item.jobId, fileName: item.fileName, state: 'rejected',
            stage: null, progress: 0,
            error: rejection.message,
            rejectedReason: rejection.reason,
          });
          return resolve(null);
        }

        if (failure) {
          removeStaging(spec.stagingPath, jobFile, bulkDir);
          void this.#finish(item.jobId, 'error', failure);
          this.#emit({
            jobId: item.jobId, fileName: item.fileName, state: 'error',
            stage: null, progress: 0, error: failure,
          });
          return resolve(null);
        }

        if (code !== 0 || !summary) {
          removeStaging(spec.stagingPath, jobFile, bulkDir);
          return reject(
            new Error(
              `worker terminou com codigo ${code}${signal ? ` (${signal})` : ''}` +
                (stderr ? `: ${stderr.trim().split('\n').slice(-3).join(' | ')}` : ''),
            ),
          );
        }
        resolve(summary);
      });

      child.on('error', reject);
    });
  }

  async #refreshPlayers(matchId: string): Promise<void> {
    await this.deps.db.exec(
      `INSERT INTO players (steam_id, last_known_name, first_seen, last_seen, matches_count)
       SELECT pm.steam_id, pm.name, m.ingested_at, m.ingested_at, 1
         FROM player_match pm JOIN matches m USING (match_id)
        WHERE pm.match_id = ?
       ON CONFLICT (steam_id) DO UPDATE SET
         last_known_name = excluded.last_known_name,
         last_seen       = excluded.last_seen,
         matches_count   = players.matches_count + 1`,
      [matchId],
    );
  }

  async #finish(jobId: string, state: string, error: string | null, matchId?: string): Promise<void> {
    await this.deps.db.exec(
      `UPDATE ingest_jobs SET state=?, error=?, match_id=COALESCE(?, match_id), finished_at=?
        WHERE job_id=?`,
      [state, error, matchId ?? null, new Date(), jobId],
    );
  }

  #emitStage(
    item: QueueItem,
    stage: IngestStage,
    fraction: number,
    startedAt: number,
    message?: string,
  ): void {
    const progress = weightedProgress(stage, fraction);
    const elapsedMs = Date.now() - startedAt;
    this.#emit({
      jobId: item.jobId,
      fileName: item.fileName,
      state: 'running',
      stage,
      progress,
      message: message ?? null,
      elapsedMs,
      etaMs: progress > 0.02 ? Math.round(elapsedMs / progress - elapsedMs) : null,
    });
  }

  #emit(partial: Partial<IngestProgress> & Pick<IngestProgress, 'jobId' | 'fileName' | 'state'>): void {
    this.deps.publish({
      stage: null,
      progress: 0,
      message: null,
      error: null,
      matchId: null,
      elapsedMs: 0,
      etaMs: null,
      rejectedReason: null,
      duplicateOf: null,
      ...partial,
    });
  }

  async recentJobs(limit = 20): Promise<IngestJob[]> {
    const rows = await this.deps.db.query<{
      job_id: string; file_name: string; state: string; error: string | null;
      match_id: string | null; started_at: string | null; finished_at: string | null;
    }>(
      `SELECT job_id, file_name, state, error, match_id, started_at, finished_at
         FROM ingest_jobs ORDER BY started_at DESC LIMIT ${Math.max(1, Math.trunc(limit))}`,
    );
    return rows.map((r) => ({
      jobId: r.job_id,
      fileName: r.file_name,
      state: r.state as IngestJob['state'],
      error: r.error,
      matchId: r.match_id,
      startedAt: r.started_at === null ? null : String(r.started_at),
      finishedAt: r.finished_at === null ? null : String(r.finished_at),
    }));
  }
}

export { RSS_CEILING_MB };
