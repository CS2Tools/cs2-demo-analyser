import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { CircleCheck, CircleSlash, CircleX, Loader2, X } from 'lucide-react';
import type { IngestProgress, IngestStage } from '@cs2/contract';
import { Button } from '@/components/ui/button';
import { transport } from '@/lib/transport';
import { cn } from '@/lib/utils';

const STAGE_LABELS: Record<IngestStage, string> = {
  hash: 'Identificando o arquivo',
  probe: 'Lendo o cabecalho',
  events: 'Extraindo eventos',
  grenades: 'Trajetorias de granada',
  replay_ticks: 'Dados do replay',
  analysis_ticks: 'Dados de analise',
  economy: 'Economia',
  derive: 'Calculando',
  voice: 'Audio',
  merge: 'Gravando na biblioteca',
};

export function IngestBar({ onFinished }: { onFinished: (matchId: string | null) => void }) {
  const { t } = useTranslation();
  const [job, setJob] = useState<IngestProgress | null>(null);

  useEffect(() => {
    return transport.subscribe('ingest', (msg) => {

      if (msg.duplicateOf) return;

      setJob(msg);
      if (msg.state === 'done') {
        onFinished(msg.matchId);

        setTimeout(() => setJob((cur) => (cur?.jobId === msg.jobId ? null : cur)), 6000);
      }
    });
  }, [onFinished]);

  if (!job) return null;

  const running = job.state === 'running' || job.state === 'queued';
  const failed = job.state === 'error';

  const rejected = job.state === 'rejected';

  return (
    <div className="shrink-0 border-t bg-card px-3 py-2">
      <div className="flex items-center gap-3">
        {running ? <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> : null}
        {job.state === 'done' ? <CircleCheck className="size-4 shrink-0 text-primary" /> : null}
        {failed ? <CircleX className="size-4 shrink-0 text-destructive" /> : null}
        {rejected ? <CircleSlash className="size-4 shrink-0 text-amber-400" /> : null}
        {job.state === 'cancelled' ? <X className="size-4 shrink-0 text-muted-foreground" /> : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-xs font-medium">{job.fileName}</span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-xs',
                rejected ? 'text-amber-400' : 'text-muted-foreground',
              )}
            >
              {failed || rejected
                ? job.error
                : job.state === 'cancelled'
                  ? 'cancelado'
                  : job.state === 'interrupted'
                    ? 'interrompido: o app foi encerrado durante a ingestao'
                    : job.state === 'done'
                      ? (job.message ?? 'pronto')
                      : (STAGE_LABELS[job.stage ?? 'hash'] ?? '')}
            </span>
            {running && job.etaMs ? (
              <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                ~{Math.ceil(job.etaMs / 1000)}s
              </span>
            ) : null}
          </div>

          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-[width] duration-300',
                failed ? 'bg-destructive' : rejected ? 'bg-amber-500' : 'bg-primary',
              )}
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
        </div>

        {running ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void transport.call('ingest.cancel', { jobId: job.jobId })}
          >
            <X data-icon="inline-start" />
            {t('common.cancel')}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={() => setJob(null)}>
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
