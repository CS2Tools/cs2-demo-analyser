import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const DIST = join(here, 'dist');

const NATIVE_PACKAGES = [
  '@duckdb/node-api',
  '@duckdb/node-bindings',
  '@duckdb/node-bindings-win32-x64',
  '@laihoe/demoparser2',
  '@laihoe/demoparser2-win32-x64-msvc',
];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',

  external: ['electron', ...NATIVE_PACKAGES],
};

await build({
  ...common,
  entryPoints: [join(here, 'src', 'main.ts')],
  outfile: join(DIST, 'main.js'),
});

await build({
  ...common,
  entryPoints: [join(here, 'src', 'preload.ts')],
  outfile: join(DIST, 'preload.js'),

  external: ['electron'],
});

await build({
  ...common,
  entryPoints: [join(ROOT, 'packages', 'ingest', 'src', 'worker.ts')],
  outfile: join(DIST, 'worker.js'),
});

cpSync(join(ROOT, 'apps', 'web', 'dist'), join(DIST, 'web'), { recursive: true });

cpSync(join(ROOT, 'apps', 'desktop', 'build', 'icon.png'), join(DIST, 'icon.png'));

cpSync(
  join(ROOT, 'packages', 'db', 'src', 'schema'),
  join(DIST, 'schema'),
  { recursive: true },
);

for (const pkg of NATIVE_PACKAGES) {
  cpSync(join(ROOT, 'node_modules', pkg), join(DIST, 'node_modules', pkg), {
    recursive: true,
    dereference: true,
  });
}

const parserPkg = JSON.parse(
  readFileSync(join(ROOT, 'node_modules', '@laihoe', 'demoparser2', 'package.json'), 'utf8'),
);
writeFileSync(
  join(DIST, 'parser-version.json'),
  JSON.stringify({ version: parserPkg.version }, null, 2),
);

process.stdout.write('\n  build do desktop pronto em apps/desktop/dist\n\n');
