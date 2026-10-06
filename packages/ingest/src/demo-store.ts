import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function demosDir(dataDir: string): string {
  return join(dataDir, 'demos');
}

export function storedDemoPath(dataDir: string, sha256: string): string {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`hash invalido: ${sha256}`);
  return join(demosDir(dataDir), `${sha256}.dem`);
}

export function ensureStoredDemo(dataDir: string, sourcePath: string, sha256: string): string {
  const target = storedDemoPath(dataDir, sha256);
  if (resolve(sourcePath) === resolve(target)) return target;
  if (existsSync(target) && statSync(target).size === statSync(sourcePath).size) return target;

  mkdirSync(demosDir(dataDir), { recursive: true });
  const part = `${target}.part`;
  copyFileSync(sourcePath, part);
  renameSync(part, target);
  return target;
}

export function sweepStoredDemos(dataDir: string, keep: Set<string>): string[] {
  const dir = demosDir(dataDir);
  if (!existsSync(dir)) return [];
  const removed: string[] = [];
  for (const name of readdirSync(dir)) {
    const sha = /^([0-9a-f]{64})\.dem$/.exec(name)?.[1];
    if (sha && keep.has(sha)) continue;
    rmSync(join(dir, name), { force: true });
    removed.push(name);
  }
  return removed;
}
