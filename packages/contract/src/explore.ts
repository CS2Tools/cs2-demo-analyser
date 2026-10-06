import { z } from 'zod';

export const exploreFieldSchema = z.object({
  id: z.string(),
  pt: z.string(),
  en: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'enum', 'date']),
  filterable: z.boolean(),
  groupable: z.boolean(),
  measurable: z.boolean(),

  values: z.array(z.string()).nullable(),
});
export type ExploreFieldInfo = z.infer<typeof exploreFieldSchema>;

export const exploreSubjectSchema = z.object({
  id: z.string(),
  pt: z.string(),
  en: z.string(),

  rowPt: z.string(),
  rowEn: z.string(),
  canOpenReplay: z.boolean(),
  fields: z.array(exploreFieldSchema),
});
export type ExploreSubjectInfo = z.infer<typeof exploreSubjectSchema>;

export const filterOpSchema = z.enum([
  'is', 'not', 'in', 'contains', 'between', 'gte', 'lte', 'notNull',
]);

export const exploreFilterSchema = z.object({
  field: z.string().max(64),
  op: filterOpSchema,
  value: z.union([z.string().max(200), z.number(), z.boolean(), z.null()]).optional(),
  values: z.array(z.union([z.string().max(200), z.number()])).max(60).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const exploreMeasureSchema = z.object({
  agg: z.enum(['count', 'sum', 'avg', 'median', 'min', 'max', 'share']),
  field: z.string().max(64).optional(),
});

export const exploreSpecSchema = z.object({
  subject: z.string().max(64),
  filters: z.array(exploreFilterSchema).max(20).default([]),
  groupBy: z.array(z.string().max(64)).max(2).default([]),
  measures: z.array(exploreMeasureSchema).max(6).default([]),
  orderBy: z.object({ index: z.number().int().min(0).max(20), dir: z.enum(['asc', 'desc']) })
    .nullable().default(null),
  limit: z.number().int().min(1).max(500).default(200),
});
export type ExploreSpec = z.infer<typeof exploreSpecSchema>;

export const exploreColumnSchema = z.object({
  key: z.string(),
  pt: z.string(),
  en: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'enum', 'date']),
  role: z.enum(['group', 'measure', 'detail']),
});

export const exploreResultSchema = z.object({
  columns: z.array(exploreColumnSchema),
  rows: z.array(z.array(z.unknown())),
  rowCount: z.number().int(),
  truncated: z.boolean(),
  elapsedMs: z.number(),

  sql: z.string(),

  replay: z.object({
    matchIdIndex: z.number().int(),
    roundIndex: z.number().int(),
    tickIndex: z.number().int().nullable(),
  }).nullable(),
});
export type ExploreResult = z.infer<typeof exploreResultSchema>;

export const savedQuerySchema = z.object({
  queryId: z.string(),
  name: z.string(),
  spec: exploreSpecSchema,
  createdAt: z.string(),
});
export type SavedQuery = z.infer<typeof savedQuerySchema>;
