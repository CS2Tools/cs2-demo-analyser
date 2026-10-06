import { Trans, useTranslation } from 'react-i18next';
import { MessageSquare, RefreshCw, Users } from 'lucide-react';
import type { MatchChat, MatchDetail } from '@cs2/contract';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamMark } from '@/components/team-mark';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ChatPanel({
  chat,
  detail,
  onSeek,
  onReprocess,
}: {
  chat: MatchChat;
  detail: MatchDetail;
  onSeek: (roundNum: number, tick: number) => void;
  onReprocess?: () => void;
}) {
  const { t } = useTranslation();
  const teams = { a: detail.summary.teamAName, b: detail.summary.teamBName };

  if (chat.messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4" />
            {t('misc2.chatTitle')}
          </CardTitle>
          <CardDescription>
            {chat.needsReprocess ? t('chatPanel.needsReprocess') : t('chatPanel.noChat')}
          </CardDescription>
          {chat.needsReprocess && onReprocess ? (
            <CardAction>
              <Button size="xs" variant="outline" onClick={onReprocess}>
                <RefreshCw data-icon="inline-start" />
                {t('reprocess.button')}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
      </Card>
    );
  }

  const tempo = (s: number | null) => {
    if (s === null) return '';
    const sinal = s < 0 ? '-' : '';
    const abs = Math.abs(Math.round(s));
    return `${sinal}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4" />
            {t('misc2.chatTitle')}
          <Badge variant="outline" className="text-[10px]">
            {chat.messages.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {t('frag.chatDesc')}
          {chat.unknownScope > 0 ? (
            <>
              {' '}
              <Trans
                i18nKey="ui2.chatUnknownScope"
                values={{ n: chat.unknownScope }}
                components={{ b: <strong /> }}
              />
            </>
          ) : null}
        </CardDescription>
        <CardAction>
          <ExportButton
            spec={{
              title: t('misc2.chatTitle'),
              meta: {
                matchId: detail.summary.matchId,
                references: {
                  escopo:
                    'teamonly vem do evento player_chat; o evento chat_message nao traz escopo, e ai fica nulo',
                  round: 'derivado do tick contra a tabela de rounds',
                  segundos: 'desde o fim do freezetime; negativo = ainda no freezetime',
                },
              },
              table: () => ({
                columns: ['tick', 'round', 'segundos_no_round', 'steam_id', 'jogador', 'time',
                  'escopo', 'texto'],
                rows: chat.messages.map((m) => [m.tick, m.roundNum,
                  m.secondsIntoRound === null ? null : Number(m.secondsIntoRound.toFixed(1)),
                  m.steamId, m.name, m.teamName,
                  m.isTeamOnly === null ? 'desconhecido' : m.isTeamOnly ? 'time' : 'todos',
                  m.text]),
              }),
              json: () => chat,
            }}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="max-h-96 overflow-y-auto p-0">
        <ul className="divide-y">
          {chat.messages.map((m, i) => (
            <li key={`${m.tick}-${i}`}>
              <button
                type="button"
                disabled={m.roundNum === null}
                onClick={() => m.roundNum !== null && onSeek(m.roundNum, m.tick)}
                className={cn(
                  'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs',
                  m.roundNum !== null && 'cursor-pointer hover:bg-accent/50',
                )}
              >
                <span className="w-12 shrink-0 font-mono tabular-nums text-muted-foreground">
                  {m.roundNum === null ? '—' : `R${m.roundNum}`}
                </span>
                <span className="w-10 shrink-0 font-mono tabular-nums text-muted-foreground/70">
                  {tempo(m.secondsIntoRound)}
                </span>
                <TeamMark teamName={m.teamName} teams={teams} className="translate-y-0.5" />
                <span className="w-28 shrink-0 truncate font-medium">
                  {cleanName(m.name ?? '—')}
                </span>
                <Escopo value={m.isTeamOnly} />
                <span className="min-w-0 flex-1 break-words">{m.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Escopo({ value }: { value: boolean | null }) {
  const { t } = useTranslation();
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="shrink-0 cursor-help text-[10px] text-muted-foreground/60">?</span>
          }
        />
        <TooltipContent>
          <div className="max-w-64 text-xs">
            {t('chatScope.unknown')}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  if (!value) return <span className="w-3 shrink-0" />;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Users className="size-3 shrink-0 cursor-help text-primary/70" />}
      />
      <TooltipContent>{t('misc2.teamOnly')}</TooltipContent>
    </Tooltip>
  );
}
