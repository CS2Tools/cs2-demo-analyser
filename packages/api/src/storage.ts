import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Storage } from '@cs2/contract';
import { demosDir } from '@cs2/ingest';

function sizeOf(path: string, filter: (name: string, isDir: boolean) => boolean = () => true): number {
  if (!existsSync(path)) return 0;
  let total = 0;
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (!filter(e.name, e.isDirectory())) continue;
    const p = join(path, e.name);
    total += e.isDirectory() ? sizeOf(p) : statSync(p).size;
  }
  return total;
}

export function getStorage(dataDir: string): Storage {
  const bulk = join(dataDir, 'bulk');
  let replays = 0;
  let voice = 0;
  if (existsSync(bulk)) {
    for (const m of readdirSync(bulk, { withFileTypes: true })) {
      if (!m.isDirectory()) continue;
      const dir = join(bulk, m.name);
      voice += sizeOf(join(dir, 'voice'));
      replays += sizeOf(dir, (name, isDir) => !(isDir && name === 'voice'));
    }
  }
  const demos = demosDir(dataDir);
  const demoFiles = existsSync(demos) ? readdirSync(demos).filter((f) => f.endsWith('.dem')) : [];
  return {
    demos: sizeOf(demos),
    demoCount: demoFiles.length,
    replays,
    voice,
    database: sizeOf(dataDir, (name, isDir) => !isDir && /^library\.duckdb(\.wal)?$/.test(name)),
    dataDir,
  };
}
