import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';

const demoPath = process.argv[2];
if (!demoPath) {
  console.error('uso: npx tsx scripts/run-worker.mjs <caminho.dem>');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'cs2-worker-'));
const matchId = randomUUID();
const bulkDir = join(dir, 'bulk', matchId);
mkdirSync(bulkDir, { recursive: true });

const spec = {
  jobId: randomUUID(),
  demoPath,
  originalPath: demoPath,
  fileName: demoPath.split(/[\\/]/).pop(),
  fileSizeBytes: statSync(demoPath).size,
  sha256: 'teste',
  stagingPath: join(dir, 'staging.duckdb'),
  bulkDir,
  matchId,
  appVersion: 'probe',
  parserVersion: 'probe',
  userSteamId: null,
  poiSteamIds: [],
  schemaDir: join(process.cwd(), 'packages/db/src/schema'),
  mapsDir: join(process.cwd(), 'vendor', 'boltobserv-maps'),
  voiceExtractorDir: join(process.cwd(), 'vendor', 'csgo-voice-extractor', 'win32-x64'),
};
const jobFile = join(dir, 'job.json');
writeFileSync(jobFile, JSON.stringify(spec), 'utf8');

console.log('staging:', spec.stagingPath);
const child = spawn(
  process.execPath,
  [...process.execArgv, join(process.cwd(), 'packages/ingest/src/worker.ts'), jobFile],
  { stdio: ['ignore', 'inherit', 'pipe', 'ipc'] },
);

child.stderr.on('data', (d) => process.stderr.write(`[stderr] ${d}`));
child.on('message', (m) => {
  if (m.type === 'progress') {
    process.stdout.write(`\r[${m.stage}] ${Math.round(m.fraction * 100)}% ${m.message ?? ''}          `);
  } else {
    console.log('\n[msg]', JSON.stringify(m).slice(0, 2000));
  }
});
child.on('close', (code, signal) => console.log('\nsaiu com', code, signal ?? ''));
