import { probeDemo } from '../packages/ingest/src/demo-probe.ts';
import { runPassA } from '../packages/ingest/src/pass-a.ts';

const path = process.argv[2];
if (!path) {
  console.error('uso: npx tsx scripts/probe-demo.mjs <caminho.dem>');
  process.exit(1);
}

const probe = probeDemo(path);
console.log('--- sondagem ---');
console.log(JSON.stringify(probe, null, 2));

if (probe.isPov) {
  console.log('\nREJEITADA como POV:', probe.povReason);
}

console.log('\n--- Pass A ---');
const passA = runPassA(path);
const rounds = passA.segmentation.rounds;
const live = rounds.filter((r) => r.phase === 'live');
console.log('rounds totais:', rounds.length, '| live:', live.length);
console.log('fases:', JSON.stringify(
  rounds.reduce((acc, r) => ({ ...acc, [r.phase]: (acc[r.phase] ?? 0) + 1 }), {}),
));
console.log('matchStartTick:', passA.segmentation.matchStartTick,
  '| restarts:', passA.segmentation.restartCount,
  '| knife:', passA.segmentation.knifeRoundTick,
  '| lastTick:', passA.lastTick);
console.log('primeiros rounds:', JSON.stringify(rounds.slice(0, 5), null, 1));
