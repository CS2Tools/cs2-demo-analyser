import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, ListChecks, Sparkles, TriangleAlert } from 'lucide-react';
import type { MatchFindings, VerdictWire } from '@cs2/contract';
import type { SupportedLocale } from '@cs2/i18n';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/export-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { cellKey, FAMILIES, groupFindings, sortBySeverity, worstSeverity } from './grid-model';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BaselineChip } from './baseline-chip';
import { formatMetric, isSignedMetric } from './format-metric';
import { SEVERITY_STYLES, VerdictCard } from './verdict-card';

type Seek = (roundNum: number, tick: number) => void;

export function FindingsSummary({
  findings,
  loading,
  error,
  onSeek,
  canSeek,
}: {
  findings: MatchFindings | null;
  loading: boolean;
  error: string | null;
  onSeek: Seek;
  canSeek: boolean;
}) {
  const { t } = useTranslation();

  if (loading && !findings) return <Skeleton className="h-48 w-full" />;
  if (error || !findings) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t('errors.generic')}</AlertTitle>
        <AlertDescription>{error ?? '—'}</AlertDescription>
      </Alert>
    );
  }

  const focusLabel =
    findings.focus.kind === 'user'
      ? t('verdict.focusUser')
      : findings.focus.kind === 'poi'
        ? t('verdict.focusPoi')
        : t('verdict.focusMatch');

  const pending = findings.history.filter((h) => h.priorMatches < h.required);

  return (
    <section className="flex flex-col gap-3" aria-label={t('verdict.summaryTitle')}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-primary" />
          {t('verdict.summaryTitle')}
        </h2>
        <span className="text-xs text-muted-foreground">{focusLabel}</span>
        {findings.focus.kind === 'match' ? (
          <span className="text-xs text-muted-foreground/80">— {t('verdict.focusMatchHint')}</span>
        ) : null}
      </div>

      {pending.length > 0 ? (
        <div className="flex flex-col gap-0.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {pending.map((h) => (
            <span key={h.steamId} className="flex items-center gap-1.5">
              <Info className="size-3 shrink-0" />
              {t('verdict.historyPending', {
                name: cleanName(h.name),
                have: h.priorMatches,
                required: h.required,
              })}
            </span>
          ))}
        </div>
      ) : null}

      {findings.insufficientPresence.length > 0 ? (

        <div className="flex flex-col gap-0.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {findings.insufficientPresence.map((p) => (
            <span key={p.steamId} className="flex items-center gap-1.5">
              <Info className="size-3 shrink-0" />
              {t('verdict.presencePending', {
                name: cleanName(p.name),
                played: p.roundsPlayed,
                total: p.liveRounds,
              })}
            </span>
          ))}
        </div>
      ) : null}

      {findings.summary.length === 0 ? (
        <Alert>
          <Info />
          <AlertDescription>{t('verdict.noFindings')}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {findings.summary.map((v) => (
            <VerdictCard key={v.id} verdict={v} onSeek={onSeek} canSeek={canSeek} />
          ))}
        </div>
      )}
    </section>
  );
}

export function AllFindings({
  findings,
  onSeek,
  canSeek = false,
}: {
  findings: MatchFindings;
  onSeek?: Seek;
  canSeek?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as SupportedLocale;
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<string | null>(null);

  const { byPlayer, byCell } = groupFindings(findings.all);
  const focus = new Set(findings.focus.steamIds);
  const players = [...byPlayer.entries()].sort(
    ([a, va], [b, vb]) =>
      Number(focus.has(b)) - Number(focus.has(a)) ||
      cleanName(va[0]!.playerName).localeCompare(cleanName(vb[0]!.playerName)),
  );
  const chosen = sortBySeverity(selected ? (byCell.get(selected) ?? []) : []);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4" />
          {t('verdict.allFindings')}
        </CardTitle>
        <CardDescription>
          {view === 'grid' ? t('verdict.gridHint') : t('verdict.allFindingsHint')}
        </CardDescription>
        <CardAction className="flex items-center gap-1.5">

          {(['grid', 'list'] as const).map((v) => (
            <Badge
              key={v}
              variant={view === v ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => setView(v)}
            >
              {t(v === 'grid' ? 'verdict.gridView' : 'verdict.listView')}
            </Badge>
          ))}
          <ExportButton
            spec={{
              title: t('verdict.allFindings'),
              meta: {
                matchId: findings.matchId,
                references: {
                  rulesVersion: findings.rulesVersion,
                  focus: findings.focus,
                  baseline:
                    'own_history = partidas anteriores do jogador; match_relative = jogadores desta partida; fixed_reference = limiar declarado; insufficient_data = sem base',
                },
              },

              table: () => ({
                columns: ['steam_id', 'jogador', 'regra', 'valor', 'unidade', 'amostra', 'severidade',
                  'confianca', 'base', 'base_detalhe', 'titulo'],
                rows: findings.all.map((v) => [v.steamId, cleanName(v.playerName), v.ruleId,
                  v.value, v.unit, v.sampleN, v.severity, v.confidence, v.baseline.kind,
                  JSON.stringify(v.baseline), t(v.titleKey)]),
              }),
              json: () => findings,
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {view === 'grid' ? (
          <>
            <FindingsGrid
              players={players.map(([steamId, verdicts]) => ({
                steamId,
                name: cleanName(verdicts[0]!.playerName),
              }))}
              byCell={byCell}
              focus={focus}
              selected={selected}
              onSelect={setSelected}
            />
            {chosen.length > 0 ? (
              <div className="grid gap-3 border-t bg-muted/10 p-3 md:grid-cols-2 2xl:grid-cols-3">
                {chosen.map((v) => (
                  <VerdictCard key={v.id} verdict={v} onSeek={onSeek} canSeek={canSeek} />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {players.map(([steamId, verdicts]) => (
                <PlayerRows
                  key={steamId}
                  name={cleanName(verdicts[0]!.playerName)}
                  highlighted={focus.has(steamId)}
                  verdicts={sortBySeverity(verdicts)}
                  locale={locale}
                />
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerRows({
  name,
  highlighted,
  verdicts,
  locale,
}: {
  name: string;
  highlighted: boolean;
  verdicts: VerdictWire[];
  locale: SupportedLocale;
}) {
  const { t } = useTranslation();
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className={cn(
            'border-t bg-muted/20 px-3 py-1 text-xs font-medium',
            highlighted && 'bg-primary/10',
          )}
        >
          {name}
        </td>
      </tr>
      {verdicts.map((v) => (
        <tr key={v.id} className="border-t border-border/50">
          <td className="w-40 px-3 py-1.5 text-xs">{t(`verdict.ruleName.${v.ruleId}`)}</td>
          <td className="w-24 px-2 py-1.5 text-right font-mono text-xs tabular-nums">
            {formatMetric(v.value, v.unit, locale, isSignedMetric(v.ruleId))}
          </td>
          <td className="w-32 px-2 py-1.5 text-xs">
            <span className="flex items-center gap-1.5">
              <span className={cn('size-1.5 shrink-0 rounded-full', SEVERITY_STYLES[v.severity].strip)} />
              <span className={SEVERITY_STYLES[v.severity].text}>
                {t(`verdict.severity.${v.severity}`)}
              </span>
            </span>
          </td>
          <td className="px-3 py-1.5">
            <BaselineChip baseline={v.baseline} unit={v.unit} />
          </td>
        </tr>
      ))}
    </>
  );
}

function FindingsGrid({
  players,
  byCell,
  focus,
  selected,
  onSelect,
}: {
  players: { steamId: string; name: string }[];
  byCell: Map<string, VerdictWire[]>;
  focus: Set<string>;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[36rem]">
        <THead>
          <Th align="left">{t('verdict.player')}</Th>
          {FAMILIES.map((f) => (
            <Th key={f} align="right">
              {t(`verdict.family.${f}`)}
            </Th>
          ))}
        </THead>
        <TBody>
          {players.map((p) => (
            <Tr key={p.steamId} className={cn(focus.has(p.steamId) && 'bg-primary/5')}>
              <Td align="left" className="max-w-40">
                <span className="truncate" title={`${p.name}\nSteamID64: ${p.steamId}`}>
                  {p.name}
                </span>
              </Td>
              {FAMILIES.map((f) => {
                const key = cellKey(p.steamId, f);
                const list = byCell.get(key) ?? [];
                if (list.length === 0) {
                  return (
                    <Td key={f} muted title={t('verdict.gridNoFinding')}>
                      —
                    </Td>
                  );
                }
                const severity = worstSeverity(list);

                const breakdown = (
                  ['critical', 'warning', 'positive', 'neutral'] as const
                )
                  .map((s) => {
                    const n = list.filter((v) => v.severity === s).length;
                    return n > 0 ? `${n} ${t(`verdict.severity.${s}`).toLowerCase()}` : null;
                  })
                  .filter(Boolean)
                  .join(', ');
                return (
                  <Td key={f} className="p-0">
                    <button
                      type="button"
                      title={breakdown}
                      onClick={() => onSelect(selected === key ? null : key)}
                      className={cn(
                        'flex w-full items-center justify-end gap-1.5 px-2 py-1.5',
                        'cursor-pointer hover:bg-accent/50',
                        selected === key && 'bg-accent ring-1 ring-primary/60 ring-inset',
                      )}
                    >
                      <span
                        className={cn('size-1.5 shrink-0 rounded-full', SEVERITY_STYLES[severity].strip)}
                      />
                      <span className={cn('font-mono text-xs tabular-nums', SEVERITY_STYLES[severity].text)}>
                        {list.length}
                      </span>
                    </button>
                  </Td>
                );
              })}
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
