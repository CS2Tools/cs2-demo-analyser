import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from '@cs2/contract';
import type { Db } from '@cs2/db';
import type { IngestQueue } from '@cs2/ingest';

export interface SettingsStore {
  get(): Settings;
  set(patch: Partial<Settings>): Settings;
}

export class JsonSettingsStore implements SettingsStore {
  #cache: Settings | null = null;

  constructor(private readonly filePath: string) {}

  get(): Settings {
    if (this.#cache) return this.#cache;
    if (!existsSync(this.filePath)) {
      this.#cache = DEFAULT_SETTINGS;
      return this.#cache;
    }
    try {
      const raw: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'));

      this.#cache = settingsSchema.parse(raw);
    } catch {

      this.#cache = DEFAULT_SETTINGS;
    }
    return this.#cache;
  }

  set(patch: Partial<Settings>): Settings {
    const next = settingsSchema.parse({ ...this.get(), ...patch });
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(next, null, 2), 'utf8');
    this.#cache = next;
    return next;
  }
}

export interface ApiContext {
  readonly db: Db;
  readonly ingest: IngestQueue;
  readonly appVersion: string;
  readonly transportKind: 'http' | 'ipc';
  readonly settings: SettingsStore;

  readonly mapsDir: string;

  readonly dataDir: string;

  readonly exportsDir: string;

  readonly voiceExtractorDir?: string;

  readonly reveal?: (path: string) => void;
}

export const VOICE_MATCH_ID = /^[0-9a-f-]{36}$/i;
export const VOICE_FILE = /^r\d{1,3}_\d{17}\.wav$/;

export const ICON_PATH = /^(equipment|deathnotice|maps|radar)\/[a-z0-9_.-]+\.svg$/i;
