import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoundReplay } from '@cs2/contract';
import { transport } from '@/lib/transport';
import { planVoice, speakingAt, voiceAudible } from './voice-plan';
import type { MixGains, TeamKey } from './voice-mix';

export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Options {
  replay: RoundReplay;
  frame: number;
  playing: boolean;
  speed: number;
  hz: number;
  enabled: boolean;
  volume: number;
  muteAbove: number;

  mix: MixGains;

  teamOf: Map<string, TeamKey | null>;
}

const DRIFT_FRAMES = 2;

export function useVoice({ replay, frame, playing, speed, hz, enabled, volume, muteAbove, mix, teamOf }: Options) {
  const [status, setStatus] = useState<VoiceStatus>('idle');

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const gainsRef = useRef(new Map<string, GainNode>());
  const teamGainsRef = useRef(new Map<TeamKey, GainNode>());
  const mixRef = useRef(mix);
  mixRef.current = mix;
  const buffersRef = useRef(new Map<string, AudioBuffer>());
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const anchorRef = useRef<{ wall: number; frame: number } | null>(null);
  const scheduleRef = useRef<() => void>(() => undefined);

  const hasVoice = replay.voice.length > 0;
  const tickAt = useCallback((f: number) => replay.startTick + f * replay.stride, [replay]);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      gainsRef.current.clear();
      teamGainsRef.current.clear();
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    return ctxRef.current;
  }, []);

  const stopAll = useCallback(() => {
    for (const s of sourcesRef.current) {
      try {
        s.stop();
      } catch {

      }
      s.disconnect();
    }
    sourcesRef.current = [];
    anchorRef.current = null;
  }, []);

  useEffect(() => {
    if (!hasVoice || !enabled) return;
    let cancelled = false;
    const ctx = ensureContext();
    setStatus('loading');
    Promise.all(
      replay.voice.map(async (t) => {
        if (buffersRef.current.has(t.fileId)) return;
        const res = await fetch(transport.assetUrl('voice', t.fileId));
        if (!res.ok) throw new Error(`voz indisponivel (${res.status})`);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        buffersRef.current.set(t.fileId, buf);
      }),
    )
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [replay, hasVoice, enabled, ensureContext]);

  const playerNode = useCallback(
    (ctx: AudioContext, master: GainNode, steamId: string): GainNode => {
      let g = gainsRef.current.get(steamId);
      if (g) return g;
      const team = teamOf.get(steamId) ?? null;
      let parent: AudioNode = master;
      if (team) {
        let tg = teamGainsRef.current.get(team);
        if (!tg) {
          tg = ctx.createGain();
          tg.gain.value = mixRef.current.team[team];
          tg.connect(master);
          teamGainsRef.current.set(team, tg);
        }
        parent = tg;
      }
      g = ctx.createGain();
      g.gain.value = mixRef.current.player[steamId] ?? 1;
      g.connect(parent);
      gainsRef.current.set(steamId, g);
      return g;
    },
    [teamOf],
  );

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = volume;
  }, [volume, status]);
  useEffect(() => {
    for (const [team, g] of teamGainsRef.current) g.gain.value = mix.team[team];
    for (const [id, g] of gainsRef.current) g.gain.value = mix.player[id] ?? 1;
  }, [mix]);

  const schedule = useCallback(() => {
    stopAll();
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;

    if (ctx.state !== 'running') {
      ctx
        .resume()
        .then(() => scheduleRef.current())
        .catch(() => setStatus('error'));
      return;
    }

    for (const clip of planVoice(replay.voice, tickAt(frame), replay.tickRate, speed)) {
      const buffer = buffersRef.current.get(clip.fileId);
      if (!buffer) continue;
      const gain = playerNode(ctx, master, clip.steamId);
      const src = ctx.createBufferSource();
      src.buffer = buffer;

      src.playbackRate.value = speed;
      src.connect(gain);
      src.start(ctx.currentTime + clip.delay, clip.offset, clip.duration);
      sourcesRef.current.push(src);
    }
    anchorRef.current = { wall: performance.now(), frame };
  }, [frame, playerNode, replay, speed, stopAll, tickAt]);
  scheduleRef.current = schedule;

  const active = enabled && hasVoice && status === 'ready' && playing && voiceAudible(speed, muteAbove);

  useEffect(() => {
    if (active) schedule();
    else stopAll();

  }, [active, speed]);

  useEffect(() => {
    const a = anchorRef.current;
    if (!active || !a) return;
    const expected = a.frame + ((performance.now() - a.wall) / 1000) * hz * speed;
    if (Math.abs(frame - expected) > DRIFT_FRAMES) schedule();
  }, [active, frame, hz, speed, schedule]);

  useEffect(() => () => stopAll(), [replay, stopAll]);

  useEffect(
    () => () => {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      masterRef.current = null;
      gainsRef.current.clear();
      teamGainsRef.current.clear();
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
    },
    [],
  );

  const speaking = useMemo(() => speakingAt(replay.voice, tickAt(frame)), [replay, frame, tickAt]);

  return {
    hasVoice,
    status,
    speaking,

    silencedBySpeed: enabled && hasVoice && playing && !voiceAudible(speed, muteAbove),
  };
}
