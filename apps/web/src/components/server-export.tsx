import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FolderOpen, TriangleAlert, X } from 'lucide-react';
import type { ExportResult } from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { transport } from '@/lib/transport';

export function useServerExport() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<ExportResult>) => {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  const clear = () => {
    setResult(null);
    setError(null);
  };

  return { run, pending, result, error, clear };
}

export function ServerExportNotice({
  result,
  error,
  onClose,
}: {
  result: ExportResult | null;
  error: string | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [revealFailed, setRevealFailed] = useState(false);
  if (!result && !error) return null;

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t('export.failed')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const size = new Intl.NumberFormat(i18n.language, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 1,
  }).format(result!.bytes / 1024 / 1024);

  return (
    <Alert>
      <CheckCircle2 />
      <AlertTitle className="flex items-center gap-2">
        {t('export.done', { size })}
        <Button variant="ghost" size="icon-xs" className="ml-auto" onClick={onClose} aria-label={t('common.close')}>
          <X />
        </Button>
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">{result!.path}</code>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void transport
                .call('app.reveal', { path: result!.path })
                .then((r) => setRevealFailed(!r.ok))
            }
          >
            <FolderOpen data-icon="inline-start" />
            {t('export.reveal')}
          </Button>
          {revealFailed ? (
            <span className="ml-2 text-xs text-muted-foreground">{t('export.revealUnavailable')}</span>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
