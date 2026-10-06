import { Gauge, Ruler, Sigma } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { RatingAnalysis } from '@cs2/contract';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ExportButton } from '@/components/export-button';
import { PlayerCell } from '@/components/team-mark';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function RatingCard({
  rating,
  matchId,
  teams,
}: {
  rating: RatingAnalysis;
  matchId: string;
  teams: { a: string | null; b: string | null };
}) {
  const { t } = useTranslation();
  const { baseline } = rating;
  const temImpacto = rating.players.some((p) => p.swingPerRound !== null);
  const puladas = rating.players.reduce((n, p) => n + p.skippedKills, 0);

  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
  const num = (v: number, casas = 2) => v.toFixed(casas);
  const swing = (v: number | null) =>
    v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%`;

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" />
          {t('ratingCard.title')}
        </CardTitle>
        <CardDescription>
          <Trans i18nKey="ratingCard.desc" components={{ b: <strong /> }} />
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('ratingCard.title'),
              meta: {
                matchId,
                references: {
                  ratingFormula:
                    '0,0073*KAST + 0,3591*KPR - 0,5329*DPR + 0,2372*Impacto + 0,0032*ADR + 0,1587',
                  impactoDaFormula: '2,13*KPR + 0,42*APR - 0,41',
                  origemDosCoeficientes: 'regressao publicada por terceiros contra valores da HLTV (ADR 0013)',
                  rating30: 'nao imitado: a HLTV nao publica a formula',
                  probabilidadeDeRound: `frequencia observada na propria biblioteca: ${baseline.observations} estados, ${baseline.states} com amostra >= ${baseline.minSample}`,
                  swing: 'variacao da chance de o lado do autor ganhar o round, somada por round',
                },
              },
              table: () => ({
                columns: ['steam_id', 'jogador', 'time', 'rounds', 'rating_aproximado',
                  'kast', 'kpr', 'dpr', 'apr', 'adr', 'impacto_por_round', 'kills_sem_amostra'],
                rows: rating.players.map((p) => [p.steamId, p.name, p.teamName, p.rounds,
                  p.rating === null ? null : Number(p.rating.toFixed(3)),
                  p.kast, Number(p.kpr.toFixed(3)), Number(p.dpr.toFixed(3)),
                  Number(p.apr.toFixed(3)), p.adr,
                  p.swingPerRound === null ? null : Number(p.swingPerRound.toFixed(4)),
                  p.skippedKills]),
              }),
              json: () => rating,
            }}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 p-0">
        <Table>
          <THead>
            <Th align="left">{t('table.player')}</Th>
            <Th tip={t('ratingCard.ratingTip')}>
              {t('ratingCard.rating')}
            </Th>
            <Th tip={t('ratingCard.swingTip')}>
              {t('ratingCard.swing')}
            </Th>
            <Th tip={t('ratingCard.kastTip')}>{t('glossary.kast')}</Th>
            <Th tip={t('ratingCard.kprTip')}>KPR</Th>
            <Th tip={t('ratingCard.dprTip')}>DPR</Th>
            <Th tip={t('ratingCard.adrTip')}>ADR</Th>
          </THead>
          <TBody>
            {rating.players.map((p) => (
              <Tr key={p.steamId}>
                <Td align="left" className="max-w-40">
                  <PlayerCell name={p.name} teamName={p.teamName} teams={teams} steamId={p.steamId} />
                </Td>
                <Td
                  className={cn(
                    p.rating !== null && p.rating >= 1.1 && 'text-primary',
                    p.rating !== null && p.rating < 0.9 && 'text-destructive',
                  )}
                >
                  {p.rating === null ? '—' : num(p.rating)}
                </Td>
                <Td
                  className={cn(
                    p.swingPerRound !== null && p.swingPerRound > 0 && 'text-primary',
                    p.swingPerRound !== null && p.swingPerRound < 0 && 'text-destructive',
                  )}
                >
                  {swing(p.swingPerRound)}
                </Td>
                <Td muted>{pct(p.kast)}</Td>
                <Td muted>{num(p.kpr)}</Td>
                <Td muted>{num(p.dpr)}</Td>
                <Td muted>{num(p.adr, 1)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>

        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 text-[11px] text-muted-foreground">
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="outline" className="cursor-help gap-1 text-[10px]">
                  <Ruler className="size-3" />
                  {t('ratingCard.ratingChip')}
                </Badge>
              }
            />
            <TooltipContent>
              <div className="max-w-72 text-xs">
                {t('ratingCard.ratingChipDesc')}
              </div>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="outline" className="cursor-help gap-1 text-[10px]">
                  <Sigma className="size-3" />
                  {t('ratingCard.impactChip')}
                </Badge>
              }
            />
            <TooltipContent>
              <div className="max-w-72 text-xs">
                {t('ratingCard.impactChipDesc', {
                  observations: baseline.observations,
                  states: baseline.states,
                  min: baseline.minSample,
                })}
              </div>
            </TooltipContent>
          </Tooltip>

          {!temImpacto ? (
            <span className="text-amber-400/90">
              {t('ratingCard.noLibrary', { min: baseline.minSample })}
            </span>
          ) : puladas > 0 ? (
            <span>
              {t('ratingCard.skipped', { n: puladas, min: baseline.minSample })}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
