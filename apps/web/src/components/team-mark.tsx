import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';

const TEAM_COLORS = ['#a855f7', '#14b8a6'] as const;

export function teamIndex(
  teamName: string | null | undefined,
  teams: { a: string | null; b: string | null },
): 0 | 1 | null {
  if (!teamName) return null;
  if (teams.a && teamName === teams.a) return 0;
  if (teams.b && teamName === teams.b) return 1;
  return null;
}

export function TeamMark({
  teamName,
  teams,
  className,
}: {
  teamName: string | null | undefined;
  teams: { a: string | null; b: string | null };
  className?: string;
}) {
  const index = teamIndex(teamName, teams);
  if (index === null) {

    return <span className={cn('inline-block size-2 shrink-0 rounded-[2px] bg-muted', className)} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn('inline-block size-2 shrink-0 rounded-[2px]', className)}
            style={{ background: TEAM_COLORS[index] }}
          />
        }
      />
      <TooltipContent>{cleanName(teamName!)}</TooltipContent>
    </Tooltip>
  );
}

export function PlayerCell({
  name,
  teamName,
  teams,
  steamId,
}: {
  name: string;
  teamName: string | null | undefined;
  teams: { a: string | null; b: string | null };
  steamId?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <TeamMark teamName={teamName} teams={teams} />
      <span className="min-w-0 truncate" title={steamId ? `${name}\nSteamID64: ${steamId}` : name}>
        {cleanName(name)}
      </span>
    </span>
  );
}
