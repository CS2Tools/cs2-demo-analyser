import type { IngestStage } from '@cs2/contract';

export interface JobSpec {
  jobId: string;

  demoPath: string;

  originalPath: string;

  originalMtimeMs: number | null;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;

  stagingPath: string;

  bulkDir: string;
  matchId: string;
  appVersion: string;
  parserVersion: string;

  userSteamId: string | null;

  poiSteamIds: string[];

  schemaDir?: string;

  mapsDir?: string;

  voiceExtractorDir?: string;
}

export type WorkerMessage =
  | { type: 'progress'; stage: IngestStage; fraction: number; message?: string }
  | { type: 'rejected'; reason: 'pov' | 'unsupported'; message: string }
  | { type: 'done'; summary: IngestSummary }
  | { type: 'error'; message: string; stack?: string };

export interface IngestSummary {
  matchId: string;
  mapName: string;
  tickRate: number;
  liveRounds: number;
  discardedRounds: number;
  knifeRoundTick: number | null;
  restartCount: number;
  durationMs: number;
  peakRssMb: number;
  replayRows: number;
  replayStride: number;
  grenades: number;
  detonations: number;
  windowRows: number;
  interestTicks: number;
  economyRows: number;
  engagements: number;

  utilityThrows: number;
  heatmapBins: number;

  voice: {
    status: 'ok' | 'none' | 'skipped_mm' | 'unavailable' | 'failed';
    talkers: number;
    segments: number;
    speechSeconds: number;
    bytes: number;
    detail: string | null;
  };

  bulkState: string;

  tables: string[];
  validation: ValidationResult[];
}

export interface ValidationResult {
  check: string;
  ok: boolean;
  detail: string;
}
