import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  FileVideo,
  FolderOpen,
  Mic,
  Pin,
  PinOff,
  History,
  Map as MapIcon,
  MoreVertical,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import type { MatchSummary } from '@cs2/contract';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DuplicateDialog, type DuplicateTarget } from '@/components/duplicate-dialog';
import { ServerExportNotice, useServerExport } from '@/components/server-export';
import { PrunedBadge } from '@/components/retention-badge';
import { CsIcon } from '@/components/cs-icon';
import { mapIcon } from '@/lib/icons';
import { canPickFiles, pickDemoFiles, readDroppedDemos } from '@/lib/demo-files';
import { Spinner } from '@/components/ui/spinner';
import { useRoute } from '@/lib/use-route';
import { transport } from '@/lib/transport';
import { cleanName, formatDateTime, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  onOpenMatch: (matchId: string) => void;
  refreshKey: number;
}

export function LibraryView({ onOpenMatch, refreshKey }: Props) {
  const { t, i18n } = useTranslation();

  const [filter, setFilter] = useState<'all' | 'mine' | 'poi'>('all');
  const { data: settings } = useRoute('settings.get', {});
  const { data: matches, loading, reload } = useRoute(
    'matches.list',
    { filter },
    [refreshKey, filter],
  );
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [duplicate, setDuplicate] = useState<DuplicateTarget | null>(null);
  const [toDelete, setToDelete] = useState<MatchSummary | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const exporter = useServerExport();

  useEffect(() => {
    reload();
  }, [refreshKey, reload]);

  const submit = useCallback(
    async (path: string, force = false) => {
      setError(null);
      try {
        const res = await transport.call('ingest.submit', { path, force });
        if (res.state === 'duplicate' && res.matchId) {

          setDuplicate({
            path,
            fileName: path.split(/[\\/]/).pop() ?? path,
            matchId: res.matchId,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const submitMany = useCallback(
    async (paths: string[]) => {
      for (const path of paths) await submit(path);
    },
    [submit],
  );

  const onDrop = useCallback(
    (ev: React.DragEvent) => {
      ev.preventDefault();
      setDragging(false);
      const { paths, ignored, withoutPath } = readDroppedDemos(ev.dataTransfer.files);

      if (paths.length > 0) void submitMany(paths);

      if (withoutPath.length > 0) {

        setPathInput(withoutPath[0]!);
        setError(
          'Este navegador nao informa onde o arquivo esta. Cole o caminho completo no campo ' +
            'acima — no aplicativo, arrastar funciona.',
        );
      } else if (paths.length === 0 && ignored.length > 0) {
        setError(`"${ignored[0]}" nao e um arquivo .dem.`);
      }
    },
    [submitMany],
  );

  const choose = useCallback(async () => {
    setError(null);
    const paths = await pickDemoFiles();
    if (paths.length > 0) await submitMany(paths);
  }, [submitMany]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    await transport.call('match.delete', { matchId: toDelete.matchId });
    setToDelete(null);
    reload();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex h-full min-h-0 flex-col gap-4 rounded-lg transition-colors',
        dragging && 'bg-primary/5 outline-2 outline-dashed outline-primary',
      )}
    >
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (pathInput.trim()) void submit(pathInput.trim());
        }}
      >
        {canPickFiles() ? (
          <>
            <Button type="button" onClick={() => void choose()}>
              <FolderOpen data-icon="inline-start" />
              {t('ui.chooseDemos')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('ui.dragHint')}
            </span>
          </>
        ) : (
          <>
            <Input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder={t('libraryScreen.pathPlaceholder')}
              className="max-w-xl font-mono text-xs"
              aria-label={t('libraryScreen.pathLabel')}
            />
            <Button type="submit">
              <FolderOpen data-icon="inline-start" />
              {t('libraryScreen.import')}
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory((v) => !v)}
        >
          <History data-icon="inline-start" />
          {t('libraryFilter.history')}
        </Button>

        <LibraryFilter
          value={filter}
          onChange={setFilter}
          hasUser={Boolean(settings?.userSteamId)}
          poiCount={settings?.playersOfInterest.length ?? 0}
        />
        {matches && matches.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={exporter.pending}
            title={t('export.libraryHint')}
            onClick={() => void exporter.run(() => transport.call('export.library', {}))}
          >
            {exporter.pending ? <Spinner data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
            {t('export.library')}
          </Button>
        ) : null}
      </form>

      <ServerExportNotice result={exporter.result} error={exporter.error} onClose={exporter.clear} />

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('libraryScreen.importError')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {showHistory ? <IngestHistory refreshKey={refreshKey} /> : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : matches && matches.length > 0 ? (
        <div className="flex flex-col gap-2">
          {matches.map((m) => (
            <MatchCard
              key={m.matchId}
              match={m}
              locale={i18n.language}
              onOpen={onOpenMatch}
              onDelete={() => setToDelete(m)}
              onTogglePin={() =>
                void transport
                  .call('match.pin', { matchId: m.matchId, pinned: !m.pinned })
                  .then(reload)
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">{dragging ? <Upload /> : <FileVideo />}</EmptyMedia>
              <EmptyTitle>{dragging ? t('library.dropHere') : t('library.noMatches')}</EmptyTitle>
              <EmptyDescription>{t('library.noMatchesHint')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        </div>
      )}

      <DuplicateDialog
        target={duplicate}
        onOpenExisting={(matchId) => {
          setDuplicate(null);
          onOpenMatch(matchId);
        }}
        onReprocess={(path) => {
          setDuplicate(null);
          void submit(path, true);
        }}
        onCancel={() => setDuplicate(null)}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('libraryScreen.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.mapName} — {cleanName(toDelete?.teamAName ?? '')} {toDelete?.scoreA}x
              {toDelete?.scoreB} {cleanName(toDelete?.teamBName ?? '')}
              <br />
              <br />
              {t('libraryScreen.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              {t('libraryScreen.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const JOB_STATE_LABELS: Record<string, string> = {
  done: 'concluida',
  error: 'erro',
  rejected: 'recusada',
  cancelled: 'cancelada',
  interrupted: 'interrompida',
  running: 'em andamento',
  queued: 'na fila',
};

function IngestHistory({ refreshKey }: { refreshKey: number }) {
  const { t } = useTranslation();
  const { data: jobs, loading } = useRoute('ingest.jobs', {}, [refreshKey]);
  const { i18n } = useTranslation();

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-3 text-sm text-muted-foreground">
          {t('ui.noImports')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-2">
        {jobs.map((j) => (
          <div key={j.jobId} className="flex items-center gap-3 text-xs">
            <Badge
              variant={
                j.state === 'done'
                  ? 'secondary'
                  : j.state === 'error'
                    ? 'destructive'
                    : 'outline'
              }
              className="w-24 justify-center text-[10px]"
            >
              {JOB_STATE_LABELS[j.state] ?? j.state}
            </Badge>
            <span className="max-w-64 truncate font-mono">{j.fileName}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{j.error ?? ''}</span>
            <span className="shrink-0 text-muted-foreground">
              {j.startedAt ? formatDateTime(j.startedAt, i18n.language) : ''}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MatchCard({
  match,
  locale,
  onOpen,
  onDelete,
  onTogglePin,
}: {
  match: MatchSummary;
  locale: string;
  onOpen: (id: string) => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const { t } = useTranslation();
  const aWon = (match.scoreA ?? 0) > (match.scoreB ?? 0);

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/60"
      onClick={() => onOpen(match.matchId)}
    >
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
        <div className="flex items-center gap-2">
          <CsIcon
            rel={mapIcon(match.mapName)}
            title={match.mapName}
            className="size-7"
          />
          <span className="font-medium">{match.mapName}</span>
          {!match.hasRadar ? (
            <Badge variant="outline" className="text-[10px]">
              {t('ui.noRadarBadge')}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2 font-mono text-lg tabular-nums">
          <span className={cn(aWon ? 'text-foreground' : 'text-muted-foreground')}>
            {match.scoreA ?? '—'}
          </span>
          <span className="text-muted-foreground">:</span>
          <span className={cn(!aWon ? 'text-foreground' : 'text-muted-foreground')}>
            {match.scoreB ?? '—'}
          </span>
        </div>

        <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {cleanName(match.teamAName ?? 'Time A')} vs {cleanName(match.teamBName ?? 'Time B')}
        </div>

        <div className="flex items-center gap-2">
          {match.source ? (
            <Badge variant="secondary" className="text-[10px]">
              {t(`labels.source.${match.source}`, { defaultValue: match.source })}
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-[10px] font-mono">
            {match.tickRate} tick
          </Badge>
          {match.hasKnifeRound ? (
            <Badge variant="outline" className="text-[10px]">
              {t('libraryFilter.knifeRound')}
            </Badge>
          ) : null}
          {match.hasWarnings ? (
            <Badge variant="destructive" className="text-[10px]">
              {t('ui.warnings')}
            </Badge>
          ) : null}
          {match.pinned ? (
            <Badge variant="secondary" className="text-[10px]" title={t('retention.pinHint')}>
              <Pin />
              {t('retention.pinned')}
            </Badge>
          ) : null}
          <PrunedBadge bulkState={match.bulkState} className="cursor-help text-[10px] text-muted-foreground" />
          {match.hasVoice ? (
            <Badge variant="outline" className="text-[10px]" title={t('voice.badgeHint')}>
              <Mic />
              {t('voice.badge')}
            </Badge>
          ) : null}
        </div>

        <div className="text-right text-xs text-muted-foreground">
          <div>{formatDuration(match.durationSeconds)}</div>

          <div
            title={
              match.playedAt
                ? match.playedAtSource === 'filename'
                  ? 'Data da partida, lida do nome do arquivo'
                  : 'Data da partida, pela data do arquivo .dem original'
                : 'Data da importacao: a demo nao traz a data da partida, e o nome do arquivo tambem nao'
            }
          >
            {match.playedAt ? null : (
              <span className="opacity-60">{t('libraryScreen.imported')} </span>
            )}
            {formatDateTime(match.playedAt ?? match.ingestedAt, locale)}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t('libraryScreen.actions')} />
            }
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onTogglePin}>
                {match.pinned ? <PinOff /> : <Pin />}
                {match.pinned ? t('retention.unpin') : t('retention.pin')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 />
                {t('ui.deleteMatch')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function LibraryFilter({
  value,
  onChange,
  hasUser,
  poiCount,
}: {
  value: 'all' | 'mine' | 'poi';
  onChange: (v: 'all' | 'mine' | 'poi') => void;
  hasUser: boolean;
  poiCount: number;
}) {
  const { t } = useTranslation();
  const options = [
    { id: 'all' as const, label: t('libraryFilter.all'), enabled: true, why: '' },
    {
      id: 'mine' as const,
      label: t('libraryFilter.mine'),
      enabled: hasUser,
      why: t('libraryFilter.mineWhy'),
    },
    {
      id: 'poi' as const,
      label: t('libraryFilter.poi'),
      enabled: poiCount > 0,
      why: t('libraryFilter.poiWhy'),
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {options.map((o) => (
        <Tooltip key={o.id}>
          <TooltipTrigger
            render={
              <Badge
                variant={value === o.id ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer text-[10px]',
                  !o.enabled && 'cursor-not-allowed opacity-40',
                )}
                onClick={() => o.enabled && onChange(o.id)}
              />
            }
          >
            {o.label}
          </TooltipTrigger>
          {o.enabled ? null : <TooltipContent>{o.why}</TooltipContent>}
        </Tooltip>
      ))}
    </div>
  );
}
