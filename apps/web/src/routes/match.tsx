import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Bomb, FileArchive, Info, Pin, PinOff, RefreshCw, ShieldCheck, Swords, TriangleAlert } from 'lucide-react';
import type { MatchDetail, RoundRow } from '@cs2/contract';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ExportButton } from '@/components/export-button';
import { ServerExportNotice, useServerExport } from '@/components/server-export';
import { PrunedBadge } from '@/components/retention-badge';
import { CsIcon } from '@/components/cs-icon';
import { mapIcon } from '@/lib/icons';
import { transport } from '@/lib/transport';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReplayView, type ReplaySeek } from '@/components/replay/replay-view';
import {
  AimSection,
  AnalysisGate,
  DuelSection,
  EconomySection,
  MapSection,
  RoundsSection,
  useMatchAnalysis,
  UtilitySection,
} from '@/routes/analysis';
import { AllFindings, FindingsSummary } from '@/components/verdict/findings-view';
import { ChatPanel } from '@/components/match/chat-panel';
import { RosterPanel } from '@/components/match/roster-panel';
import { useRoute } from '@/lib/use-route';
import { cleanName, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MatchView({
  matchId,
  onBack,
  onOpenMatch,

  initialSeek,
}: {
  matchId: string;
  onBack: () => void;
  onOpenMatch: (id: string) => void;
  initialSeek?: { roundNum: number; tick?: number; nonce: number } | null;
}) {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useRoute('match.get', { matchId }, [matchId]);
  const exporter = useServerExport();
  const [pinning, setPinning] = useState(false);
  const reprocess = useReprocess(matchId, onOpenMatch);
  const findings = useRoute('match.findings', { matchId }, [matchId]);
  const chat = useRoute('match.chat', { matchId }, [matchId]);
  const roster = useRoute('match.roster', { matchId }, [matchId]);

  const analysis = useMatchAnalysis(matchId);
  const [tab, setTab] = useState('resumo');
  const [seek, setSeek] = useState<ReplaySeek | null>(null);

  useEffect(() => {
    if (!initialSeek) return;

    setSeek({ roundNum: initialSeek.roundNum, tick: initialSeek.tick ?? 0, nonce: initialSeek.nonce });
    setTab('replay');
  }, [initialSeek]);

  const seekTo = (roundNum: number, tick: number) => {
    setSeek((prev) => ({ roundNum, tick, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab('replay');
  };

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !data) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t('matchScreen.openError')}</AlertTitle>
        <AlertDescription>{error ?? 'partida nao encontrada'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          {t('nav.library')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={reprocess.state === 'running'}
            title={t('reprocess.hint')}
            onClick={() => void reprocess.start()}
          >
            {reprocess.state === 'running' ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            {t('reprocess.button')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pinning}
            title={t('retention.pinHint')}
            onClick={() => {
              setPinning(true);
              void transport
                .call('match.pin', { matchId, pinned: !data.summary.pinned })
                .then(reload)
                .finally(() => setPinning(false));
            }}
          >
            {data.summary.pinned ? <PinOff data-icon="inline-start" /> : <Pin data-icon="inline-start" />}
            {data.summary.pinned ? t('retention.unpin') : t('retention.pin')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporter.pending}
            title={t('export.matchHint')}
            onClick={() => void exporter.run(() => transport.call('export.match', { matchId }))}
          >
            {exporter.pending ? <Spinner data-icon="inline-start" /> : <FileArchive data-icon="inline-start" />}
            {t('export.match')}
          </Button>
        </div>
      </div>

      <ServerExportNotice result={exporter.result} error={exporter.error} onClose={exporter.clear} />
      {reprocess.state === 'missing' ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('reprocess.missingTitle')}</AlertTitle>
          <AlertDescription>
            {t('reprocess.missing')}
            {reprocess.originalPath ? (
              <code className="mt-1 block break-all text-xs">{reprocess.originalPath}</code>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : reprocess.state === 'error' ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('reprocess.failed')}</AlertTitle>
          <AlertDescription>{reprocess.error}</AlertDescription>
        </Alert>
      ) : null}

      <MatchHeader detail={data} />
      <SegmentationNotice detail={data} />
      <ValidationNotice detail={data} />

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>

        <TabsList>
          <TabsTrigger value="resumo">{t('tabs.summary')}</TabsTrigger>
          <TabsTrigger value="mira">{t('tabs.aim')}</TabsTrigger>
          <TabsTrigger value="duelos">{t('tabs.duels')}</TabsTrigger>
          <TabsTrigger value="rounds">{t('tabs.rounds')}</TabsTrigger>
          <TabsTrigger value="economia">{t('tabs.economy')}</TabsTrigger>
          <TabsTrigger value="utilitario">{t('tabs.utility')}</TabsTrigger>
          <TabsTrigger value="mapa">{t('tabs.map')}</TabsTrigger>
          <TabsTrigger value="replay">{t('tabs.replay')}</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="flex flex-col gap-6">
          <FindingsSummary
            findings={findings.data}
            loading={findings.loading}
            error={findings.error}
            onSeek={seekTo}
            canSeek={data.summary.hasRadar}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Scoreboard detail={data} />
            <RoundTimeline detail={data} />
          </div>
          {findings.data ? (
            <AllFindings findings={findings.data} onSeek={seekTo} canSeek={data.summary.hasRadar} />
          ) : null}
          {roster.data ? (
            <RosterPanel
              roster={roster.data}
              teams={{ a: data.summary.teamAName, b: data.summary.teamBName }}
            />
          ) : null}
          {chat.data ? (
            <ChatPanel
              chat={chat.data}
              detail={data}
              onSeek={seekTo}
              onReprocess={() => void reprocess.start()}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="mira">
          <AnalysisGate state={analysis}>{(a) => <AimSection analysis={a} />}</AnalysisGate>
        </TabsContent>

        <TabsContent value="duelos">
          <AnalysisGate state={analysis}>{(a) => <DuelSection analysis={a} />}</AnalysisGate>
        </TabsContent>

        <TabsContent value="rounds">
          <AnalysisGate state={analysis}>{(a) => <RoundsSection analysis={a} />}</AnalysisGate>
        </TabsContent>

        <TabsContent value="economia">
          <AnalysisGate state={analysis}>{(a) => <EconomySection analysis={a} />}</AnalysisGate>
        </TabsContent>

        <TabsContent value="utilitario">
          <AnalysisGate state={analysis}>{(a) => <UtilitySection analysis={a} />}</AnalysisGate>
        </TabsContent>

        <TabsContent value="mapa">
          <AnalysisGate state={analysis}>{(a) => <MapSection analysis={a} />}</AnalysisGate>
        </TabsContent>

        <TabsContent value="replay">
          <ReplayView detail={data} seek={seek} onReprocess={() => void reprocess.start()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchHeader({ detail }: { detail: MatchDetail }) {
  const { t } = useTranslation();
  const s = detail.summary;
  const aWon = (s.scoreA ?? 0) > (s.scoreB ?? 0);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
        <div className="flex items-center gap-3">
          <CsIcon rel={mapIcon(s.mapName)} title={s.mapName} className="size-10" />
          <div>
            <div className="text-xs text-muted-foreground">{t('segmentation.mapLabel')}</div>
            <div className="text-lg font-semibold">{s.mapName}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <TeamScore name={cleanName(s.teamAName ?? 'Time A')} score={s.scoreA} won={aWon} />
          <span className="text-2xl text-muted-foreground">:</span>
          <TeamScore name={cleanName(s.teamBName ?? 'Time B')} score={s.scoreB} won={!aWon} />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {s.source ? <Badge variant="secondary">{t(`labels.source.${s.source}`, { defaultValue: s.source })}</Badge> : null}
          <Badge variant="outline" className="font-mono">{s.tickRate} tick</Badge>
          {s.demoBuild ? (
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" className="font-mono" />}>
                {t('frag2.demoBuildBadge', { build: s.demoBuild })}
              </TooltipTrigger>
              <TooltipContent>
                {t('frag2.demoBuildTip', {
                  format: s.demoFormat ? t('frag2.demoFormat', { format: s.demoFormat }) : '',
                })}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {!s.hasVoice ? (
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" />}>
                {t('matchScreen.noVoice')}
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-72">{t('matchScreen.noVoiceDesc')}</div>
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Badge variant="outline">{formatDuration(s.durationSeconds)}</Badge>
          {s.pinned ? (
            <Badge variant="secondary">
              <Pin />
              {t('matchScreen.pinned')}
            </Badge>
          ) : null}
          <PrunedBadge bulkState={s.bulkState} />
          {!s.hasRadar ? (
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" />}>
                {t('matchScreen.noRadar')}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{t('matchScreen.noRadarDesc')}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamScore({ name, score, won }: { name: string; score: number | null; won: boolean }) {
  return (
    <div className={cn('text-center', !won && 'opacity-60')}>
      <div className="max-w-40 truncate text-xs text-muted-foreground">{name}</div>
      <div className="font-mono text-3xl tabular-nums">{score ?? '—'}</div>
    </div>
  );
}

function SegmentationNotice({ detail }: { detail: MatchDetail }) {
  const { t } = useTranslation();
  const { summary, discardedRounds } = detail;
  if (discardedRounds.length === 0 && summary.restartCount === 0) return null;

  const knife = discardedRounds.filter((r) => r.phase === 'knife').length;
  const warmup = discardedRounds.filter((r) => r.phase === 'warmup').length;
  const other = discardedRounds.length - knife - warmup;

  return (
    <Alert>
      <Info />
      <AlertTitle>
        {t('segmentation.title', { count: discardedRounds.length })}
      </AlertTitle>
      <AlertDescription>
        {t('segmentation.restarts', { count: summary.restartCount })}
        {knife > 0 ? ` ${t('segmentation.knife')}` : ''}
        {warmup > 0 ? ` ${t('segmentation.warmup', { count: warmup })}` : ''}
        {other > 0 ? ` ${t('segmentation.other', { count: other })}` : ''}{' '}
        {t('segmentation.why')}
      </AlertDescription>
    </Alert>
  );
}

function ValidationNotice({ detail }: { detail: MatchDetail }) {
  const { t } = useTranslation();
  const failed = detail.validation.filter((v) => !v.ok);
  if (failed.length === 0) return null;

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>{t('matchScreen.checksFailed')}</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
          {failed.map((v) => (
            <li key={v.check}>
              <span className="font-medium">{v.check}</span>: {v.detail}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function Scoreboard({ detail }: { detail: MatchDetail }) {
  const { t } = useTranslation();
  const byTeam = new Map<string, typeof detail.scoreboard>();
  for (const p of detail.scoreboard) {
    const key = p.teamName ?? '—';
    const list = byTeam.get(key) ?? [];
    list.push(p);
    byTeam.set(key, list);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="size-4" />
          {t('misc2.scoreboard')}
        </CardTitle>
        <CardDescription>
          {t('ui.liveOnly')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('misc2.scoreboard'),
              meta: {
                matchId: detail.summary.matchId,
                references: { escopo: 'so rounds live; round faca e aquecimento excluidos' },
              },
              table: () => ({
                columns: ['steam_id', 'jogador', 'time', 'lado_inicial', 'rounds', 'kills', 'mortes',
                  'assistencias', 'saldo', 'headshots', 'hs_pct', 'dano_total', 'adr', 'kast',
                  'dano_utilitario', 'inimigos_cegos', 'aliados_cegos'],
                rows: detail.scoreboard.map((p) => [p.steamId, cleanName(p.name), p.teamName,
                  p.startingSide, p.roundsPlayed, p.kills, p.deaths, p.assists, p.plusMinus,
                  p.headshots, p.headshotPct, p.damageTotal, p.adr, p.kastPct, p.utilityDamage,
                  p.enemiesFlashed, p.teammatesFlashed]),
              }),
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">{t('table.player')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('table.kills')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('table.deaths')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('table.assists')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('table.plusMinus')}</th>
              <th className="px-2 py-1.5 text-right font-medium">
                <Tooltip>
                  <TooltipTrigger render={<span className="cursor-help" />}>
                    {t('table.hsPct')}
                  </TooltipTrigger>
                  <TooltipContent>{t('table.hsPctDesc')}</TooltipContent>
                </Tooltip>
              </th>
              <th className="px-2 py-1.5 text-right font-medium">
                <Tooltip>
                  <TooltipTrigger render={<span className="cursor-help" />}>
                    {t('glossary.adr')}
                  </TooltipTrigger>
                  <TooltipContent>{t('glossary.adr_desc')}</TooltipContent>
                </Tooltip>
              </th>
              <th className="px-2 py-1.5 text-right font-medium">
                <Tooltip>
                  <TooltipTrigger render={<span className="cursor-help" />}>
                    {t('glossary.kast')}
                  </TooltipTrigger>
                  <TooltipContent>{t('glossary.kast_desc')}</TooltipContent>
                </Tooltip>
              </th>
              <th className="px-2 py-1.5 text-right font-medium">{t('table.util')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('table.flash')}</th>
            </tr>
          </thead>
          {[...byTeam.entries()].map(([team, players]) => (
            <tbody key={team}>
              <tr>
                <td colSpan={10} className="bg-muted/20 px-3 py-1 text-xs font-medium">
                  {cleanName(team)}
                </td>
              </tr>
              {players.map((p) => (
                <tr
                  key={p.steamId}
                  className={cn('border-b last:border-0', p.isUser && 'bg-primary/10')}
                >
                  <td className="max-w-56 truncate px-3 py-1.5" title={`${p.name}\nSteamID64: ${p.steamId}`}>
                    {cleanName(p.name)}
                    {p.isUser ? (
                      <Badge variant="default" className="ml-2 text-[9px]">
                        {t('matchScreen.you')}
                      </Badge>
                    ) : null}
                    {p.isPoi && !p.isUser ? (
                      <Badge variant="secondary" className="ml-2 text-[9px]">
                        {t('matchScreen.followed')}
                      </Badge>
                    ) : null}

                    {!p.playedAllRounds && p.firstRound !== null && p.lastRound !== null ? (
                      <Badge
                        variant="outline"
                        className="ml-2 font-mono text-[9px]"
                        title={t('matchScreen.roundWindowTip', { rounds: p.roundsPlayed })}
                      >
                        {t('matchScreen.roundWindow', {
                          first: p.firstRound,
                          last: p.lastRound,
                        })}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{p.kills}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{p.deaths}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{p.assists}</td>
                  <td
                    className={cn(
                      'px-2 py-1.5 text-right font-mono tabular-nums',
                      p.plusMinus > 0 && 'text-primary',
                      p.plusMinus < 0 && 'text-destructive',
                    )}
                  >
                    {p.plusMinus > 0 ? '+' : ''}
                    {p.plusMinus}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {p.headshotPct === null ? '—' : `${Math.round(p.headshotPct * 100)}%`}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {p.adr === null ? '—' : p.adr.toFixed(1)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {p.kastPct === null ? '—' : `${Math.round(p.kastPct * 100)}%`}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                    {p.utilityDamage}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                    {p.enemiesFlashed}
                    {p.teammatesFlashed > 0 ? (
                      <span className="text-destructive"> / {p.teammatesFlashed}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </CardContent>
    </Card>
  );
}

function RoundTimeline({ detail }: { detail: MatchDetail }) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">{t('table.rounds')}</CardTitle>
        <CardAction>
          <ExportButton
            spec={{
              title: t('table.rounds'),
              meta: { matchId: detail.summary.matchId },
              table: () => ({
                columns: ['round', 'fase', 'vencedor_lado', 'motivo', 'kills', 'duracao_s',
                  'placar_a', 'placar_b', 'tick_bomba_plantada', 'tick_desarme'],
                rows: [...detail.rounds, ...detail.discardedRounds].map((r) => [r.roundNum, r.phase,
                  r.winnerSide, r.winReason, r.kills, r.durationSeconds, r.scoreAAfter,
                  r.scoreBAfter, r.bombPlantTick, r.bombDefuseTick]),
              }),
            }}
          />
        </CardAction>
        <CardDescription>
          {t('matchScreen.liveRoundCount', { count: detail.rounds.length })}
          {detail.discardedRounds.length > 0
            ? t('matchScreen.plusDiscarded', { count: detail.discardedRounds.length })
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5 p-2">
        {detail.rounds.map((r) => (
          <RoundRowItem key={r.roundNum} round={r} />
        ))}
        {detail.discardedRounds.length > 0 ? (
          <>
            <div className="mt-3 px-2 text-xs font-medium text-muted-foreground">
              {t('ui.outOfMatch')}
            </div>
            {detail.discardedRounds.map((r) => (
              <RoundRowItem key={`d-${r.endTick}`} round={r} discarded />
            ))}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

const PHASE_LABELS: Record<string, string> = {
  knife: 'Round Faca',
  warmup: 'Aquecimento',
  restart_discarded: 'Descartado (restart)',
};

function RoundRowItem({ round, discarded }: { round: RoundRow; discarded?: boolean }) {
  const { t } = useTranslation();
  const ct = round.winnerSide === 'CT';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1 text-xs',
        discarded ? 'opacity-50' : 'hover:bg-accent',
      )}
    >
      <span className="w-6 text-right font-mono tabular-nums text-muted-foreground">
        {discarded ? '—' : round.roundNum}
      </span>

      <span
        className={cn(
          'w-6 rounded px-1 text-center font-mono text-[10px] font-semibold',
          round.winnerSide === null && 'bg-muted text-muted-foreground',
          ct && 'bg-sky-500/20 text-sky-300',
          round.winnerSide === 'T' && 'bg-amber-500/20 text-amber-300',
        )}
      >
        {round.winnerSide ?? '?'}
      </span>

      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {discarded
          ? (PHASE_LABELS[round.phase] ?? round.phase)
          : round.winReason
            ? t(`labels.winReason.${round.winReason}`, { defaultValue: round.winReason })
            : '—'}
      </span>

      {round.bombPlantTick !== null ? (
        <Bomb className="size-3 shrink-0 text-amber-400" />
      ) : null}
      {round.bombDefuseTick !== null ? (
        <ShieldCheck className="size-3 shrink-0 text-sky-400" />
      ) : null}

      <span className="w-8 text-right font-mono tabular-nums text-muted-foreground">
        {round.kills}k
      </span>
      <span className="w-10 text-right font-mono tabular-nums text-muted-foreground">
        {formatDuration(round.durationSeconds)}
      </span>
      {!discarded ? (

        <span className="w-12 text-right font-mono tabular-nums">
          {round.scoreAAfter ?? '—'}-{round.scoreBAfter ?? '—'}
        </span>
      ) : (
        <span className="w-12" />
      )}
    </div>
  );
}

function useReprocess(matchId: string, onOpenMatch: (id: string) => void) {
  const [state, setState] = useState<'idle' | 'running' | 'missing' | 'error'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [originalPath, setOriginalPath] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    return transport.subscribe('ingest', (msg) => {
      if (msg.jobId !== jobId) return;
      if (msg.state === 'done' && msg.matchId) {
        setState('idle');
        onOpenMatch(msg.matchId);
      } else if (msg.state === 'error' || msg.state === 'cancelled' || msg.state === 'interrupted') {
        setState('error');
        setError(msg.error ?? msg.state);
      }
    });
  }, [jobId, onOpenMatch]);

  const start = async () => {
    setState('running');
    setError(null);
    try {
      const r = await transport.call('match.reprocess', { matchId });
      setOriginalPath(r.originalPath);
      if (r.source === 'missing' || !r.jobId) {
        setState('missing');
        return;
      }
      setJobId(r.jobId);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return { state, error, originalPath, start };
}
