import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXTRACTOR = join(process.cwd(), 'vendor', 'csgo-voice-extractor', 'win32-x64');

const dir = process.argv[2];
if (!dir) {
  console.error('uso: npx tsx scripts/check-voice.mjs <pasta com .dem>');
  process.exit(1);
}

const demos = readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith('.dem'))
  .map((f) => join(dir, f))
  .sort();

console.log(`extrator: ${EXTRACTOR}`);
console.log(`${demos.length} demo(s)\n`);

const results = [];
for (const [i, demo] of demos.entries()) {
  const name = demo.split(/[\\/]/).pop();
  process.stdout.write(`[${i + 1}/${demos.length}] ${name.slice(0, 60)} ... `);
  const out = mkdtempSync(join(tmpdir(), 'cs2voice-'));
  const started = Date.now();
  const { stdout, stderr, code } = await run(demo, out);
  const files = safeList(out);
  rmSync(out, { recursive: true, force: true });

  const talkers = files.filter((f) => f.endsWith('.wav')).length;
  const seconds = Math.round((Date.now() - started) / 1000);
  results.push({ name, talkers, code, seconds, mtime: statSync(demo).mtime });
  console.log(
    talkers > 0
      ? `${talkers} falante(s) em ${seconds}s`
      : `SEM VOZ em ${seconds}s — ${(stdout + stderr).match(/No voice data[^\n]*/)?.[0] ?? `codigo ${code}`}`,
  );
}

console.log('\n--- por data da demo ---');
for (const r of [...results].sort((a, b) => a.mtime - b.mtime)) {
  console.log(
    `${r.mtime.toISOString().slice(0, 10)}  ${String(r.talkers).padStart(2)} falante(s)  ${r.name.slice(0, 64)}`,
  );
}

const semVoz = results.filter((r) => r.talkers === 0);
console.log(`\ncom voz: ${results.length - semVoz.length}/${results.length}`);
if (semVoz.length > 0) {
  console.log('sem voz:', semVoz.map((r) => r.name.slice(0, 40)).join(', '));
}

function run(demo, out) {
  return new Promise((resolve) => {
    execFile(
      join(EXTRACTOR, 'csgove.exe'),
      ['-output', out, '-mode', 'split-compact', demo],
      { cwd: EXTRACTOR, windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) =>
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code: err?.code ?? 0 }),
    );
  });
}

function safeList(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

void readFileSync;
