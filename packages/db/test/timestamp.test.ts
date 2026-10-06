import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb } from '../src/duckdb.js';
import { toSqlTimestamp } from '../src/timestamp.js';

let dir: string;
let db: DuckDb;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2ts-'));
  db = await DuckDb.open(join(dir, 'a.duckdb'));
  await db.exec('CREATE TABLE t (quando TIMESTAMP)');
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('toSqlTimestamp', () => {
  it('formata os componentes LOCAIS, sem converter nada', () => {
    expect(toSqlTimestamp(new Date(2026, 8, 9, 22, 58, 3))).toBe('2026-09-09 22:58:03');
    expect(toSqlTimestamp(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01 00:00:00');
  });

  it('o horario volta do banco igual ao que entrou', async () => {
    await db.exec('INSERT INTO t VALUES (?)', [toSqlTimestamp(new Date(2026, 8, 9, 22, 58))]);
    const row = await db.queryOne<{ texto: string }>('SELECT CAST(quando AS VARCHAR) AS texto FROM t');
    expect(row!.texto.startsWith('2026-09-09 22:58')).toBe(true);
  });

  it('gravar um Date direto desloca pelo fuso — e e por isso que isto existe', async () => {
    const local = new Date(2026, 8, 9, 22, 58);
    await db.exec('INSERT INTO t VALUES (?)', [local]);
    const row = await db.queryOne<{ texto: string }>('SELECT CAST(quando AS VARCHAR) AS texto FROM t');
    const deslocado = row!.texto.slice(0, 16) !== '2026-09-09 22:58';

    expect(deslocado).toBe(local.getTimezoneOffset() !== 0);
  });
});
