import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Info,
  Mic,
  MicOff,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { MatchDetail, RoundReplay } from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RadarCanvas } from './radar-canvas';
import { numbersBySlot, poiColourBySlot, type PlayerLabelMode } from './labels';
import { ExportButton } from '@/components/export-button';
import { useVoice } from './use-voice';
import { UtilityPanel } from './utility-panel';
import { useMixState, useRoundMix, VoiceMixerPanel, type MixStateApi } from './voice-mixer';
import type { TeamKey } from './voice-mix';
import { Killfeed, PlayerPanel, RoundTimer, useHudIndex } from './hud';
import { transport } from '@/lib/transport';
import { SPEEDS, useReplayClock } from './use-replay-clock';
import { useRoute } from '@/lib/use-route';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';

const REPLAY_HZ = 8;

export interface ReplaySeek {
  roundNum: number;
  tick: number;
  nonce: number;
}

const SEEK_LEAD_SECONDS = 2;

export function ReplayView({
  detail,
  seek,
  onReprocess,
}: {
  detail: MatchDetail;
  seek?: ReplaySeek | null;
  onReprocess?: () => void;
}) {
  const { t } = useTranslation();
  const [roundNum, setRoundNum] = useState(seek?.roundNum ?? detail.rounds[0]?.roundNum ?? 1);

  const { data: settings } = useRoute('settings.get', {});
  const mixApi = useMixState(settings ?? null);
  const [voiceOn, setVoiceOn] = useState<boolean | null>(null);
  const [voiceVolume, setVoiceVolume] = useState<number | null>(null);
  const voice: VoiceControls = {
    enabled: voiceOn ?? settings?.voiceEnabled ?? true,
    volume: voiceVolume ?? settings?.voiceVolume ?? 0.8,
    muteAbove: settings?.voiceMuteAboveSpeed ?? 2,
    setEnabled: (v) => {
      setVoiceOn(v);
      void transport.call('settings.set', { voiceEnabled: v }).catch(() => undefined);
    },
    setVolume: setVoiceVolume,
    commitVolume: (v) => void transport.call('settings.set', { voiceVolume: v }).catch(() => undefined),
    mix: mixApi,
    teamLabels: teamLabelsFor(detail, settings?.userSteamId ?? null, t),
  };

  const labelMode: PlayerLabelMode = settings?.replayPlayerLabels ?? 'number';

  useEffect(() => {
    if (seek) setRoundNum(seek.roundNum);
  }, [seek]);
  const { data: replay, loading, error } = useRoute(
    'replay.round',
    { matchId: detail.summary.matchId, roundNum },
    [detail.summary.matchId, roundNum],
  );

  if (!detail.summary.hasRadar) {
    return (
      <Alert>
        <Info />
        <AlertTitle>{t('misc.viewerUnavailable')}</AlertTitle>
        <AlertDescription>
          <Trans
            i18nKey="panel.noRadarReplay"
            values={{ map: detail.summary.mapName }}
            components={{ m: <span className="font-mono" /> }}
          />
        </AlertDescription>
      </Alert>
    );
  }

  if (detail.summary.bulkState === 'pruned') {
    return (
      <Alert>
        <Archive />
        <AlertTitle>{t('retention.prunedTitle')}</AlertTitle>
        <AlertDescription>{t('retention.prunedExplain')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <RoundPicker detail={detail} current={roundNum} onPick={setRoundNum} />

      {loading ? (
        <Skeleton className="aspect-square w-full max-w-3xl" />
      ) : error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('misc.replayUnavailable')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : replay ? (
        <ReplayPlayer
          key={`${replay.matchId}-${replay.roundNum}`}
          replay={replay}
          matchHasVoice={detail.summary.hasVoice}
          onReprocess={onReprocess}
          voiceControls={voice}
          labelMode={labelMode}
          pois={settings?.playersOfInterest ?? []}
          seek={seek && seek.roundNum === replay.roundNum ? seek : null}
        />
      ) : null}
    </div>
  );
}

function RoundPicker({
  detail,
  current,
  onPick,
}: {
  detail: MatchDetail;
  current: number;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {detail.rounds.map((r) => (
        <button
          key={r.roundNum}
          type="button"
          onClick={() => onPick(r.roundNum)}
          title={`Round ${r.roundNum} — ${r.winnerSide ?? '?'} venceu`}
          className={cn(
            'size-7 rounded text-xs font-mono tabular-nums transition-colors',
            current === r.roundNum
              ? 'bg-primary text-primary-foreground'
              : r.winnerSide === 'CT'
                ? 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/30'
                : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/30',
          )}
        >
          {r.roundNum}
        </button>
      ))}
    </div>
  );
}

function ReplayPlayer({
  replay,
  seek,
  matchHasVoice,
  onReprocess,
  voiceControls,
  labelMode,
  pois,
}: {
  replay: RoundReplay;
  seek: ReplaySeek | null;
  matchHasVoice: boolean;
  onReprocess?: () => void;
  voiceControls: VoiceControls;
  labelMode: PlayerLabelMode;

  pois: readonly { steamId: string; colour: string }[];
}) {
  const hudIndex = useHudIndex(replay);
  const poiColours = useMemo(() => poiColourBySlot(replay.slots, pois), [replay.slots, pois]);
  const clock = useReplayClock({ frames: replay.frames, hz: REPLAY_HZ });
  const { t } = useTranslation();

  const { enabled, volume } = voiceControls;
  const mixer = useRoundMix(replay, voiceControls.mix);

  const voice = useVoice({
    replay,
    frame: clock.frame,
    playing: clock.playing,
    speed: clock.speed,
    hz: REPLAY_HZ,
    enabled,
    volume,
    muteAbove: voiceControls.muteAbove,
    mix: mixer.gains,
    teamOf: mixer.teamOf,
  });

  const seekNonce = seek?.nonce;
  useEffect(() => {
    if (!seek) return;
    const frame = (seek.tick - replay.startTick) / replay.stride - SEEK_LEAD_SECONDS * REPLAY_HZ;
    clock.pause();
    clock.seek(Math.max(0, Math.min(replay.frames - 1, frame)));

  }, [seekNonce, replay]);
  const [hovered, setHovered] = useState<number | null>(null);
  const layers = useRef<HTMLCanvasElement[] | null>(null);

  const eventFrames = useMemo(
    () =>
      replay.events.map((e) => ({
        frame: (e.tick - replay.startTick) / replay.stride,
        kind: e.kind,
      })),
    [replay],
  );

  const jumpEvent = (direction: 1 | -1) => {
    const sorted = eventFrames.map((e) => e.frame).sort((a, b) => a - b);
    const next =
      direction === 1
        ? sorted.find((f) => f > clock.frame + 0.5)
        : [...sorted].reverse().find((f) => f < clock.frame - 0.5);
    if (next !== undefined) clock.seek(next);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      switch (ev.key) {
        case ' ':
          ev.preventDefault();
          clock.toggle();
          break;
        case ',':
          clock.step(-1);
          break;
        case '.':
          clock.step(1);
          break;
        case '[':
          jumpEvent(-1);
          break;
        case ']':
          jumpEvent(1);
          break;
        case 'm':
        case 'M':

          if (matchHasVoice) voiceControls.setEnabled(!enabled);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const seconds = (clock.frame / REPLAY_HZ).toFixed(1);
  const total = (replay.frames / REPLAY_HZ).toFixed(0);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex max-w-3xl flex-col gap-2">

        {replay.hud.dataVersion < 3 ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="min-w-0 flex-1">{t('hud.replayCutShort')}</span>
            {onReprocess ? (
              <Button size="xs" variant="outline" onClick={onReprocess}>
                {t('reprocess.button')}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="relative">
          <RadarCanvas
            replay={replay}
            frame={clock.frame}
            highlightSlot={hovered}
            onHoverSlot={setHovered}
            labelMode={labelMode}
            poiColours={poiColours}
            layersRef={layers}
          />

          <div className="pointer-events-none absolute left-2 top-2">
            <RoundTimer replay={replay} frame={clock.frame} index={hudIndex} />
          </div>
          <div className="pointer-events-none absolute right-2 top-2 max-w-[58%]">
            <Killfeed
              replay={replay}
              frame={clock.frame}
              index={hudIndex}
              onSeek={(f) => {
                clock.pause();
                clock.seek(f);
              }}
            />
          </div>
        </div>

        <Timeline
          replay={replay}
          frame={clock.frame}
          events={eventFrames}
          onSeek={clock.seek}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon-sm" variant="ghost" onClick={() => jumpEvent(-1)} title={t('misc.prevEvent')}>
            <SkipBack />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => clock.step(-1)} title={t('misc.prevFrame')}>
            <ChevronLeft />
          </Button>
          <Button size="icon-sm" onClick={clock.toggle} title={t('misc.playPause')}>
            {clock.playing ? <Pause /> : <Play />}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => clock.step(1)} title={t('misc.nextFrame')}>
            <ChevronRight />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => jumpEvent(1)} title={t('misc.nextEvent')}>
            <SkipForward />
          </Button>

          <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
            {seconds}s / {total}s
          </span>

          {matchHasVoice ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="icon-sm"
                variant="ghost"
                title={enabled ? t('voice.turnOff') : t('voice.turnOn')}
                onClick={() => voiceControls.setEnabled(!enabled)}
              >
                {enabled ? <Volume2 /> : <VolumeX />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                disabled={!enabled}
                aria-label={t('voice.volume')}
                className="h-1 w-20 accent-primary"
                onChange={(e) => voiceControls.setVolume(Number(e.target.value))}
                onPointerUp={(e) => voiceControls.commitVolume(Number((e.target as HTMLInputElement).value))}
              />
              <span className="text-[11px] text-muted-foreground">
                {!voice.hasVoice
                  ? t('voice.noneThisRound')
                  : voice.status === 'loading'
                    ? t('voice.loading')
                    : voice.status === 'error'
                      ? t('voice.error')
                      : voice.silencedBySpeed
                        ? t('voice.silencedBySpeed')
                        : null}
              </span>
            </div>
          ) : null}

          <ExportButton
            spec={{
              title: `Round ${replay.roundNum} - ${replay.mapName} - ${seconds}s`,
              meta: { matchId: replay.matchId },
              png: () =>
                layers.current
                  ? {
                      layers: layers.current,
                      subtitle: `Quadro em ${seconds}s de ${total}s`,
                      footer: [
                        'Fumaca e incendiaria: posicao e duracao reais; a AREA e aproximada (o demo nao contem o volume).',
                        'Radar: boltobserv (GPL-3.0). Gerado pelo CS2 Demo Analyser, 100% local.',
                      ],
                    }
                  : null,
            }}
          />

          <ToggleGroup
            multiple={false}
            value={[String(clock.speed)]}
            onValueChange={(v) => {
              const next = Number(v[0]);
              if (Number.isFinite(next) && next > 0) clock.setSpeed(next);
            }}
            size="sm"
            variant="outline"
            className="ml-auto"
          >
            {SPEEDS.map((s) => (
              <ToggleGroupItem key={s} value={String(s)} aria-label={`${s}x`}>
                {s}x
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <UtilityPanel
          matchId={replay.matchId}
          roundNum={replay.roundNum}
          onSeek={(tick) => {
            const frame = (tick - replay.startTick) / replay.stride - SEEK_LEAD_SECONDS * REPLAY_HZ;
            clock.pause();
            clock.seek(Math.max(0, Math.min(replay.frames - 1, frame)));
          }}
        />

        {matchHasVoice && enabled ? (
          <VoiceMixerPanel
            replay={replay}
            mixer={mixer}
            speaking={voice.speaking}
            teamLabels={voiceControls.teamLabels}
          />
        ) : null}
      </div>

      <PlayerPanel
        numbers={labelMode === 'number' ? numbersBySlot(replay.slots) : null}
        poiColours={poiColours}
        replay={replay}
        frame={clock.frame}
        index={hudIndex}
        hovered={hovered}
        onHover={setHovered}
        speaking={voice.speaking}
        muted={new Set(mixer.talkers.filter((x) => !mixer.audible(x.steamId)).map((x) => x.steamId))}
        onToggleMute={
          voice.hasVoice
            ? (id) => mixer.setPlayer(id, { muted: !(mixer.state.players[id]?.muted ?? false) })
            : undefined
        }
        onReprocess={onReprocess}
      />
    </div>
  );
}

function Timeline({
  replay,
  frame,
  events,
  onSeek,
}: {
  replay: RoundReplay;
  frame: number;
  events: { frame: number; kind: string }[];
  onSeek: (frame: number) => void;
}) {
  const pct = (f: number) => (f / Math.max(1, replay.frames - 1)) * 100;

  const seekFromEvent = (ev: React.MouseEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const ratio = (ev.clientX - rect.left) / rect.width;
    onSeek(ratio * (replay.frames - 1));
  };

  return (
    <div
      className="relative h-7 cursor-pointer rounded bg-muted/50"
      onClick={seekFromEvent}
      onMouseDown={(e) => {
        const move = (m: MouseEvent) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((m.clientX - rect.left) / rect.width) * (replay.frames - 1));
        };
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
    >
      {events.map((e, i) => (
        <div
          key={i}
          className={cn(
            'pointer-events-none absolute top-1 h-5 w-0.5',
            e.kind === 'kill' ? 'bg-foreground/40' : 'bg-amber-400',
          )}
          style={{ left: `${pct(e.frame)}%` }}
        />
      ))}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
        style={{ left: `${pct(frame)}%` }}
      />
    </div>
  );
}

interface VoiceControls {
  enabled: boolean;
  volume: number;
  muteAbove: number;
  setEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  commitVolume: (v: number) => void;
  mix: MixStateApi;
  teamLabels: Record<TeamKey, string>;
}

function teamLabelsFor(
  detail: MatchDetail,
  userSteamId: string | null,
  t: (k: string) => string,
): Record<TeamKey, string> {
  const a = cleanName(detail.summary.teamAName ?? 'Time A');
  const b = cleanName(detail.summary.teamBName ?? 'Time B');
  const user = userSteamId ? detail.scoreboard.find((p) => p.steamId === userSteamId) : null;
  if (!user?.teamName) return { A: a, B: b };
  const userIsA = user.teamName === detail.summary.teamAName;
  return userIsA
    ? { A: t('voice.yourTeam'), B: t('voice.opponent') }
    : { A: t('voice.opponent'), B: t('voice.yourTeam') };
}
