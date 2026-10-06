import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkCheck, BookmarkPlus, Crosshair, RefreshCw } from 'lucide-react';
import type { RoundThrow } from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { throwWords } from '@/lib/throw-words';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cleanName } from '@/lib/format';
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

const TYPE_COLORS: Record<string, string> = {
  smoke: '#94a3b8',
  flashbang: '#facc15',
  molotov: '#f97316',
  he: '#ef4444',
  decoy: '#a78bfa',
  unknown: '#64748b',
};

export function UtilityPanel({
  matchId,
  roundNum,
  onSeek,
}: {
  matchId: string;
  roundNum: number;

  onSeek: (tick: number) => void;
}) {
  const { t } = useTranslation();
  const { data, loading, reload } = useRoute(
    'utility.roundThrows',
    { matchId, roundNum },
    [matchId, roundNum],
  );
  const [naming, setNaming] = useState<number | null>(null);
  const [name, setName] = useState('');

  if (loading || !data) return null;

  if (!data.extracted) {
    return (
      <Alert className="text-xs">
        <RefreshCw />
        <AlertTitle>{t('misc.utilityNotExtracted')}</AlertTitle>
        <AlertDescription>
          {t('ui.utilityNotExtractedHint')}
        </AlertDescription>
      </Alert>
    );
  }

  if (data.throws.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">{t('misc.noUtilityThisRound')}</p>
    );
  }

  const save = async (item: RoundThrow) => {
    const fallback = `${TYPE_LABELS[item.grenadeType] ?? 'Granada'} — round ${item.roundNum}`;
    await transport.call('collection.save', {
      matchId: item.matchId,
      throwId: item.throwId,
      name: name.trim() || fallback,
      note: null,
    });
    setNaming(null);
    setName('');
    reload();
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{t('misc.roundUtility')}</span>
        <span className="text-[10px] text-muted-foreground">
          {t('panel.saveHint')}
        </span>
      </div>

      <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
        {data.throws.map((item) => (
          <div
            key={item.throwId}
            className={cn(
              'flex items-center gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-muted/60',
              item.savedAs && 'bg-primary/5',
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: TYPE_COLORS[item.grenadeType] ?? TYPE_COLORS.unknown }}
            />
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left"
              title={t('misc.seeThrowInReplay')}
              onClick={() => item.throwTick !== null && onSeek(item.throwTick)}
            >
              <span className="font-medium">{TYPE_LABELS[item.grenadeType]}</span>{' '}
              <span className={item.side === 'CT' ? 'text-sky-300' : 'text-amber-300'}>
                {cleanName(item.playerName ?? item.steamId ?? '—')}
              </span>
              {item.secondsIntoRound !== null ? (
                <span className="text-muted-foreground"> · {item.secondsIntoRound}s</span>
              ) : null}
              {item.enemiesBlinded > 0 ? (
                <span className="text-muted-foreground">
                  {t('frag2.blindedCount', { n: item.enemiesBlinded })}
                </span>
              ) : null}
              {item.enemyDamage > 0 ? (
                <span className="text-muted-foreground">
                  {t('frag2.damageCount', { n: item.enemyDamage })}
                </span>
              ) : null}

              <Badge variant="outline" className="ml-1 text-[9px] font-normal">
                {throwWords(item).short}
              </Badge>
            </button>

            {item.savedAs ? (
              <span
                className="flex items-center gap-1 text-[10px] text-primary"
                title={t('panel.savedAs', { name: item.savedAs })}
              >
                <BookmarkCheck className="size-3" />
                {t('ui.saved')}
              </span>
            ) : naming === item.throwId ? (
              <span className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`${TYPE_LABELS[item.grenadeType]} — round ${item.roundNum}`}
                  className="h-6 w-44 text-[11px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void save(item);
                    if (e.key === 'Escape') setNaming(null);
                  }}
                />
                <Button size="xs" onClick={() => void save(item)}>
                  {t('ui.save')}
                </Button>
              </span>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                title={t('misc.saveToCollection')}
                onClick={() => {
                  setNaming(item.throwId);
                  setName('');
                  if (item.throwTick !== null) onSeek(item.throwTick);
                }}
              >
                <BookmarkPlus />
              </Button>
            )}
          </div>
        ))}
      </div>

      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Crosshair className="size-3" />
        {t('ui.clickRowThrow')}
      </p>
    </div>
  );
}
