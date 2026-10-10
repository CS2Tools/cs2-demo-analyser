import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const dirArg = process.argv[2];
if (!dirArg) {
  console.error('uso: npx tsx scripts/check-demos.mjs <pasta com .dem>');
  process.exit(1);
}

const demos = readdirSync(dirArg)
  .filter((f) => f.toLowerCase().endsWith('.dem'))
  .map((f) => join(dirArg, f));

if (demos.length === 0) {
  console.error(`nenhum .dem em ${dirArg}`);
  process.exit(1);
}

console.log(`${demos.length} demo(s) em ${dirArg}\n`);

const results = [];
for (const [i, demoPath] of demos.entries()) {
  const name = demoPath.split(/[\\/]/).pop();
  const sizeMb = Math.round(statSync(demoPath).size / 1024 / 1024);
  process.stdout.write(`[${i + 1}/${demos.length}] ${name} (${sizeMb} MB) ... `);
  const started = Date.now();
  const result = await runOne(demoPath);
  const seconds = Math.round((Date.now() - started) / 1000);
  results.push({ name, ...result, seconds });
  const r = result.roster;
  console.log(
    result.ok
      ? `ok em ${seconds}s — ${result.summary.liveRounds} rounds, ${result.summary.grenades} granadas` +
          (r ? `, ${r.players} jogadores ${r.teams}, slots ${r.slots}` +
               (r.handoffs > 0 ? `, ${r.handoffs} troca(s)` : '') +
               (r.understaffed > 0 ? `, ${r.understaffed} round(s) desfalcado(s)` : '') +
               (r.absent > 0 ? `, ${r.absent} (round, slot) fora do round` : '') : '') +
          (result.dropped.length > 0 ? `; SEM: ${result.dropped.join(', ')}` : '')
      : `FALHOU em ${seconds}s: ${result.error}`,
  );
}

console.log('\n--- resumo ---');
const bad = results.filter((r) => !r.ok);
const degraded = results.filter((r) => r.ok && r.dropped.length > 0);
console.log(`ok: ${results.length - bad.length}/${results.length}`);
for (const r of degraded) console.log(`  ! ${r.name}: sem ${r.dropped.join(', ')}`);
for (const r of bad) console.log(`  x ${r.name}: ${r.error}`);
process.exit(bad.length > 0 ? 1 : 0);

async function runOne(demoPath) {
  const dir = mkdtempSync(join(tmpdir(), 'cs2-check-'));
  const matchId = randomUUID();
  const bulkDir = join(dir, 'bulk');
  mkdirSync(bulkDir, { recursive: true });
  const spec = {
    jobId: randomUUID(),
    demoPath,
    originalPath: demoPath,
    fileName: demoPath.split(/[\\/]/).pop(),
    fileSizeBytes: statSync(demoPath).size,
    sha256: matchId,
    stagingPath: join(dir, 'staging.duckdb'),
    bulkDir,
    matchId,
    appVersion: 'check',
    parserVersion: 'check',
    userSteamId: null,
    poiSteamIds: [],
    schemaDir: join(process.cwd(), 'packages/db/src/schema'),
    mapsDir: join(process.cwd(), 'vendor', 'boltobserv-maps'),
    voiceExtractorDir: join(process.cwd(), 'vendor', 'csgo-voice-extractor', 'win32-x64'),
  };
  const jobFile = join(dir, 'job.json');
  writeFileSync(jobFile, JSON.stringify(spec), 'utf8');

  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--max-old-space-size=4096',
        join(process.cwd(), 'packages/ingest/src/worker.ts'), jobFile],
      { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
    );
    let summary = null;
    let error = null;
    const dropped = new Set();
    child.stderr.on('data', (d) => {
      const text = String(d);

      const m = text.match(/esta demo nao entregou: ([^\n]+)/);
      if (m) for (const p of m[1].split(',')) dropped.add(p.trim().replace(/ —.*/, ''));
    });
    child.on('message', (m) => {
      if (m.type === 'done') summary = m.summary;
      if (m.type === 'error') error = m.message;
      if (m.type === 'rejected') error = `rejeitada (${m.reason}): ${m.message}`;
    });
    child.on('close', (code) => {
      if (!summary) {
        limpar(dir);
        resolve({ ok: false, error: error ?? `worker saiu com codigo ${code}`, dropped: [...dropped] });
        return;
      }

      inspectRoster(spec.stagingPath, matchId, bulkDir)
        .then((roster) => {
          limpar(dir);
          resolve({ ok: roster.ok, summary, dropped: [...dropped], roster, error: roster.error });
        })
        .catch((err) => {
          limpar(dir);
          resolve({ ok: false, error: `elenco: ${err.message}`, dropped: [...dropped] });
        });
    });
    child.on('error', (err) => resolve({ ok: false, error: err.message, dropped: [] }));
  });
}

function limpar(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {

  }
}

async function inspectRoster(dbPath, matchId, bulkDir) {
  const { DuckDb } = await import('../packages/db/src/index.ts');
  const { ensureRoster } = await import('../packages/api/src/roster-queries.ts');
  const db = await DuckDb.open(dbPath);
  const problemas = [];
  try {
    await ensureRoster(db);

    const jogadores = await db.query(
      'SELECT steam_id, team_slot FROM player_match WHERE match_id = ?', [matchId],
    );
    const semTime = jogadores.filter((p) => p.team_slot !== 'A' && p.team_slot !== 'B');
    if (semTime.length > 0) problemas.push(`${semTime.length} jogador(es) sem time`);

    const a = jogadores.filter((p) => p.team_slot === 'A').length;
    const b = jogadores.filter((p) => p.team_slot === 'B').length;
    if (a < 5 || b < 5) problemas.push(`elencos de ${a} e ${b}`);

    const placar = await db.queryOne(
      `SELECT m.score_a + m.score_b AS soma,
              (SELECT COUNT(*) FROM rounds WHERE match_id = m.match_id AND phase = 'live') AS live
         FROM matches m WHERE m.match_id = ?`, [matchId],
    );
    if (Number(placar.soma) !== Number(placar.live)) {
      problemas.push(`placar ${placar.soma} x ${placar.live} rounds live`);
    }

    const vazios = await db.query(
      `SELECT round_num, roster_ct, roster_t FROM rounds
        WHERE match_id = ? AND phase = 'live' AND (roster_ct = 0 OR roster_t = 0)`,
      [matchId],
    );
    if (vazios.length > 0) {
      problemas.push(
        `lado vazio: ${vazios.map((r) => `r${r.round_num}=${r.roster_ct}v${r.roster_t}`).join(' ')}`,
      );
    }

    const fantasmas = await db.query(
      `SELECT k.round_num, COUNT(DISTINCT q.sid)::INTEGER AS n
         FROM (SELECT round_num, attacker_steam_id AS sid FROM kills
                WHERE match_id = ? AND round_num IS NOT NULL AND attacker_steam_id IS NOT NULL
               UNION
               SELECT round_num, victim_steam_id AS sid FROM kills
                WHERE match_id = ? AND round_num IS NOT NULL AND victim_steam_id IS NOT NULL) q
         JOIN rounds k ON k.match_id = ? AND k.round_num = q.round_num AND k.phase = 'live'
        WHERE NOT EXISTS (
          SELECT 1 FROM player_round_stats prs
           WHERE prs.match_id = ? AND prs.round_num = q.round_num
             AND prs.steam_id = q.sid AND prs.side IS NOT NULL)
        GROUP BY k.round_num`,
      [matchId, matchId, matchId, matchId],
    );
    if (fantasmas.length > 0) {
      problemas.push(
        `jogou mas nao esta no elenco do round: ${fantasmas
          .map((r) => `r${r.round_num}(${r.n})`)
          .join(' ')}`,
      );
    }

    const semRound = await db.queryOne(
      `SELECT (SELECT COUNT(*) FROM player_round_stats
                WHERE match_id = ? AND side IS NULL) AS prs,
              (SELECT COUNT(*) FROM economy
                WHERE match_id = ? AND side IS NULL) AS econ`,
      [matchId, matchId],
    );
    if (Number(semRound.prs) > 0 || Number(semRound.econ) > 0) {
      problemas.push(
        `linha de round sem ter jogado o round: ${semRound.prs} em player_round_stats, ` +
          `${semRound.econ} em economy`,
      );
    }

    const slots = await db.queryOne(
      'SELECT replay_slot_count AS n FROM matches WHERE match_id = ?', [matchId],
    );
    const nSlots = slots.n === null ? null : Number(slots.n);
    if (nSlots !== null && nSlots < jogadores.length) {
      problemas.push(`replay com ${nSlots} slots para ${jogadores.length} jogadores`);
    }

    const parquet = join(bulkDir, matchId, 'ticks_replay.parquet').replaceAll('\\', '/');
    let ausentes = 0;
    if (existsSync(parquet)) {
      const perdidos = await db.query(
        `WITH presenca AS (
           SELECT round_num, slot, any_value(steam_id) AS steam_id,
                  COUNT(*) FILTER (WHERE side IN (2, 3)) AS validos
             FROM read_parquet(?)
            WHERE match_id = ?
            GROUP BY round_num, slot
         )
         SELECT p.round_num, p.slot, p.steam_id,
                (prs.steam_id IS NOT NULL) AS jogou
           FROM presenca p
           LEFT JOIN player_round_stats prs
             ON prs.match_id = ? AND prs.round_num = p.round_num
            AND prs.steam_id = p.steam_id AND prs.side IS NOT NULL
          WHERE p.validos = 0`,
        [parquet, matchId, matchId],
      );
      ausentes = perdidos.length;
      const jogaram = perdidos.filter((r) => r.jogou);
      if (jogaram.length > 0) {
        problemas.push(
          `sem lado no replay, mas jogou o round: ${jogaram
            .slice(0, 5)
            .map((r) => `r${r.round_num}/slot${r.slot}`)
            .join(' ')}`,
        );
      }
    }

    const trocas = await db.query(
      'SELECT out_steam_id, in_steam_id, gap_rounds FROM roster_handoffs WHERE match_id = ?',
      [matchId],
    );
    const auto = trocas.filter(
      (h) => h.out_steam_id !== null && h.out_steam_id === h.in_steam_id,
    );
    if (auto.length > 0) problemas.push(`${auto.length} troca(s) pareando alguem consigo mesmo`);
    if (jogadores.length > 10 && trocas.length === 0) {
      problemas.push(`${jogadores.length} jogadores e nenhuma troca registrada`);
    }

    const desfalcados = await db.queryOne(
      `SELECT COUNT(*) AS n FROM rounds
        WHERE match_id = ? AND phase = 'live' AND roster_ct <> roster_t`, [matchId],
    );

    return {
      ok: problemas.length === 0,
      error: problemas.join('; '),
      players: jogadores.length,
      teams: `${a}v${b}`,
      slots: nSlots,
      handoffs: trocas.length,
      understaffed: Number(desfalcados.n),

      absent: ausentes,
    };
  } finally {
    await db.close();
  }
}
