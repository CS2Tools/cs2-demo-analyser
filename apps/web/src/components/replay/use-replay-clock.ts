import { useCallback, useEffect, useRef, useState } from 'react';

export interface ReplayClock {

  frame: number;
  playing: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (frame: number) => void;
  step: (deltaFrames: number) => void;
  setSpeed: (speed: number) => void;
}

export const SPEEDS = [0.125, 0.25, 0.5, 1, 2, 4, 8] as const;

export function currentFrame(
  anchorFrame: number,
  anchorTime: number,
  playing: boolean,
  hz: number,
  speed: number,
  frames: number,
  now = performance.now(),
): number {
  if (!playing) return anchorFrame;
  const f = anchorFrame + ((now - anchorTime) / 1000) * hz * speed;
  return Math.max(0, Math.min(frames - 1, f));
}

export function useReplayClock(options: {
  frames: number;

  hz: number;
  onEnd?: () => void;
}): ReplayClock {
  const { frames, hz } = options;

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [frame, setFrame] = useState(0);

  const anchorFrame = useRef(0);
  const anchorTime = useRef(0);
  const raf = useRef<number | null>(null);
  const onEnd = useRef(options.onEnd);
  onEnd.current = options.onEnd;

  const reanchor = useCallback((atFrame: number) => {
    anchorFrame.current = atFrame;
    anchorTime.current = performance.now();
  }, []);

  const seek = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(frames - 1, next));
      reanchor(clamped);
      setFrame(clamped);
    },
    [frames, reanchor],
  );

  const play = useCallback(() => {

    if (anchorFrame.current >= frames - 1) seek(0);
    reanchor(anchorFrame.current);
    setPlaying(true);
  }, [frames, reanchor, seek]);

  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  const step = useCallback(
    (delta: number) => {
      pause();
      seek(anchorFrame.current + delta);
    },
    [pause, seek],
  );

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const setSpeed = useCallback(
    (next: number) => {

      reanchor(currentFrame(anchorFrame.current, anchorTime.current, playingRef.current, hz, speedRef.current, frames));
      setSpeedState(next);
    },
    [reanchor, hz, frames],
  );

  useEffect(() => {
    if (!playing) return;

    const tick = () => {
      const elapsed = (performance.now() - anchorTime.current) / 1000;
      const next = anchorFrame.current + elapsed * hz * speed;

      if (next >= frames - 1) {
        anchorFrame.current = frames - 1;
        setFrame(frames - 1);
        setPlaying(false);
        onEnd.current?.();
        return;
      }

      setFrame(next);
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, hz, frames]);

  useEffect(() => {
    if (!playing) anchorFrame.current = frame;
  }, [playing, frame]);

  return { frame, playing, speed, play, pause, toggle, seek, step, setSpeed };
}
