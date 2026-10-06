import { useTranslation } from 'react-i18next';
import { UserRoundCog } from 'lucide-react';
import type { MatchRosterWire, RosterHandoffWire } from '@cs2/contract';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ExportButton } from '@/components/export-button';
import { TeamMark } from '@/components/team-mark';
import { cleanName } from '@/lib/format';

type Teams = { a: string | null; b: string | null };

export function RosterPanel({ roster, teams }: { roster: MatchRosterWire; teams: Teams }) {
  const { t } = useTranslation();
  if (roster.handoffs.length === 0 && roster.understaffedRounds.length === 0) return null;

  const linha = (h: RosterHandoffWire): string => {
    const out = h.outName === null ? null : cleanName(h.outName);
    const entrou = h.inName === null ? null : cleanName(h.inName);
    if (out !== null && entrou !== null) {
      return t('matchScreen.rosterHandoff', {
        out,
        outRound: h.outLastRound,
        in: entrou,
        inRound: h.inFirstRound,
      });
    }
    if (out !== null) {
      return t('matchScreen.rosterHandoffOutOnly', { out, outRound: h.outLastRound });
    }
    return t('matchScreen.rosterHandoffInOnly', { in: entrou, inRound: h.inFirstRound });
  };

  const intervalo = (h: RosterHandoffWire): string | null => {
    if (h.gapRounds === null) return null;
    if (h.gapRounds < 0) return t('matchScreen.rosterOverlap', { n: -h.gapRounds });
    if (h.gapRounds === 0) return t('matchScreen.rosterGapClean');
    return t('matchScreen.rosterGapRounds', { n: h.gapRounds });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRoundCog className="size-4" />
          {t('matchScreen.rosterChanges')}
        </CardTitle>
        <CardDescription>{t('matchScreen.rosterChangesDesc')}</CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('matchScreen.rosterChanges'),
              meta: {
                references: {
                  janela:
                    'rounds live em que o jogador apareceu no elenco; medido round a round',
                  pareamento:
                    'INFERIDO por adjacencia: mesma equipe, janela que termina x janela que comeca',
                  intervalo:
                    'rounds live entre a saida e a entrada; negativo = as janelas se sobrepoem, e ai nao e substituicao',
                  motivo:
                    'a demo NAO registra por que alguem saiu; o codigo de player_disconnect nao distingue complete de fim de partida',
                },
              },
              table: () => ({
                columns: [
                  'time', 'saiu', 'ultimo_round', 'entrou', 'primeiro_round',
                  'intervalo_em_rounds', 'criterio',
                ],
                rows: roster.handoffs.map((h) => [
                  h.teamName, h.outName, h.outLastRound,
                  h.inName, h.inFirstRound, h.gapRounds, h.inference,
                ]),
              }),
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {roster.handoffs.map((h) => (
          <div
            key={`${h.teamSlot}-${h.outSteamId ?? ''}-${h.inSteamId ?? ''}`}
            className="flex flex-col gap-0.5"
          >
            <span className="flex items-center gap-1.5">
              <TeamMark teamName={h.teamName} teams={teams} />
              <span>{linha(h)}</span>
            </span>
            {intervalo(h) ? (
              <span className="pl-5 text-[11px] text-muted-foreground">{intervalo(h)}</span>
            ) : null}
          </div>
        ))}
        {roster.understaffedRounds.length > 0 ? (
          <div className="border-t pt-2 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground">
              {t('matchScreen.understaffedRounds')}
            </p>
            <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
              {roster.understaffedRounds.map((r) => (
                <li key={r.roundNum}>
                  {t('matchScreen.understaffedRound', {
                    round: r.roundNum,
                    ct: r.rosterCt,
                    t: r.rosterT,
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
