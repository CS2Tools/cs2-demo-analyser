import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import type { IngestProgress } from '@cs2/contract';
import { IngestQueue, processAlive } from '../src/runner.js';

let dir: string;
let db: DuckDb;
let queue: IngestQueue;
const published: IngestProgress[] = [];

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2ing-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
  published.length = 0;

  queue = new IngestQueue({
    db,
    dataDir: dir,
    mapsDir: join(dir, 'maps'),
    appVersion: '0.0.0-test',
    parserVersion: '0.0.0',
    getUserSteamId: () => null,
    getPoiSteamIds: () => [],
    publish: (p) => published.push(p),
    deleteMatch: async () => undefined,
  });
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('processAlive', () => {
  it('reconhece o proprio processo como vivo', () => {
    expect(processAlive(process.pid)).toBe(true);
  });

  it('trata PID ausente ou invalido como morto', () => {
    expect(processAlive(null)).toBe(false);
    expect(processAlive(undefined)).toBe(false);
    expect(processAlive(0)).toBe(false);
    expect(processAlive(-1)).toBe(false);
  });

  it('reconhece um PID inexistente como morto', () => {

    expect(processAlive(4_194_303)).toBe(false);
  });
});

async function insertJob(
  jobId: string,
  state: string,
  pid: number | null,
): Promise<void> {
  await db.exec(
    `INSERT INTO ingest_jobs (job_id, demo_path, file_name, sha256, state, progress, pid, started_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [jobId, 'C:/x.dem', 'x.dem', `sha-${jobId}`, state, pid, new Date()],
  );
}

const stateOf = async (jobId: string): Promise<string> =>
  (await db.queryOne<{ state: string }>('SELECT state FROM ingest_jobs WHERE job_id = ?', [jobId]))!
    .state;

describe('recoverInterrupted', () => {
  it('marca como interrompido o job cujo processo morreu', async () => {
    await insertJob('morto', 'running', 4_194_303);

    const report = await queue.recoverInterrupted();

    expect(report.interruptedJobs).toBe(1);
    expect(await stateOf('morto')).toBe('interrupted');
  });

  it('mata o worker ORFAO que sobreviveu ao app e marca o job', async () => {

    const orphan = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 60000)'], {
      stdio: 'ignore',
    });
    await new Promise((r) => setTimeout(r, 200));
    await insertJob('orfao', 'running', orphan.pid!);

    const report = await queue.recoverInterrupted();

    expect(report.interruptedJobs).toBe(1);
    expect(await stateOf('orfao')).toBe('interrupted');

    await new Promise((r) => setTimeout(r, 300));
    expect(orphan.killed || orphan.exitCode !== null || orphan.signalCode !== null).toBe(true);
    orphan.kill('SIGKILL');
  });

  it('recupera tambem jobs que ficaram na fila', async () => {
    await insertJob('enfileirado', 'queued', null);
    await queue.recoverInterrupted();
    expect(await stateOf('enfileirado')).toBe('interrupted');
  });

  it('nao toca em jobs ja finalizados', async () => {
    await insertJob('pronto', 'done', 4_194_303);
    await insertJob('falhou', 'error', 4_194_303);
    await insertJob('cancelado', 'cancelled', null);

    const report = await queue.recoverInterrupted();

    expect(report.interruptedJobs).toBe(0);
    expect(await stateOf('pronto')).toBe('done');
    expect(await stateOf('falhou')).toBe('error');
    expect(await stateOf('cancelado')).toBe('cancelled');
  });

  it('grava um motivo legivel no job interrompido', async () => {
    await insertJob('morto', 'running', 4_194_303);
    await queue.recoverInterrupted();

    const row = await db.queryOne<{ error: string; finished_at: string | null }>(
      'SELECT error, finished_at FROM ingest_jobs WHERE job_id = ?',
      ['morto'],
    );
    expect(row!.error).toMatch(/encerrado durante a ingestao/i);
    expect(row!.finished_at).not.toBeNull();
  });
});

describe('varredura de staging', () => {
  it('apaga bancos de staging e arquivos de job orfaos', async () => {
    const staging = join(dir, 'staging');
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, 'abc.duckdb'), 'lixo');
    writeFileSync(join(staging, 'abc.duckdb.wal'), 'lixo');
    writeFileSync(join(staging, 'def.job.json'), '{}');

    const report = await queue.recoverInterrupted();

    expect(report.orphanStagingFiles).toBe(3);
    expect(readdirSync(staging)).toHaveLength(0);
  });

  it('nao explode quando a pasta de staging nem existe', async () => {
    const report = await queue.recoverInterrupted();
    expect(report.orphanStagingFiles).toBe(0);
    expect(existsSync(join(dir, 'staging'))).toBe(false);
  });

  it('ignora arquivos que nao sao de staging', async () => {
    const staging = join(dir, 'staging');
    mkdirSync(staging, { recursive: true });
    writeFileSync(join(staging, 'anotacao.txt'), 'nao e meu');

    const report = await queue.recoverInterrupted();

    expect(report.orphanStagingFiles).toBe(0);
    expect(readdirSync(staging)).toEqual(['anotacao.txt']);
  });
});

describe('duplicatas', () => {
  it('reconhece uma demo ja ingerida pelo hash e NAO reprocessa sozinha', async () => {
    const demo = join(dir, 'demo.dem');
    writeFileSync(demo, 'conteudo qualquer');

    const { hashFile } = await import('../src/runner.js');
    const sha = await hashFile(demo);
    await db.exec(
      `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar,
                            tick_rate, tick_rate_source, ingested_at, schema_version)
       VALUES ('m1', ?, 'demo.dem', 'de_overpass', true, 64, 'inferred', ?, 2)`,
      [sha, new Date()],
    );

    const result = await queue.submit(demo, false);

    expect(result.state).toBe('duplicate');
    expect(result.matchId).toBe('m1');

    const last = published.at(-1)!;
    expect(last.duplicateOf).toBe('m1');
    expect(last.message).toMatch(/ja esta na biblioteca/i);

    const jobs = await db.query('SELECT * FROM ingest_jobs');
    expect(jobs).toHaveLength(0);
  });
});

describe('arquivo ilegivel', () => {
  it('fecha o ciclo de progresso em vez de deixar a barra presa', async () => {
    const inexistente = join(dir, 'nao-existe.dem');

    await expect(queue.submit(inexistente, false)).rejects.toThrow();

    expect(published[0]!.state).toBe('running');
    const last = published.at(-1)!;
    expect(last.state).toBe('error');
    expect(last.error).toMatch(/nao foi possivel ler o arquivo/i);

    expect(await db.query('SELECT * FROM ingest_jobs')).toHaveLength(0);
  });
});

describe('limpeza de staging', () => {
  it('removeStaging apaga tambem o .wal, que o DuckDB deixa ao lado', async () => {
    const { removeStaging } = await import('../src/runner.js');
    const staging = join(dir, 'staging');
    mkdirSync(staging, { recursive: true });

    const dbFile = join(staging, 'x.duckdb');
    writeFileSync(dbFile, 'banco');
    writeFileSync(`${dbFile}.wal`, 'wal de mais de um mega na vida real');
    const jobFile = join(staging, 'x.job.json');
    writeFileSync(jobFile, '{}');

    removeStaging(dbFile, jobFile);

    expect(existsSync(dbFile)).toBe(false);
    expect(existsSync(`${dbFile}.wal`)).toBe(false);
    expect(existsSync(jobFile)).toBe(false);
  });

  it('nao reclama quando os arquivos nem existem', async () => {
    const { removeStaging } = await import('../src/runner.js');
    expect(() => removeStaging(join(dir, 'nao-existe.duckdb'))).not.toThrow();
  });
});

describe('recentJobs', () => {
  it('devolve os jobs mais recentes primeiro', async () => {
    await insertJob('a', 'done', null);
    await insertJob('b', 'error', null);

    const jobs = await queue.recentJobs(10);

    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.jobId).sort()).toEqual(['a', 'b']);
    expect(jobs[0]!.fileName).toBe('x.dem');
  });
});
