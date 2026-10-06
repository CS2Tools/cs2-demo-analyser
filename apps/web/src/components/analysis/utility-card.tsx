import { useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Flame, RefreshCw, Sparkles, Target, X } from 'lucide-react';
import type { UtilityAnalysis, UtilityThrow } from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ExportButton } from '@/components/export-button';
import { cleanName } from '@/lib/format';
import { PlayerCell } from '@/components/team-mark';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ThrowsCanvas, THROW_COLORS } from './throws-canvas';
import {
  DEFAULT_FILTERS,
  filterThrows,
  isFiltered,
  type ThrowFilters,
} from './throw-filters';

const KIND_LABELS: Record<UtilityThrow['kind'], string> = {
  smoke: 'Smoke',
  flash: 'Flash',
  fire: 'Molotov',
  he: 'HE',
  decoy: 'Decoy',
};

const money = (v: number) => `$${v.toLocaleString('pt-BR')}`;

export function UtilityCard({
  utility,
  matchId,
  mapName,
  hasRadar,
  teams,
  onReprocess,
}: {
  utility: UtilityAnalysis;
  matchId: string;
  mapName: string;
  hasRadar: boolean;
  teams: { a: string | null; b: string | null };
  onReprocess?: () => void;
}) {
  const { t } = useTranslation();
  const players = [...utility.players].sort(
    (a, b) => b.he.damage + b.fire.damage - (a.he.damage + a.fire.damage),
  );

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="size-4" />
          {t('utilityCard.title')}
        </CardTitle>
        <CardDescription>
          <Trans
            i18nKey="utilityCard.desc"
            values={{ seconds: '1,1' }}
            components={{ b: <strong />, i: <em /> }}
          />
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('utilityCard.title'),
              meta: {
                matchId,
                references: {
                  facingAwayDegrees: utility.facingAwayDegrees,
                  popFlash: 'nao calculavel: o tempo ate a flash estourar e o pavio (1,6 s), nao o voo',
                  distanciaDaFlash: 'da vitima ate o ponto do estouro, em unidades do jogo, a 8 Hz',
                  danoDeFogo: 'evento de dano com arma inferno',
                  heePorGranada: 'dano casado com a detonacao mais proxima do mesmo jogador',
                  smokeBloqueio: 'nao calculado: exigiria linha de visao contra a geometria do mapa',
                  utilitarioNaMorte: 'inventario no ultimo tick amostrado (8 Hz) antes da morte',
                },
              },
              table: () => ({
                columns: ['steam_id', 'jogador', 'he_granadas', 'he_dano', 'he_melhor_multi',
                  'fogo_granadas', 'fogo_dano', 'fogo_kills', 'smokes', 'smoke_segundos_medianos',
                  'kills_atraves_de_smoke', 'flashes', 'cegueiras_efetivas',
                  'distancia_mediana_da_flash', 'flash_assists', 'cegados_de_costas',
                  'team_flashes', 'utilitario_na_morte'],
                rows: players.map((p) => [p.steamId, cleanName(p.name),
                  p.he.grenades, p.he.damage, p.he.bestMultiHit,
                  p.fire.grenades, p.fire.damage, p.fire.kills,
                  p.smoke.smokes, p.smoke.medianSecondsIntoRound, p.smoke.killsThroughSmoke,
                  p.flash.flashes, p.flash.effectiveBlinds, p.flash.medianDistance,
                  p.flash.flashAssists, p.flash.blindedFacingAway, p.flash.teamFlashes,
                  p.unusedUtility.value]),
              }),
              json: () => utility,
            }}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {!utility.hasDeepData ? (
          <Alert>
            <RefreshCw />
            <AlertTitle>{t('utilityCard.missingTitle')}</AlertTitle>
            <AlertDescription>
              <span>
                {t('ui2.utilityOldMatch')}
              </span>
              {onReprocess ? (
                <Button size="sm" variant="outline" onClick={onReprocess}>
                  {t('reprocess.button')}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto">
          <Table className="min-w-[46rem]">
            <THead>
              <Th align="left">{t('table.player')}</Th>
              <Th tip={t('utilityCard.heTip')}>
                {t('utilityCard.he')}
              </Th>
              <Th tip={t('utilityCard.heDamageTip')}>{t('utilityCard.heDamage')}</Th>
              <Th tip={t('utilityCard.bestHeTip')}>{t('utilityCard.bestHe')}</Th>
              <Th tip={t('utilityCard.molotovTip')}>{t('utilityCard.molotov')}</Th>
              <Th tip={t('utilityCard.fireDamageTip')}>{t('utilityCard.fireDamage')}</Th>
              <Th tip={t('utilityCard.smokesTip')}>
                {t('utilityCard.smokes')}
              </Th>
              <Th tip={t('utilityCard.flashesTip')}>{t('utilityCard.flashes')}</Th>
              <Th tip={t('utilityCard.effectiveTip')}>
                {t('utilityCard.effective')}
              </Th>
              <Th tip={t('utilityCard.distanceTip')}>
                {t('utilityCard.distance')}
              </Th>
              <Th tip={t('utilityCard.assistTip')}>{t('utilityCard.assist')}</Th>
              <Th tip={t('utilityCard.facingAwayTip')}>
                {t('utilityCard.facingAway')}
              </Th>
              <Th tip={t('utilityCard.teamFlashTip')}>
                {t('utilityCard.teamFlash')}
              </Th>
              <Th tip={t('utilityCard.inHandTip')}>
                {t('utilityCard.inHand')}
              </Th>
            </THead>
            <TBody>
              {players.map((p) => (
                <Tr key={p.steamId}>
                  <Td align="left" className="max-w-40">
                    <PlayerCell
                      name={p.name}
                      teamName={p.teamName}
                      teams={teams}
                      steamId={p.steamId}
                    />
                  </Td>
                  <Num value={p.he.grenades} />
                  <Num value={p.he.damage} highlight />
                  <Num
                    value={p.he.bestMultiHit}
                    title={`Mais inimigos atingidos por uma unica HE: ${p.he.bestMultiHit}`}
                  />
                  <Num value={p.fire.grenades} />
                  <Num value={p.fire.damage} highlight />
                  <Num value={p.smoke.smokes} />
                  <Num value={p.flash.flashes} />
                  <Num value={p.flash.effectiveBlinds} highlight />
                  <Num
                    value={p.flash.medianDistance === null ? '—' : Math.round(p.flash.medianDistance)}
                    title={t('utilityCard.distanceChip')}
                  />
                  <Num value={p.flash.flashAssists} />
                  <Num value={p.flash.blindedFacingAway} muted />
                  <Num value={p.flash.teamFlashes} muted />
                  <Num value={money(p.unusedUtility.value)} muted />
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          <Trans i18nKey="utilityNote.text" components={{ b: <strong /> }} />
        </p>

        {hasRadar ? <ThrowsMap utility={utility} mapName={mapName} matchId={matchId} /> : null}
      </CardContent>
    </Card>
  );
}

function Num({
  value,
  highlight,
  muted,
  title,
}: {
  value: number | string;
  highlight?: boolean;
  muted?: boolean;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={cn(
        'px-2 py-1.5 text-right font-mono text-xs tabular-nums',
        highlight && 'text-primary',
        muted && 'text-muted-foreground',
      )}
    >
      {value}
    </td>
  );
}

function ThrowsMap({
  utility,
  mapName,
  matchId,
}: {
  utility: UtilityAnalysis;
  mapName: string;
  matchId: string;
}) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ThrowFilters>(DEFAULT_FILTERS);
  const { kinds, steamId } = filters;
  const set = <K extends keyof ThrowFilters>(key: K, value: ThrowFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const layers = useRef<HTMLCanvasElement[] | null>(null);

  const shown = useMemo(() => filterThrows(utility.throws, filters), [utility.throws, filters]);

  const hasBlindData = useMemo(
    () => utility.throws.some((g) => g.enemiesBlinded > 0),
    [utility.throws],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('utilityCard.whereItLanded')}</span>
        <ExportButton
          className="-my-1"
          spec={{

            title: `Arremessos - ${mapName}`,
            meta: {
              matchId,
              references: {
                linhaDoArremesso: 'reta da mao ate a detonacao; a trajetoria real faz arco',
                resultadoPorGranada:
                  'dano e cegueira casados com a detonacao mais proxima do mesmo jogador no mesmo round',
                smokeEDecoy: 'sem efeito medido: bloqueio de visao exigiria a geometria do mapa',
                coordenadas: 'pixels do radar, origem no canto superior esquerdo',
                radar: 'boltobserv (GPL-3.0)',
              },
            },
            table: () => ({
              columns: ['granada', 'round', 'steam_id', 'tipo', 'lado', 'saiu_x', 'saiu_y',
                'detonou_x', 'detonou_y', 'andar', 'dano_em_inimigo', 'inimigos_atingidos',
                'inimigos_cegados', 'segundos_de_cegueira', 'maior_cegueira'],
              rows: shown.map((g) => [g.grenadeId, g.roundNum, g.steamId, g.kind, g.side,
                g.throwPx, g.throwPy, g.detPx, g.detPy, g.split, g.damage, g.enemiesHit,
                g.enemiesBlinded, Number(g.blindSeconds.toFixed(2)),
                Number(g.bestBlindSeconds.toFixed(2))]),
            }),
            png: () =>
              layers.current
                ? {
                    layers: layers.current,
                    subtitle: [
                      `${shown.length} de ${utility.throws.length} granadas`,
                            kinds.length === 5 ? null : kinds.map((k) => KIND_LABELS[k]).join(', '),
                      steamId === null
                        ? null
                        : cleanName(
                            utility.players.find((p) => p.steamId === steamId)?.name ?? steamId,
                          ),
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    footer: [
                      'O ponto e onde a granada detonou; a linha, de onde ela saiu — reta, porque a trajetoria real faz arco.',
                      'Radar: boltobserv (GPL-3.0). Gerado pelo CS2 Demo Analyser, 100% local.',
                    ],
                  }
                : null,
          }}
        />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {(['smoke', 'flash', 'fire', 'he', 'decoy'] as const).map((k) => {
            const on = kinds.includes(k);
            return (
              <Badge
                key={k}
                variant={on ? 'default' : 'outline'}
                className={cn('cursor-pointer text-[10px]', !on && 'opacity-60')}
                onClick={() =>
                  set('kinds', on ? kinds.filter((x) => x !== k) : [...kinds, k])
                }
              >
                <span
                  className="mr-1 inline-block size-2 rounded-full"
                  style={{ background: THROW_COLORS[k] }}
                />
                {KIND_LABELS[k]}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={steamId === null ? 'default' : 'outline'}
          className="cursor-pointer text-[10px]"
          onClick={() => set('steamId', null)}
        >
          {t('utilityCard.all')}
        </Badge>
        {utility.players.map((p) => (
          <Badge
            key={p.steamId}
            variant={steamId === p.steamId ? 'default' : 'outline'}
            className="cursor-pointer text-[10px]"
            onClick={() => set('steamId', steamId === p.steamId ? null : p.steamId)}
          >
            {cleanName(p.name)}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">{t('utilityCard.side')}</span>
          {(['todos', 'CT', 'T'] as const).map((sd) => (
            <Badge
              key={sd}
              variant={filters.side === sd ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer text-[10px]',
                filters.side !== sd && 'opacity-60',
                sd === 'CT' && filters.side === sd && 'bg-sky-500/80',
                sd === 'T' && filters.side === sd && 'bg-amber-500/80',
              )}
              onClick={() => set('side', sd)}
            >
              {sd === 'todos' ? t('utilityCard.all') : sd}
            </Badge>
          ))}
        </div>

        <Badge
          variant={filters.effectiveOnly ? 'default' : 'outline'}
          className={cn('cursor-pointer text-[10px]', !filters.effectiveOnly && 'opacity-60')}
          title={t('utilityCard.onlyEffectiveTip')}
          onClick={() => set('effectiveOnly', !filters.effectiveOnly)}
        >
          <Target className="size-3" />
          {t('utilityCard.onlyEffective')}
        </Badge>

        <Threshold
          label={t('utilityCard.minDamage')}
          value={filters.minDamage}
          step={10}
          onChange={(v) => set('minDamage', v)}
          title={t('utilityCard.minDamageTip')}
        />
        <Threshold
          label={t('utilityCard.minBlind')}
          value={filters.minBlindSeconds}
          step={0.5}
          suffix="s"
          onChange={(v) => set('minBlindSeconds', v)}
          title={t('utilityCard.minBlindTip')}
        />
        <Threshold
          label={t('utilityCard.minEnemies')}
          value={filters.minEnemies}
          step={1}
          onChange={(v) => set('minEnemies', v)}
          title={t('utilityCard.minEnemiesTip')}
        />

        {isFiltered(filters) ? (
          <Badge
            variant="outline"
            className="cursor-pointer text-[10px]"
            onClick={() => setFilters({ ...DEFAULT_FILTERS, kinds })}
          >
            <X className="size-3" />
            {t('utilityCard.clear')}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Sparkles className="size-3" />
        <span>
          {t('throwMap.shownOfTotal', {
            shown: shown.length,
            total: utility.throws.length,
          })}{' '}
          {isFiltered(filters) ? t('throwMap.thresholdRule') : ''}{' '}
                    {utility.unattributedDamage > 0 ? (
            <strong className="font-medium text-amber-400/90">
              {t('frag.unattributedDamage', { n: utility.unattributedDamage })}
            </strong>
          ) : null}{' '}

          {utility.unattributedBlindSeconds > 0 ? (
            <strong className="font-medium text-amber-400/90">
              {t('throwMap.unattributedBlind', {
                seconds: utility.unattributedBlindSeconds.toFixed(1),
              })}
            </strong>
          ) : null}
        </span>
      </div>
      {filters.effectiveOnly && !hasBlindData ? (
        <div className="text-[11px] text-amber-400/90">
          {t('ui.noBlindData')}
        </div>
      ) : null}
      <ThrowsCanvas mapName={mapName} throws={shown} layersRef={layers} />
    </div>
  );
}

function Threshold({
  label,
  value,
  step,
  suffix,
  title,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  suffix?: string;
  title: string;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation();
  const shown = value === 0 ? t('utilityCard.any') : `${value.toLocaleString('pt-BR')}${suffix ?? ''}`;
  return (
    <span className="flex items-center gap-1" title={title}>
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center overflow-hidden rounded-md border">
        <button
          type="button"
          aria-label={t('utilityCard.less', { what: label })}
          disabled={value === 0}
          className="px-1.5 py-0.5 hover:bg-accent disabled:opacity-30"
          onClick={() => onChange(Math.max(0, Number((value - step).toFixed(2))))}
        >
          −
        </button>
        <span
          className={cn(
            'min-w-14 px-1 text-center font-mono tabular-nums',
            value === 0 && 'text-muted-foreground',
          )}
        >
          {shown}
        </span>
        <button
          type="button"
          aria-label={t('utilityCard.more', { what: label })}
          className="px-1.5 py-0.5 hover:bg-accent"
          onClick={() => onChange(Number((value + step).toFixed(2)))}
        >
          +
        </button>
      </span>
    </span>
  );
}
