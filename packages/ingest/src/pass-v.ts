import { execFile } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlValue } from '@cs2/db';
import {
  downsampleToInt16,
  encodeWav16,
  readWavHeader,
  roundForTick,
  SpeechDetector,
  steamIdFromVoiceFile,
  type SpeechSegment,
  type VoiceRound,
} from './voice.js';

export const VOICE_EXE = 'csgove.exe';

export interface PassVInput {
  extractorDir: string;
  demoPath: string;

  workDir: string;

  outDir: string;
  matchId: string;
  tickRate: number;
  rounds: VoiceRound[];
  onProgress: (fraction: number, message?: string) => void;
}

export interface PassVResult {

  rows: SqlValue[][];
  talkers: number;
  segments: number;
  speechSeconds: number;
  bytesWritten: number;

  droppedSegments: number;
}

export const VOICE_COLUMNS = [
  'match_id', 'steam_id', 'segment_index', 'start_tick', 'end_tick', 'duration_ms',
  'sample_rate', 'rel_path', 'alignment', 'round_num', 'file_offset_ms',
] as const;

function runExtractor(extractorDir: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      join(extractorDir, VOICE_EXE),
      args,
      { cwd: extractorDir, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          const detail = String(stderr || err.message).trim().split('\n').slice(-2).join(' | ');
          reject(new Error(`extrator de voz falhou (codigo ${String((err as { code?: unknown }).code)}): ${detail}`));
        } else {
          resolve();
        }
      },
    );
  });
}

function readSamples(fd: number, dataOffset: number, start: number, end: number): Int32Array {
  const bytes = (end - start) * 4;
  const buf = Buffer.allocUnsafeSlow(bytes);
  let got = 0;
  while (got < bytes) {
    const n = readSync(fd, buf, got, bytes - got, dataOffset + start * 4 + got);
    if (n === 0) break;
    got += n;
  }
  return new Int32Array(buf.buffer, buf.byteOffset, Math.floor(got / 4));
}

function detectSegments(fd: number, dataOffset: number, totalSamples: number, rate: number): SpeechSegment[] {
  const detector = new SpeechDetector(rate);
  const block = rate * 10;
  for (let s = 0; s < totalSamples; s += block) {
    detector.push(readSamples(fd, dataOffset, s, Math.min(totalSamples, s + block)), s);
  }
  return detector.finish();
}

export async function runPassV(input: PassVInput): Promise<PassVResult> {
  const { extractorDir, demoPath, workDir, outDir, matchId, tickRate, rounds, onProgress } = input;
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  try {

    onProgress(0, 'procurando quem fala');
    const discoverDir = join(workDir, 'discover');
    mkdirSync(discoverDir);
    await runExtractor(extractorDir, ['-output', discoverDir, '-mode', 'split-compact', demoPath]);
    const talkers = [
      ...new Set(readdirSync(discoverDir).map(steamIdFromVoiceFile).filter((x): x is string => x !== null)),
    ];
    rmSync(discoverDir, { recursive: true, force: true });

    const result: PassVResult = {
      rows: [], talkers: talkers.length, segments: 0, speechSeconds: 0, bytesWritten: 0, droppedSegments: 0,
    };
    if (talkers.length === 0) {
      onProgress(1, 'sem voz nesta demo');
      return result;
    }

    mkdirSync(outDir, { recursive: true });

    for (const [i, steamId] of talkers.entries()) {
      onProgress(0.1 + (0.9 * i) / talkers.length, `voz ${i + 1} de ${talkers.length}`);
      const fullDir = join(workDir, 'full');
      rmSync(fullDir, { recursive: true, force: true });
      mkdirSync(fullDir);
      await runExtractor(extractorDir, [
        '-output', fullDir, '-mode', 'split-full', '-steam-ids', steamId, demoPath,
      ]);

      const file = readdirSync(fullDir).find((f) => steamIdFromVoiceFile(f) === steamId);
      if (!file) continue;

      const fd = openSync(join(fullDir, file), 'r');
      try {
        const head = Buffer.alloc(4096);
        readSync(fd, head, 0, head.length, 0);
        const wav = readWavHeader(head);
        if (wav.format !== 1 || wav.bitsPerSample !== 32 || wav.channels !== 1) {
          throw new Error(
            `formato de WAV inesperado: fmt ${wav.format}, ${wav.bitsPerSample} bits, ${wav.channels} canais`,
          );
        }
        const total = Math.floor(wav.dataBytes / 4);
        const segments = detectSegments(fd, wav.dataOffset, total, wav.sampleRate);

        const byRound = new Map<number, { seg: SpeechSegment; audio: Int16Array; rate: number }[]>();
        for (const seg of segments) {
          const startTick = Math.round((seg.start / wav.sampleRate) * tickRate);
          const round = roundForTick(startTick, rounds);
          if (round === null) {
            result.droppedSegments++;
            continue;
          }
          const { data, rate } = downsampleToInt16(
            readSamples(fd, wav.dataOffset, seg.start, seg.end),
            wav.sampleRate,
          );
          const list = byRound.get(round) ?? [];
          list.push({ seg, audio: data, rate });
          byRound.set(round, list);
        }

        let segIndex = 0;
        for (const [round, list] of byRound) {
          const rate = list[0]!.rate;
          const totalLen = list.reduce((a, x) => a + x.audio.length, 0);
          const joined = new Int16Array(totalLen);
          const rel = `voice/r${round}_${steamId}.wav`;
          let offset = 0;
          for (const { seg, audio } of list) {
            joined.set(audio, offset);
            const durationMs = Math.round((audio.length / rate) * 1000);
            result.rows.push([
              matchId,
              steamId,
              segIndex++,
              Math.round((seg.start / wav.sampleRate) * tickRate),
              Math.round((seg.end / wav.sampleRate) * tickRate),
              durationMs,
              rate,
              rel,

              'exact',
              round,
              Math.round((offset / rate) * 1000),
            ]);
            result.segments++;
            result.speechSeconds += audio.length / rate;
            offset += audio.length;
          }
          const bytes = encodeWav16(joined, rate);
          writeFileSync(join(outDir, `r${round}_${steamId}.wav`), bytes);
          result.bytesWritten += bytes.length;
        }
      } finally {
        closeSync(fd);

        rmSync(fullDir, { recursive: true, force: true });
      }
    }

    onProgress(1, `${talkers.length} jogador(es) com voz`);
    return result;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export function voiceExtractorAvailable(dir: string | undefined | null): dir is string {
  return Boolean(dir) && existsSync(join(dir!, VOICE_EXE));
}
