import { describe, expect, it } from 'vitest';
import {
  downsampleToInt16,
  encodeWav16,
  readWavHeader,
  roundForTick,
  SpeechDetector,
  steamIdFromVoiceFile,
} from '../src/voice.js';

function int32Wav(samples: number[], rate = 48_000, extraChunk = false): Buffer {
  const extra = extraChunk ? Buffer.concat([Buffer.from('LIST'), Buffer.from([4, 0, 0, 0]), Buffer.from('INFO')]) : Buffer.alloc(0);
  const data = Buffer.alloc(samples.length * 4);
  samples.forEach((s, i) => data.writeInt32LE(s, i * 4));
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(1, 10);
  fmt.writeUInt32LE(rate, 12);
  fmt.writeUInt32LE(rate * 4, 16);
  fmt.writeUInt16LE(4, 20);
  fmt.writeUInt16LE(32, 22);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'ascii');
  head.write('WAVE', 8, 'ascii');
  const dataHead = Buffer.alloc(8);
  dataHead.write('data', 0, 'ascii');
  dataHead.writeUInt32LE(data.length, 4);
  const all = Buffer.concat([head, fmt, extra, dataHead, data]);
  all.writeUInt32LE(all.length - 8, 4);
  return all;
}

describe('readWavHeader', () => {
  it('le o formato do csgove: PCM int32, 48 kHz, mono', () => {
    const h = readWavHeader(int32Wav([1, 2, 3]));
    expect(h).toMatchObject({ format: 1, channels: 1, sampleRate: 48_000, bitsPerSample: 32, dataBytes: 12 });
  });

  it('acha o chunk data mesmo com chunk extra antes dele', () => {
    const plain = readWavHeader(int32Wav([1]));
    const withList = readWavHeader(int32Wav([1], 48_000, true));
    expect(withList.dataOffset).toBe(plain.dataOffset + 12);
  });

  it('recusa o que nao e WAV', () => {
    expect(() => readWavHeader(Buffer.from('nao sou um wav, sou texto'))).toThrow();
  });
});

describe('SpeechDetector', () => {
  const rate = 10;

  it('separa falas por pausa maior que a minima e junta respiracao curta', () => {
    const d = new SpeechDetector(rate, 0.3);

    const s = [0, 5, 5, 0, 0, 5, 5, 0, 0, 0, 0, 0, 5, 0];
    d.push(Int32Array.from(s), 0);
    expect(d.finish()).toEqual([
      { start: 1, end: 7 },
      { start: 12, end: 13 },
    ]);
  });

  it('funciona igual quando o audio chega em blocos quebrados no meio da fala', () => {
    const s = [0, 5, 5, 0, 0, 5, 5, 0, 0, 0, 0, 0, 5, 0];
    const whole = new SpeechDetector(rate, 0.3);
    whole.push(Int32Array.from(s), 0);
    const chunked = new SpeechDetector(rate, 0.3);
    for (let i = 0; i < s.length; i += 4) chunked.push(Int32Array.from(s.slice(i, i + 4)), i);
    expect(chunked.finish()).toEqual(whole.finish());
  });

  it('silencio total nao gera trecho', () => {
    const d = new SpeechDetector(rate);
    d.push(new Int32Array(100), 0);
    expect(d.finish()).toEqual([]);
  });

  it('ruido baixo conta como fala: silencio e so o zero exato', () => {
    const d = new SpeechDetector(rate);
    d.push(Int32Array.from([0, 1, -1, 0]), 0);
    expect(d.finish()).toEqual([{ start: 1, end: 3 }]);
  });
});

describe('downsampleToInt16', () => {
  it('48 kHz vira 16 kHz com a media de cada 3 amostras, nos 16 bits de cima', () => {
    const k = 65536;
    const { data, rate } = downsampleToInt16(Int32Array.from([3 * k, 3 * k, 3 * k, 0, 0, 6 * k]), 48_000);
    expect(rate).toBe(16_000);
    expect(Array.from(data)).toEqual([3, 2]);
  });

  it('satura em vez de dar a volta', () => {
    const max = 2 ** 31 - 1;
    const { data } = downsampleToInt16(Int32Array.from([max, max, max, -max - 1, -max - 1, -max - 1]), 48_000);
    expect(Array.from(data)).toEqual([32767, -32768]);
  });

  it('taxa que nao e multipla de 16 kHz fica como esta', () => {
    const { rate, data } = downsampleToInt16(Int32Array.from([65536, 65536]), 24_000);
    expect(rate).toBe(24_000);
    expect(data.length).toBe(2);
  });
});

describe('encodeWav16', () => {
  it('gera um WAV que o proprio leitor reconhece', () => {
    const wav = encodeWav16(Int16Array.from([1, -1, 300]), 16_000);
    const h = readWavHeader(wav);
    expect(h).toMatchObject({ format: 1, channels: 1, sampleRate: 16_000, bitsPerSample: 16, dataBytes: 6 });
    expect(wav.readInt16LE(h.dataOffset + 4)).toBe(300);
  });
});

describe('roundForTick', () => {
  const rounds = [
    { roundNum: 1, startTick: 1000, endTick: 5000 },
    { roundNum: 2, startTick: 5500, endTick: 9000 },
  ];

  it('fala antes do primeiro round live (aquecimento, faca) nao tem round', () => {
    expect(roundForTick(900, rounds)).toBeNull();
  });

  it('fala no intervalo depois do fim pertence ao round que acabou', () => {
    expect(roundForTick(5200, rounds)).toBe(1);
    expect(roundForTick(5500, rounds)).toBe(2);
  });

  it('depois do fim do ultimo round, nada', () => {
    expect(roundForTick(9000, rounds)).toBe(2);
    expect(roundForTick(9001, rounds)).toBeNull();
  });
});

describe('steamIdFromVoiceFile', () => {
  it('le o SteamID do fim do nome, mesmo com nick cheio de simbolos', () => {
    expect(steamIdFromVoiceFile('demo_⑪ ✓ ★ SiilenT_76561198070931957.wav')).toBe('76561198070931957');
    expect(steamIdFromVoiceFile('demo.wav')).toBeNull();
  });
});
