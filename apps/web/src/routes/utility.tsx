import { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Check, ChevronLeft, Copy, Pencil, Play, Trash2 } from 'lucide-react';
import type { SavedLineup } from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CsIcon } from '@/components/cs-icon';
import { ExportButton } from '@/components/export-button';
import { LineupMap, LINEUP_COLORS } from '@/components/lineups/lineup-map';
import { mapIcon } from '@/lib/icons';
import { throwWords } from '@/lib/throw-words';
import { transport } from '@/lib/transport';
import { useRoute } from '@/lib/use-route';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  smoke: 'Smoke',
  flashbang: 'Flash',
  molotov: 'Molotov',
  he: 'HE',
  decoy: 'Decoy',
  unknown: 'Granada',
};

export function UtilityView({
  onOpenReplay,
}: {
  onOpenReplay?: (matchId: string, roundNum: number) => void;
}) {
  const { t } = useTranslation();
  const { data: maps, loading, reload: reloadMaps } = useRoute('utility.maps', {});
  const [mapName, setMapName] = useState<string | null>(null);

  if (loading) return <Skeleton className="h-96 w-full" />;

  if (mapName) {
    return (
      <MapCollection
        mapName={mapName}
        onBack={() => {
          setMapName(null);
          reloadMaps();
        }}
        onOpenReplay={onOpenReplay}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <Trans
          i18nKey="collection.hint"
          values={{ list: t('misc.roundUtility') }}
          components={{ b: <strong /> }}
        />
      </p>

      {(maps ?? []).length === 0 ? (
        <Alert>
          <AlertTitle>{t('misc.emptyCollection')}</AlertTitle>
          <AlertDescription>
            {t('collection.empty')}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(maps ?? []).map((m) => (
            <Card
              key={m.mapName}
              className="cursor-pointer transition-colors hover:border-primary/60"
              onClick={() => setMapName(m.mapName)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <CsIcon rel={mapIcon(m.mapName)} fallback={m.mapName} className="size-10" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm">{m.mapName}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('frag2.savedCount', { count: m.saved })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MapCollection({
  mapName,
  onBack,
  onOpenReplay,
}: {
  mapName: string;
  onBack: () => void;
  onOpenReplay?: (matchId: string, roundNum: number) => void;
}) {
  const { t } = useTranslation();
  const { data, loading, reload } = useRoute('collection.list', { mapName }, [mapName]);
  const [selected, setSelected] = useState<string | null>(null);

  const saved = data ?? [];
  const current = saved.find((l) => l.lineupId === selected) ?? null;

  const points = saved.map((l) => ({
    lineupId: l.lineupId,
    grenadeType: l.grenadeType,
    throwPx: l.throwPx,
    throwPy: l.throwPy,
    detPx: l.detPx,
    detPy: l.detPy,
  }));

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft data-icon="inline-start" />
          {t('ui.maps')}
        </Button>
        <CsIcon rel={mapIcon(mapName)} fallback={mapName} className="size-6" />
        <span className="font-mono text-sm">{mapName}</span>
        <span className="text-xs text-muted-foreground">
          {t('frag2.savedShort', { count: saved.length })}
        </span>
        <div className="ml-auto">
          <ExportButton
            spec={{
              title: `Utilitarias - ${mapName}`,
              table: () => ({
                columns: ['nome', 'tipo', 'lado', 'comando', 'nota'],
                rows: saved.map((l) => [l.name, l.grenadeType, l.side, l.command, l.note]),
              }),
              json: () => saved,
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <LineupMap
          mapName={mapName}
          lineups={points}
          selectedId={selected}
          onSelect={setSelected}
        />

        <div className="flex min-h-0 flex-col gap-2">
          {current ? (
            <SavedDetail
              lineup={current}
              onChanged={reload}
              onOpenReplay={onOpenReplay}
              onClose={() => setSelected(null)}
            />
          ) : (
            <Card>
              <CardContent className="p-3 text-xs text-muted-foreground">
                {t('frag5.pickOnMap')}
              </CardContent>
            </Card>
          )}

          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {saved.map((l) => (
              <button
                key={l.lineupId}
                type="button"
                onClick={() => setSelected(l.lineupId)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs',
                  l.lineupId === selected ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: LINEUP_COLORS[l.grenadeType] }}
                />
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {TYPE_LABELS[l.grenadeType]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SavedDetail({
  lineup,
  onChanged,
  onOpenReplay,
  onClose,
}: {
  lineup: SavedLineup;
  onChanged: () => void;
  onOpenReplay?: (matchId: string, roundNum: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lineup.name);
  const [note, setNote] = useState(lineup.note ?? '');
  const [confirming, setConfirming] = useState(false);

  const { movement, click, crouched } = throwWords(lineup);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ background: LINEUP_COLORS[lineup.grenadeType] }}
          />
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{lineup.name}</span>
          )}
          <Button
            size="icon-xs"
            variant="ghost"
            title={t('misc.rename')}
            onClick={async () => {
              if (editing) {
                await transport.call('collection.rename', {
                  lineupId: lineup.lineupId,
                  name: name.trim() || lineup.name,
                  note: note.trim() || null,
                });
                onChanged();
              }
              setEditing(!editing);
            }}
          >
            {editing ? <Check /> : <Pencil />}
          </Button>
        </div>

        {editing ? (
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('misc.notePlaceholder')}
            className="h-7 text-xs"
          />
        ) : lineup.note ? (
          <p className="text-xs text-muted-foreground">{lineup.note}</p>
        ) : null}

        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <Badge variant="outline">{TYPE_LABELS[lineup.grenadeType]}</Badge>
          {lineup.side ? <Badge variant="outline">{lineup.side}</Badge> : null}
          <Badge variant="outline">{movement}</Badge>
          {crouched ? <Badge variant="outline">{t('misc.crouched')}</Badge> : null}
          <Badge variant="outline">{click}</Badge>
        </div>

        <CommandBox command={lineup.command} />

        <div className="flex items-center gap-2">
          {lineup.canOpenReplay && lineup.sourceMatchId && lineup.sourceRound !== null && onOpenReplay ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenReplay(lineup.sourceMatchId!, lineup.sourceRound!)}
            >
              <Play data-icon="inline-start" />
              {t('ui.seeInReplay')}
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {t('ui.noReplaySaved')}
            </span>
          )}

          {confirming ? (
            <span className="ml-auto flex items-center gap-1 text-[11px]">
              {t('ui.deleteQ')}
              <Button
                size="xs"
                variant="destructive"
                onClick={async () => {
                  await transport.call('collection.remove', { lineupId: lineup.lineupId });
                  setConfirming(false);
                  onClose();
                  onChanged();
                }}
              >
                {t('ui.yes')}
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
                {t('ui.no')}
              </Button>
            </span>
          ) : (
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto"
              title={t('misc.deleteFromCollection')}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="text-destructive" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CommandBox({ command }: { command: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [command]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[10px]">
          {command}
        </code>
        <Button size="xs" variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {t('ui.pasteOnServer')} <span className="font-mono">sv_cheats 1</span>
        {t('ui.pasteOnServerEnd')}
      </p>
    </div>
  );
}
