import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DuckDBConnection,
  DuckDBInstance,
  type DuckDBResultReader,
} from '@duckdb/node-api';
import type { Appender, Db, QueryResult, SqlValue } from './Db.js';

function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object') {

    const v = value as { toString(): string };
    return v.toString();
  }
  return value;
}

function toParams(params: SqlValue[]): unknown[] | undefined {
  if (params.length === 0) return undefined;
  return params.map((p) => (p instanceof Date ? p.toISOString() : p));
}

function rowObjects<T>(result: DuckDBResultReader): T[] {
  const names = result.columnNames();
  return result.getRows().map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < names.length; i++) obj[names[i]!] = normalize(row[i]);
    return obj as T;
  });
}

const READ_ONLY_PREFIXES = [
  'select', 'with', 'from', 'describe', 'show', 'explain', 'summarize', 'pragma', 'table', 'values',
];

export function assertReadOnlySql(sql: string): void {
  const stripped = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .replace(/;\s*$/, '');

  if (stripped.includes(';')) {
    throw new Error('O console aceita uma consulta por vez.');
  }
  const first = stripped.toLowerCase().match(/^[a-z_]+/)?.[0] ?? '';
  if (!READ_ONLY_PREFIXES.includes(first)) {
    throw new Error(
      `"${first.toUpperCase()}" nao e permitido no console. Somente leitura: ` +
        READ_ONLY_PREFIXES.map((p) => p.toUpperCase()).join(', ') + '.',
    );
  }
}

export class DuckDb implements Db {

  #txQueue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly instance: DuckDBInstance,
    private readonly conn: DuckDBConnection,

    private readonly isTx = false,
  ) {}

  static async open(path: string): Promise<DuckDb> {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const instance = await DuckDBInstance.create(path);
    const conn = await instance.connect();
    return new DuckDb(instance, conn);
  }

  async query<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const bound = toParams(params);
    const result = bound
      ? await this.conn.runAndReadAll(sql, bound as never[])
      : await this.conn.runAndReadAll(sql);
    return rowObjects<T>(result);
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async exec(sql: string, params: SqlValue[] = []): Promise<void> {
    const bound = toParams(params);
    if (bound) await this.conn.run(sql, bound as never[]);
    else await this.conn.run(sql);
  }

  async rawConsoleQuery(sql: string, maxRows: number): Promise<QueryResult> {
    assertReadOnlySql(sql);
    const t0 = performance.now();

    const wrapped = `SELECT * FROM (${sql.replace(/;\s*$/, '')}) LIMIT ${maxRows + 1}`;
    const result = await this.conn.runAndReadAll(wrapped);
    const elapsedMs = performance.now() - t0;

    const all = result.getRows().map((row) => row.map(normalize));
    const truncated = all.length > maxRows;

    return {
      columns: result.columnNames().map((name, i) => ({
        name,
        type: String(result.columnTypes()[i]),
      })),
      rows: truncated ? all.slice(0, maxRows) : all,
      rowCount: truncated ? maxRows : all.length,
      elapsedMs: Math.round(elapsedMs * 100) / 100,
      truncated,
    };
  }

  async bulkInsert(table: string, columns: string[], rows: SqlValue[][]): Promise<number> {
    if (rows.length === 0) return 0;
    const placeholders = `(${columns.map(() => '?').join(', ')})`;
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
    const prepared = await this.conn.prepare(sql);
    for (const row of rows) {
      prepared.bind(toParams(row) as never[]);
      await prepared.run();
    }
    return rows.length;
  }

  async appender(table: string): Promise<Appender> {
    return (await this.conn.createAppender(table)) as unknown as Appender;
  }

  async attachAndMerge(
    stagingPath: string,
    tables: string[],
    beforeInsert?: (tx: Db) => Promise<void>,
  ): Promise<void> {
    const alias = 'staging_merge';

    await this.exec(`ATTACH '${stagingPath.replace(/'/g, "''")}' AS ${alias} (READ_ONLY)`);
    try {
      await this.transaction(async (tx) => {
        if (beforeInsert) await beforeInsert(tx);
        for (const table of tables) {
          await tx.exec(`INSERT INTO ${table} SELECT * FROM ${alias}.${table}`);
        }
      });
    } finally {
      await this.exec(`DETACH ${alias}`);
    }
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.isTx) {

      throw new Error('transacao aninhada nao e suportada: use o tx recebido');
    }
    const run = async () => {
      const conn = await this.instance.connect();
      const tx = new DuckDb(this.instance, conn, true);
      try {
        await tx.exec('BEGIN TRANSACTION');
        try {
          const out = await fn(tx);
          await tx.exec('COMMIT');
          return out;
        } catch (err) {
          await tx.exec('ROLLBACK').catch(() => undefined);
          throw err;
        }
      } finally {
        conn.closeSync();
      }
    };

    const next = this.#txQueue.then(run, run);
    this.#txQueue = next.catch(() => undefined);
    return next;
  }

  async listTables(): Promise<string[]> {
    const rows = await this.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'main' ORDER BY table_name`,
    );
    return rows.map((r) => r.table_name);
  }

  async checkpoint(): Promise<void> {
    await this.exec('CHECKPOINT');
  }

  async close(): Promise<void> {
    this.conn.closeSync();
    if (!this.isTx) this.instance.closeSync();
  }
}
