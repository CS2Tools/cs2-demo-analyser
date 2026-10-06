import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  Crosshair,
  Flame,
  Library,
  Settings as SettingsIcon,
  Swords,
  User,
  WifiOff,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LibraryView } from '@/routes/library';
import { SettingsView } from '@/routes/settings';
import { ExplorerView } from '@/routes/explorer';
import { UtilityView } from '@/routes/utility';
import { MatchView } from '@/routes/match';
import { PlayerView } from '@/routes/player';
import { TeamView } from '@/routes/team';
import { IngestBar } from '@/components/ingest-bar';
import { LocaleToggle } from '@/components/locale-toggle';

type ViewId = 'library' | 'match' | 'player' | 'team' | 'utility' | 'explore' | 'settings';

interface NavEntry {
  id: ViewId;
  labelKey: string;
  icon: typeof Library;

  phase?: string;
}

const PRIMARY: NavEntry[] = [
  { id: 'library', labelKey: 'nav.library', icon: Library },
  { id: 'match', labelKey: 'nav.match', icon: Swords },
  { id: 'utility', labelKey: 'nav.utility', icon: Flame },
  { id: 'explore', labelKey: 'nav.explore', icon: Compass },
  { id: 'player', labelKey: 'nav.player', icon: User },
  { id: 'team', labelKey: 'nav.team', icon: Crosshair },
];

const SECONDARY: NavEntry[] = [
  { id: 'settings', labelKey: 'nav.settings', icon: SettingsIcon },
];

export function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewId>('library');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [seek, setSeek] = useState<{ roundNum: number; nonce: number } | null>(null);

  const openMatch = useCallback((id: string) => {
    setMatchId(id);
    setView('match');
  }, []);

  const onIngestFinished = useCallback((id: string | null) => {
    setRefreshKey((k) => k + 1);
    if (id) setMatchId((cur) => cur ?? id);
  }, []);

  const renderNav = (entries: NavEntry[]) => (
    <SidebarMenu>
      {entries.map(({ id, labelKey, icon: Icon, phase }) => (
        <SidebarMenuItem key={id}>
          <SidebarMenuButton isActive={view === id} onClick={() => setView(id)}>
            <Icon />
            <span>{t(labelKey)}</span>
            {phase ? (
              <Badge variant="outline" className="ml-auto text-[10px]">
                {phase}
              </Badge>
            ) : null}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Crosshair className="size-5 shrink-0 text-primary" />
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">{t('common.appName')}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t('common.offline')}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>{renderNav(PRIMARY)}</SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>

            <SidebarGroupContent>{renderNav(SECONDARY)}</SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground" />
              }
            >
              <WifiOff className="size-3.5 shrink-0" />
              <span className="truncate group-data-[collapsible=icon]:hidden">
                {t('common.offline')}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('ui.offlineNote')}
            </TooltipContent>
          </Tooltip>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">
            {t(PRIMARY.concat(SECONDARY).find((e) => e.id === view)?.labelKey ?? 'nav.library')}
          </h1>
          <div className="ml-auto">
            <LocaleToggle />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {view === 'library' ? (
            <LibraryView onOpenMatch={openMatch} refreshKey={refreshKey} />
          ) : null}
          {view === 'utility' ? (
            <UtilityView
              onOpenReplay={(id, roundNum) => {
                setSeek((prev) => ({ roundNum, nonce: (prev?.nonce ?? 0) + 1 }));
                setMatchId(id);
                setView('match');
              }}
            />
          ) : null}
          {view === 'settings' ? <SettingsView /> : null}
          {view === 'explore' ? (
            <ExplorerView
              onOpenReplay={(id, roundNum) => {
                setSeek((prev) => ({ roundNum, nonce: (prev?.nonce ?? 0) + 1 }));
                setMatchId(id);
                setView('match');
              }}
            />
          ) : null}
          {view === 'match' ? (
            matchId ? (
              <MatchView
              matchId={matchId}
              onBack={() => setView('library')}
              onOpenMatch={openMatch}
              initialSeek={seek}
            />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('ui.pickMatch')}
              </div>
            )
          ) : null}
          {view === 'player' ? <PlayerView onOpenMatch={openMatch} /> : null}
          {view === 'team' ? <TeamView onOpenMatch={openMatch} /> : null}
        </div>

        <IngestBar onFinished={onIngestFinished} />
      </SidebarInset>
    </SidebarProvider>
  );
}
