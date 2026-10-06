import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, RefreshCw } from 'lucide-react';
import { REPLAY_SLOTS_SINCE_DATA_VERSION, type RoundReplay } from '@cs2/contract';
import { Button } from '@/components/ui/button';
import { CsIcon } from '@/components/cs-icon';
import {
  EQUIPMENT_ICONS,
  inventoryCategory,
  KILLFEED_ICONS,
  weaponIcon,
} from '@/lib/icons';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  formatClock,
  indexInventory,
  indexSteps,
  inventoryAt,
  roundClock,
  valueAt,
} from './hud-state';

const CT = 'text-sky-300';
const T = 'text-amber-300';

export function useHudIndex(replay: RoundReplay) {
  return useMemo(() => {
    const h = replay.hud;
    return {
      money: indexSteps(h.money),
      armor: indexSteps(h.armor),
      helmet: indexSteps(h.helmet),
      defuser: indexSteps(h.defuser),
      defusing: indexSteps(h.defusing),
      inventory: indexInventory(h.inventory),
      sideOf: new Map(replay.slots.map((s) => [s.slot, s.side])),
      nameOf: new Map(replay.slots.map((s) => [s.slot, cleanName(s.name)])),
    };
  }, [replay]);
}

export type HudIndex = ReturnType<typeof useHudIndex>;

function Scoreboard({ replay }: { replay: RoundReplay }) {
  const sideOf = (team: 'A' | 'B') =>
    replay.slots.find((slot) => slot.team === team)?.side ?? null;

  const cell = (team: 'A' | 'B', name: string | null, value: number) => {
    const side = sideOf(team);
    return (
      <span
        className={cn(
          'flex min-w-0 items-baseline gap-1.5',
          side === 'CT' ? 'text-sky-300' : side === 'T' ? 'text-amber-300' : 'text-muted-foreground',
          team === 'B' && 'flex-row-reverse',
        )}
        title={name ?? undefined}
      >
        <span className="max-w-20 truncate text-[10px]">{cleanName(name ?? team)}</span>
        <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
      </span>
    );
  };

  return (
    <div className="flex w-full items-baseline justify-between gap-2">
      {cell('A', replay.score.teamAName, replay.score.a)}
      <span className="text-[10px] text-muted-foreground">:</span>
      {cell('B', replay.score.teamBName, replay.score.b)}
    </div>
  );
}

export function RoundTimer({ replay, frame, index }: { replay: RoundReplay; frame: number; index: HudIndex }) {
  const { t } = useTranslation();
  const tick = replay.startTick + frame * replay.stride;
  const clock = roundClock(replay.hud, tick, replay.tickRate, (slot) => valueAt(index.defusing, slot, frame) === 1);
  const pct = clock.total && clock.remaining !== null ? clock.remaining / clock.total : null;

  const label =
    clock.phase === 'freeze'
      ? t('hud.freeze')
      : clock.phase === 'planted'
        ? t('hud.planted', { site: replay.hud.plant?.site ?? replay.hud.plant?.place ?? '?' })
        : clock.phase === 'defused'
          ? t('hud.defused')
          : clock.phase === 'exploded'
            ? t('hud.exploded')
            : clock.phase === 'over'
              ? t('hud.roundOver')
              : null;

  const planted = clock.phase === 'planted';
  const defuser = clock.defuse?.slot != null ? index.nameOf.get(clock.defuse.slot) : null;

  return (
    <div className="pointer-events-none flex min-w-36 flex-col items-center gap-1 rounded-md bg-black/70 px-3 py-1.5 backdrop-blur-sm">
      <Scoreboard replay={replay} />
      <div className="flex items-center gap-2">
        {planted ? <CsIcon rel={EQUIPMENT_ICONS.plantedC4} className="h-4" /> : null}
        <span
          className={cn(
            'font-mono text-lg font-semibold tabular-nums',
            planted && 'text-red-400',
            clock.phase === 'freeze' && 'text-muted-foreground',
          )}
        >
          {clock.phase === 'defused' || clock.phase === 'exploded'
            ? '0:00'
            : clock.phase === 'over'
              ? '—'
              : formatClock(clock.remaining)}
        </span>
      </div>
      {label ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      {pct !== null ? (
        <div className="h-1 w-full overflow-hidden rounded bg-white/10">
          <div
            className={cn('h-full', planted ? 'bg-red-500' : clock.phase === 'freeze' ? 'bg-white/30' : 'bg-white/60')}
            style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }}
          />
        </div>
      ) : null}
      {clock.defuse ? (
        <div className="flex w-full flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2 text-[10px] text-sky-300">
            <span className="flex items-center gap-1">
              {clock.defuse.hasKit ? <CsIcon rel={EQUIPMENT_ICONS.defuser} className="h-3" /> : null}
              {t(clock.defuse.hasKit ? 'hud.defusingKit' : 'hud.defusingNoKit', { name: defuser ?? '?' })}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded bg-white/10">
            <div className="h-full bg-sky-400" style={{ width: `${clock.defuse.progress * 100}%` }} />
          </div>
        </div>
      ) : null}
      {planted && replay.hud.c4TimerSource === 'reference' ? (
        <span className="text-[9px] text-muted-foreground" title={t('hud.c4ReferenceHint')}>
          {t('hud.c4Reference')}
        </span>
      ) : null}
    </div>
  );
}

const KILLFEED_SECONDS = 5;

export function Killfeed({
  replay,
  frame,
  index,
  onSeek,
}: {
  replay: RoundReplay;
  frame: number;
  index: HudIndex;
  onSeek: (frame: number) => void;
}) {
  const { t } = useTranslation();
  const tick = replay.startTick + frame * replay.stride;
  const window = KILLFEED_SECONDS * replay.tickRate;
  const kills = replay.events.filter((e) => e.kind === 'kill' && e.tick <= tick && tick - e.tick <= window);
  if (kills.length === 0) return null;

  const who = (slot: number | null) => {
    if (slot === null) return <span className="text-muted-foreground">{t('hud.world')}</span>;
    const side = index.sideOf.get(slot);
    return <span className={cn('max-w-28 truncate', side === 'CT' ? CT : T)}>{index.nameOf.get(slot)}</span>;
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {kills.map((k) => {
        const age = (tick - k.tick) / window;
        return (
          <button
            key={`${k.tick}-${k.targetSlot}`}
            type="button"
            onClick={() => onSeek((k.tick - replay.startTick) / replay.stride)}
            title={t('hud.killfeedSeek')}
            className="pointer-events-auto flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-[11px] backdrop-blur-sm transition-opacity hover:bg-black/90"
            style={{ opacity: 1 - age * 0.5 }}
          >
            {k.attackerBlind ? <CsIcon rel={KILLFEED_ICONS.attackerBlind} title={t('hud.blind')} /> : null}
            {who(k.actorSlot)}
            {k.assisterSlot !== null ? (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                +{k.flashAssist ? <CsIcon rel={EQUIPMENT_ICONS.flashAssist} title={t('hud.flashAssist')} /> : null}
                <span className="max-w-20 truncate">{index.nameOf.get(k.assisterSlot)}</span>
              </span>
            ) : null}
            <CsIcon rel={weaponIcon(k.weapon)} fallback={k.weapon ?? ''} title={k.weapon ?? ''} className="h-3.5" />
            {k.noscope ? <CsIcon rel={KILLFEED_ICONS.noscope} title={t('hud.noscope')} /> : null}
            {k.thruSmoke ? <CsIcon rel={KILLFEED_ICONS.thruSmoke} title={t('hud.thruSmoke')} /> : null}
            {k.penetrated ? <CsIcon rel={KILLFEED_ICONS.penetrated} title={t('hud.wallbang')} /> : null}
            {k.headshot ? <CsIcon rel={KILLFEED_ICONS.headshot} title={t('hud.headshot')} /> : null}
            {who(k.targetSlot)}
          </button>
        );
      })}
    </div>
  );
}

const CATEGORY_ORDER = { primary: 0, secondary: 1, grenade: 2, c4: 3, other: 4, knife: 5 } as const;

const TEAM_COLOR_HEX: Record<string, string> = {
  yellow: '#e5d33a',
  purple: '#b84bd4',
  green: '#41c74a',
  blue: '#4b9eff',
  orange: '#f0862e',
};

export function PlayerPanel({
  replay,
  frame,
  index,
  hovered,
  onHover,
  speaking,
  muted,
  onToggleMute,
  onReprocess,
  numbers,
  poiColours,
}: {
  replay: RoundReplay;
  frame: number;
  index: HudIndex;
  hovered: number | null;
  onHover: (slot: number | null) => void;
  speaking: Set<string>;
  muted: Set<string>;
  onToggleMute?: (steamId: string) => void;
  onReprocess?: () => void;

  numbers?: Map<number, number> | null;

  poiColours?: Map<number, string> | null;
}) {
  const { t, i18n } = useTranslation();
  const i = Math.max(0, Math.min(replay.frames - 1, Math.floor(frame)));
  const talkers = new Set(replay.voice.map((v) => v.steamId));
  const hasHud = replay.hud.dataVersion >= 2;

  const hasColors = replay.slots.some((s) => s.teamColor !== null);
  const money = new Intl.NumberFormat(i18n.language);

  const slotsOk = replay.hud.dataVersion >= REPLAY_SLOTS_SINCE_DATA_VERSION;

  const byTeam = {
    A: replay.slots.filter((s) => s.team === 'A'),
    B: replay.slots.filter((s) => s.team === 'B'),
  };

  const semTime = replay.slots.filter((s) => s.team === null);

  const row = (s: RoundReplay['slots'][number]) => {
    const idx = i * replay.slotsPerFrame + s.slot;
    const hp = replay.health[idx] ?? 0;
    const alive = replay.lifeState[idx] === 0;
    const flashed = (replay.flash[idx] ?? 0) > 0.5;
    const weaponI = replay.hud.weaponIdx[idx] ?? -1;
    const active = weaponI >= 0 ? replay.hud.weaponNames[weaponI]! : null;
    const armor = valueAt(index.armor, s.slot, i) ?? 0;
    const helmet = valueAt(index.helmet, s.slot, i) === 1;
    const kit = valueAt(index.defuser, s.slot, i) === 1;
    const cash = valueAt(index.money, s.slot, i);
    const items = (inventoryAt(index.inventory, s.slot, i) ?? [])
      .filter((n) => inventoryCategory(n) !== 'knife')
      .sort((a, b) => CATEGORY_ORDER[inventoryCategory(a)] - CATEGORY_ORDER[inventoryCategory(b)]);
    const side = s.side === 'CT' ? CT : T;

    const poiColour = poiColours?.get(s.slot) ?? null;

    return (
      <div
        key={s.slot}
        onMouseEnter={() => onHover(s.slot)}
        onMouseLeave={() => onHover(null)}
        className={cn(
          'flex flex-col gap-1 rounded px-2 py-1.5 text-xs transition-colors',
          hovered === s.slot && 'bg-accent',
          !alive && 'opacity-40',
        )}
      >
        <div className="flex items-center gap-2">
          {numbers?.has(s.slot) ? (
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-background',
                s.side === 'CT' ? 'bg-sky-400' : 'bg-amber-400',
              )}
              title={t('misc2.radarNumber')}
            >
              {numbers.get(s.slot)}
            </span>
          ) : (
            <span className={cn('size-2 shrink-0 rounded-full', s.side === 'CT' ? 'bg-sky-400' : 'bg-amber-400')} />
          )}
          <span
            className={cn('min-w-0 flex-1 truncate font-medium', alive && !poiColour && side)}
            style={poiColour ? { color: poiColour } : undefined}
            title={poiColour ? 'Jogador de interesse' : undefined}
          >
            {cleanName(s.name)}
          </span>

          {s.teamColor && TEAM_COLOR_HEX[s.teamColor] ? (
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: TEAM_COLOR_HEX[s.teamColor] }}
              title={`Cor deste jogador no HUD do time: ${s.teamColor}`}
            />
          ) : null}
          {talkers.has(s.steamId) && onToggleMute ? (
            <button
              type="button"
              onClick={() => onToggleMute(s.steamId)}
              title={muted.has(s.steamId) ? t('voice.unmutePlayer') : t('voice.mutePlayer')}
              className={cn(
                'shrink-0 rounded p-0.5 transition-colors',
                muted.has(s.steamId)
                  ? 'text-muted-foreground/50'
                  : speaking.has(s.steamId)
                    ? 'text-emerald-400'
                    : 'text-muted-foreground',
              )}
            >
              {muted.has(s.steamId) ? (
                <MicOff className="size-3" />
              ) : (
                <Mic className={cn('size-3', speaking.has(s.steamId) && 'animate-pulse')} />
              )}
            </button>
          ) : null}
          {flashed ? <span className="text-[10px] text-white/70">{t('hud.blindShort')}</span> : null}
          {hasHud && cash !== null ? (
            <span className="font-mono tabular-nums text-emerald-400">${money.format(cash)}</span>
          ) : null}
        </div>

        {alive ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded bg-white/10" title={`${hp} HP`}>
              <div
                className={cn('h-full', hp <= 30 ? 'bg-red-500' : 'bg-white/70')}
                style={{ width: `${Math.max(0, Math.min(100, hp))}%` }}
              />
            </div>
            <span className="w-6 font-mono text-[10px] tabular-nums text-muted-foreground">{hp}</span>
            {armor > 0 ? (
              <CsIcon
                rel={helmet ? EQUIPMENT_ICONS.armorHelmet : EQUIPMENT_ICONS.armor}
                title={t(helmet ? 'hud.armorHelmet' : 'hud.armor', { n: armor })}
                className="h-3 opacity-80"
              />
            ) : null}
            {kit ? <CsIcon rel={EQUIPMENT_ICONS.defuser} title={t('hud.kit')} className="h-3" /> : null}
            <div className="ml-auto flex min-w-0 items-center gap-1.5">
              {hasHud
                ? items.map((it, n) => (
                    <CsIcon
                      key={`${it}-${n}`}
                      rel={weaponIcon(it)}
                      fallback={it}
                      title={it}
                      className={cn(
                        'h-3',
                        it === active ? 'opacity-100 drop-shadow-[0_0_2px_rgba(255,255,255,0.6)]' : 'opacity-45',
                        inventoryCategory(it) === 'c4' && 'opacity-100',
                      )}
                    />
                  ))
                : <CsIcon rel={weaponIcon(active)} fallback={active ?? ''} title={active ?? ''} className="h-3" />}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {!hasHud ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
          {t('reprocess.needed')}
          {onReprocess ? (
            <Button size="xs" variant="outline" onClick={onReprocess} className="self-start">
              <RefreshCw data-icon="inline-start" />
              {t('reprocess.button')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {hasHud && !hasColors ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
          {t('frag.colorNeedsReprocess')}
          {onReprocess ? (
            <Button size="xs" variant="outline" onClick={onReprocess} className="self-start">
              <RefreshCw data-icon="inline-start" />
              {t('reprocess.button')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {hasHud && !slotsOk ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
          {t('frag.slotsNeedReprocess')}
          {onReprocess ? (
            <Button size="xs" variant="outline" onClick={onReprocess} className="self-start">
              <RefreshCw data-icon="inline-start" />
              {t('reprocess.button')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {(['A', 'B'] as const).map((team) => (
        <div key={team} className="flex flex-col gap-0.5">{byTeam[team].map(row)}</div>
      ))}
      {semTime.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] text-muted-foreground">{t('frag.playersWithoutTeam')}</p>
          {semTime.map(row)}
        </div>
      ) : null}
    </div>
  );
}
