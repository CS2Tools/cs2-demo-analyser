import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Minus,
  User,
} from 'lucide-react';
import type {
  PlayerListItem,
  PlayerMetricSeries,
  PlayerProfile,
  PlayerTrainItem,
} from '@cs2/contract';
import type { SupportedLocale } from '@cs2/i18n';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CsIcon } from '@/components/cs-icon';
import { ExportButton } from '@/components/export-button';
import { formatMetric, isSignedMetric } from '@/components/verdict/format-metric';
import { SEVERITY_STYLES } from '@/components/verdict/verdict-card';
import { mapIcon, weaponIcon } from '@/lib/icons';
import { cleanName, formatDateTime } from '@/lib/format';
import { useRoute } from '@/lib/use-route';
import { cn } from '@/lib/utils';

export function PlayerView({ onOpenMatch }: { onOpenMatch: (matchId: string) => void }) {
  const { t } = useTranslation();
  const [steamId, setSteamId] = useState<string | null>(null);
  const [windowSize, setWindowSize] = useState(10);

  const profile = useRoute(
    'player.profile',
    { steamId: steamId ?? '', lastMatches: windowSize },
    [steamId, windowSize],
  );

  return (
    <div className="flex flex-col gap-4">
      <PlayerPicker selected={steamId} onSelect={setSteamId} />

      {steamId === null ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('playerScreen.pick')}
          </CardContent>
        </Card>
      ) : profile.error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('playerScreen.error')}</AlertTitle>
          <AlertDescription>{profile.error}</AlertDescription>
        </Alert>
      ) : profile.loading || !profile.data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <PlayerProfileView
          profile={profile.data}
          window={windowSize}
          onWindow={setWindowSize}
          onOpenMatch={onOpenMatch}
        />
      )}
    </div>
  );
}

function PlayerPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (steamId: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { data, loading } = useRoute('players.list', { query, limit: 60 }, [query]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('playerScreen.search')}
            className="h-8 max-w-xs text-sm"
          />
        </div>

        {loading && !data ? (
          <Skeleton className="h-8 w-full" />
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('ui.nobodyFound')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(data ?? []).map((p) => (
              <PlayerChip
                key={p.steamId}
                player={p}
                active={p.steamId === selected}
                onSelect={() => onSelect(p.steamId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerChip({
  player,
  active,
  onSelect,
}: {
  player: PlayerListItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={player.steamId}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
        active ? 'border-primary bg-primary/10' : 'hover:bg-accent',
      )}
    >
      {player.isUser ? <User className="size-3 text-primary" /> : null}
      {player.isPoi ? (
        <Star className="size-3" style={{ color: player.colour ?? undefined }} />
      ) : null}
      <span className="max-w-40 truncate">{cleanName(player.name)}</span>
      <span className="text-[10px] text-muted-foreground">{player.matches}</span>
    </button>
  );
}

function PlayerProfileView({
  profile,
  window,
  onWindow,
  onOpenMatch,
}: {
  profile: PlayerProfile;
  window: number;
  onWindow: (n: number) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as SupportedLocale;

  if (profile.matches === 0) {
    return (
      <Alert>
        <AlertTitle>{t('playerScreen.noMatches')}</AlertTitle>
        <AlertDescription>
          {t('ui.matchGone')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader profile={profile} locale={locale} />
      <EvolutionCard profile={profile} locale={locale} onOpenMatch={onOpenMatch} />
      <TrainCard
        profile={profile}
        window={window}
        onWindow={onWindow}
        locale={locale}
        onOpenMatch={onOpenMatch}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <MapCard profile={profile} />
        <WeaponCard profile={profile} />
      </div>
    </div>
  );
}

function ProfileHeader({ profile, locale }: { profile: PlayerProfile; locale: string }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-semibold">{cleanName(profile.name)}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{profile.steamId}</span>
        </div>

        <Stat label={t('playerScreen.matches')} value={String(profile.matches)} />
        <Stat
          label={t('playerScreen.period')}
          value={
            profile.firstSeen && profile.lastSeen
              ? `${formatDateTime(profile.firstSeen, locale).split(',')[0]} → ${formatDateTime(profile.lastSeen, locale).split(',')[0]}`
              : '—'
          }
        />

        <div className="flex items-center gap-1">
          {profile.maps.map((m) => (
            <CsIcon key={m} rel={mapIcon(m)} title={m} fallback={m} className="size-6" />
          ))}
        </div>

        {profile.aliases.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={<Badge variant="outline" className="text-[10px]" />}
            >
              {t('chart.aliasCount', { count: profile.aliases.length })}
            </TooltipTrigger>
            <TooltipContent>
              {t('chart.aliases', { list: profile.aliases.map(cleanName).join(', ') })}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {profile.prunedMatches > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={<Badge variant="outline" className="gap-1 text-[10px]" />}
            >
              <Archive className="size-3" />
              {t('frag5.prunedBadge', { count: profile.prunedMatches })}
            </TooltipTrigger>
            <TooltipContent>
              {t('frag5.prunedMatches')}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

function EvolutionCard({
  profile,
  locale,
  onOpenMatch,
}: {
  profile: PlayerProfile;
  locale: SupportedLocale;
  onOpenMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState(profile.series[0]?.ruleId ?? '');
  const series = profile.series.find((s) => s.ruleId === metric) ?? profile.series[0] ?? null;

  if (!series) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          {t('playerScreen.noMetrics')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{t('playerScreen.evolution')}</h2>
          <ExportButton
            className="order-last ml-auto"
            spec={{

              title: `Evolucao - ${t(`verdict.ruleName.${series.ruleId}`)}`,
              meta: {
                references: {
                  base: 'mediana das partidas ANTERIORES do proprio jogador',
                  amostraMinima: series.minSample,
                  sentido: series.direction,
                  unidade: series.unit,
                },
              },
              table: () => ({
                columns: ['partida', 'jogada_em', 'mapa', 'adversario', 'valor',
                  'mediana_anterior', 'amostra', 'amostra_suficiente'],
                rows: series.points.map((p) => [p.matchId, p.playedAt, p.mapName, p.opponent,
                  p.value, p.priorMedian, p.sampleN, p.enough]),
              }),
              json: () => series,
            }}
          />
          <select
            value={series.ruleId}
            onChange={(e) => setMetric(e.target.value)}
            className="h-7 rounded-md border bg-background px-1 text-xs"
          >
            {profile.series.map((s) => (
              <option key={s.ruleId} value={s.ruleId}>
                {t(`verdict.ruleName.${s.ruleId}`)}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            {series.direction === 'closer_to_zero'
              ? t('playerScreen.closerToZero')
              : series.direction === 'higher_better'
                ? t('playerScreen.higherBetter')
                : t('playerScreen.lowerBetter')}
          </span>
        </div>

        <MetricChart series={series} locale={locale} onOpenMatch={onOpenMatch} />

        <p className="text-[11px] text-muted-foreground">
          {t('playerScreen.medianNote', { min: series.minSample })}
        </p>
      </CardContent>
    </Card>
  );
}

const CHART = { w: 720, h: 180, padX: 8, padY: 16 };

function MetricChart({
  series,
  locale,
  onOpenMatch,
}: {
  series: PlayerMetricSeries;
  locale: SupportedLocale;
  onOpenMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const signed = isSignedMetric(series.ruleId);
  const geometry = useMemo(() => {
    const values = series.points.flatMap((p) =>
      p.priorMedian === null ? [p.value] : [p.value, p.priorMedian],
    );
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (series.direction === 'closer_to_zero') {
      const m = Math.max(Math.abs(lo), Math.abs(hi));
      lo = -m;
      hi = m;
    }

    if (hi - lo < 1e-9) {
      const pad = Math.abs(hi) * 0.1 || 1;
      lo -= pad;
      hi += pad;
    }
    const n = series.points.length;
    const x = (i: number) =>
      n === 1
        ? CHART.w / 2
        : CHART.padX + (i * (CHART.w - 2 * CHART.padX)) / (n - 1);
    const y = (v: number) =>
      CHART.h - CHART.padY - ((v - lo) / (hi - lo)) * (CHART.h - 2 * CHART.padY);
    return { x, y, lo, hi };
  }, [series]);

  const better = (value: number, prior: number | null): 'better' | 'worse' | null => {
    if (prior === null) return null;
    const d =
      series.direction === 'closer_to_zero'
        ? Math.abs(prior) - Math.abs(value)
        : series.direction === 'higher_better'
          ? value - prior
          : prior - value;
    if (Math.abs(d) < 1e-9) return null;
    return d > 0 ? 'better' : 'worse';
  };

  const line = series.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${geometry.x(i)} ${geometry.y(p.value)}`)
    .join(' ');

  const priorLine = series.points
    .map((p, i) => (p.priorMedian === null ? null : `${geometry.x(i)},${geometry.y(p.priorMedian)}`))
    .filter((v): v is string => v !== null)
    .join(' ');

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${CHART.w} ${CHART.h}`}
        className="h-44 w-full"
        preserveAspectRatio="none"
        role="img"
      >
        {series.direction === 'closer_to_zero' ? (
          <line
            x1={0}
            x2={CHART.w}
            y1={geometry.y(0)}
            y2={geometry.y(0)}
            className="stroke-muted-foreground/40"
            strokeWidth={1}
          />
        ) : null}

        {priorLine ? (
          <polyline
            points={priorLine}
            fill="none"
            className="stroke-muted-foreground/60"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        ) : null}

        <path d={line} fill="none" className="stroke-primary" strokeWidth={2} />

        {series.points.map((p, i) => {
          const verdict = better(p.value, p.priorMedian);
          return (
            <circle
              key={p.matchId}
              cx={geometry.x(i)}
              cy={geometry.y(p.value)}
              r={5}
              className={cn(
                'cursor-pointer',
                verdict === 'better'
                  ? 'fill-emerald-500'
                  : verdict === 'worse'
                    ? 'fill-destructive'
                    : 'fill-muted-foreground',
                !p.enough && 'opacity-35',
              )}
              onClick={() => onOpenMatch(p.matchId)}
            >
              <title>
                {`${p.mapName} · ${formatDateTime(p.playedAt, locale)}\n` +
                  `${formatMetric(p.value, series.unit, locale, signed)}` +
                  (p.priorMedian === null
                    ? ''
                    : ` (mediana anterior: ${formatMetric(p.priorMedian, series.unit, locale, signed)})`) +
                  `\namostra: ${p.sampleN}${p.enough ? '' : ` — abaixo do minimo de ${series.minSample}`}`}
              </title>
            </circle>
          );
        })}
      </svg>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{t('chart.min', { value: formatMetric(geometry.lo, series.unit, locale, signed) })}</span>
        <span>
          {t('chart.points', { count: series.points.length })}
        </span>
        <span>{t('chart.max', { value: formatMetric(geometry.hi, series.unit, locale, signed) })}</span>
      </div>
    </div>
  );
}

const TREND_ICON = { better: TrendingUp, worse: TrendingDown, flat: Minus };
const TREND_TEXT = {
  better: 'aparecendo menos nas ultimas',
  worse: 'aparecendo mais nas ultimas',
  flat: 'sem mudanca na janela',
};

function TrainCard({
  profile,
  window,
  onWindow,
  locale,
  onOpenMatch,
}: {
  profile: PlayerProfile;
  window: number;
  onWindow: (n: number) => void;
  locale: SupportedLocale;
  onOpenMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{t('playerScreen.whatToTrain')}</h2>
          <span className="text-[11px] text-muted-foreground">
            {t('ui.trainHint')}
          </span>
          <select
            value={window}
            onChange={(e) => onWindow(Number(e.target.value))}
            className="h-7 rounded-md border bg-background px-1 text-xs"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {t('train.matchesOption', { n })}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            {t('train.windowNote', { n: profile.windowMatches })}
          </span>
        </div>

        {profile.train.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('train.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {profile.train.map((item) => (
              <TrainRow
                key={item.ruleId}
                item={item}
                locale={locale}
                onOpenMatch={onOpenMatch}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrainRow({
  item,
  locale,
  onOpenMatch,
}: {
  item: PlayerTrainItem;
  locale: SupportedLocale;
  onOpenMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const style = SEVERITY_STYLES[item.worst];
  const Trend = item.trend ? TREND_ICON[item.trend] : null;

  return (
    <div className="relative overflow-hidden rounded-md border">
      <div className={cn('absolute inset-y-0 left-0 w-1', style.strip)} aria-hidden />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-2 pl-3 pr-2 text-left text-sm hover:bg-accent/50"
      >
        <span className="min-w-0 flex-1 truncate font-medium">
          {t(`verdict.ruleName.${item.ruleId}`)}
        </span>

        {Trend ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className={cn(
                    'flex items-center',
                    item.trend === 'better'
                      ? 'text-emerald-400'
                      : item.trend === 'worse'
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                  )}
                />
              }
            >
              <Trend className="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              {t('chart.halves', { trend: TREND_TEXT[item.trend!] })}
            </TooltipContent>
          </Tooltip>
        ) : null}

        <Badge variant="secondary" className="shrink-0 text-[10px] tabular-nums">
          {t('labels.timesOf', { times: item.times, of: item.of })}
        </Badge>
      </button>

      {open ? (
        <div className="flex flex-col gap-1 border-t px-3 py-2">
          {item.matches.map((m) => (
            <button
              key={m.matchId}
              type="button"
              onClick={() => onOpenMatch(m.matchId)}
              className="flex items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              <CsIcon rel={mapIcon(m.mapName)} title={m.mapName} className="size-4" />
              <span className="w-24 shrink-0 truncate">{m.mapName}</span>
              <span className="w-28 shrink-0">{formatDateTime(m.playedAt, locale)}</span>
              <span className={cn('tabular-nums', SEVERITY_STYLES[m.severity].text)}>
                {formatMetric(m.value, item.unit, locale, isSignedMetric(item.ruleId))}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MapCard({ profile }: { profile: PlayerProfile }) {
  const { t } = useTranslation();
  const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <h2 className="text-sm font-semibold">{t('playerScreen.byMap')}</h2>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">{t('ui.map')}</th>
              <th className="py-1 text-right font-medium">{t('playerScreen.winLoss')}</th>
              <th className="py-1 text-right font-medium">{t('table.rounds')}</th>
              <th className="py-1 text-right font-medium">ADR</th>
              <th className="py-1 text-right font-medium">K/D</th>
              <th className="py-1 text-right font-medium">{t('playerScreen.entry')}</th>
            </tr>
          </thead>
          <tbody>
            {profile.byMap.map((m) => (
              <tr key={m.mapName} className="border-t">
                <td className="flex items-center gap-1.5 py-1">
                  <CsIcon rel={mapIcon(m.mapName)} title={m.mapName} className="size-5" />
                  {m.mapName}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {m.wins}–{m.losses}
                  {m.draws > 0 ? `–${m.draws}` : ''}
                </td>
                <td className="py-1 text-right tabular-nums">{m.roundsPlayed}</td>
                <td className="py-1 text-right tabular-nums">
                  {m.adr === null ? '—' : nf.format(m.adr)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {m.kd === null ? '—' : nf.format(m.kd)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {m.entrySuccess === null ? '—' : `${Math.round(m.entrySuccess * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function WeaponCard({ profile }: { profile: PlayerProfile }) {
  const { t } = useTranslation();
  const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const rows = profile.byWeapon.slice(0, 12);
  const anyMissing = rows.some((w) => w.damage === null);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <h2 className="text-sm font-semibold">{t('playerScreen.byWeapon')}</h2>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">{t('ui.weapon')}</th>
              <th className="py-1 text-right font-medium">{t('playerScreen.kills')}</th>
              <th className="py-1 text-right font-medium">HS</th>
              <th className="py-1 text-right font-medium">{t('playerScreen.distance')}</th>
              <th className="py-1 text-right font-medium">{t('ui.damage')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.weapon} className="border-t">
                <td className="flex items-center gap-1.5 py-1">
                  <CsIcon rel={weaponIcon(w.weapon)} title={w.weapon} className="h-4" />
                  {w.weapon}
                </td>
                <td className="py-1 text-right tabular-nums">{w.kills}</td>
                <td className="py-1 text-right tabular-nums">
                  {w.headshotPct === null ? '—' : `${Math.round(w.headshotPct * 100)}%`}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {w.medianDistance === null ? '—' : `${nf.format(w.medianDistance)} m`}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {w.damage === null ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-help" />}>—</TooltipTrigger>
                      <TooltipContent>
                        {t('weaponGap.text')}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    w.damage
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {anyMissing ? (
          <p className="text-[10px] text-muted-foreground">
            {t('playerWeapons.noteWithMissing')}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">{t('playerScreen.distanceNote')}</p>
        )}
      </CardContent>
    </Card>
  );
}
