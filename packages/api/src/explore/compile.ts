import { fieldById, subjectById, type ExploreField, type ExploreSubject } from './catalog.js';

export type FilterOp = 'is' | 'not' | 'in' | 'contains' | 'between' | 'gte' | 'lte' | 'notNull';

export interface ExploreFilter {
  field: string;
  op: FilterOp;

  value?: string | number | boolean | null;
  values?: (string | number)[];
  min?: number;
  max?: number;
}

export type Aggregation = 'count' | 'sum' | 'avg' | 'median' | 'min' | 'max' | 'share';

export interface ExploreMeasure {
  agg: Aggregation;

  field?: string;
}

export interface ExploreSpec {
  subject: string;
  filters?: ExploreFilter[];
  groupBy?: string[];
  measures?: ExploreMeasure[];

  orderBy?: { index: number; dir: 'asc' | 'desc' };
  limit?: number;
}

export interface CompiledColumn {
  key: string;
  pt: string;
  en: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'date';

  role: 'group' | 'measure' | 'detail';
}

export interface Compiled {
  sql: string;
  params: (string | number | boolean)[];
  columns: CompiledColumn[];

  replay: { matchIdIndex: number; roundIndex: number; tickIndex: number | null } | null;
}

export const MAX_ROWS = 500;

export const MAX_IN_VALUES = 60;

export const MAX_GROUP_BY = 2;

export class ExploreError extends Error {}

const AGG_NEEDS_NUMBER: Aggregation[] = ['sum', 'avg', 'median'];

export function compile(spec: ExploreSpec): Compiled {
  const subject = subjectById(spec.subject);
  if (!subject) throw new ExploreError(`assunto desconhecido: ${spec.subject}`);

  const params: (string | number | boolean)[] = [];
  const where: string[] = [];
  if (subject.where) where.push(subject.where);

  for (const filter of spec.filters ?? []) {
    where.push(compileFilter(subject, filter, params));
  }

  const groupBy = spec.groupBy ?? [];
  if (groupBy.length > MAX_GROUP_BY) {
    throw new ExploreError(`no máximo ${MAX_GROUP_BY} agrupamentos`);
  }

  const columns: CompiledColumn[] = [];
  const select: string[] = [];

  for (const id of groupBy) {
    const field = requireField(subject, id);
    if (!field.groupable) throw new ExploreError(`nao da para agrupar por ${id}`);
    select.push(`${field.sql} AS "${field.id}"`);
    columns.push({ key: field.id, pt: field.pt, en: field.en, type: field.type, role: 'group' });
  }

  const measures = spec.measures ?? [];
  const limit = clamp(spec.limit ?? MAX_ROWS, 1, MAX_ROWS);

  const detail = groupBy.length === 0 && measures.length === 0;
  if (detail) return compileDetail(subject, where, params, limit);

  for (const measure of measures) {
    const { sql, label, type } = compileMeasure(subject, measure);
    select.push(`${sql} AS "${label.key}"`);
    columns.push({ ...label, type, role: 'measure' });
  }

  if (select.length === 0) throw new ExploreError('a pergunta precisa de pelo menos uma medida');

  const sql =
    `SELECT ${select.join(', ')}\n` +
    `  FROM ${subject.from}\n` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}\n` : '') +
    (groupBy.length > 0 ? ` GROUP BY ${groupBy.map((_, i) => i + 1).join(', ')}\n` : '') +
    ` ORDER BY ${orderClause(spec, columns)}\n` +
    ` LIMIT ${limit}`;

  return { sql, params, columns, replay: null };
}

function compileDetail(
  subject: ExploreSubject,
  where: string[],
  params: (string | number | boolean)[],
  limit: number,
): Compiled {
  const shown = subject.fields.filter((f) => f.groupable || f.measurable).slice(0, 10);
  const select = shown.map((f) => `${f.sql} AS "${f.id}"`);
  const columns: CompiledColumn[] = shown.map((f) => ({
    key: f.id, pt: f.pt, en: f.en, type: f.type, role: 'detail',
  }));

  let replay: Compiled['replay'] = null;
  if (subject.replay) {
    const base = select.length;
    select.push(`${subject.replay.matchId} AS "_matchId"`, `${subject.replay.round} AS "_round"`);
    if (subject.replay.tick) select.push(`${subject.replay.tick} AS "_tick"`);
    replay = {
      matchIdIndex: base,
      roundIndex: base + 1,
      tickIndex: subject.replay.tick ? base + 2 : null,
    };
  }

  const sql =
    `SELECT ${select.join(', ')}\n` +
    `  FROM ${subject.from}\n` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}\n` : '') +
    ` LIMIT ${limit}`;

  return { sql, params, columns, replay };
}

function requireField(subject: ExploreSubject, id: string): ExploreField {
  const field = fieldById(subject, id);
  if (!field) {
    throw new ExploreError(`campo desconhecido em ${subject.id}: ${id}`);
  }
  return field;
}

function compileFilter(
  subject: ExploreSubject,
  filter: ExploreFilter,
  params: (string | number | boolean)[],
): string {
  const field = requireField(subject, filter.field);
  if (!field.filterable) throw new ExploreError(`nao da para filtrar por ${filter.field}`);

  switch (filter.op) {
    case 'notNull':
      return `${field.sql} IS NOT NULL`;

    case 'is':
    case 'not': {
      if (filter.value === null || filter.value === undefined) {
        return filter.op === 'is' ? `${field.sql} IS NULL` : `${field.sql} IS NOT NULL`;
      }
      params.push(coerce(field, filter.value));
      return `${field.sql} ${filter.op === 'is' ? '=' : '<>'} ?`;
    }

    case 'in': {
      const values = filter.values ?? [];
      if (values.length === 0) throw new ExploreError(`filtro "${filter.field}" sem valores`);
      if (values.length > MAX_IN_VALUES) {
        throw new ExploreError(`filtro "${filter.field}" com valores demais`);
      }
      for (const value of values) params.push(coerce(field, value));
      return `${field.sql} IN (${values.map(() => '?').join(', ')})`;
    }

    case 'contains': {
      if (field.type !== 'string') throw new ExploreError(`"contem" so vale para texto`);

      params.push(`%${escapeLike(String(filter.value ?? ''))}%`);
      return `${field.sql} ILIKE ? ESCAPE '\\'`;
    }

    case 'gte':
    case 'lte': {
      requireNumeric(field);
      params.push(Number(filter.value));
      return `${field.sql} ${filter.op === 'gte' ? '>=' : '<='} ?`;
    }

    case 'between': {
      requireNumeric(field);
      if (filter.min === undefined || filter.max === undefined) {
        throw new ExploreError(`filtro "${filter.field}" precisa de minimo e maximo`);
      }
      params.push(filter.min, filter.max);
      return `${field.sql} BETWEEN ? AND ?`;
    }

    default:
      throw new ExploreError(`operacao desconhecida: ${String(filter.op)}`);
  }
}

function compileMeasure(
  subject: ExploreSubject,
  measure: ExploreMeasure,
): { sql: string; label: { key: string; pt: string; en: string }; type: CompiledColumn['type'] } {
  if (measure.agg === 'count') {
    return {
      sql: 'COUNT(*)::BIGINT',
      label: { key: 'count', pt: 'Quantidade', en: 'Count' },
      type: 'number',
    };
  }

  if (!measure.field) throw new ExploreError(`a medida ${measure.agg} precisa de um campo`);
  const field = requireField(subject, measure.field);
  if (!field.measurable) throw new ExploreError(`nao da para medir ${measure.field}`);

  const key = `${measure.agg}_${field.id}`;

  if (measure.agg === 'share') {
    if (field.type !== 'boolean') {
      throw new ExploreError(`porcentagem so vale para campo de sim/nao: ${field.id}`);
    }
    return {
      sql: `ROUND(100.0 * SUM(CASE WHEN ${field.sql} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1)`,
      label: { key, pt: `% ${field.pt}`, en: `% ${field.en}` },
      type: 'number',
    };
  }

  if (AGG_NEEDS_NUMBER.includes(measure.agg)) requireNumeric(field);

  const fn = measure.agg === 'median' ? 'MEDIAN' : measure.agg.toUpperCase();
  const rounded = measure.agg === 'avg' || measure.agg === 'median';
  const inner = `${fn}(${field.sql})`;

  const PT: Record<Aggregation, string> = {
    count: 'Quantidade', sum: 'Soma de', avg: 'Média de', median: 'Mediana de',
    min: 'Mínimo de', max: 'Máximo de', share: '%',
  };
  const EN: Record<Aggregation, string> = {
    count: 'Count', sum: 'Sum of', avg: 'Average', median: 'Median',
    min: 'Min', max: 'Max', share: '%',
  };

  return {
    sql: rounded ? `ROUND(${inner}, 2)` : inner,
    label: { key, pt: `${PT[measure.agg]} ${field.pt.toLowerCase()}`, en: `${EN[measure.agg]} ${field.en.toLowerCase()}` },
    type: 'number',
  };
}

function orderClause(spec: ExploreSpec, columns: CompiledColumn[]): string {
  const dir = spec.orderBy?.dir === 'asc' ? 'ASC' : 'DESC';

  const fallback = columns.findIndex((c) => c.role === 'measure');
  const index = spec.orderBy ? spec.orderBy.index : fallback;
  const safe = Number.isInteger(index) && index >= 0 && index < columns.length ? index : 0;
  return `${safe + 1} ${dir} NULLS LAST`;
}

function requireNumeric(field: ExploreField): void {
  if (field.type !== 'number') {
    throw new ExploreError(`${field.id} nao e numero`);
  }
}

function coerce(field: ExploreField, value: string | number | boolean): string | number | boolean {
  if (field.type === 'number') return Number(value);
  if (field.type === 'boolean') return value === true || value === 'true';
  return String(value);
}

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));
