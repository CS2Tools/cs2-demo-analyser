import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Crosshair, Info, Map as MapIcon, Swords, TriangleAlert, Users } from 'lucide-react';
import type { TeamLineup, TeamMatchSide } from '@cs2/contract';
import type { SupportedLocale } from '@cs2/i18n';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ExportButton } from '@/components/export-button';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { cleanName, formatDateTime } from '@/lib/format';
import { mapIcon } from '@/lib/icons';
import { CsIcon } from '@/components/cs-icon';
import { useRoute } from '@/lib/use-route';
import { cn } from '@/lib/utils';

export function TeamView({ onOpenMatch }: { onOpenMatch: (matchId: string) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as SupportedLocale;
  const lineups = useRoute('team.lineups', {}, []);
  const [teamId, setTeamId] = useState<string | null>(null);

  const chosen = useMemo(
    () => lineups.data?.find((l) => l.id === teamId) ?? lineups.data?.[0] ?? null,
    [lineups.data, teamId],
  );

  if (lineups.loading && !lineups.data) return <Skeleton className="h-96 w-full" />;
  if (lineups.error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t('teamScreen.error')}</AlertTitle>
        <AlertDescription>{lineups.error}</AlertDescription>
      </Alert>
    );
  }
  if (!chosen) {
    return (
      <Alert>
        <Info />
        <AlertDescription>
          {t('teamScreen.empty')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Crosshair className="size-4" />
          {t('nav.team')}
        </h1>
        <div className="flex flex-wrap gap-1.5">
          {lineups.data?.map((l) => (
            <Badge
              key={l.id}
              variant={l.id === chosen.id ? 'default' : 'outline'}
              className={cn('cursor-pointer text-[11px]', l.id !== chosen.id && 'opacity-70')}
              onClick={() => setTeamId(l.id)}
            >
              {l.name ? cleanName(l.name) : t('teamScreen.unnamed')}
              <span className="ml-1 font-mono opacity-70">{l.matches}</span>
            </Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue="partida">
        <TabsList>
          <TabsTrigger value="partida">{t('teamScreen.tabMatch')}</TabsTrigger>
          <TabsTrigger value="biblioteca">{t('teamScreen.tabLibrary')}</TabsTrigger>
        </TabsList>

        <TabsContent value="partida">
          <MatchTab lineup={chosen} locale={locale} onOpenMatch={onOpenMatch} />
        </TabsContent>

        <TabsContent value="biblioteca">
          <LibraryTab lineup={chosen} onOpenMatch={onOpenMatch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchTab({
  lineup,
  locale,
  onOpenMatch,
}: {
  lineup: TeamLineup;
  locale: SupportedLocale;
  onOpenMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();

  const ids = useMemo(() => [...lineup.matchIds].reverse(), [lineup.matchIds]);
  const [matchId, setMatchId] = useState(ids[0]!);
  useEffect(() => setMatchId(ids[0]!), [ids]);

  const report = useRoute('team.match', { matchId }, [matchId]);
  const matches = useRoute('matches.list', { filter: 'all' }, []);
  const info = matches.data?.find((m) => m.matchId === matchId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-muted-foreground">{t('teamScreen.matchLabel')}</span>
        {ids.map((id) => {
          const m = matches.data?.find((x) => x.matchId === id);
          return (
            <Badge
              key={id}
              variant={id === matchId ? 'default' : 'outline'}
              className={cn('cursor-pointer text-[10px]', id !== matchId && 'opacity-70')}
              onClick={() => setMatchId(id)}
            >
              {m ? m.mapName : id.slice(0, 6)}
              {m?.playedAt ? (
                <span className="ml-1 opacity-70">{formatDateTime(m.playedAt, locale)}</span>
              ) : null}
            </Badge>
          );
        })}
        {info ? (
          <button
            type="button"
            className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onOpenMatch(matchId)}
          >
            {t('teamScreen.openInMatch')}
          </button>
        ) : null}
      </div>

      {report.loading && !report.data ? <Skeleton className="h-96 w-full" /> : null}
      {report.error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{report.error}</AlertDescription>
        </Alert>
      ) : null}

      {report.data ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {report.data.teams.map((team, i) => (
              <TeamColumn
                key={team.teamName ?? i}
                team={team}
                opponent={report.data!.teams[1 - i]!}
                highlighted={team.teamName === lineup.name}
                matchId={matchId}
              />
            ))}
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">
            {t('teamScreen.byTeamNote')}
          </p>
        </>
      ) : null}
    </div>
  );
}

const BUY_LABELS: Record<string, string> = {
  pistol: 'Pistola',
  full_eco: 'Save',
  eco: 'Eco',
  semi_eco: 'Semi-eco',
  force_buy: 'Force',
  full_buy: 'Full buy',
};

const virou = (t: TeamMatchSide) => t.roundsWon - t.openings.openedWon;

const atrasado = (t: TeamMatchSide) => t.roundsPlayed - t.openings.opened;

function pct(won: number, total: number): string {
  if (total === 0) return '—';
  return `${won}/${total} (${Math.round((won / total) * 100)}%)`;
}

function TeamColumn({
  team,
  opponent,
  highlighted,
  matchId,
}: {
  team: TeamMatchSide;
  opponent: TeamMatchSide;
  highlighted: boolean;
  matchId: string;
}) {
  const { t } = useTranslation();
  const melhor = (a: number, b: number) => (a > b ? 'text-primary' : a < b ? 'text-muted-foreground' : '');

  return (
    <Card className={cn(highlighted && 'ring-1 ring-primary/40')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          {team.teamName ? cleanName(team.teamName) : t('teamScreen.noName')}
          <span className="font-mono text-sm text-muted-foreground">
            {team.roundsWon}/{team.roundsPlayed}
          </span>
        </CardTitle>

        <CardDescription
          className="text-pretty"
          title={team.players.map((p) => cleanName(p.name)).join(' · ')}
        >
          {team.players.map((p) => cleanName(p.name)).join(' · ')}
          {team.players.length > 5 ? (
            <span className="ml-1.5 font-mono text-[11px]">
              {t('teamScreen.rosterSize', { n: team.players.length })}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-0">
        <Table>
          <THead>
            <Th align="left">{t('teamScreen.reading')}</Th>
            <Th>{t('teamScreen.thisTeam')}</Th>
            <Th>{t('teamScreen.opponent')}</Th>
          </THead>
          <TBody>
            {team.bySide.map((s) => {
              const dele = opponent.bySide.find((x) => x.side !== s.side);
              return (
                <Tr key={s.side}>
                  <Td align="left">
                    {t('teamScreen.roundsOf')}{' '}
                    <span className={s.side === 'CT' ? 'text-sky-300' : 'text-amber-300'}>
                      {s.side}
                    </span>
                  </Td>
                  <Td className={melhor(s.won / Math.max(1, s.rounds), (dele?.won ?? 0) / Math.max(1, dele?.rounds ?? 1))}>
                    {pct(s.won, s.rounds)}
                  </Td>
                  <Td muted>{dele ? pct(dele.won, dele.rounds) : '—'}</Td>
                </Tr>
              );
            })}

            <Tr>
              <Td align="left">
                <Tip text={t('teamScreen.openedTip')}>{t('teamScreen.opened')}</Tip>
              </Td>
              <Td className={melhor(team.openings.opened, opponent.openings.opened)}>
                {pct(team.openings.openedWon, team.openings.opened)}
              </Td>
              <Td muted>{pct(opponent.openings.openedWon, opponent.openings.opened)}</Td>
            </Tr>

            <Tr>
              <Td align="left">
                <Tip text={t('teamScreen.turnedTip')}>{t('teamScreen.turned')}</Tip>
              </Td>
              <Td className={melhor(virou(team), virou(opponent))}>
                {pct(virou(team), atrasado(team))}
              </Td>
              <Td muted>{pct(virou(opponent), atrasado(opponent))}</Td>
            </Tr>

            <Tr>
              <Td align="left">
                <Tip text={t('teamScreen.utilPerRoundTip')}>{t('teamScreen.utilPerRound')}</Tip>
              </Td>
              <Td>
                {team.utility.roundsPlayed > 0
                  ? (team.utility.thrown / team.utility.roundsPlayed).toFixed(1)
                  : '—'}
              </Td>
              <Td muted>
                {opponent.utility.roundsPlayed > 0
                  ? (opponent.utility.thrown / opponent.utility.roundsPlayed).toFixed(1)
                  : '—'}
              </Td>
            </Tr>

            <Tr>
              <Td align="left">
                <Tip text={t('teamScreen.utilDamageTip')}>{t('teamScreen.utilDamage')}</Tip>
              </Td>
              <Td className={melhor(team.utility.damage, opponent.utility.damage)}>
                {team.utility.damage}
              </Td>
              <Td muted>{opponent.utility.damage}</Td>
            </Tr>

            <Tr>
              <Td align="left">
                <Tip text={t('teamScreen.bombTip')}>{t('teamScreen.bomb')}</Tip>
              </Td>
              <Td>
                {t('teamScreen.plantsShort', { plants: team.bomb.plants, defuses: team.bomb.defuses })}
              </Td>
              <Td muted>
                {opponent.bomb.plants} / {opponent.bomb.defuses}
              </Td>
            </Tr>
          </TBody>
        </Table>

        {team.bomb.bySite.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 px-3 text-[11px]">
            <span className="text-muted-foreground">{t('teamScreen.wherePlants')}</span>
            {team.bomb.bySite.map((s) => (
              <Badge key={s.site ?? '?'} variant="outline" className="text-[10px]">
                {s.site ?? t('teamScreen.unknownSite')}: {s.plants}
                {s.defusedByEnemy > 0 ? (
                  <span className="ml-1 text-destructive/80">
                    {t('teamScreen.defusedCount', { n: s.defusedByEnemy })}
                  </span>
                ) : null}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 text-[11px]">
          <span className="text-muted-foreground">{t('teamScreen.buy')}</span>
          {team.buys
            .slice()
            .sort((a, b) => b.rounds - a.rounds)
            .map((b) => (
              <Badge key={b.buyType} variant="outline" className="text-[10px]">
                {BUY_LABELS[b.buyType] ?? b.buyType}
                <span className="ml-1 font-mono">{b.won}/{b.rounds}</span>
              </Badge>
            ))}
          <ExportButton
            className="ml-auto -my-1"
            spec={{
              title: t('teamScreen.exportTitle', { name: team.teamName ?? t('teamScreen.unnamed') }),
              meta: {
                matchId,
                references: {
                  agrupamento: 'por TIME, nao por lado: o lado vira na metade da partida',
                  timeDoLado: 'maioria do elenco daquele lado no round',
                  vantagem: 'primeiro desequilibrio numerico do round',
                },
              },
              table: () => ({
                columns: ['leitura', 'valor', 'de'],
                rows: [
                  ['rounds', team.roundsWon, team.roundsPlayed],
                  ...team.bySide.map((s) => [`rounds_${s.side}`, s.won, s.rounds]),
                  ['abriu_o_round', team.openings.openedWon, team.openings.opened],
                  ['converteu_vantagem', team.advantages.won, team.advantages.rounds],
                  ['utilitario_arremessado', team.utility.thrown, team.utility.roundsPlayed],
                  ['dano_de_utilitario', team.utility.damage, null],
                  ['plantios', team.bomb.plants, null],
                  ['defusas', team.bomb.defuses, null],
                  ...team.buys.map((b) => [`compra_${b.buyType}`, b.won, b.rounds]),
                ],
              }),
              json: () => team,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="cursor-help underline decoration-dotted underline-offset-2" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left font-normal">{text}</TooltipContent>
    </Tooltip>
  );
}

function LibraryTab({
  lineup,
  onOpenMatch,
}: {
  lineup: TeamLineup;
  onOpenMatch: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const matches = useRoute('matches.list', { filter: 'all' }, []);
  const nucleo = lineup.players[0]?.matches ?? 0;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords className="size-4" />
            {lineup.name ? cleanName(lineup.name) : t('teamScreen.noName')}
          </CardTitle>
          <CardDescription>
            {t('teamScreen.summary', {
              matches: lineup.matches,
              wins: lineup.wins,
              won: lineup.roundsWon,
              lost: lineup.roundsLost,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-0">
          <Table>
            <THead>
              <Th align="left">{t('table.side')}</Th>
              <Th>{t('table.rounds')}</Th>
              <Th>{t('teamScreen.won')}</Th>
            </THead>
            <TBody>
              {lineup.bySide.map((s) => (
                <Tr key={s.side}>
                  <Td align="left" className={s.side === 'CT' ? 'text-sky-300' : 'text-amber-300'}>
                    {s.side}
                  </Td>
                  <Td muted>{s.rounds}</Td>
                  <Td>{pct(s.won, s.rounds)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <div className="flex flex-col gap-1 px-3 pb-3">
            <span className="text-xs font-medium text-muted-foreground">{t('teamScreen.roster')}</span>
            <div className="flex flex-wrap gap-1.5">
              {lineup.players.map((p) => (
                <Badge
                  key={p.steamId}
                  variant={p.matches === nucleo ? 'default' : 'outline'}
                  className="text-[10px]"
                  title={
                    p.matches === nucleo
                      ? t('teamScreen.coreHint')
                      : t('teamScreen.playedHint', { n: p.matches, total: lineup.matches })
                  }
                >
                  {cleanName(p.name)}
                  <span className="ml-1 font-mono opacity-70">
                    {p.matches}/{lineup.matches}
                  </span>
                </Badge>
              ))}
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">
              <Trans i18nKey="teamScreen.heuristic" components={{ b: <strong /> }} />
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapIcon className="size-4" />
            {t('teamScreen.byMap')}
          </CardTitle>
          <CardDescription>
            {t('teamScreen.byMapDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Th align="left">{t('table.map')}</Th>
              <Th>{t('table.matches')}</Th>
              <Th>{t('table.rounds')}</Th>
              <Th>{t('teamScreen.balance')}</Th>
            </THead>
            <TBody>
              {lineup.maps.map((m) => (
                <Tr key={m.mapName}>
                  <Td align="left">
                    <span className="flex items-center gap-1.5">
                      <CsIcon rel={mapIcon(m.mapName)} className="size-4" />
                      {m.mapName}
                    </span>
                  </Td>
                  <Td muted>{m.matches}</Td>
                  <Td muted>
                    {m.roundsWon}–{m.roundsLost}
                  </Td>
                  <Td className={m.roundsWon > m.roundsLost ? 'text-primary' : 'text-destructive'}>
                    {m.roundsWon - m.roundsLost > 0 ? '+' : ''}
                    {m.roundsWon - m.roundsLost}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <div className="flex flex-wrap gap-1.5 p-3">
            <span className="text-[11px] text-muted-foreground">{t('teamScreen.groupMatches')}</span>
            {lineup.matchIds.map((id) => {
              const m = matches.data?.find((x) => x.matchId === id);
              return (
                <Badge
                  key={id}
                  variant="outline"
                  className="cursor-pointer text-[10px]"
                  onClick={() => onOpenMatch(id)}
                >

                  {m ? m.mapName : id.slice(0, 8)}
                  {m?.playedAt ? (
                    <span className="ml-1 opacity-70">{m.playedAt.slice(0, 10)}</span>
                  ) : null}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
