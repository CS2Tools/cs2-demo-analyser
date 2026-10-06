import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Play, TriangleAlert } from 'lucide-react';
import type { SqlResult } from '@cs2/contract';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { useRoute } from '@/lib/use-route';
import { transport } from '@/lib/transport';
import { cn } from '@/lib/utils';
import { ExportButton } from '@/components/export-button';
import type { Cell } from '@/lib/export';

const DEFAULT_SQL = `-- Ctrl+Enter para executar. Somente leitura.
SELECT map_name, source, tick_rate, rounds_played, score_a, score_b, ingested_at
FROM matches
ORDER BY ingested_at DESC;`;

export function SqlConsoleView() {
  const { t } = useTranslation();
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const { data: tables } = useRoute('sql.tables', {});
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await transport.call('sql.query', { sql, maxRows: 500 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [sql]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const insertTable = (name: string) => {
    setSql((prev) => `${prev.trimEnd()}\n${name}`);
    areaRef.current?.focus();
  };

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col lg:flex">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Database className="size-3.5" />
          Tabelas ({tables?.length ?? 0})
        </div>
        <ScrollArea className="min-h-0 flex-1 rounded-md border">
          <div className="flex flex-col p-1">
            {tables?.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertTable(t)}
                className="rounded px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t}
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <textarea
            ref={areaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            className="min-h-32 w-full resize-y rounded-md border bg-muted/30 p-3 font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => void run()} disabled={running}>
              {running ? <Spinner data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              {t('sqlConsole.run')}
            </Button>
            <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {t('sqlConsole.shortcut')}
            </kbd>
            {result ? (
              <span className="ml-auto text-xs text-muted-foreground">
                {t('sqlConsole.rows', {
                  count: result.rowCount,
                  ms: result.elapsedMs.toFixed(1),
                })}
                {result.truncated ? t('sqlConsole.truncated') : ''}
              </span>
            ) : null}
            {result && result.columns.length > 0 ? (
              <ExportButton
                spec={{
                  title: 'consulta-sql',

                  meta: { references: { sql, truncated: result.truncated, rowCount: result.rowCount } },
                  table: () => ({
                    columns: result.columns.map((c) => c.name),
                    rows: result.rows.map((r) =>
                      r.map((v): Cell =>
                        v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                          ? v
                          : JSON.stringify(v),
                      ),
                    ),
                  }),
                }}
              />
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{t('misc2.queryRefused')}</AlertTitle>
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        {result ? <ResultTable result={result} /> : null}
      </div>
    </div>
  );
}

function ResultTable({ result }: { result: SqlResult }) {
  const { t } = useTranslation();
  if (result.columns.length === 0) return null;

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>
            {result.columns.map((c) => (
              <th key={c.name} className="border-b px-3 py-1.5 text-left font-medium">
                <div className="flex flex-col">
                  <span className="font-mono text-xs">{c.name}</span>
                  <Badge variant="outline" className="mt-0.5 w-fit text-[9px] font-normal">
                    {c.type}
                  </Badge>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (

            <tr key={i} className="odd:bg-muted/20">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    'whitespace-nowrap border-b px-3 py-1 font-mono text-xs',
                    cell === null && 'text-muted-foreground/50 italic',
                    typeof cell === 'number' && 'text-right tabular-nums',
                  )}
                >
                  {cell === null ? 'null' : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {t('ui.sqlNoRows')}
        </p>
      ) : null}
    </div>
  );
}
