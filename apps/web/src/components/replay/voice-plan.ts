import type { VoiceTrack } from '@cs2/contract';

export function voiceAudible(speed: number, muteAbove: number): boolean {
  return speed >= 1 && speed <= muteAbove;
}

export interface PlannedClip {
  steamId: string;
  fileId: string;

  delay: number;

  offset: number;

  duration: number;
}

export function planVoice(
  tracks: VoiceTrack[],
  nowTick: number,
  tickRate: number,
  speed: number,
): PlannedClip[] {
  const clips: PlannedClip[] = [];
  for (const t of tracks) {
    for (const s of t.segments) {
      const segStart = s.offsetMs / 1000;
      const segDur = s.durationMs / 1000;
      const elapsed = (nowTick - s.startTick) / tickRate;
      if (elapsed >= segDur) continue;
      if (elapsed >= 0) {
        clips.push({ steamId: t.steamId, fileId: t.fileId, delay: 0, offset: segStart + elapsed, duration: segDur - elapsed });
      } else {
        clips.push({ steamId: t.steamId, fileId: t.fileId, delay: -elapsed / speed, offset: segStart, duration: segDur });
      }
    }
  }
  return clips;
}

export function speakingAt(tracks: VoiceTrack[], tick: number): Set<string> {
  const out = new Set<string>();
  for (const t of tracks) {
    if (t.segments.some((s) => tick >= s.startTick && tick <= s.endTick)) out.add(t.steamId);
  }
  return out;
}
