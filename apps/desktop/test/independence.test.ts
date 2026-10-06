import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

const GAME_TARGETING: [string, RegExp][] = [
  ['pasta da Steam', /steamapps/i],
  ['pasta do jogo', /counter-strike global offensive/i],
  ['processo do jogo', /\b(cs2|csgo)\.exe\b/i],
  ['protocolo da Steam', /steam:\/\//i],
  ['registro da Valve/Steam', /software\\+(valve|wow6432node\\+valve)/i],
  ['configuracao da Steam', /\b(libraryfolders\.vdf|gameinfo\.gi)\b/i],
];

const SOURCE_ONLY: [string, RegExp][] = [
  ['acesso a processo', /\b(OpenProcess|ReadProcessMemory|WriteProcessMemory|CreateRemoteThread|VirtualAllocEx)\b/],
  ['pacote do jogo', /\.vpk\b/i],
  ['caminho da Steam no registro', /\bSteamPath\b/],
];

const SELF = basename(fileURLToPath(import.meta.url));

function walk(dir: string, exts: RegExp, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'release') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.test(e.name)) out.push(p);
  }
  return out;
}

function violations(files: string[], rules: [string, RegExp][], binary = false): string[] {
  const found: string[] = [];
  for (const f of files) {
    if (basename(f) === SELF) continue;
    const text = readFileSync(f, binary ? 'latin1' : 'utf8');
    for (const [label, re] of rules) {
      if (re.test(text)) found.push(`${relative(ROOT, f)}: ${label} (${re})`);
    }
  }
  return found;
}

describe('independencia do CS2', () => {
  const sources = [
    ...walk(join(ROOT, 'apps'), /\.(ts|tsx|mjs|js|html)$/),
    ...walk(join(ROOT, 'packages'), /\.(ts|tsx|mjs|js|sql)$/),
    ...walk(join(ROOT, 'scripts'), /\.(ts|mjs|js)$/),
  ];

  it('o teste enxerga o codigo de verdade', () => {

    expect(sources.length).toBeGreaterThan(80);
  });

  it('nenhum codigo-fonte aponta para o jogo, a Steam ou outro processo', () => {
    expect(violations(sources, [...GAME_TARGETING, ...SOURCE_ONLY])).toEqual([]);
  });

  it('nenhuma dependencia le arquivos do jogo ou fala com a Steam', () => {
    const manifests = [
      join(ROOT, 'package.json'),
      ...readdirSync(join(ROOT, 'apps')).map((a) => join(ROOT, 'apps', a, 'package.json')),
      ...readdirSync(join(ROOT, 'packages')).map((p) => join(ROOT, 'packages', p, 'package.json')),
    ].filter(existsSync);
    const bad: string[] = [];
    for (const m of manifests) {
      const pkg = JSON.parse(readFileSync(m, 'utf8')) as Record<string, Record<string, string> | undefined>;
      for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        for (const name of Object.keys(pkg[field] ?? {})) {
          if (/vpk|steam|valve|vdf|memoryjs|ffi-napi|node-ffi|process-memory/i.test(name)) {
            bad.push(`${relative(ROOT, m)}: ${name}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('bundles e binarios distribuidos nao apontam para o jogo', () => {
    const shipped: string[] = [];
    const dist = join(ROOT, 'apps', 'desktop', 'dist');
    if (existsSync(dist)) {
      for (const f of readdirSync(dist)) if (f.endsWith('.js')) shipped.push(join(dist, f));
      const web = join(dist, 'web', 'assets');
      if (existsSync(web)) for (const f of readdirSync(web)) shipped.push(join(web, f));
    }
    const natives = [
      join(ROOT, 'vendor', 'csgo-voice-extractor', 'win32-x64'),
      join(ROOT, 'node_modules', '@laihoe', 'demoparser2-win32-x64-msvc'),
      join(ROOT, 'node_modules', '@duckdb', 'node-bindings-win32-x64'),
    ];
    for (const d of natives) {
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (/\.(exe|dll|node)$/i.test(f) && statSync(p).size > 0) shipped.push(p);
      }
    }
    expect(violations(shipped, GAME_TARGETING, true)).toEqual([]);
  });

  it('as DLLs da Valve exigidas pelo extrator de voz sao vazias', () => {

    const dir = join(ROOT, 'vendor', 'csgo-voice-extractor', 'win32-x64');
    for (const dll of ['tier0.dll', 'vaudio_celt.dll']) {
      const p = join(dir, dll);
      if (existsSync(p)) expect(statSync(p).size, dll).toBe(0);
    }
  });
});
