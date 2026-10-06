import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileImage, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import {
  composePng,
  fileSlug,
  referenceFooter,
  renderTableCanvas,
  saveBlob,
  saveText,
  toCsv,
  toJson,
  type ExportMeta,
  type TableData,
} from '@/lib/export';

export interface ExportSpec {

  title: string;
  meta?: Omit<ExportMeta, 'title'>;
  table?: () => TableData;

  json?: () => unknown;
  png?: () => {
    layers: HTMLCanvasElement[];
    alphas?: number[];
    subtitle?: string;
    footer?: string[];
  } | null;
}

function pngSource(spec: ExportSpec): NonNullable<ReturnType<NonNullable<ExportSpec['png']>>> | null {
  if (spec.png) return spec.png();
  const table = spec.table?.();
  if (!table) return null;
  return {
    layers: [renderTableCanvas(table)],
    subtitle: spec.meta?.matchId ? `partida ${spec.meta.matchId}` : undefined,
    footer: referenceFooter(spec.meta),
  };
}

export function ExportButton({ spec, className }: { spec: ExportSpec; className?: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = fileSlug(spec.title);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const jsonData = () => {
    if (spec.json) return spec.json();
    const table = spec.table?.();
    if (!table) return null;
    return table.rows.map((r) => Object.fromEntries(table.columns.map((c, i) => [c, r[i] ?? null])));
  };

  const hasJson = Boolean(spec.json || spec.table);
  const hasPng = Boolean(spec.png || spec.table);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={className}
            aria-label={t('common.export')}
            title={error ?? t('common.export')}
          />
        }
      >
        {busy ? <Spinner /> : <Download className={error ? 'text-destructive' : undefined} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hasPng ? (
          <DropdownMenuItem
            onClick={() =>
              run(async () => {
                const src = pngSource(spec);
                if (!src) throw new Error(t('export.nothing'));
                const blob = await composePng(src.layers, {
                  title: spec.title,
                  subtitle: src.subtitle,
                  footer: src.footer,
                  alphas: src.alphas,
                });
                await saveBlob(`${name}.png`, blob);
              })
            }
          >
            <FileImage />
            PNG
          </DropdownMenuItem>
        ) : null}
        {spec.table ? (
          <DropdownMenuItem
            onClick={() => run(() => saveText(`${name}.csv`, toCsv(spec.table!()), 'text/csv'))}
          >
            <FileSpreadsheet />
            CSV
          </DropdownMenuItem>
        ) : null}
        {hasJson ? (
          <DropdownMenuItem
            onClick={() =>
              run(() =>
                saveText(
                  `${name}.json`,
                  toJson(jsonData(), { title: spec.title, ...spec.meta }),
                  'application/json',
                ),
              )
            }
          >
            <FileJson />
            JSON
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
