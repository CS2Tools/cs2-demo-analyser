import { Trans, useTranslation } from 'react-i18next';
import {
  Bomb,
  Crosshair,
  Flame,
  Map as MapIcon,
  Swords,
  Target,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type {
  AccuracyAnalysis,
  AimAnalysis,
  DuelAnalysis,
  EconomyAnalysis,
  FlashAnalysis,
  MatchAnalysis,
  RoundsAnalysis,
} from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Fragment, useMemo, useRef, useState } from 'react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/export-button';
import { DeepEconomyCard } from '@/components/analysis/deep-economy-card';
import { RatingCard } from '@/components/analysis/rating-card';
import { UtilityCard } from '@/components/analysis/utility-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRoute, type RouteState } from '@/lib/use-route';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { HeatmapCanvas } from '@/components/analysis/heatmap-canvas';
import { ThrowsCanvas } from '@/components/analysis/throws-canvas';
import { CsIcon } from '@/components/cs-icon';
import { PlayerCell, TeamMark, teamIndex } from '@/components/team-mark';
import { GroupRow, Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { weaponIcon } from '@/lib/icons';

function FixedReference({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge variant="outline" className="cursor-help text-[10px] font-normal" />
        }
      >
        {t('ui.fixedReference')}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

const BUY_LABELS: Record<string, string> = {
  pistol: 'Pistol',
  full_eco: 'Save',
  eco: 'Eco',
  semi_eco: 'Semi-eco',
  force_buy: 'Force Buy',
  full_buy: 'Full Buy',
};

export function useMatchAnalysis(matchId: string): RouteState<MatchAnalysis> {
  return useRoute('match.analysis', { matchId }, [matchId]);
}

export function AnalysisGate({
  state,
  children,
}: {
  state: RouteState<MatchAnalysis>;
  children: (analysis: MatchAnalysis) => React.ReactNode;
}) {
  const { t } = useTranslation();
  if (state.loading) return <Skeleton className="h-96 w-full" />;
  if (state.error || !state.data) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t('analysis.error')}</AlertTitle>
        <AlertDescription>{state.error ?? t('analysis.noData')}</AlertDescription>
      </Alert>
    );
  }
  return <>{children(state.data)}</>;
}

interface SectionProps {
  analysis: MatchAnalysis;
}

type Teams = MatchAnalysis['teams'];

function Section({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-2">{children}</div>;
}

export function AimSection({ analysis }: SectionProps) {
  return (
    <Section>
      <AimCard aim={analysis.aim} matchId={analysis.matchId} teams={analysis.teams} />
      <AccuracyCard
        accuracy={analysis.accuracy}
        matchId={analysis.matchId}
        teams={analysis.teams}
      />
    </Section>
  );
}

export function DuelSection({ analysis }: SectionProps) {
  return (
    <Section>
      <DuelCard duels={analysis.duels} matchId={analysis.matchId} teams={analysis.teams} />
      <TradeChainCard duels={analysis.duels} matchId={analysis.matchId} teams={analysis.teams} />
    </Section>
  );
}

export function EconomySection({ analysis }: SectionProps) {
  return (
    <Section>
      <EconomyCard economy={analysis.economy} matchId={analysis.matchId} />
      <DeepEconomyCard
        economy={analysis.economy}
        matchId={analysis.matchId}
        teams={analysis.teams}
      />
    </Section>
  );
}

export function UtilitySection({ analysis }: SectionProps) {
  return (
    <Section>
      <FlashCard flashes={analysis.flashes} matchId={analysis.matchId} teams={analysis.teams} />
      <UtilityCard
        utility={analysis.utility}
        matchId={analysis.matchId}
        teams={analysis.teams}
        mapName={analysis.mapName}
        hasRadar={analysis.hasRadar}
      />
    </Section>
  );
}

export function RoundsSection({ analysis }: SectionProps) {
  const teams = analysis.teams;
  return (
    <Section>

      <RatingCard rating={analysis.rating} matchId={analysis.matchId} teams={teams} />
      <ClutchCard rounds={analysis.rounds} matchId={analysis.matchId} teams={teams} />
      <AdvantageCard rounds={analysis.rounds} teams={teams} />
      <MultikillCard rounds={analysis.rounds} teams={teams} />
      <KastCard rounds={analysis.rounds} teams={teams} />
    </Section>
  );
}

export function MapSection({ analysis }: SectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <HeatmapCard analysis={analysis} />
      <BombCard analysis={analysis} />
    </div>
  );
}

function ClutchCard({ rounds, matchId, teams }: { rounds: RoundsAnalysis; matchId: string; teams: Teams }) {
  const { t } = useTranslation();
  if (rounds.clutches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="size-4" />
            {t('analysis.clutches')}
          </CardTitle>
          <CardDescription>{t('analysis.clutchesEmpty')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="size-4" />
            {t('analysis.clutches')}
        </CardTitle>
        <CardDescription>
          {t('analysis.clutchesDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysis.clutches'),
              meta: { matchId, references: { definicao: 'ultimo vivo do lado com pelo menos um inimigo vivo' } },
              table: () => ({
                columns: ['steam_id', 'jogador', 'time', 'tentados', 'ganhos', 'detalhe'],
                rows: rounds.clutches.map((c) => [c.steamId, cleanName(c.name), c.teamName, c.tried, c.won,
                  c.byVersus.map((v) => `1v${v.versus}: ${v.won}/${v.tried}`).join('; ')]),
              }),
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {rounds.clutches.map((c) => (
          <div key={c.steamId} className="flex items-center gap-2 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <TeamMark teamName={c.teamName} teams={teams} />
              <span className="truncate">{cleanName(c.name)}</span>
            </span>
            <span className="flex gap-1">
              {c.byVersus.map((v) => (
                <Badge
                  key={v.versus}
                  variant={v.won > 0 ? 'default' : 'outline'}
                  className="text-[10px] tabular-nums"
                  title={`${v.won} de ${v.tried} contra ${v.versus}`}
                >
                  1v{v.versus}: {v.won}/{v.tried}
                </Badge>
              ))}
            </span>
            <span className="w-12 shrink-0 text-right font-mono tabular-nums">
              {c.won}/{c.tried}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AdvantageCard({ rounds, teams }: { rounds: RoundsAnalysis; teams: Teams }) {
  const { t } = useTranslation();

  const porKill = useMemo(
    () => rounds.advantages.filter((a) => a.cause !== 'absence'),
    [rounds.advantages],
  );
  const porAusencia = useMemo(
    () => rounds.advantages.filter((a) => a.cause === 'absence'),
    [rounds.advantages],
  );
  const groups = useMemo(() => {
    const byTeam = new Map<string, typeof rounds.advantages>();
    for (const a of porKill) {
      const key = a.teamName ?? '';
      byTeam.set(key, [...(byTeam.get(key) ?? []), a]);
    }
    return [...byTeam.entries()].sort(
      ([a], [b]) => (teamIndex(a, teams) ?? 9) - (teamIndex(b, teams) ?? 9),
    );
  }, [porKill, teams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" />
          {t('analysis.advantage')}
        </CardTitle>
        <CardDescription>
          {t('analysis.advantageDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysis.advantage'),
              meta: {
                references: {
                  vantagem: 'primeiro round em que o placar de vivos desequilibrou',
                  convertido: 'o lado em vantagem venceu o round',
                  time: 'maioria do elenco daquele lado no round; nulo quando ha empate ou falta o nome',
                  causa:
                    'kill = vantagem conquistada; ausencia = o round comecou desfalcado porque alguem saiu e o substituto nao entrou',
                },
              },
              table: () => ({
                columns: ['time', 'lado', 'placar_de_vivos', 'causa', 'rounds', 'convertidos'],
                rows: rounds.advantages.map((a) => [
                  a.teamName, a.side, a.label, a.cause, a.rounds, a.won,
                ]),
              }),
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {porKill.length === 0 && porAusencia.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{t('analysis.advantageEmpty')}</p>
        ) : (
          <Table>
            <THead>
              <Th align="left">{t('table.side')}</Th>
              <Th align="left" tip={t('analysis.livesTip')}>
                {t('analysis.livesHeader')}
              </Th>
              <Th tip={t('analysis.roundsTip')}>{t('table.rounds')}</Th>
              <Th tip={t('analysis.convertedTip')}>{t('table.converted')}</Th>
            </THead>
            <TBody>
              {groups.map(([teamName, list]) => {
                const total = list.reduce((n, a) => n + a.rounds, 0);
                const won = list.reduce((n, a) => n + a.won, 0);
                return (
                  <Fragment key={teamName || 'sem-time'}>
                    <GroupRow colSpan={4}>
                      <span className="flex items-center gap-1.5">
                        <TeamMark teamName={teamName || null} teams={teams} />
                        {teamName ? cleanName(teamName) : t('analysis.unnamedTeam')}
                        <span className="font-mono text-muted-foreground">
                          {won}/{total} ({Math.round((won / total) * 100)}%)
                        </span>
                      </span>
                    </GroupRow>
                    {list.map((a) => (
                      <Tr key={`${a.side}-${a.label}-${a.cause}`}>
                        <Td
                          align="left"
                          className={a.side === 'CT' ? 'text-sky-300' : 'text-amber-300'}
                        >
                          {a.side}
                        </Td>
                        <Td align="left" className="font-mono tabular-nums">
                          {a.label}
                        </Td>
                        <Td muted>{a.rounds}</Td>
                        <Td>
                          {a.won}/{a.rounds} ({Math.round((a.won / a.rounds) * 100)}%)
                        </Td>
                      </Tr>
                    ))}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        )}
        {porAusencia.length > 0 ? (

          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">{t('analysis.advantageByAbsence')}</p>
            <p className="mt-0.5">{t('analysis.advantageByAbsenceDesc')}</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {porAusencia.map((a) => (
                <li key={`${a.side}-${a.label}`} className="flex items-center gap-1.5">
                  <TeamMark teamName={a.teamName} teams={teams} />
                  <span className="font-mono tabular-nums">
                    {t('analysis.advantageByAbsenceRow', {
                      label: a.label,
                      rounds: a.rounds,
                      won: a.won,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {rounds.opening.length > 0 ? (
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">

            <Trans
              i18nKey="frag.openerLine"
              values={{
                won: rounds.opening.reduce((n, o) => n + o.openedWon, 0),
                total: rounds.opening.reduce((n, o) => n + o.opened, 0),
              }}
              components={{ b: <strong /> }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MultikillCard({ rounds, teams }: { rounds: RoundsAnalysis; teams: Teams }) {
  const { t } = useTranslation();

  const labelOf = (i: number) => (i === 3 ? 'ace' : `${i + 2}k`);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="size-4" />
          {t('analysis.multikills')}
        </CardTitle>
        <CardDescription>{t('analysis.multikillsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {rounds.multikills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('analysis.multikillsEmpty')}</p>
        ) : (
          rounds.multikills.map((m) => (
            <div key={m.steamId} className="flex items-center gap-2 text-sm">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <TeamMark teamName={m.teamName} teams={teams} />
                <span className="truncate">{cleanName(m.name)}</span>
              </span>
              {m.counts.map((n, i) =>
                n > 0 ? (
                  <Badge key={labelOf(i)} variant={i >= 2 ? 'default' : 'secondary'} className="text-[10px]">
                    {n}x {labelOf(i)}
                  </Badge>
                ) : null,
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function KastCard({ rounds, teams }: { rounds: RoundsAnalysis; teams: Teams }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="size-4" />
          KAST
        </CardTitle>
        <CardDescription>
          {t('analysis.kastDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">{t('table.player')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('table.rounds')}</th>
              <th className="px-3 py-1.5 text-right font-medium">KAST</th>
            </tr>
          </thead>
          <tbody>
            {rounds.kast.map((k) => (
              <tr key={k.steamId} className="border-b last:border-0">
                <td className="max-w-40 px-3 py-1.5">
                  <PlayerCell name={k.name} teamName={k.teamName} teams={teams} steamId={k.steamId} />
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {k.kastRounds}/{k.rounds}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {k.kast === null ? '\u2014' : `${Math.round(k.kast * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AccuracyCard({ accuracy, matchId, teams }: { accuracy: AccuracyAnalysis; matchId: string; teams: Teams }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const pct = (v: number | null) => (v === null ? '\u2014' : `${(v * 100).toFixed(1)}%`);

  const focus = accuracy.players.find((p) => p.steamId === selected) ?? null;
  const weapons = focus
    ? accuracy.byWeapon.filter((w) => w.steamId === focus.steamId).slice(0, 8)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4" />
          {t('analysis.accuracy')}
        </CardTitle>
        <CardDescription>
          {t('analysis.accuracyDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysis.accuracy'),
              meta: {
                matchId,
                references: {
                  limiteDeVelocidade: `${Math.round(accuracy.accurateSpeedFraction * 100)}% da velocidade maxima da arma`,
                  spray: 'do 2o tiro em diante, em rajadas de 3+',
                  escopo: 'so arma de fogo; um disparo conta como um acerto no maximo',
                },
              },
              table: () => ({
                columns: ['steam_id', 'jogador', 'disparos', 'acertos', 'precisao',
                  'precisao_primeiro_tiro', 'precisao_spray', 'counter_strafe', 'dano'],
                rows: accuracy.players.map((p) => [p.steamId, cleanName(p.name), p.shots, p.hits,
                  p.accuracy, p.firstAccuracy, p.sprayAccuracy, p.counterStrafe, p.damage]),
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
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.shots')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.hitRate')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.firstShot')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.spray')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('analysis.standing')}</th>
            </tr>
          </thead>
          <tbody>
            {accuracy.players.map((p) => (
              <tr
                key={p.steamId}
                onClick={() => setSelected(p.steamId === selected ? null : p.steamId)}
                className={cn(
                  'cursor-pointer border-b last:border-0 hover:bg-accent/40',
                  p.steamId === selected && 'bg-accent/60',
                )}
              >
                <td className="max-w-40 px-3 py-1.5">
                  <PlayerCell name={p.name} teamName={p.teamName} teams={teams} steamId={p.steamId} />
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {p.shots}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{pct(p.accuracy)}</td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {pct(p.firstAccuracy)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {pct(p.sprayAccuracy)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {p.counterStrafe === null ? (
                    '\u2014'
                  ) : (
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-help" />}>
                        {pct(p.counterStrafe)}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t('frag.counterStrafe', {
                          pct: Math.round(accuracy.accurateSpeedFraction * 100),
                          slow: p.slowEnoughShots,
                          judged: p.judgedShots,
                        })}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {focus ? <Hitgroups player={focus} weapons={weapons} /> : null}

        <div className="flex flex-col gap-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            {focus ? 'Clique de novo para fechar.' : 'Clique num jogador para ver onde a bala pegou e a quebra por arma.'}
          </span>
          {accuracy.hasShotData ? null : (
            <span>
              <Trans i18nKey="analysisTail.reprocessNote" components={{ b: <strong /> }} />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Hitgroups({
  player,
  weapons,
}: {
  player: AccuracyAnalysis['players'][number];
  weapons: AccuracyAnalysis['byWeapon'];
}) {
  const { t } = useTranslation();
  const GRUPOS: [string, string][] = [
    ['head', 'Cabeca'],
    ['neck', 'Pescoco'],
    ['chest', 'Torax'],
    ['stomach', 'Estomago'],
    ['arms', 'Bracos'],
    ['legs', 'Pernas'],
    ['generic', 'Outro'],
  ];
  const valor = (id: string) => {
    if (id === 'arms') return (player.hitgroups.left_arm ?? 0) + (player.hitgroups.right_arm ?? 0);
    if (id === 'legs') return (player.hitgroups.left_leg ?? 0) + (player.hitgroups.right_leg ?? 0);
    return player.hitgroups[id] ?? 0;
  };
  const total = GRUPOS.reduce((sum, [id]) => sum + valor(id), 0);

  return (
    <div className="flex flex-col gap-3 border-t px-3 py-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{t('analysis.whereBullet')}</span>
        {total === 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {t('ui.noHitgroup')}
          </span>
        ) : (
          GRUPOS.filter(([id]) => valor(id) > 0).map(([id, label]) => (
            <div key={id} className="flex items-center gap-2 text-[11px]">
              <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className={cn('h-full', id === 'head' ? 'bg-emerald-500' : 'bg-primary/60')}
                  style={{ width: `${(valor(id) / total) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono tabular-nums">
                {valor(id)} ({Math.round((valor(id) / total) * 100)}%)
              </span>
            </div>
          ))
        )}
      </div>

      {weapons.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t('analysis.byWeapon')}</span>
          {weapons.map((w) => (
            <div key={w.weapon} className="flex items-center gap-2 text-[11px]">
              <CsIcon rel={weaponIcon(w.weapon)} title={w.weapon} className="h-3.5" />
              <span className="w-28 shrink-0 truncate text-muted-foreground">
                {w.weapon.replace(/^weapon_/, '')}
              </span>
              <span className="font-mono tabular-nums">
                {w.hits}/{w.shots}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {w.accuracy === null ? '\u2014' : `${(w.accuracy * 100).toFixed(0)}%`}
              </span>
              <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                {t('frag.weaponDamage', { damage: w.damage })}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AimCard({ aim, matchId, teams }: { aim: AimAnalysis; matchId: string; teams: Teams }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="size-4" />
          {t('frag.preAimTitle', { preAim: t('glossary.preAim') })}
        </CardTitle>
        <CardDescription>
          {t('analysis.preAimDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysisTail.preAimAndAccuracy'),
              meta: {
                matchId,
                references: {
                  punchModel: aim.punchModel,
                  calibrationMedianDeg: aim.calibrationMedianDeg,
                  preaimLeadMs: 250,
                  pitchSign: 'negativo = abaixo da cabeca',
                  scope: 'so duelos que terminaram em morte, com arma de fogo',
                },
              },
              table: () => ({
                columns: ['steam_id', 'jogador', 'duelos', 'preaim_mediana_graus',
                  'preaim_vertical_mediana_graus', 'precisao_mediana_graus', 'erro_mediano_unidades'],
                rows: aim.players.map((p) => [p.steamId, cleanName(p.name), p.duels,
                  p.preaimMedianDeg, p.preaimPitchMedianDeg, p.firstShotMedianDeg, p.medianMissUnits]),
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
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.duels')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('glossary.preAim')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.vertical')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('analysis.accuracy')}</th>
            </tr>
          </thead>
          <tbody>
            {aim.players.map((p) => (
              <tr key={p.steamId} className="border-b last:border-0">
                <td className="max-w-40 px-3 py-1.5">
                  <PlayerCell name={p.name} teamName={p.teamName} teams={teams} steamId={p.steamId} />
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {p.duels}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {p.preaimMedianDeg === null ? '—' : `${p.preaimMedianDeg.toFixed(2)}°`}
                </td>
                <td
                  className={cn(
                    'px-2 py-1.5 text-right font-mono tabular-nums',
                    (p.preaimPitchMedianDeg ?? 0) < -2 && 'text-destructive',
                  )}
                >
                  {p.preaimPitchMedianDeg === null ? (
                    '—'
                  ) : (
                    <Tooltip>
                      <TooltipTrigger render={<span className="cursor-help" />}>
                        {p.preaimPitchMedianDeg > 0 ? '+' : ''}
                        {p.preaimPitchMedianDeg.toFixed(2)}°
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <Trans i18nKey="analysisTail.pitchNote" components={{ b: <strong /> }} />
                      </TooltipContent>
                    </Tooltip>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {p.firstShotMedianDeg === null ? '—' : `${p.firstShotMedianDeg.toFixed(2)}°`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <FixedReference>
            O modelo de recuo (<span className="font-mono">{aim.punchModel}</span>) nao foi
            escolhido: foi medido sobre headshots confirmados, onde a bala comprovadamente passou
            pela cabeca. A mediana do erro residual ficou em{' '}
            {t('frag.calibration', { deg: aim.calibrationMedianDeg.toFixed(2) })}
          </FixedReference>
          <span>
            {t('analysisNotes.killsOnly')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TradeChainCard({ duels, matchId, teams }: { duels: DuelAnalysis; matchId: string; teams: Teams }) {
  const { t } = useTranslation();
  const [mirror, setMirror] = useState(false);
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '\u2014');
  const rows = [...duels.trades].sort((a, b) =>
    mirror ? b.deaths - a.deaths : b.opportunities - a.opportunities,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="size-4" />
          {t('analysis.tradeChain')}
        </CardTitle>
        <CardDescription>
          {mirror ? (
            <>
              {t('analysis.tradeChainMirror')}
            </>
          ) : (
            <>
              {t('analysis.chainLead')} (<strong>{t('analysis.chance')}</strong>) {t('analysis.chainMid')} (<strong>{t('analysis.wentAfter')}</strong>) {t('analysis.chainMid2')} (<strong>{t('analysis.avenged')}</strong>) {t('analysis.chainWindow', { seconds: duels.tradeWindowSeconds })}
            </>
          )}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Button size="xs" variant="outline" onClick={() => setMirror((v) => !v)}>
              {mirror ? 'Ver como vingador' : 'Ver como vingado'}
            </Button>
            <ExportButton
              spec={{
                title: t('analysis.tradeChain'),
                meta: {
                  matchId,
                  references: {
                    janela: `${duels.tradeWindowSeconds} s`,
                    tentativa: 'dano no assassino dentro da janela; tiro que errou nao conta',
                  },
                },
                table: () => ({
                  columns: ['steam_id', 'jogador', 'chances', 'foi_atras', 'vingou',
                    'mortes', 'mortes_com_chance', 'alguem_foi_atras', 'vingadas'],
                  rows: duels.trades.map((c) => [c.steamId, cleanName(c.name), c.opportunities,
                    c.attempts, c.successes, c.deaths, c.deathsWithOpportunity,
                    c.deathsWithAttempt, c.deathsTraded]),
                }),
              }}
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">{t('table.player')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{mirror ? t('chain.deaths') : t('chain.chances')}</th>
              <th className="px-2 py-1.5 text-right font-medium">
                {mirror ? t('chain.withChance') : t('chain.wentAfter')}
              </th>
              <th className="px-2 py-1.5 text-right font-medium">
                {mirror ? t('chain.someoneWent') : t('chain.avenged')}
              </th>
              <th className="px-3 py-1.5 text-right font-medium">
                {mirror ? t('chain.avengedMirror') : t('chain.converted')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.steamId} className="border-b last:border-0">
                <td className="max-w-40 px-3 py-1.5">
                  <PlayerCell name={c.name} teamName={c.teamName} teams={teams} steamId={c.steamId} />
                </td>
                {mirror ? (
                  <>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                      {c.deaths}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {c.deathsWithOpportunity}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {c.deathsWithAttempt}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                      {c.deathsTraded} ({pct(c.deathsTraded, c.deathsWithOpportunity)})
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                      {c.opportunities}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                      {c.attempts} ({pct(c.attempts, c.opportunities)})
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">{c.successes}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                      {pct(c.successes, c.attempts)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col gap-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span>
            <Trans i18nKey="chain.chanceNote" components={{ b: <strong /> }} />
          </span>
          <span>
            <Trans i18nKey="chain.wentAfterNote" components={{ b: <strong /> }} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DuelCard({ duels, matchId, teams }: { duels: DuelAnalysis; matchId: string; teams: Teams }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="size-4" />
          {t('glossary.entryKill')} e {t('glossary.trade')}
        </CardTitle>
        <CardDescription>
          {t('analysis.tradedDeathDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysisTail.entryAndTrade'),
              meta: {
                matchId,
                references: {
                  tradeWindowSeconds: duels.tradeWindowSeconds,
                  entryMaxSeconds: 45,
                  entryMinAlive: 4,
                  note: 'taxa de morte trocada e metrica de TIME',
                },
              },
              table: () => ({
                columns: ['steam_id', 'jogador', 'time', 'entradas_ganhas', 'entradas_perdidas',
                  'sucesso_entrada', 'kills_de_troca', 'mortes_vingadas', 'mortes', 'taxa_morte_vingada'],
                rows: duels.players.map((p) => [p.steamId, cleanName(p.name), p.teamName,
                  p.entryKills, p.entryDeaths, p.entrySuccess, p.tradeKills, p.tradedDeaths,
                  p.deaths, p.tradedDeathRate]),
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
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.entries')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.success')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.trades')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('analysis.avengedHeader')}</th>
            </tr>
          </thead>
          <tbody>
            {duels.players.map((p) => (
              <tr key={p.steamId} className="border-b last:border-0">
                <td className="max-w-40 px-3 py-1.5">
                  <PlayerCell name={p.name} teamName={p.teamName} teams={teams} steamId={p.steamId} />
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  <span className="text-primary">{p.entryKills}</span>
                  <span className="text-muted-foreground"> / {p.entryDeaths}</span>
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {p.entrySuccess === null ? '—' : `${Math.round(p.entrySuccess * 100)}%`}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {p.tradeKills}
                </td>
                <td
                  className={cn(
                    'px-3 py-1.5 text-right font-mono tabular-nums',
                    (p.tradedDeathRate ?? 1) < 0.15 && p.deaths > 5 && 'text-destructive',
                  )}
                >
                  {p.tradedDeathRate === null
                    ? '—'
                    : `${Math.round(p.tradedDeathRate * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <FixedReference>
            <Trans
              i18nKey="analysisNotes.tradeWindow"
              values={{ seconds: duels.tradeWindowSeconds }}
              components={{ b: <strong /> }}
            />
          </FixedReference>
          <span>{t('analysis.entryFootnote')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FlashCard({ flashes, matchId, teams }: { flashes: FlashAnalysis; matchId: string; teams: Teams }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="size-4" />
          {t('analysis.flashEfficacy')}
        </CardTitle>
        <CardDescription>
          {t('analysis.flashEfficacyDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysis.flashEfficacy'),
              meta: {
                matchId,
                references: {
                  effectiveThresholdSeconds: flashes.effectiveThresholdSeconds,
                  teamFlashPenalty: flashes.teamFlashPenalty,
                  netValue: 'segundos cegando inimigo - penalidade x segundos cegando aliado',
                },
              },
              table: () => ({
                columns: ['steam_id', 'jogador', 'flashes', 'inimigos_cegos', 'efetivas',
                  'aliados_cegos', 'segundos_inimigo', 'segundos_aliado', 'valor_liquido_s'],
                rows: flashes.players.map((p) => [p.steamId, cleanName(p.name), p.thrown,
                  p.enemiesFlashed, p.effectiveFlashes, p.teammatesFlashed,
                  p.enemyBlindSeconds, p.teamBlindSeconds, p.netValueSeconds]),
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
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.blinded')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.effective')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.allies')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('analysis.net')}</th>
            </tr>
          </thead>
          <tbody>
            {flashes.players.map((p) => (
              <tr key={p.steamId} className="border-b last:border-0">
                <td className="max-w-40 px-3 py-1.5">
                  <PlayerCell name={p.name} teamName={p.teamName} teams={teams} steamId={p.steamId} />
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {p.enemiesFlashed}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-primary">
                  {p.effectiveFlashes}
                </td>
                <td
                  className={cn(
                    'px-2 py-1.5 text-right font-mono tabular-nums',
                    p.teammatesFlashed > p.effectiveFlashes && 'text-destructive',
                  )}
                >
                  {p.teammatesFlashed}
                </td>
                <td
                  className={cn(
                    'px-3 py-1.5 text-right font-mono tabular-nums',
                    p.netValueSeconds < 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {p.netValueSeconds > 0 ? '+' : ''}
                  {p.netValueSeconds.toFixed(1)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <FixedReference>
            <Trans
              i18nKey="chain.flashNote"
              values={{
                seconds: flashes.effectiveThresholdSeconds,
                penalty: flashes.teamFlashPenalty,
              }}
              components={{ b: <strong /> }}
            />
          </FixedReference>
        </div>
      </CardContent>
    </Card>
  );
}

function EconomyCard({ economy, matchId }: { economy: EconomyAnalysis; matchId: string }) {
  const { t } = useTranslation();
  const maxValue = Math.max(
    1,
    ...economy.rounds.flatMap((r) => [r.ctEquipValue ?? 0, r.tEquipValue ?? 0]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4" />
          {t('analysis.economyPerRound')}
        </CardTitle>
        <CardDescription>
          {t('analysis.economyPerRoundDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysis.economyPerRound'),
              meta: {
                matchId,
                references: {
                  momento: 'fim do freezetime',
                  compraJogador: { eco: '< 2000', semi_eco: '2000-3500', force_buy: '3500-5000', full_buy: '>= 5000' },
                  compraTime: { eco: '< 5000', semi_eco: '5000-10000', force_buy: '10000-20000', full_buy: '>= 20000' },
                },
              },
              table: () => ({
                columns: ['round', 'vencedor', 'ct_equipamento', 'ct_compra', 't_equipamento', 't_compra'],
                rows: economy.rounds.map((r) => [r.roundNum, r.winnerSide, r.ctEquipValue,
                  r.ctBuyType, r.tEquipValue, r.tBuyType]),
              }),
              json: () => economy,
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end gap-1">
          {economy.rounds.map((r) => (
            <Tooltip key={r.roundNum}>
              <TooltipTrigger
                render={<div className="flex min-w-0 flex-1 cursor-help flex-col gap-0.5" />}
              >
                <div className="flex h-16 flex-col justify-end gap-0.5">
                  <div
                    className="w-full rounded-sm bg-sky-500/70"
                    style={{ height: `${((r.ctEquipValue ?? 0) / maxValue) * 50}%` }}
                  />
                  <div
                    className="w-full rounded-sm bg-amber-500/70"
                    style={{ height: `${((r.tEquipValue ?? 0) / maxValue) * 50}%` }}
                  />
                </div>
                <div
                  className={cn(
                    'h-1 w-full rounded-full',
                    r.winnerSide === 'CT' ? 'bg-sky-400' : 'bg-amber-400',
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                <div className="font-mono text-xs">
                  {t('frag.economyTooltip', { round: r.roundNum, side: r.winnerSide })}
                  <br />
                  CT {BUY_LABELS[r.ctBuyType ?? ''] ?? '?'} (${r.ctEquipValue ?? 0})
                  <br />T {BUY_LABELS[r.tBuyType ?? ''] ?? '?'} (${r.tEquipValue ?? 0})
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {t('ui.winsByBuy')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {economy.matchups
              .filter((m) => m.rounds >= 2)
              .sort((a, b) => b.rounds - a.rounds)
              .map((m) => (
                <Badge key={`${m.buyType}-${m.enemyBuyType}`} variant="outline" className="text-[10px]">
                  {BUY_LABELS[m.buyType]} vs {BUY_LABELS[m.enemyBuyType]}:{' '}
                  <span className={cn('ml-1 font-mono', m.won / m.rounds >= 0.5 && 'text-primary')}>
                    {m.won}/{m.rounds}
                  </span>
                </Badge>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapCard({ analysis }: { analysis: MatchAnalysis }) {
  const { t } = useTranslation();
  const layers = useRef<HTMLCanvasElement[] | null>(null);

  const [side, setSide] = useState<'todos' | 'CT' | 'T'>('todos');
  const [who, setWho] = useState<string | null>(null);

  const [kind, setKind] = useState<'deaths' | 'kills'>('deaths');

  const source = kind === 'deaths' ? analysis.heatmap.deaths : analysis.heatmap.kills;
  const bins = source.filter(
    (b) => (side === 'todos' || b.side === side) && (who === null || b.steamId === who),
  );

  const maxCount =
    kind === 'deaths' && side === 'todos' && who === null
      ? analysis.heatmap.maxCount
      : Math.max(1, ...bins.map((b) => b.count));
  if (!analysis.hasRadar) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="size-4" />
          {t('analysis.deathMap')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <MapIcon />
            <AlertTitle>{t('analysis.noRadarTitle')}</AlertTitle>
            <AlertDescription>
              <Trans
                i18nKey="analysisNotes.noRadarHeatmap"
                values={{ map: analysis.mapName }}
                components={{ m: <span className="font-mono" /> }}
              />
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapIcon className="size-4" />
          {kind === 'deaths' ? 'Onde as pessoas morrem' : 'Onde as pessoas matam'}
        </CardTitle>
        <CardDescription>
          {t('frag.heatmapDesc', {
            what: kind === 'deaths' ? t('frag.heatmapDeaths') : t('frag.heatmapKills'),
            grid: analysis.heatmap.gridSize,
            whose:
              kind === 'deaths' ? t('frag.heatmapWhoDied') : t('frag.heatmapWhoKilled'),
          })}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{

              title: `Mapa de ${kind === 'deaths' ? 'mortes' : 'kills'} - ${analysis.mapName}`,
              meta: {
                matchId: analysis.matchId,
                references: {
                  gridSize: analysis.heatmap.gridSize,
                  coordinates: 'binX/binY em celulas da grade, origem no canto INFERIOR esquerdo do radar',
                  radar: 'boltobserv (GPL-3.0)',
                },
              },
              json: () => analysis.heatmap,
              png: () =>
                layers.current
                  ? {
                      layers: layers.current,
                      alphas: [0.7, 1],
                      subtitle: [
                        `${bins.reduce((a, b) => a + b.count, 0)} ${kind === 'deaths' ? 'mortes' : 'kills'}`,
                        side === 'todos' ? null : `lado ${side}`,
                        who === null
                          ? null
                          : cleanName(
                              analysis.heatmap.players.find((p) => p.steamId === who)?.name ?? who,
                            ),
                      ]
                        .filter(Boolean)
                        .join(' · '),
                      footer: [
                        `Grade de ${analysis.heatmap.gridSize}x${analysis.heatmap.gridSize} sobre o radar. Amarelo = mais ${kind === 'deaths' ? 'mortes' : 'kills'}.`,
                        'Radar: boltobserv (GPL-3.0). Gerado pelo CS2 Demo Analyser, 100% local.',
                      ],
                    }
                  : null,
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {([
            ['deaths', 'mortes'],
            ['kills', 'kills'],
          ] as const).map(([id, rotulo]) => (
            <Badge
              key={id}
              variant={kind === id ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => setKind(id)}
            >
              {rotulo}
            </Badge>
          ))}
          <span className="ml-1 text-muted-foreground">{t('ui.of')}</span>
          {(['todos', 'CT', 'T'] as const).map((s) => (
            <Badge
              key={s}
              variant={side === s ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => setSide(s)}
            >
              {s === 'todos' ? 'os dois lados' : s}
            </Badge>
          ))}
          <select
            value={who ?? ''}
            onChange={(e) => setWho(e.target.value || null)}
            className="ml-1 h-6 rounded-md border bg-background px-1 text-[11px]"
          >
            <option value="">{t('analysisTail.everyone')}</option>
            {analysis.heatmap.players.map((p) => (
              <option key={p.steamId} value={p.steamId}>
                {cleanName(p.name)}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">
            {bins.reduce((n, b) => n + b.count, 0)} {kind === 'deaths' ? 'morte(s)' : 'kill(s)'}
          </span>
        </div>

        <HeatmapCanvas
          layersRef={layers}
          mapName={analysis.mapName}
          bins={bins}
          gridSize={analysis.heatmap.gridSize}
          maxCount={maxCount}
        />
      </CardContent>
    </Card>
  );
}

function BombCard({ analysis }: { analysis: MatchAnalysis }) {
  const { t } = useTranslation();
  const bomb = analysis.bomb;
  const semDesfecho = bomb.plants - bomb.defused - bomb.exploded;

  if (bomb.plants === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bomb className="size-4" />
            {t('analysis.bombTitle')}
          </CardTitle>
          <CardDescription>{t('analysis.bombEmpty')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bomb className="size-4" />
            {t('analysis.bombTitle')}
        </CardTitle>
        <CardDescription>
          {t('analysis.bombDesc')}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('analysis.bombTitle'),
              meta: {
                matchId: analysis.matchId,
                references: {
                  timerC4: `${bomb.c4TimerSeconds} s (${bomb.c4TimerSource === 'measured' ? 'medido nesta partida' : 'referencia declarada'})`,
                  escopo: 'so rounds live com plantio',
                },
              },
              table: () => ({
                columns: ['site', 'plantios', 'T_venceu', 'CT_venceu', 'desarmadas', 'explodiu',
                  'tempo_mediano_ate_plantar_s'],
                rows: bomb.bySite.map((x) => [x.site ?? 'desconhecido', x.plants, x.tWon, x.ctWon,
                  x.defused, x.exploded, x.medianPlantSeconds]),
              }),
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">{t('ui.site')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.plants')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.untilPlant')}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t('analysis.tWon')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('analysis.ctRetake')}</th>
            </tr>
          </thead>
          <tbody>
            {bomb.bySite.map((x) => (
              <tr key={x.site ?? '?'} className="border-b last:border-0">
                <td className="px-3 py-1.5 font-medium">{x.site ?? 'nao identificado'}</td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {x.plants}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {x.medianPlantSeconds === null ? '\u2014' : `${x.medianPlantSeconds.toFixed(0)} s`}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {x.tWon}/{x.plants} ({Math.round((x.tWon / x.plants) * 100)}%)
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {x.ctWon}/{x.plants} ({Math.round((x.ctWon / x.plants) * 100)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid gap-2 px-3 sm:grid-cols-3">
          <Stat
            label={t('analysisTail.defused')}
            value={t('analysisTail.defusedOf', { defused: bomb.defused, plants: bomb.plants })}
            hint={t('analysisTail.defusedHint', {
              withKit: bomb.defusedWithKit,
              withoutKit: bomb.defusedWithoutKit,
            })}
          />
          <Stat
            label={t('analysisTail.exploded')}
            value={String(bomb.exploded)}
            hint={semDesfecho > 0 ? t('analysisTail.explodedHint', { n: semDesfecho }) : undefined}
          />
          <Stat
            label={t('analysisTail.leftOnDefuse')}
            value={bomb.medianSecondsLeftOnDefuse === null
              ? '\u2014'
              : `${bomb.medianSecondsLeftOnDefuse.toFixed(1)} s`}
            hint={`timer de ${bomb.c4TimerSeconds} s, ${bomb.c4TimerSource === 'measured' ? 'medido nesta partida' : 'referencia'}`}
          />
        </div>

        {bomb.postPlantDeaths.length > 0 ? (
          <div className="px-3 text-[11px] text-muted-foreground">
            {t('frag.postPlantDeaths')}{' '}
            {bomb.postPlantDeaths.map((p, i) => (
              <span key={p.side}>
                {i > 0 ? ' e ' : ''}
                <strong>{p.deaths}</strong> {t('frag.ofSide')} {p.side}
              </span>
            ))}
            .
          </div>
        ) : null}

        {analysis.hasRadar && bomb.points.length > 0 ? (
          <div className="px-3 pb-3">
            <span className="text-xs font-medium">{t('analysis.whereBombWent')}</span>
            <ThrowsCanvas
              mapName={analysis.mapName}
              throws={bomb.points.map((p) => ({
                grenadeId: p.roundNum,
                roundNum: p.roundNum,
                steamId: null,
                kind: p.outcome === 'defused' ? 'smoke' : 'fire',
                side: null,
                throwPx: null,
                throwPy: null,
                detPx: p.px,
                detPy: p.py,
                split: p.split,
              }))}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cinza = desarmada. Laranja = explodiu ou o round acabou antes de a bomba resolver.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col rounded-md border px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
      {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
