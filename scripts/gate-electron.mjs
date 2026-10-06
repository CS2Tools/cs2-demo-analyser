import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXE = join(ROOT, 'apps', 'desktop', 'release', 'win-unpacked', 'CS2 Demo Analyser.exe');

function run(label, command, args, cwd = ROOT) {
  process.stdout.write(`\n  > ${label}\n`);
  const r = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.stderr.write(`\n  ${label}: falhou (codigo ${r.status})\n`);
    process.exit(r.status ?? 1);
  }
}

function findDemo() {
  const fromArgv = process.argv[2];
  if (fromArgv) return fromArgv;

  const dir = join(ROOT, 'fixtures', 'demos');
  if (existsSync(dir)) {
    const hit = readdirSync(dir).find((f) => f.toLowerCase().endsWith('.dem'));
    if (hit) return join(dir, hit);
  }
  return null;
}

const demo = findDemo();
if (!demo || !existsSync(demo)) {
  process.stderr.write(
    '\n  Informe o caminho de uma demo GOTV:\n' +
      '    npm run gate:electron -- "C:\\\\caminho\\\\demo.dem"\n' +
      '  ou coloque um arquivo .dem em fixtures/demos/\n\n',
  );
  process.exit(1);
}

run('build da UI', 'npm', ['-w', '@cs2/web', 'run', 'build']);
run('build do desktop', 'npm', ['-w', '@cs2/desktop', 'run', 'build']);
run('empacotamento', 'npx', ['electron-builder', '--dir'], join(ROOT, 'apps', 'desktop'));

process.stdout.write(`\n  > teste de fumaca no .exe empacotado\n`);

const smoke = spawnSync(`"${EXE}" --smoke-test "${demo}"`, {
  stdio: 'inherit',
  shell: true,
});

for (const name of readdirSync(tmpdir())) {
  if (name.startsWith('cs2-smoke-')) rmSync(join(tmpdir(), name), { recursive: true, force: true });
}
process.exit(smoke.status ?? 1);
