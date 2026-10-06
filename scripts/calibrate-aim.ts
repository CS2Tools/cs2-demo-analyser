import { statSync } from 'node:fs';
import { basename } from 'node:path';
import { parseEvents, parseTicks } from '@laihoe/demoparser2';
import {
  aimErrorToHead,
  CALIBRATION_MEDIAN_DEG,
  CALIBRATION_P90_DEG,
  describe as describeDist,
  passesCalibration,
  type AimSample,
  type Distribution,
  type PunchModel,
} from '@cs2/core';

type Row = Record<string, unknown>;

const EYE_ANGLES = 'CCSPlayerPawn.m_angEyeAngles';
const VIEW_PUNCH = 'CCSPlayerPawn.CCSPlayer_CameraServices.m_vecCsViewPunchAngle';

const log = (s = '') => process.stdout.write(`${s}\n`);
const rule = () => log(`  ${'='.repeat(74)}`);

const demoPath = process.argv[2];
if (!demoPath) {
  log('uso: npm run calibrate:aim -- "<caminho da demo>"');
  process.exit(1);
}
statSync(demoPath);

log('');
rule();
log(`  CALIBRACAO DA MIRA — ${basename(demoPath)}`);
rule();

const deaths = parseEvents(demoPath, ['player_death'], [], []) as Row[];

const MIN_DISTANCE_M = 6;

const headshots = deaths.filter((d) => d['headshot'] === true);
const filtros: { nome: string; rejeita: (d: Row) => boolean }[] = [
  { nome: 'wallbang', rejeita: (d) => Number(d['penetrated'] ?? 0) !== 0 },
  { nome: 'atirador cego', rejeita: (d) => d['attackerblind'] === true },
  { nome: 'atraves de fumaca', rejeita: (d) => d['thrusmoke'] === true },
  { nome: `perto demais (< ${MIN_DISTANCE_M}m)`, rejeita: (d) => Number(d['distance'] ?? 0) < MIN_DISTANCE_M },
  { nome: 'faca', rejeita: (d) => String(d['weapon'] ?? '').includes('knife') },
  {
    nome: 'sem atirador ou vitima',
    rejeita: (d) =>
      d['attacker_steamid'] == null ||
      d['user_steamid'] == null ||
      d['attacker_steamid'] === d['user_steamid'],
  },
];

const clean = headshots.filter((d) => !filtros.some((f) => f.rejeita(d)));

log('');
log(`  headshots na demo          ${headshots.length}`);
for (const f of filtros) {
  const n = headshots.filter((d) => f.rejeita(d)).length;
  if (n > 0) log(`    descartados por ${f.nome.padEnd(26)} ${n}`);
}
log(`  limpos para calibrar       ${clean.length}`);

if (clean.length < 5) {
  log('');
  log('  Amostra pequena demais para calibrar. Use uma demo com mais headshots.');
  process.exit(1);
}

const TICK_OFFSETS = [0, -1, -2];

const ticks = [
  ...new Set(clean.flatMap((d) => TICK_OFFSETS.map((o) => Number(d['tick']) + o))),
].sort((a, b) => a - b);
const props = ['X', 'Y', 'Z', 'duck_amount', 'usercmd_viewangle_x', 'usercmd_viewangle_y',
  EYE_ANGLES, VIEW_PUNCH];

const rows = parseTicks(demoPath, props, ticks) as Row[];

const state = new Map<string, Row>();
for (const r of rows) state.set(`${String(r['tick'])}|${String(r['steamid'])}`, r);

const vec = (v: unknown, i: number): number => {
  if (Array.isArray(v)) {
    const n = Number(v[i]);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

function buildSamples(tickOffset: number): AimSample[] {
  const out: AimSample[] = [];
  for (const d of clean) {
    const tick = String(Number(d['tick']) + tickOffset);
    const attacker = state.get(`${tick}|${String(d['attacker_steamid'])}`);
    const victim = state.get(`${tick}|${String(d['user_steamid'])}`);
    if (!attacker || !victim) continue;
    out.push(sampleFrom(attacker, victim));
  }
  return out;
}

function sampleFrom(attacker: Row, victim: Row): AimSample {
  return {
    shooter: { x: Number(attacker['X']), y: Number(attacker['Y']), z: Number(attacker['Z']) },
    shooterDuck: Number(attacker['duck_amount'] ?? 0),
    eyePitch: vec(attacker[EYE_ANGLES], 0),
    eyeYaw: vec(attacker[EYE_ANGLES], 1),
    punchPitch: vec(attacker[VIEW_PUNCH], 0),
    punchYaw: vec(attacker[VIEW_PUNCH], 1),
    cmdPitch: attacker['usercmd_viewangle_x'] == null ? null : Number(attacker['usercmd_viewangle_x']),
    cmdYaw: attacker['usercmd_viewangle_y'] == null ? null : Number(attacker['usercmd_viewangle_y']),
    victim: { x: Number(victim['X']), y: Number(victim['Y']), z: Number(victim['Z']) },
    victimDuck: Number(victim['duck_amount'] ?? 0),
  };
}

const samples = buildSamples(0);
log(`  com estado nos dois lados  ${samples.length}`);

const punchMagnitude = describeDist(
  samples.map((s) => Math.hypot(s.punchPitch, s.punchYaw)),
);
log('');
log(`  tranco de recuo no momento do tiro: mediana ${punchMagnitude.median.toFixed(3)}\u00B0, ` +
    `p90 ${punchMagnitude.p90.toFixed(3)}\u00B0`);
if (punchMagnitude.p90 < 0.05) {
  log('  (recuo praticamente nulo nesta amostra — os modelos tendem a empatar)');
}

const MODELS: { model: PunchModel; label: string }[] = [
  { model: 'none', label: 'visao (recuo incluso)' },
  { model: 'add', label: 'visao + tranco' },
  { model: 'subtract', label: 'visao - tranco' },
  { model: 'usercmd', label: 'comando do cliente' },
];

const HEAD_OFFSETS = [-6, -4, -2, 0, 2, 4];

interface Candidate {
  model: PunchModel;
  label: string;
  tickOffset: number;
  headOffset: number;
  dist: Distribution;
  bias: number;
}

const candidates: Candidate[] = [];

for (const tickOffset of TICK_OFFSETS) {
  const built = buildSamples(tickOffset);
  if (built.length === 0) continue;

  for (const { model, label } of MODELS) {
    for (const headOffset of HEAD_OFFSETS) {
      const shifted = built.map((s) => ({
        ...s,
        victim: { ...s.victim, z: s.victim.z + headOffset },
      }));
      const errors = shifted.map((s) => aimErrorToHead(s, model));
      const pitchErrors = errors.map((e) => e.pitchDeg);
      candidates.push({
        model,
        label,
        tickOffset,
        headOffset,
        dist: describeDist(errors.map((e) => e.totalDeg)),
        bias: pitchErrors.reduce((a, b) => a + b, 0) / pitchErrors.length,
      });
    }
  }
}

const passing = candidates.filter((c) => passesCalibration(c.dist));
if (passing.length > 0) {
  passing.sort((a, b) => a.dist.median - b.dist.median);
  candidates.length = 0;
  candidates.push(...passing, ...candidates);
} else {
  candidates.sort((a, b) => a.dist.p90 - b.dist.p90);
}

log('');
log(
  passing.length > 0
    ? `  MELHORES COMBINACOES (${passing.length} passam nos dois limites; ordenadas pela mediana)`
    : '  NENHUMA COMBINACAO PASSA — ordenadas pela cauda, para diagnostico',
);
log(`    ${'modelo'.padEnd(24)}${'tick'.padStart(6)}${'cabeca'.padStart(8)}` +
    `${'mediana'.padStart(10)}${'p90'.padStart(9)}${'<1°'.padStart(7)}${'vies'.padStart(9)}`);
log(`    ${'-'.repeat(73)}`);
for (const c of candidates.slice(0, 10)) {
  log(
    `    ${c.label.padEnd(24)}${String(c.tickOffset).padStart(6)}` +
      `${`${c.headOffset >= 0 ? '+' : ''}${c.headOffset}u`.padStart(8)}` +
      `${`${c.dist.median.toFixed(3)}°`.padStart(10)}` +
      `${`${c.dist.p90.toFixed(2)}°`.padStart(9)}` +
      `${`${(c.dist.under1deg * 100).toFixed(0)}%`.padStart(7)}` +
      `${`${c.bias >= 0 ? '+' : ''}${c.bias.toFixed(2)}°`.padStart(9)}`,
  );
}

const best = candidates[0]!;
const ok = passesCalibration(best.dist);

log('');
rule();
log(`  VENCEDOR`);
log(`    modelo de recuo          ${best.label}  (${best.model})`);
log(`    tick do disparo          evento ${best.tickOffset === 0 ? 'no proprio tick' : `${best.tickOffset} tick(s)`}`);
log(`    altura da cabeca         olho ${best.headOffset >= 0 ? '+' : ''}${best.headOffset}u`);
log(`    mediana ${best.dist.median.toFixed(3)}° (limite ${CALIBRATION_MEDIAN_DEG}°)   ` +
    `p90 ${best.dist.p90.toFixed(2)}° (limite ${CALIBRATION_P90_DEG}°)   ` +
    `vies ${best.bias >= 0 ? '+' : ''}${best.bias.toFixed(3)}°`);
log('');
log(`  ${ok ? '>> PORTAO PASSOU' : '>> PORTAO FALHOU — nao construa metrica de mira em cima disto'}`);
rule();
log('');

process.exit(ok ? 0 : 1);
