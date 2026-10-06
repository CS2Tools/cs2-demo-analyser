import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bookmark,
  ChevronDown,
  Play,
  Plus,
  Terminal,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  ExploreFieldInfo,
  ExploreResult,
  ExploreSpec,
  ExploreSubjectInfo,
  SavedQuery,
} from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ExportButton } from '@/components/export-button';
import { SqlConsoleView } from '@/routes/sql-console';
import { useRoute } from '@/lib/use-route';
import { transport } from '@/lib/transport';
import { cn } from '@/lib/utils';
import type { Cell } from '@/lib/export';

const AGGS = ['count', 'sum', 'avg', 'median', 'max', 'min', 'share'] as const;

const EMPTY: ExploreSpec = {
  subject: 'kills',
  filters: [],
  groupBy: [],
  measures: [{ agg: 'count' }],
  orderBy: null,
  limit: 200,
};

export function ExplorerView({
  onOpenReplay,
}: {
  onOpenReplay?: (matchId: string, roundNum: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const pt = i18n.language !== 'en';
  const { data: catalog, loading } = useRoute('explore.catalog', {});
  const { data: examples } = useRoute('explore.examples', {});
  const saved = useRoute('queries.list', {});

  const { data: settings } = useRoute('settings.get', {});

  const [spec, setSpec] = useState<ExploreSpec>(EMPTY);
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [saveName, setSaveName] = useState('');

  const subject = useMemo(
    () => catalog?.find((s) => s.id === spec.subject) ?? null,
    [catalog, spec.subject],
  );
  const label = useCallback(
    (f: { pt: string; en: string }) => (pt ? f.pt : f.en),
    [pt],
  );

  const run = useCallback(
    async (next: ExploreSpec) => {
      setRunning(true);
      setError(null);
      try {
        setResult(await transport.call('explore.query', next));
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (catalog) void run(EMPTY);
  }, [catalog, run]);

  const update = (patch: Partial<ExploreSpec>) => {
    const next = { ...spec, ...patch };
    setSpec(next);
    void run(next);
  };

  const openSaved = (query: SavedQuery) => {
    setSpec(query.spec);
    void run(query.spec);
  };

  if (loading || !catalog) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <QuestionBar
        catalog={catalog}
        subject={subject}
        spec={spec}
        label={label}
        onChange={update}
        hasUser={Boolean(settings?.userSteamId)}
        poiCount={settings?.playersOfInterest.length ?? 0}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(examples ?? []).map((q) => (
          <Badge
            key={q.queryId}
            variant="outline"
            className="cursor-pointer text-[10px]"
            onClick={() => openSaved(q)}
          >
            {q.name}
          </Badge>
        ))}
      </div>

      {(saved.data ?? []).length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase text-muted-foreground">{t('explorerScreen.saved')}</span>
          {(saved.data ?? []).map((q) => (
            <SavedChip
              key={q.queryId}
              query={q}
              onOpen={() => openSaved(q)}
              onRemoved={() => saved.reload()}
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('explorerScreen.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {running ? <Skeleton className="h-64 w-full" /> : null}

      {result && !running ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t('explorerScreen.rows', {
                count: result.rowCount,
                ms: result.elapsedMs,
              })}
              {result.truncated ? t('explorerScreen.truncatedAtLimit') : ''}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={t('explorerScreen.savePlaceholder')}
                className="h-8 w-56 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!saveName.trim()}
                onClick={async () => {
                  await transport.call('queries.save', { name: saveName.trim(), spec });
                  setSaveName('');
                  saved.reload();
                }}
              >
                <Bookmark data-icon="inline-start" />
                {t('ui.save')}
              </Button>
              <ExportButton
                spec={{
                  title: t('explorerScreen.title'),
                  meta: { references: { pergunta: spec } },
                  table: () => ({
                    columns: result.columns.map((c) => label(c)),
                    rows: result.rows.map((r) => r.slice(0, result.columns.length) as Cell[]),
                  }),
                  json: () => ({ pergunta: spec, colunas: result.columns, linhas: result.rows }),
                }}
              />
            </div>
          </div>

          <ResultChart result={result} label={label} />
          <ResultTable
            result={result}
            label={label}
            onOpenReplay={subject?.canOpenReplay ? onOpenReplay : undefined}
          />

          <button
            type="button"
            className="flex w-fit items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowSql((v) => !v)}
          >
            <ChevronDown className={cn('size-3 transition-transform', showSql && 'rotate-180')} />
            {showSql ? t('frag3.hideSql') : t('frag3.showSql')}
          </button>
          {showSql ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[10px]">
              {result.sql}
            </pre>
          ) : null}
        </>
      ) : null}

      <div className="mt-4 border-t pt-3">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowConsole((v) => !v)}
        >
          <Terminal className="size-3.5" />
          {t('ui.advancedSql')}
          <ChevronDown className={cn('size-3 transition-transform', showConsole && 'rotate-180')} />
        </button>
        {showConsole ? (
          <div className="mt-3">
            <SqlConsoleView />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SavedChip({
  query,
  onOpen,
  onRemoved,
}: {
  query: SavedQuery;
  onOpen: () => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        {t('frag2.deleteNamed', { name: query.name })}
        <button
          type="button"
          className="underline"
          onClick={async () => {
            await transport.call('queries.remove', { queryId: query.queryId });
            setConfirming(false);
            onRemoved();
          }}
        >
          {t('ui.yes')}
        </button>
        <button type="button" className="underline" onClick={() => setConfirming(false)}>
          {t('ui.no')}
        </button>
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-1 text-[10px]">
      <button type="button" onClick={onOpen}>
        {query.name}
      </button>
      <button
        type="button"
        title={t('explorerScreen.deleteQuestion')}
        className="opacity-50 transition-opacity hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

function RemovableChip({
  variant,
  title,
  children,
  onRemove,
}: {
  variant: 'default' | 'secondary' | 'outline';

  title: string;
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <Badge variant={variant} className="gap-1 text-[10px]">
      {children}
      <button
        type="button"
        onClick={onRemove}
        title={title}
        aria-label={title}
        className="-mr-1 grid size-4 place-items-center rounded-full hover:bg-foreground/20"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

function QuestionBar({
  catalog,
  subject,
  spec,
  label,
  onChange,
  hasUser,
  poiCount,
}: {
  catalog: ExploreSubjectInfo[];
  subject: ExploreSubjectInfo | null;
  spec: ExploreSpec;
  label: (f: { pt: string; en: string }) => string;
  onChange: (patch: Partial<ExploreSpec>) => void;
  hasUser: boolean;
  poiCount: number;
}) {
  const { t } = useTranslation();
  const fields = subject?.fields ?? [];
  const groupable = fields.filter((f) => f.groupable);
  const measurable = fields.filter((f) => f.measurable);
  const filterable = fields.filter((f) => f.filterable);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('explorerScreen.show')}</span>
          <select
            value={spec.subject}
            className="h-8 rounded-md border bg-background px-2 text-sm"
            onChange={(e) =>
              onChange({ subject: e.target.value, filters: [], groupBy: [], measures: [{ agg: 'count' }], orderBy: null })
            }
          >
            {catalog.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s)}
              </option>
            ))}
          </select>
          {subject ? (
            <span className="text-[11px] text-muted-foreground">({label({ pt: subject.rowPt, en: subject.rowEn })})</span>
          ) : null}

          <span className="ml-2 text-muted-foreground">{t('explorerScreen.groupingBy')}</span>
          <MultiSelect
            options={groupable}
            selected={spec.groupBy}
            label={label}
            max={2}
            empty={t('agg.nothing')}
            onChange={(groupBy) => onChange({ groupBy, orderBy: null })}
          />

          <span className="ml-2 text-muted-foreground">{t('explorerScreen.measuring')}</span>
          <MeasurePicker
            fields={measurable}
            measures={spec.measures}
            label={label}
            onChange={(measures) => onChange({ measures, orderBy: null })}
          />
        </div>

        <QuickFilters
          fields={filterable}
          filters={spec.filters}
          hasUser={hasUser}
          poiCount={poiCount}
          onChange={(filters) => onChange({ filters })}
        />

        <FilterRow
          fields={filterable}
          filters={spec.filters}
          label={label}
          onChange={(filters) => onChange({ filters })}
        />
      </CardContent>
    </Card>
  );
}

function MultiSelect({
  options,
  selected,
  label,
  max,
  empty,
  onChange,
}: {
  options: ExploreFieldInfo[];
  selected: string[];
  label: (f: { pt: string; en: string }) => string;
  max: number;
  empty: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {selected.length === 0 ? (
        <span className="text-[11px] text-muted-foreground">{empty}</span>
      ) : null}
      {selected.map((id) => {
        const field = options.find((f) => f.id === id);
        return (
          <RemovableChip
            key={id}
            variant="default"
            title={`Tirar ${field ? label(field) : id} do agrupamento`}
            onRemove={() => onChange(selected.filter((s) => s !== id))}
          >
            {field ? label(field) : id}
          </RemovableChip>
        );
      })}
      {selected.length < max ? (
        <select
          value=""
          className="h-7 rounded-md border bg-background px-1 text-xs"
          onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
        >
          <option value="">+</option>
          {options
            .filter((f) => !selected.includes(f.id))
            .map((f) => (
              <option key={f.id} value={f.id}>
                {label(f)}
              </option>
            ))}
        </select>
      ) : null}
    </div>
  );
}

function MeasurePicker({
  fields,
  measures,
  label,
  onChange,
}: {
  fields: ExploreFieldInfo[];
  measures: ExploreSpec['measures'];
  label: (f: { pt: string; en: string }) => string;
  onChange: (next: ExploreSpec['measures']) => void;
}) {
  const { t } = useTranslation();
  const [agg, setAgg] = useState<string>('count');
  const [field, setField] = useState<string>('');

  const canAdd = agg === 'count' || field !== '';
  const options = fields.filter((f) => (agg === 'share' ? f.type === 'boolean' : f.type === 'number'));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {measures.map((m, i) => (
        <RemovableChip
          key={`${m.agg}-${m.field ?? ''}-${i}`}
          variant="default"
          title={t('explorerScreen.removeMeasure')}
          onRemove={() => onChange(measures.filter((_, index) => index !== i))}
        >
          {t(`agg.${m.agg}`, { defaultValue: m.agg })}
          {m.field ? ` de ${label(fields.find((f) => f.id === m.field) ?? { pt: m.field, en: m.field })}` : ''}
        </RemovableChip>
      ))}
      <select
        value={agg}
        className="h-7 rounded-md border bg-background px-1 text-xs"
        onChange={(e) => {
          setAgg(e.target.value);
          setField('');
        }}
      >
        {AGGS.map((a) => (
          <option key={a} value={a}>
            {t(`agg.${a}`)}
          </option>
        ))}
      </select>
      {agg !== 'count' ? (
        <select
          value={field}
          className="h-7 rounded-md border bg-background px-1 text-xs"
          onChange={(e) => setField(e.target.value)}
        >
          <option value="">{t('explorerScreen.fieldPlaceholder')}</option>
          {options.map((f) => (
            <option key={f.id} value={f.id}>
              {label(f)}
            </option>
          ))}
        </select>
      ) : null}
      <Button
        size="icon-xs"
        variant="ghost"
        disabled={!canAdd}
        title={t('explorerScreen.addMeasure')}
        onClick={() => onChange([...measures, { agg: agg as 'count', field: field || undefined }])}
      >
        <Plus />
      </Button>
    </div>
  );
}

function QuickFilters({
  fields,
  filters,
  hasUser,
  poiCount,
  onChange,
}: {
  fields: ExploreFieldInfo[];
  filters: ExploreSpec['filters'];
  hasUser: boolean;
  poiCount: number;
  onChange: (next: ExploreSpec['filters']) => void;
}) {
  const { t } = useTranslation();
  const shortcuts = [
    {
      id: 'isMe',
      text: t('agg.onlyMe'),
      enabled: hasUser,
      why: t('agg.onlyMeWhy'),
    },
    {
      id: 'isPoi',
      text: t('agg.onlyMine'),
      enabled: poiCount > 0,
      why: t('agg.onlyMineWhy'),
    },
  ].filter((s) => fields.some((f) => f.id === s.id));

  if (shortcuts.length === 0) return null;

  const toggle = (id: string, on: boolean) => {
    onChange(
      on
        ? [...filters.filter((f) => f.field !== id), { field: id, op: 'is' as const, value: true }]
        : filters.filter((f) => f.field !== id),
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm text-muted-foreground">{t('explorerScreen.shortcuts')}</span>
      {shortcuts.map((s) => {
        const on = filters.some((f) => f.field === s.id && f.value === true);
        const chip = (
          <Badge
            key={s.id}
            variant={on ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer text-[10px]',
              !s.enabled && 'cursor-not-allowed opacity-40',
            )}
            onClick={() => s.enabled && toggle(s.id, !on)}
          >
            {s.text}
          </Badge>
        );
        return s.enabled ? chip : (
          <span key={s.id} title={s.why}>
            {chip}
          </span>
        );
      })}
    </div>
  );
}

function FilterRow({
  fields,
  filters,
  label,
  onChange,
}: {
  fields: ExploreFieldInfo[];
  filters: ExploreSpec['filters'];
  label: (f: { pt: string; en: string }) => string;
  onChange: (next: ExploreSpec['filters']) => void;
}) {
  const { t } = useTranslation();
  const [fieldId, setFieldId] = useState('');
  const [value, setValue] = useState('');
  const field = fields.find((f) => f.id === fieldId) ?? null;

  const add = () => {
    if (!field) return;
    const filter =
      field.type === 'boolean'
        ? { field: field.id, op: 'is' as const, value: value !== 'false' }
        : field.type === 'number'
          ? { field: field.id, op: 'gte' as const, value: Number(value) }
          : { field: field.id, op: 'is' as const, value };
    onChange([...filters, filter]);
    setFieldId('');
    setValue('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm text-muted-foreground">{t('explorerScreen.onlyWhen')}</span>
      {filters.length === 0 ? (
        <span className="text-[11px] text-muted-foreground">{t('explorerScreen.noFilter')}</span>
      ) : null}
      {filters.map((f, i) => {
        const info = fields.find((x) => x.id === f.field);
        const text =
          f.op === 'gte' ? `≥ ${String(f.value)}`
            : f.op === 'lte' ? `≤ ${String(f.value)}`
              : f.op === 'contains' ? `contém "${String(f.value)}"`
                : f.op === 'in' ? `= ${(f.values ?? []).join(', ')}`
                  : typeof f.value === 'boolean' ? (f.value ? 'sim' : 'não')
                    : `= ${String(f.value)}`;
        return (
          <RemovableChip
            key={`${f.field}-${i}`}
            variant="secondary"
            title={`Tirar o filtro ${info ? label(info) : f.field}`}
            onRemove={() => onChange(filters.filter((_, index) => index !== i))}
          >
            {info ? label(info) : f.field} {text}
          </RemovableChip>
        );
      })}

      <select
        value={fieldId}
        className="h-7 rounded-md border bg-background px-1 text-xs"
        onChange={(e) => {
          setFieldId(e.target.value);
          setValue('');
        }}
      >
        <option value="">{t('explorerScreen.addFilter')}</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {label(f)}
          </option>
        ))}
      </select>

      {field ? (
        <>
          {field.values ? (
            <select
              value={value}
              className="h-7 rounded-md border bg-background px-1 text-xs"
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">{t('explorerScreen.valuePlaceholder')}</option>
              {field.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : field.type === 'boolean' ? (
            <select
              value={value || 'true'}
              className="h-7 rounded-md border bg-background px-1 text-xs"
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="true">{t('ui.yes')}</option>
              <option value="false">{t('explorerScreen.not')}</option>
            </select>
          ) : (
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field.type === 'number' ? t('explorerScreen.min') : t('explorerScreen.value')}
              className="h-7 w-32 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          )}
          <Button size="xs" variant="outline" onClick={add}>
            <Plus />
          </Button>
        </>
      ) : null}
    </div>
  );
}

function ResultChart({
  result,
  label,
}: {
  result: ExploreResult;
  label: (f: { pt: string; en: string }) => string;
}) {
  const { t } = useTranslation();
  const measureIndex = result.columns.findIndex((c) => c.role === 'measure');
  const groupIndex = result.columns.findIndex((c) => c.role === 'group');
  if (measureIndex < 0 || groupIndex < 0 || result.rows.length === 0) return null;

  const rows = result.rows.slice(0, 15);
  const values = rows.map((r) => Number(r[measureIndex] ?? 0));
  const max = Math.max(1, ...values);

  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BarChart3 className="size-3.5" />
          {t('explorerScreen.chartTitle', {
            measure: label(result.columns[measureIndex]!),
            group: label(result.columns[groupIndex]!),
          })}
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-40 shrink-0 truncate text-[11px]">{String(row[groupIndex] ?? '—')}</span>
            <div className="h-3 flex-1 rounded-sm bg-muted">
              <div
                className="h-3 rounded-sm bg-primary/70"
                style={{ width: `${(values[i]! / max) * 100}%` }}
              />
            </div>
            <span className="w-16 text-right font-mono text-[11px] tabular-nums">{values[i]}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ResultTable({
  result,
  label,
  onOpenReplay,
}: {
  result: ExploreResult;
  label: (f: { pt: string; en: string }) => string;
  onOpenReplay?: (matchId: string, roundNum: number) => void;
}) {
  const { t } = useTranslation();
  const replay = result.replay;

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/90 backdrop-blur">
          <tr className="text-xs text-muted-foreground">
            {result.columns.map((c) => (
              <th key={c.key} className="px-3 py-1.5 text-left font-medium">
                {label(c)}
              </th>
            ))}
            {replay && onOpenReplay ? <th className="w-10" /> : null}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-t">
              {result.columns.map((c, j) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-1',
                    c.type === 'number' ? 'text-right font-mono text-xs tabular-nums' : 'text-xs',
                  )}
                >
                  {format(row[j])}
                </td>
              ))}
              {replay && onOpenReplay ? (
                <td className="px-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title={t('explorerScreen.openInReplay')}
                    onClick={() =>
                      onOpenReplay(String(row[replay.matchIdIndex]), Number(row[replay.roundIndex]))
                    }
                  >
                    <Play />
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground">
          {t('ui.noRowsFilter')}
        </div>
      ) : null}
    </div>
  );
}

function format(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}
