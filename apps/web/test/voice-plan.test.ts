import { describe, expect, it } from 'vitest';
import type { VoiceTrack } from '@cs2/contract';
import { planVoice, speakingAt, voiceAudible } from '../src/components/replay/voice-plan';

const track: VoiceTrack = {
  steamId: 'a',
  slot: 0,
  fileId: 'm/r1_a.wav',
  segments: [
    { startTick: 640, endTick: 768, offsetMs: 0, durationMs: 2000 },
    { startTick: 1280, endTick: 1344, offsetMs: 2000, durationMs: 1000 },
  ],
};

describe('planVoice', () => {
  it('antes de tudo: agenda os dois trechos com o atraso certo', () => {
    const clips = planVoice([track], 0, 64, 1);
    expect(clips.map((c) => [c.delay, c.offset, c.duration])).toEqual([
      [10, 0, 2],
      [20, 2, 1],
    ]);
  });

  it('no meio de uma fala: toca o resto a partir do ponto certo, ja', () => {
    const [clip] = planVoice([track], 704, 64, 1);
    expect(clip).toMatchObject({ delay: 0, offset: 1, duration: 1 });
  });

  it('trecho que ja acabou nao entra', () => {
    expect(planVoice([track], 800, 64, 1)).toHaveLength(1);
  });

  it('a 2x o atraso cai pela metade; o trecho de arquivo e o mesmo', () => {
    const clips = planVoice([track], 0, 64, 2);
    expect(clips[0]).toMatchObject({ delay: 5, offset: 0, duration: 2 });
  });

  it('a mesma conta a 128 tick', () => {
    const t128: VoiceTrack = { ...track, segments: [{ startTick: 1280, endTick: 1536, offsetMs: 0, durationMs: 2000 }] };
    expect(planVoice([t128], 0, 128, 1)[0]!.delay).toBe(10);
  });
});

describe('speakingAt', () => {
  it('marca quem fala no tick, sem depender de estar tocando', () => {
    expect([...speakingAt([track], 700)]).toEqual(['a']);
    expect(speakingAt([track], 900).size).toBe(0);
  });
});

describe('voiceAudible', () => {
  it('toca de 1x ate o limite; abaixo de 1x ou acima, mudo', () => {
    expect(voiceAudible(1, 2)).toBe(true);
    expect(voiceAudible(2, 2)).toBe(true);
    expect(voiceAudible(4, 2)).toBe(false);
    expect(voiceAudible(0.5, 2)).toBe(false);
  });
});
