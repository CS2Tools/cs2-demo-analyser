import { statSync } from 'node:fs';
import { basename } from 'node:path';
import {
  listGameEvents,
  parseEvents,
  parseGrenades,
  parseHeader,
  parsePlayerInfo,
  parseTicks,
} from '@laihoe/demoparser2';
import { TickClock } from '@cs2/core';
import { hasRadar, normalizeMapName } from '@cs2/radar';

const MB = 1024 * 1024;
const RSS_GATE_MB = 700;

let peakRss = 0;
const sampler = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 50);
sampler.unref();
const sampleRss = () => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
};

interface PassReport {
  name: string;
  ms: number;
  rows: number;
  rssAfterMb: number;
}
const report: PassReport[] = [];

function pass<T>(name: string, fn: () => T, countRows: (r: T) => number): T {
  const t0 = performance.now();
  const result = fn();
  sampleRss();
  report.push({
    name,
    ms: Math.round(performance.now() - t0),
    rows: countRows(result),
    rssAfterMb: Math.round(process.memoryUsage().rss / MB),
  });
  return result;
}

const fmt = new Intl.NumberFormat('pt-BR');
const log = (s = '') => process.stdout.write(`${s}\n`);
const rule = (c = '=') => log(`  ${c.repeat(74)}`);

type Row = Record<string, unknown>;

const demoPathArg = process.argv[2];
if (!demoPathArg) {
  log('uso: npm run spike:parse -- "<caminho da demo>"');
  process.exit(1);
}
const demoPath: string = demoPathArg;

const fileSizeMb = statSync(demoPath).size / MB;
log('');
rule();
log(`  SPIKE DO PARSER — ${basename(demoPath)}`);
log(`  ${fileSizeMb.toFixed(1)} MB`);
rule();

const header = pass('header', () => parseHeader(demoPath) as Row, () => 1);
const players = pass('playerInfo', () => parsePlayerInfo(demoPath) as Row[], (r) => r.length);

const mapRaw = String(header['map_name'] ?? '');
const mapName = normalizeMapName(mapRaw);
const serverName = String(header['server_name'] ?? '');
const clientName = String(header['client_name'] ?? '');

function inferTickRate(a: number, b: number): number {
  const probe = parseTicks(demoPath, ['game_time'], [a, b]) as Row[];
  const ra = probe.find((r) => Number(r['tick']) === a);
  const rb = probe.find((r) => Number(r['tick']) === b);
  const ta = Number(ra?.['game_time']);
  const tb = Number(rb?.['game_time']);
  if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb === ta) return 64;
  const raw = (b - a) / (tb - ta);

  return Math.abs(raw - 128) < Math.abs(raw - 64) ? 128 : 64;
}

function detectSource(server: string): string {
  const s = server.toLowerCase();
  if (s.includes('gamersclub')) return 'gamers_club';
  if (s.includes('faceit')) return 'faceit';
  if (s.includes('valve') || s.includes('counter-strike')) return 'valve_mm';
  return 'unknown';
}

const humanPlayers = players.filter((p) => p['is_fake_player'] !== true);
const looksLikeGotv = /sourcetv|gotv/i.test(clientName);
const isPov = !looksLikeGotv || humanPlayers.length < 10;

const declared = new Set(listGameEvents(demoPath) as string[]);
const WANTED = [
  'round_start',
  'round_freeze_end',
  'round_end',
  'round_officially_ended',
  'round_announce_match_start',
  'player_death',
  'player_hurt',
  'weapon_fire',
  'player_blind',
  'flashbang_detonate',
  'hegrenade_detonate',
  'smokegrenade_detonate',
  'smokegrenade_expired',
  'inferno_startburn',
  'inferno_expire',
  'bomb_planted',
  'bomb_defused',
  'bomb_exploded',
  'bomb_begindefuse',
  'round_mvp',
  'item_pickup',
];

const events = pass(
  'A: eventos',
  () => parseEvents(demoPath, WANTED, [], ['total_rounds_played', 'is_bomb_planted']) as Row[],
  (r) => r.length,
);

const byType = new Map<string, Row[]>();
for (const ev of events) {
  const t = String(ev['event_name']);
  let bucket = byType.get(t);
  if (!bucket) byType.set(t, (bucket = []));
  bucket.push(ev);
}

const tickOf = (e: Row) => Number(e['tick']);
const lastTick = events.reduce((m, e) => Math.max(m, tickOf(e)), 0);

const tickRate = inferTickRate(Math.floor(lastTick * 0.2), Math.floor(lastTick * 0.8));
const clock = new TickClock(tickRate);

log('');
log('  CABECALHO');
log(`    mapa              ${mapRaw}${mapRaw !== mapName ? ` -> ${mapName}` : ''}`);
log(`    radar vendorizado ${hasRadar(mapName) ? 'sim' : 'NAO — visualizador 2D bloqueado'}`);
log(`    servidor          ${serverName}`);
log(`    origem            ${detectSource(serverName)}`);
log(`    gravacao          ${clientName}`);
log(`    tipo              ${isPov ? 'POV — SERIA RECUSADA' : 'GOTV'}`);
log(`    jogadores humanos ${humanPlayers.length}`);
log(`    tick rate         ${tickRate} (inferido de game_time)`);
log(`    ultimo tick       ${fmt.format(lastTick)}  (${clock.formatClock(lastTick)})`);

log('');
log(`  EVENTOS  (listGameEvents declara ${declared.size}; pedimos ${WANTED.length})`);
for (const name of WANTED) {
  const n = byType.get(name)?.length ?? 0;
  if (n > 0) log(`    ${name.padEnd(28)}${fmt.format(n).padStart(9)}`);
}

const matchStarts = (byType.get('round_announce_match_start') ?? []).map(tickOf);
const freezeEnds = (byType.get('round_freeze_end') ?? []).map(tickOf);

const matchStartTick = matchStarts.length ? Math.max(...matchStarts) : (freezeEnds[0] ?? 0);

const realRoundEnds = (byType.get('round_end') ?? []).filter(
  (e) => e['winner'] != null && tickOf(e) > 1,
);
const liveRoundEnds = realRoundEnds.filter((e) => tickOf(e) > matchStartTick);
const preMatchRoundEnds = realRoundEnds.filter((e) => tickOf(e) <= matchStartTick);

log('');
log('  SEGMENTACAO DE ROUNDS');
log(`    round_announce_match_start  ${matchStarts.length}x em ${matchStarts.map((t) => fmt.format(t)).join(', ') || '(nenhum)'}`);
log(`    matchStartTick              ${fmt.format(matchStartTick)}  (${clock.formatClock(matchStartTick)})`);
log(`    rounds reais na demo        ${realRoundEnds.length}`);
log(`    descartados (pre-partida)   ${preMatchRoundEnds.length}  ${preMatchRoundEnds.length ? '<- round faca / aquecimento' : ''}`);
log(`    rounds LIVE                 ${liveRoundEnds.length}`);

const sideWins = { CT: 0, T: 0 };
for (const e of liveRoundEnds) {
  const w = String(e['winner']);
  if (w === 'CT' || w === 'T') sideWins[w]++;
}
log(`    vitorias por lado           CT ${sideWins.CT} x ${sideWins.T} T  (placar por time exige troca de lado)`);

let grenadeRows = 0;
pass(
  'B: granadas (so projeteis)',
  () => {
    const rows = parseGrenades(demoPath, null, false) as Row[];
    grenadeRows = rows.length;
    return null;
  },
  () => grenadeRows,
);

const REPLAY_HZ = 8;
const stride = clock.strideForHz(REPLAY_HZ);

const replayTicks: number[] = [];
for (let t = 0; t <= lastTick; t += stride) replayTicks.push(t);

const PROPS_REPLAY = [
  'X', 'Y', 'Z', 'yaw', 'pitch', 'health', 'armor_value', 'life_state',
  'flash_duration', 'is_scoped', 'active_weapon_name', 'duck_amount',
];

const CHUNK_REPLAY = 4000;
let replayRows = 0;
pass(
  `C: replay ${REPLAY_HZ}Hz (stride ${stride})`,
  () => {
    for (let i = 0; i < replayTicks.length; i += CHUNK_REPLAY) {
      const chunk = replayTicks.slice(i, i + CHUNK_REPLAY);

      const cols = parseTicks(demoPath, PROPS_REPLAY, chunk, undefined, true) as Record<
        string,
        unknown[]
      >;
      replayRows += (cols['tick'] as unknown[] | undefined)?.length ?? 0;
      sampleRss();

    }
    return null;
  },
  () => replayRows,
);

const windows: Array<[number, number]> = [];
const addWindow = (from: number, to: number) => windows.push([Math.max(0, from), to]);

for (const ev of byType.get('weapon_fire') ?? []) {
  const t = tickOf(ev);
  addWindow(t - clock.toTicksCeil(0.6), t + clock.toTicksCeil(0.15));
}
for (const ev of byType.get('player_death') ?? []) {
  addWindow(tickOf(ev) - clock.toTicksCeil(1.0), tickOf(ev));
}
for (const ev of byType.get('player_blind') ?? []) {
  const t = tickOf(ev);
  addWindow(t, t + clock.toTicksCeil(0.3));
}

windows.sort((a, b) => a[0] - b[0]);
const interest: number[] = [];
let cursor = -1;
for (const [from, to] of windows) {
  for (let t = Math.max(from, cursor + 1); t <= to; t++) interest.push(t);
  cursor = Math.max(cursor, to);
}

const PROPS_AIM = [
  'X', 'Y', 'Z', 'pitch', 'yaw', 'aim_punch_angle',
  'usercmd_viewangle_x', 'usercmd_viewangle_y',
  'velocity_X', 'velocity_Y', 'velocity_Z',
  'duck_amount', 'health', 'life_state', 'active_weapon_name', 'is_scoped',
];

const CHUNK_AIM = 3000;
let aimRows = 0;
pass(
  'D: janelas a taxa cheia',
  () => {
    for (let i = 0; i < interest.length; i += CHUNK_AIM) {
      const chunk = interest.slice(i, i + CHUNK_AIM);
      const cols = parseTicks(demoPath, PROPS_AIM, chunk, undefined, true) as Record<
        string,
        unknown[]
      >;
      aimRows += (cols['tick'] as unknown[] | undefined)?.length ?? 0;
      sampleRss();
    }
    return null;
  },
  () => aimRows,
);

const PROPS_ECON = [
  'balance', 'start_balance', 'cash_spent_this_round', 'cash_earned_this_round',
  'armor_value', 'has_helmet', 'has_defuser', 'active_weapon_name',
];

let econRows = 0;
pass(
  'E: economia',
  () => {
    econRows = (parseTicks(demoPath, PROPS_ECON, freezeEnds) as Row[]).length;
    return null;
  },
  () => econRows,
);

const native = (await import('@laihoe/demoparser2')) as unknown as Record<string, unknown>;
const voiceNote =
  typeof native['parseVoice'] === 'function'
    ? 'parseVoice disponivel — reavaliar o ADR 0003'
    : 'INDISPONIVEL: parseVoice nao existe no binario win32-x64 (ver ADR 0003)';

sampleRss();
const peakMb = Math.round(peakRss / MB);
const totalMs = report.reduce((a, p) => a + p.ms, 0);

log('');
log('  PASSES');
log(`    ${'passe'.padEnd(30)}${'tempo'.padStart(10)}${'linhas'.padStart(12)}${'RSS'.padStart(9)}`);
log(`    ${'-'.repeat(61)}`);
for (const p of report) {
  log(
    `    ${p.name.padEnd(30)}${`${fmt.format(p.ms)} ms`.padStart(10)}` +
      `${fmt.format(p.rows).padStart(12)}${`${p.rssAfterMb} MB`.padStart(9)}`,
  );
}
log(`    ${'-'.repeat(61)}`);
log(`    ${'total'.padEnd(30)}${`${fmt.format(totalMs)} ms`.padStart(10)}`);

log('');
log('  JANELAMENTO (o ganho do Pass D)');
log(`    ticks da demo               ${fmt.format(lastTick)}`);
log(`    ticks de interesse          ${fmt.format(interest.length)}`);
log(`    reducao                     ${((1 - interest.length / lastTick) * 100).toFixed(1)}%`);
log(`    blocos replay / analise     ${Math.ceil(replayTicks.length / CHUNK_REPLAY)} / ${Math.ceil(interest.length / CHUNK_AIM)}`);
log(`    granadas (linhas de path)   ${fmt.format(grenadeRows)}`);
log(`    economia (linhas)           ${fmt.format(econRows)}`);

log('');
log('  VOZ');
log(`    ${voiceNote}`);

log('');
rule();
const ok = peakMb < RSS_GATE_MB;
log(`  PICO DE RSS: ${peakMb} MB   (portao: < ${RSS_GATE_MB} MB)   ${ok ? '>> PASSOU' : '>> FALHOU'}`);
log(
  `  TEMPO TOTAL: ${(totalMs / 1000).toFixed(1)} s para ${fileSizeMb.toFixed(0)} MB` +
    `  (${(fileSizeMb / (totalMs / 1000)).toFixed(0)} MB/s)`,
);
rule();
log('');

process.exit(ok ? 0 : 1);
