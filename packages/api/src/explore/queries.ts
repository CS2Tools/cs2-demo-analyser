import { randomUUID } from 'node:crypto';
import type { Db } from '@cs2/db';
import type {
  ExploreResult,
  ExploreSpec,
  ExploreSubjectInfo,
  SavedQuery,
} from '@cs2/contract';
import { SUBJECTS } from './catalog.js';
import { compile, ExploreError, MAX_ROWS } from './compile.js';

export function exploreCatalog(): ExploreSubjectInfo[] {
  return SUBJECTS.map((s) => ({
    id: s.id,
    pt: s.pt,
    en: s.en,
    rowPt: s.rowPt,
    rowEn: s.rowEn,
    canOpenReplay: Boolean(s.replay),
    fields: s.fields.map((f) => ({
      id: f.id,
      pt: f.pt,
      en: f.en,
      type: f.type,
      filterable: Boolean(f.filterable),
      groupable: Boolean(f.groupable),
      measurable: Boolean(f.measurable),
      values: f.values ?? null,
    })),
  }));
}

export async function runExplore(db: Db, spec: ExploreSpec): Promise<ExploreResult> {
  let compiled;
  try {
    compiled = compile({
      subject: spec.subject,
      filters: spec.filters,
      groupBy: spec.groupBy,
      measures: spec.measures,
      orderBy: spec.orderBy ?? undefined,
      limit: spec.limit,
    });
  } catch (err) {

    if (err instanceof ExploreError) throw new Error(err.message);
    throw err;
  }

  const started = performance.now();

  const rows = await db.query<Record<string, unknown>>(compiled.sql, compiled.params);
  const elapsedMs = Math.round((performance.now() - started) * 100) / 100;

  const keys = Object.keys(rows[0] ?? {});
  const truncated = rows.length >= Math.min(spec.limit, MAX_ROWS);

  return {
    columns: compiled.columns,
    rows: rows.map((row) => keys.map((key) => normalize(row[key]))),
    rowCount: rows.length,
    truncated,
    elapsedMs,
    sql: compiled.sql,
    replay: compiled.replay,
  };
}

function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

interface SavedRow {
  query_id: string;
  name: string;
  spec_json: string;
  created_at: Date | string;
}

const toSaved = (r: SavedRow): SavedQuery => ({
  queryId: r.query_id,
  name: r.name,
  spec: JSON.parse(r.spec_json) as ExploreSpec,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function listSavedQueries(db: Db): Promise<SavedQuery[]> {
  const rows = await db.query<SavedRow>(
    'SELECT query_id, name, spec_json, created_at FROM saved_queries ORDER BY created_at DESC',
  );
  return rows.map(toSaved);
}

export async function saveQuery(
  db: Db,
  params: { name: string; spec: ExploreSpec },
): Promise<SavedQuery> {

  compile({
    subject: params.spec.subject,
    filters: params.spec.filters,
    groupBy: params.spec.groupBy,
    measures: params.spec.measures,
    orderBy: params.spec.orderBy ?? undefined,
    limit: params.spec.limit,
  });

  const queryId = randomUUID();
  const createdAt = new Date();
  await db.exec(
    `INSERT INTO saved_queries (query_id, name, subject, spec_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [queryId, params.name, params.spec.subject, JSON.stringify(params.spec), createdAt],
  );
  return { queryId, name: params.name, spec: params.spec, createdAt: createdAt.toISOString() };
}

export async function removeSavedQuery(db: Db, queryId: string): Promise<boolean> {
  const before = await db.queryOne<{ n: number }>(
    'SELECT COUNT(*)::INTEGER AS n FROM saved_queries WHERE query_id = ?',
    [queryId],
  );
  await db.exec('DELETE FROM saved_queries WHERE query_id = ?', [queryId]);
  return Number(before?.n ?? 0) > 0;
}

export const EXAMPLE_QUERIES: { name: string; spec: ExploreSpec }[] = [
  {
    name: 'Minhas kills por arma',
    spec: {
      subject: 'kills', filters: [], groupBy: ['weapon'],
      measures: [{ agg: 'count' }], orderBy: null, limit: 200,
    },
  },
  {
    name: '% de headshot por arma',
    spec: {
      subject: 'kills', filters: [], groupBy: ['weapon'],
      measures: [{ agg: 'count' }, { agg: 'share', field: 'headshot' }],
      orderBy: { index: 1, dir: 'desc' }, limit: 200,
    },
  },
  {
    name: 'Mortes sem troca por jogador',
    spec: {
      subject: 'deaths', filters: [{ field: 'traded', op: 'is', value: false }],
      groupBy: ['player'], measures: [{ agg: 'count' }],
      orderBy: { index: 1, dir: 'desc' }, limit: 200,
    },
  },
  {
    name: 'Dano de HE por partida',
    spec: {
      subject: 'damages',
      filters: [
        { field: 'weapon', op: 'is', value: 'hegrenade' },
        { field: 'teamDamage', op: 'is', value: false },
      ],
      groupBy: ['match'], measures: [{ agg: 'sum', field: 'damage' }],
      orderBy: { index: 1, dir: 'desc' }, limit: 200,
    },
  },
  {
    name: 'Rounds de force e quantos foram vencidos',
    spec: {
      subject: 'rounds', filters: [{ field: 'tBuy', op: 'is', value: 'force_buy' }],
      groupBy: ['winnerSide'], measures: [{ agg: 'count' }],
      orderBy: { index: 1, dir: 'desc' }, limit: 200,
    },
  },
  {
    name: 'Utilitário que morreu na mão, por jogador',
    spec: {
      subject: 'performance', filters: [{ field: 'survived', op: 'is', value: false }],
      groupBy: ['player'],
      measures: [{ agg: 'sum', field: 'unusedUtility' }, { agg: 'count' }],
      orderBy: { index: 1, dir: 'desc' }, limit: 200,
    },
  },
];
