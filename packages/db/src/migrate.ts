import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './Db.js';

function defaultSchemaDir(): string | null {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), 'schema');
  } catch {
    return null;
  }
}

let schemaDir: string | null = defaultSchemaDir();

export function setSchemaDir(dir: string): void {
  schemaDir = dir;
}

export const SCHEMA_VERSION = 20;

interface Migration {
  version: number;
  name: string;
  sql: string;
}

function load(version: number, name: string): Migration {
  if (!schemaDir) {
    throw new Error(
      'Diretorio de schema desconhecido. Num build empacotado, chame setSchemaDir() antes de migrate().',
    );
  }
  return {
    version,
    name,
    sql: readFileSync(join(schemaDir, `${String(version).padStart(3, '0')}_${name}.sql`), 'utf8'),
  };
}

function migrations(): Migration[] {
  return [load(1, 'init'), load(2, 'team_score'), load(3, 'aim_duels_guns_only'), load(4, 'voice_rounds'), load(5, 'stored_demo'), load(6, 'hud_data'), load(7, 'utility_deep'), load(8, 'flash_distance'), load(9, 'event_ids'), load(10, 'utility_throws'), load(11, 'saved_queries'), load(12, 'demo_build'), load(13, 'metrics_version'), load(14, 'hitgroup'), load(15, 'round_stats_version'), load(16, 'round_states'), load(17, 'team_color'), load(18, 'played_at_source'), load(19, 'drop_players_of_interest'), load(20, 'roster_complete')];
}

const checksum = (sql: string) => createHash('sha256').update(sql).digest('hex').slice(0, 16);

export async function migrate(db: Db): Promise<{ applied: number[]; current: number }> {

  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, applied_at TIMESTAMP NOT NULL, checksum VARCHAR NOT NULL)`);

  const done = await db.query<{ version: number; checksum: string }>(
    'SELECT version, checksum FROM schema_migrations',
  );
  const doneMap = new Map(done.map((r) => [Number(r.version), r.checksum]));
  const applied: number[] = [];

  for (const m of migrations()) {
    const sum = checksum(m.sql);
    const existing = doneMap.get(m.version);

    if (existing !== undefined) {
      if (existing !== sum) {

        throw new Error(
          `A migracao ${m.version} (${m.name}) mudou depois de aplicada ` +
            `(${existing} -> ${sum}). Crie uma migracao nova em vez de editar a antiga.`,
        );
      }
      continue;
    }

    for (const statement of splitStatements(m.sql)) {
      await db.exec(statement);
    }
    await db.exec(
      'INSERT INTO schema_migrations (version, applied_at, checksum) VALUES (?, ?, ?)',
      [m.version, new Date(), sum],
    );
    applied.push(m.version);
  }

  return { applied, current: SCHEMA_VERSION };
}

export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      buf += ch;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        buf += '*/';
        i++;
        continue;
      }
      buf += ch;
      continue;
    }
    if (!inString && ch === '-' && next === '-') {
      inLineComment = true;
      buf += ch;
      continue;
    }
    if (!inString && ch === '/' && next === '*') {
      inBlockComment = true;
      buf += '/*';
      i++;
      continue;
    }
    if (ch === "'") {
      inString = !inString;
      buf += ch;
      continue;
    }
    if (ch === ';' && !inString) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s.replace(/--[^\n]*/g, '').trim().length > 0);
}
