export interface WavInfo {

  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataBytes: number;
}

export function readWavHeader(buf: Buffer): WavInfo {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('nao e um arquivo WAV');
  }
  let pos = 12;
  let fmt: Omit<WavInfo, 'dataOffset' | 'dataBytes'> | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(pos + 8),
        channels: buf.readUInt16LE(pos + 10),
        sampleRate: buf.readUInt32LE(pos + 12),
        bitsPerSample: buf.readUInt16LE(pos + 22),
      };
    } else if (id === 'data') {
      if (!fmt) throw new Error('WAV sem chunk fmt antes do data');
      return { ...fmt, dataOffset: pos + 8, dataBytes: size };
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error('WAV sem chunk data');
}

export interface SpeechSegment {

  start: number;

  end: number;
}

export const SPEECH_GAP_SECONDS = 0.3;

export class SpeechDetector {
  readonly segments: SpeechSegment[] = [];
  #gap: number;
  #current: SpeechSegment | null = null;
  #lastNonZero = -1;

  constructor(sampleRate: number, gapSeconds = SPEECH_GAP_SECONDS) {
    this.#gap = Math.max(1, Math.round(sampleRate * gapSeconds));
  }

  push(block: Int32Array, firstIndex: number): void {
    for (let i = 0; i < block.length; i++) {
      if (block[i] === 0) continue;
      const idx = firstIndex + i;
      if (this.#current && idx - this.#lastNonZero > this.#gap) {
        this.#current.end = this.#lastNonZero + 1;
        this.segments.push(this.#current);
        this.#current = null;
      }
      if (!this.#current) this.#current = { start: idx, end: idx + 1 };
      this.#lastNonZero = idx;
    }
  }

  finish(): SpeechSegment[] {
    if (this.#current) {
      this.#current.end = this.#lastNonZero + 1;
      this.segments.push(this.#current);
      this.#current = null;
    }
    return this.segments;
  }
}

export const VOICE_OUTPUT_RATE = 16_000;

export function downsampleToInt16(samples: Int32Array, fromRate: number): { data: Int16Array; rate: number } {
  const factor = fromRate % VOICE_OUTPUT_RATE === 0 ? fromRate / VOICE_OUTPUT_RATE : 1;
  const rate = fromRate / factor;
  const out = new Int16Array(Math.floor(samples.length / factor));
  for (let o = 0; o < out.length; o++) {
    let sum = 0;
    for (let k = 0; k < factor; k++) sum += samples[o * factor + k]!;
    const v = Math.round(sum / factor / 65536);
    out[o] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
  }
  return { data: out, rate };
}

export function encodeWav16(samples: Int16Array, sampleRate: number): Buffer {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  Buffer.from(samples.buffer, samples.byteOffset, dataBytes).copy(buf, 44);
  return buf;
}

export interface VoiceRound {
  roundNum: number;

  startTick: number;
  endTick: number;
}

export function roundForTick(tick: number, rounds: VoiceRound[]): number | null {
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i]!;
    const next = rounds[i + 1];
    const until = next ? next.startTick : r.endTick + 1;
    if (tick >= r.startTick && tick < until) return r.roundNum;
  }
  return null;
}

export function steamIdFromVoiceFile(name: string): string | null {
  return /_(\d{17})\.wav$/i.exec(name)?.[1] ?? null;
}
