import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { zipSync, type Zippable } from 'fflate';
import { RULES_VERSION } from '@cs2/core';
import { SCHEMA_VERSION, type Db } from '@cs2/db';
import type { ExportResult } from '@cs2/contract';
import { getMatch } from './match-queries.js';
import { getMatchAnalysis } from './analysis-queries.js';
import { getMatchFindings } from './findings-queries.js';
import { bulkDir } from './retention.js';
import type { ApiContext } from './context.js';

const MATCH_TABLES = [
  'player_match', 'rounds', 'kills', 'damages', 'economy', 'engagements',
  'blinds', 'grenades', 'bomb_events', 'player_round_stats', 'chat_messages',
  'voice_segments',

  'utility_throws',
] as const;

const enc = new TextEncoder();
const json = (v: unknown) => enc.encode(JSON.stringify(v, null, 2));

export function safeFileName(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'export'
  );
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const sqlPath = (p: string) => p.replace(/\\/g, '/').replace(/'/g, "''");

export async function exportMatch(ctx: ApiContext, matchId: string): Promise<ExportResult> {
  const detail = await getMatch(ctx.db, matchId);
  const [analysis, findings] = await Promise.all([
    getMatchAnalysis(ctx.db, matchId),
    getMatchFindings(ctx.db, matchId, ctx.settings.get()),
  ]);

  mkdirSync(ctx.exportsDir, { recursive: true });
  const tmp = mkdtempSync(join(ctx.exportsDir, '.tmp-'));
  try {
    const files: Zippable = {};

    for (const table of MATCH_TABLES) {
      const out = join(tmp, `${table}.csv`);
      await ctx.db.exec(
        `COPY (SELECT * FROM ${table} WHERE match_id = ?) TO '${sqlPath(out)}' (HEADER, DELIMITER ',')`,
        [matchId],
      );
      files[`csv/${table}.csv`] = readFileSync(out);
    }

    files['match.json'] = json(detail);
    files['analysis.json'] = json(analysis);

    files['findings.json'] = json(findings);

    const bulk = bulkDir(ctx.dataDir, matchId);
    const bulkFiles = existsSync(bulk) ? readdirSync(bulk).filter((f) => f.endsWith('.parquet')) : [];
    for (const f of bulkFiles) {
      files[`bulk/${f}`] = [readFileSync(join(bulk, f)), { level: 0 }];
    }

    const voiceDir = join(bulk, 'voice');
    const voiceFiles = existsSync(voiceDir) ? readdirSync(voiceDir).filter((f) => f.endsWith('.wav')) : [];
    for (const f of voiceFiles) {
      files[`voice/${f}`] = [readFileSync(join(voiceDir, f)), { level: 6 }];
    }

    files['manifest.json'] = json({
      kind: 'cs2-demo-analyser/match',
      appVersion: ctx.appVersion,
      schemaVersion: SCHEMA_VERSION,
      rulesVersion: RULES_VERSION,
      exportedAt: new Date().toISOString(),
      matchId,
      demoFile: detail.summary.fileName,
      bulkState: detail.summary.bulkState,
      tables: MATCH_TABLES,
      bulk: bulkFiles,
      voiceFiles: voiceFiles.length,
      notes: [
        'findings.json: cada veredicto traz o campo baseline (own_history, match_relative, fixed_reference ou insufficient_data).',
        'Textos de veredicto sao chaves de traducao (titleKey/bodyKey) com parametros, nao prosa.',
        'Tempos em ticks; tick_rate em match.json. Angulos em graus.',
      ],
    });

    const s = detail.summary;
    const name = safeFileName(
      `${s.mapName}_${s.teamAName ?? 'A'}-vs-${s.teamBName ?? 'B'}_${stamp()}`,
    );
    const path = join(ctx.exportsDir, `${name}.zip`);
    writeFileSync(path, zipSync(files, { level: 6 }));
    return { path, bytes: statSync(path).size };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export async function exportLibrary(ctx: ApiContext): Promise<ExportResult> {
  const dir = join(ctx.exportsDir, `cs2-biblioteca-${stamp()}`);
  mkdirSync(dir, { recursive: true });

  const target = join(dir, 'library.duckdb');
  const current = await ctx.db.queryOne<{ name: string }>('SELECT current_database() AS name');
  await ctx.db.exec(`ATTACH '${sqlPath(target)}' AS export_target`);
  try {
    await ctx.db.exec(`COPY FROM DATABASE "${current!.name}" TO export_target`);
  } finally {
    await ctx.db.exec('DETACH export_target');
  }

  const bulk = join(ctx.dataDir, 'bulk');
  if (existsSync(bulk)) cpSync(bulk, join(dir, 'bulk'), { recursive: true });

  const counts = await ctx.db.queryOne<{ matches: number; pruned: number }>(
    `SELECT COUNT(*)::INTEGER AS matches,
            COUNT(*) FILTER (WHERE bulk_state = 'pruned')::INTEGER AS pruned
       FROM matches`,
  );
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify(
      {
        kind: 'cs2-demo-analyser/library',
        appVersion: ctx.appVersion,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        matches: Number(counts?.matches ?? 0),
        prunedMatches: Number(counts?.pruned ?? 0),
        contents: ['library.duckdb', 'bulk/<match_id>/*.parquet', 'bulk/<match_id>/voice/*.wav'],
        restore:
          'Feche o app e copie library.duckdb e a pasta bulk para a pasta de dados. As demos .dem originais nao fazem parte da exportacao.',
      },
      null,
      2,
    ),
  );

  return { path: dir, bytes: dirSize(dir) };
}

function dirSize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}
