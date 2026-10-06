import { Coins, Ruler, TrendingDown } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { EconomyAnalysis } from '@cs2/contract';
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
import { cleanName } from '@/lib/format';
import { PlayerCell } from '@/components/team-mark';
import { Th, THead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const BUY_LABELS: Record<string, string> = {
  pistol: 'Pistola',
  full_eco: 'Save',
  eco: 'Eco',
  semi_eco: 'Semi-eco',
  force_buy: 'Force Buy',
  full_buy: 'Full Buy',
};

const money = (v: number) => `$${v.toLocaleString('pt-BR')}`;

export function DeepEconomyCard({
  economy,
  matchId,
  teams,
}: {
  economy: EconomyAnalysis;
  matchId: string;
  teams: { a: string | null; b: string | null };
}) {
  const { t } = useTranslation();
  const { deep } = economy;
  const maxMoney = Math.max(1, ...deep.rounds.flatMap((r) => [r.ctMoney, r.tMoney]));
  const lowBuys = deep.conversion.filter((c) =>
    c.buyType === 'eco' || c.buyType === 'semi_eco' || c.buyType === 'force_buy',
  );
  const lostForces = deep.forceBuys.filter((f) => !f.won);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="size-4" />
          {t('deepEconomy.title')}
        </CardTitle>
        <CardDescription>
          <Trans i18nKey="deepEconomy.desc" components={{ b: <strong /> }} />
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('deepEconomy.title'),
              meta: {
                matchId,
                references: {
                  premioDerrota: deep.lossBonusSteps,
                  regra: 'derrota sobe um degrau, vitoria desce um; recomeca a cada metade',
                  equipamentoDestruido: 'valor com que a vitima entrou no round (fim do freezetime)',
                  dinheiroNaMesa: 'saldo nao gasto no freezetime, so em round de full buy do time',
                },
              },
              table: () => ({
                columns: ['round', 'ct_dinheiro', 't_dinheiro', 'ct_premio_derrota',
                  't_premio_derrota', 'ct_break', 't_break'],
                rows: deep.rounds.map((r) => [r.roundNum, r.ctMoney, r.tMoney,
                  r.ctLossBonus, r.tLossBonus, r.ctBreak, r.tBreak]),
              }),
              json: () => deep,
            }}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('deepEconomy.moneyAtStart')}</span>
            <span className="font-mono">{t('deepEconomy.peak', { value: money(maxMoney) })}</span>
          </div>
          <div className="flex items-end gap-1">
            {deep.rounds.map((r) => (
              <Tooltip key={r.roundNum}>
                <TooltipTrigger
                  render={<div className="flex min-w-0 flex-1 cursor-help flex-col gap-0.5" />}
                >
                  <div className="flex h-20 flex-col justify-end gap-0.5">
                    <div
                      className="w-full rounded-sm bg-sky-500/70"
                      style={{ height: `${(r.ctMoney / maxMoney) * 50}%` }}
                    />
                    <div
                      className="w-full rounded-sm bg-amber-500/70"
                      style={{ height: `${(r.tMoney / maxMoney) * 50}%` }}
                    />
                  </div>
                  <div className="flex h-3 items-center justify-center">
                    {r.ctBreak || r.tBreak ? (
                      <TrendingDown
                        className={cn(
                          'size-3',
                          r.ctBreak && r.tBreak
                            ? 'text-destructive'
                            : r.ctBreak
                              ? 'text-sky-400'
                              : 'text-amber-400',
                        )}
                      />
                    ) : null}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="font-mono text-xs">
                    {t('frag2.roundTooltip', { round: r.roundNum })}
                    <br />
                    CT {money(r.ctMoney)} — {t('deepEconomy.lossBonusLine')} {money(r.ctLossBonus)}
                    <br />T {money(r.tMoney)} — {t('deepEconomy.lossBonusLine')} {money(r.tLossBonus)}
                    {r.ctBreak ? <><br />{t('deepEconomy.ctBroke')}</> : null}
                    {r.tBreak ? <><br />{t('deepEconomy.tBroke')}</> : null}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-sky-500/70" /> CT
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-amber-500/70" /> T
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="size-3" />
              {t('deepEconomy.breakPoint')}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge variant="outline" className="cursor-help gap-1 text-[10px]">
                    <Ruler className="size-3" />
                    {t('deepEconomy.fixedRef')}
                  </Badge>
                }
              />
              <TooltipContent>
                <div className="max-w-64 text-xs">
                  {t('deepEconomy.lossBonusDesc', {
                    steps: deep.lossBonusSteps.map(money).join(' / '),
                  })}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {lowBuys.length > 0 ? (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {t('deepEconomy.conversion')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lowBuys.map((c) => (
                <Badge key={`${c.side}-${c.buyType}`} variant="outline" className="text-[10px]">
                  <span className={c.side === 'CT' ? 'text-sky-300' : 'text-amber-300'}>
                    {c.side}
                  </span>{' '}
                  {BUY_LABELS[c.buyType] ?? c.buyType}:
                  <span className={cn('ml-1 font-mono', c.won > 0 && 'text-primary')}>
                    {c.won}/{c.rounds}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {lostForces.length > 0 ? (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {t('deepEconomy.forceCost')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lostForces.map((f) => (
                <Badge key={`${f.roundNum}-${f.side}`} variant="outline" className="text-[10px]">
                  <span className={f.side === 'CT' ? 'text-sky-300' : 'text-amber-300'}>
                    {f.side}
                  </span>{' '}
                  {t('labels.roundNum', { n: f.roundNum })}
                  <span className="ml-1 font-mono">
                    {f.roundsUntilFullBuy === null
                      ? t('deepEconomy.noFullBuy')
                      : t('deepEconomy.untilFullBuy', { n: f.roundsUntilFullBuy })}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {t('deepEconomy.byPlayer')}
          </div>
          <table className="w-full text-sm">
            <THead>
              <Th align="left">{t('table.player')}</Th>
              <Th tip={t('deepEconomy.spentTip')}>{t('deepEconomy.spent')}</Th>
              <Th tip={t('deepEconomy.destroyedTip')}>
                {t('deepEconomy.destroyed')}
              </Th>
              <Th tip={t('deepEconomy.savedTip')}>
                {t('deepEconomy.saved')}
              </Th>
              <Th tip={t('deepEconomy.onTableTip')}>
                {t('deepEconomy.onTable')}
              </Th>
            </THead>
            <tbody>
              {deep.byPlayer.map((p) => (
                <tr key={p.steamId} className="border-b last:border-0">
                  <td className="px-3 py-1.5">
                    <PlayerCell
                      name={p.name}
                      teamName={p.teamName}
                      teams={teams}
                      steamId={p.steamId}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                    {money(p.spent)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-primary">
                    {money(p.equipDestroyed)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                    {money(p.equipSaved)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {money(p.leftOnTable)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 pt-1.5 text-[11px] text-muted-foreground">
            <Trans i18nKey="deepEconomy.footnote" components={{ b: <strong /> }} />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
