import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Headphones, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import type { RoundReplay, Settings } from '@cs2/contract';
import { Button } from '@/components/ui/button';
import { transport } from '@/lib/transport';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  computeMix,
  DEFAULT_CHANNEL,
  emptyMix,
  isAudible,
  MAX_PLAYER_VOLUME,
  type ChannelState,
  type MixState,
  type TeamKey,
} from './voice-mix';

export function useMixState(settings: Settings | null) {
  const [state, setState] = useState<MixState>(emptyMix);
  const seeded = useRef(false);

  const saved = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!settings || seeded.current) return;
    seeded.current = true;
    saved.current = { ...settings.voicePlayerVolumes };
    setState((s) => {
      const players = { ...s.players };
      for (const [id, volume] of Object.entries(settings.voicePlayerVolumes)) {
        players[id] = { ...(players[id] ?? DEFAULT_CHANNEL), volume };
      }
      return { ...s, players };
    });
  }, [settings]);

  const setTeam = useCallback((team: TeamKey, patch: Partial<ChannelState>) => {
    setState((s) => ({ ...s, teams: { ...s.teams, [team]: { ...s.teams[team], ...patch } } }));
  }, []);

  const setPlayer = useCallback((steamId: string, patch: Partial<ChannelState>) => {
    setState((s) => ({
      ...s,
      players: { ...s.players, [steamId]: { ...(s.players[steamId] ?? DEFAULT_CHANNEL), ...patch } },
    }));
  }, []);

  const toggleSolo = useCallback((steamId: string) => {
    setState((s) => ({ ...s, solo: s.solo === steamId ? null : steamId }));
  }, []);

  const persistPlayerVolume = useCallback(
    (steamId: string, volume: number) => {
      saved.current = { ...saved.current, [steamId]: volume };
      void transport.call('settings.set', { voicePlayerVolumes: saved.current }).catch(() => undefined);
    },
    [],
  );

  return { state, setTeam, setPlayer, toggleSolo, persistPlayerVolume };
}

export type MixStateApi = ReturnType<typeof useMixState>;

export function useRoundMix(replay: RoundReplay, api: MixStateApi) {
  const { state } = api;
  const teamOf = useMemo(() => {
    const m = new Map<string, TeamKey | null>();
    for (const s of replay.slots) m.set(s.steamId, s.team);
    for (const v of replay.voice) if (!m.has(v.steamId)) m.set(v.steamId, null);
    return m;
  }, [replay]);

  const talkers = useMemo(
    () => replay.voice.map((v) => ({ steamId: v.steamId, team: teamOf.get(v.steamId) ?? null })),
    [replay, teamOf],
  );

  const gains = useMemo(() => computeMix(state, talkers), [state, talkers]);

  const audible = useCallback(
    (steamId: string) => isAudible(gains, steamId, teamOf.get(steamId) ?? null),
    [gains, teamOf],
  );

  return { ...api, gains, teamOf, talkers, audible };
}

export type VoiceMixer = ReturnType<typeof useRoundMix>;

function VolumeSlider({
  value,
  onChange,
  onCommit,
  label,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="range"
        min={0}
        max={MAX_PLAYER_VOLUME}
        step={0.05}
        value={value}
        disabled={disabled}
        aria-label={label}
        className="h-1 w-24 accent-primary disabled:opacity-40"
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      />
      <span className="w-9 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export function VoiceMixerPanel({
  replay,
  mixer,
  speaking,
  teamLabels,
}: {
  replay: RoundReplay;
  mixer: VoiceMixer;
  speaking: Set<string>;
  teamLabels: Record<TeamKey, string>;
}) {
  const { t } = useTranslation();
  const nameOf = new Map(replay.slots.map((s) => [s.steamId, cleanName(s.name)]));
  const sideOf = new Map(replay.slots.map((s) => [s.steamId, s.side]));

  if (mixer.talkers.length === 0) return null;

  const groups: { key: TeamKey | null; label: string }[] = [
    { key: 'A', label: teamLabels.A },
    { key: 'B', label: teamLabels.B },
  ];
  const others = mixer.talkers.filter((x) => x.team === null);

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{t('voice.mixer')}</span>
        {mixer.state.solo ? (
          <Button size="xs" variant="ghost" onClick={() => mixer.toggleSolo(mixer.state.solo!)}>
            {t('voice.clearSolo')}
          </Button>
        ) : null}
      </div>

      {groups.map(({ key, label }) => {
        const members = mixer.talkers.filter((x) => x.team === key);
        if (!key || members.length === 0) return null;
        const team = mixer.state.teams[key];
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Button
                size="icon-xs"
                variant="ghost"
                title={team.muted ? t('voice.unmuteTeam') : t('voice.muteTeam')}
                onClick={() => mixer.setTeam(key, { muted: !team.muted })}
              >
                {team.muted ? <VolumeX className="text-destructive" /> : <Volume2 />}
              </Button>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
              <VolumeSlider
                value={team.volume}
                label={t('voice.teamVolume', { team: label })}
                disabled={team.muted}
                onChange={(v) => mixer.setTeam(key, { volume: v })}
              />
            </div>
            {members.map((m) => (
              <PlayerRow
                key={m.steamId}
                steamId={m.steamId}
                name={nameOf.get(m.steamId) ?? m.steamId}
                side={sideOf.get(m.steamId) ?? null}
                mixer={mixer}
                speaking={speaking.has(m.steamId)}
              />
            ))}
          </div>
        );
      })}

      {others.map((m) => (
        <PlayerRow key={m.steamId} steamId={m.steamId} name={m.steamId} side={null} mixer={mixer} speaking={speaking.has(m.steamId)} />
      ))}
    </div>
  );
}

function PlayerRow({
  steamId,
  name,
  side,
  mixer,
  speaking,
}: {
  steamId: string;
  name: string;
  side: 'CT' | 'T' | null;
  mixer: VoiceMixer;
  speaking: boolean;
}) {
  const { t } = useTranslation();
  const ch = mixer.state.players[steamId] ?? DEFAULT_CHANNEL;
  const solo = mixer.state.solo === steamId;
  const audible = mixer.audible(steamId);

  return (
    <div className={cn('flex items-center gap-2 pl-6', !audible && 'opacity-50')}>
      <Button
        size="icon-xs"
        variant="ghost"
        title={ch.muted ? t('voice.unmutePlayer') : t('voice.mutePlayer')}
        onClick={() => mixer.setPlayer(steamId, { muted: !ch.muted })}
      >
        {ch.muted ? (
          <MicOff className="text-muted-foreground" />
        ) : (
          <Mic className={cn(speaking && audible && 'animate-pulse text-emerald-400')} />
        )}
      </Button>
      <Button
        size="icon-xs"
        variant={solo ? 'default' : 'ghost'}
        title={solo ? t('voice.clearSolo') : t('voice.solo')}
        onClick={() => mixer.toggleSolo(steamId)}
      >
        <Headphones />
      </Button>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[11px]',
          side === 'CT' ? 'text-sky-300' : side === 'T' ? 'text-amber-300' : 'text-muted-foreground',
        )}
      >
        {name}
      </span>
      <VolumeSlider
        value={ch.volume}
        label={t('voice.playerVolume', { name })}
        onChange={(v) => mixer.setPlayer(steamId, { volume: v })}
        onCommit={(v) => mixer.persistPlayerVolume(steamId, v)}
      />
    </div>
  );
}
