import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demosDir, ensureStoredDemo, storedDemoPath, sweepStoredDemos } from '../src/demo-store.js';

let dir: string;
let dataDir: string;
let source: string;
const SHA = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cs2store-'));
  dataDir = join(dir, 'data');

  const game = join(dir, 'steam', 'game', 'csgo');
  mkdirSync(game, { recursive: true });
  source = join(game, 'partida.dem');
  writeFileSync(source, 'conteudo da demo');
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('ensureStoredDemo', () => {
  it('copia a demo para data/demos/<sha>.dem', () => {
    const stored = ensureStoredDemo(dataDir, source, SHA);
    expect(stored).toBe(storedDemoPath(dataDir, SHA));
    expect(readFileSync(stored, 'utf8')).toBe('conteudo da demo');
  });

  it('depois da copia, a origem pode sumir: e a garantia de independencia', () => {
    const stored = ensureStoredDemo(dataDir, source, SHA);
    rmSync(join(dir, 'steam'), { recursive: true, force: true });
    expect(existsSync(stored)).toBe(true);
  });

  it('nao deixa arquivo parcial para tras', () => {
    ensureStoredDemo(dataDir, source, SHA);
    expect(readdirSync(demosDir(dataDir))).toEqual([`${SHA}.dem`]);
  });

  it('a mesma demo de duas pastas vira uma copia so', () => {
    const outra = join(dir, 'Downloads', 'copia.dem');
    mkdirSync(join(dir, 'Downloads'));
    writeFileSync(outra, 'conteudo da demo');
    ensureStoredDemo(dataDir, source, SHA);
    ensureStoredDemo(dataDir, outra, SHA);
    expect(readdirSync(demosDir(dataDir))).toHaveLength(1);
  });

  it('reprocessar a partir da propria copia nao copia de novo', () => {
    const stored = ensureStoredDemo(dataDir, source, SHA);
    expect(ensureStoredDemo(dataDir, stored, SHA)).toBe(stored);
  });

  it('recusa hash malformado: o nome do arquivo nao pode virar caminho', () => {
    expect(() => storedDemoPath(dataDir, '../../etc')).toThrow();
  });
});

describe('sweepStoredDemos', () => {
  it('apaga copias sem partida e sobras .part; mantem as usadas', () => {
    ensureStoredDemo(dataDir, source, SHA);
    ensureStoredDemo(dataDir, source, OTHER);
    writeFileSync(join(demosDir(dataDir), `${'c'.repeat(64)}.dem.part`), 'x');

    const removed = sweepStoredDemos(dataDir, new Set([SHA]));
    expect(removed.sort()).toEqual([`${OTHER}.dem`, `${'c'.repeat(64)}.dem.part`].sort());
    expect(readdirSync(demosDir(dataDir))).toEqual([`${SHA}.dem`]);
  });

  it('sem pasta de demos, nao faz nada', () => {
    expect(sweepStoredDemos(dataDir, new Set())).toEqual([]);
  });
});
