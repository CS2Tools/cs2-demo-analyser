import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DuckDb, migrate, setSchemaDir, toSqlTimestamp, type SqlValue } from '@cs2/db';
import { measureC4Timer, plantForRound, siteFromPlace, TickClock, type Side } from '@cs2/core';
import { inferTickRate, probeDemo } from './demo-probe.js';
import { parseMapMeta } from '@cs2/radar';
import { assignTeams, readClanNames, readSidesPerRound, runPassA } from './pass-a.js';
import { runPassB } from './pass-b.js';
import { mergeChat } from './chat.js';
import { resolvePlayedAt } from './played-at.js';
import { HUD_PROPS, runPassC } from './pass-c.js';
import { runPassD } from './pass-d.js';
import { runPassE } from './pass-e.js';
import { runPassF } from './pass-f.js';
import { runPassU } from './pass-u.js';
import { readRoundTimers } from './round-timers.js';
import { runPassV, VOICE_COLUMNS, voiceExtractorAvailable } from './pass-v.js';
import type { IngestStage } from '@cs2/contract';
import type { IngestSummary, JobSpec, ValidationResult, WorkerMessage } from './types.js';

type Row = Record<string, unknown>;

const MB = 1024 * 1024;
let peakRss = 0;
const rssTimer = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 100);
rssTimer.unref();

function send(msg: WorkerMessage): void {
  process.send?.(msg);
}

function progress(stage: IngestStage, fraction: number, message?: string): void {
  send({ type: 'progress', stage, fraction, message });
}

export const REPLAY_DATA_VERSION = 6;

export const PASS_A_TABLES = [
  'matches',
  'player_match',
  'rounds',
  'kills',
  'damages',
  'weapon_fires',
  'blinds',
  'bomb_events',
  'chat_messages',
  'grenades',
  'grenade_detonations',
  'economy',
  'engagements',
  'heatmap_bins',
  'player_round_stats',
  'voice_segments',
  'utility_throws',
] as const;

async function main(): Promise<void> {
  const jobFile = process.argv[2];
  if (!jobFile) throw new Error('worker exige o caminho do arquivo de job');
  const job = JSON.parse(readFileSync(jobFile, 'utf8')) as JobSpec;

  const startedAt = Date.now();

  progress('probe', 0);
  const probe = probeDemo(job.demoPath);

  if (probe.isPov) {
    send({
      type: 'rejected',
      reason: 'pov',
      message:
        `Este parece ser um demo POV (gravado por um jogador): ${probe.povReason}. ` +
        'O analisador precisa de um demo GOTV, gravado pelo servidor, porque um POV ' +
        'so registra o que aquele jogador via.',
    });
    return;
  }
  progress('probe', 1);

  progress('events', 0);
  const passA = runPassA(job.demoPath);
  progress('events', 0.7);

  const tickRate = inferTickRate(job.demoPath, passA.lastTick);
  const clock = new TickClock(tickRate);

  const { sideByRound, colorOf } = readSidesPerRound(job.demoPath, passA.segmentation);
  progress('events', 1);

  progress('derive', 0);

  const playerNames = new Map(probe.players.map((p) => [p.steamId, p.name]));

  const firstLive = passA.segmentation.rounds.find((r) => r.phase === 'live');
  const clanTick = firstLive?.freezeEndTick ?? firstLive?.startTick ?? null;
  const clanNames = clanTick === null ? new Map<string, string>() : readClanNames(job.demoPath, clanTick);

  const teams = assignTeams(
    passA.segmentation, sideByRound, playerNames, job.fileName, clanNames,
  );

  const live = passA.segmentation.rounds.filter((r) => r.phase === 'live' && r.roundNum !== null);

  const ranges: { roundNum: number; from: number; to: number }[] = [];
  let previous = passA.segmentation.matchStartTick;
  for (const r of live) {
    ranges.push({ roundNum: r.roundNum!, from: previous, to: r.endTick });
    previous = r.endTick;
  }

  const roundOf = (tick: number): number | null => {
    for (const r of ranges) if (tick > r.from && tick <= r.to) return r.roundNum;
    return null;
  };

  const sideOf = (roundNum: number | null, steamId: string): Side | null =>
    roundNum === null ? null : (sideByRound.get(roundNum)?.get(steamId) ?? null);

  if (job.schemaDir) setSchemaDir(job.schemaDir);
  const db = await DuckDb.open(job.stagingPath);
  await migrate(db);

  const ev = (name: string): Row[] => passA.events.get(name) ?? [];
  const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (v: unknown): boolean => v === true;

  let id = 0;
  const nextId = () => ++id;

  const plants = ev('bomb_planted');
  const defuses = ev('bomb_defused');
  const explodes = ev('bomb_exploded');
  const firstTickIn = (rows: Row[], roundNum: number): number | null => {
    for (const r of rows) if (roundOf(Number(r['tick'])) === roundNum) return Number(r['tick']);
    return null;
  };

  const roundRows: SqlValue[][] = [];
  let ctScore = 0;
  let tScore = 0;
  let scoreA = 0;
  let scoreB = 0;
  for (const r of passA.segmentation.rounds) {
    const winnerTeam = r.roundNum === null ? undefined : teams.winnerByRound.get(r.roundNum);
    if (r.roundNum !== null && r.winnerSide === 'CT') ctScore++;
    if (r.roundNum !== null && r.winnerSide === 'T') tScore++;
    if (winnerTeam === 'A') scoreA++;
    if (winnerTeam === 'B') scoreB++;
    roundRows.push([
      job.matchId,

      r.roundNum ?? -(roundRows.length + 1),
      r.gameRoundNum,
      r.phase,
      r.startTick,
      r.freezeEndTick,
      r.endTick,
      r.officialEndTick,
      r.roundNum === null ? null : firstTickIn(plants, r.roundNum),
      null,
      r.roundNum === null ? null : firstTickIn(defuses, r.roundNum),
      r.roundNum === null ? null : firstTickIn(explodes, r.roundNum),
      r.winnerSide,
      r.winReason,
      r.roundNum === null ? null : ctScore,
      r.roundNum === null ? null : tScore,
      null, null, null, null,
      r.isOvertime,
      r.half,

      r.roundNum === null ? null : scoreA,
      r.roundNum === null ? null : scoreB,
      winnerTeam ?? null,
    ]);
  }
  await db.bulkInsert(
    'rounds',
    [
      'match_id', 'round_num', 'game_round_num', 'phase',
      'start_tick', 'freeze_end_tick', 'end_tick', 'official_end_tick',
      'bomb_plant_tick', 'plant_site', 'bomb_defuse_tick', 'bomb_explode_tick',
      'winner_side', 'win_reason', 'ct_score_after', 't_score_after',
      'ct_equip_value', 't_equip_value', 'ct_buy_type', 't_buy_type',
      'is_overtime', 'half',
      'score_a_after', 'score_b_after', 'winner_team',
    ],
    roundRows,
  );
  progress('derive', 0.2);

  interface Agg {
    kills: number; deaths: number; assists: number; headshots: number; damage: number;
    utilityDamage: number; enemiesFlashed: number; teammatesFlashed: number; roundsPlayed: Set<number>;
  }
  const agg = new Map<string, Agg>();
  const aggOf = (steamId: string): Agg => {
    let a = agg.get(steamId);
    if (!a) {
      agg.set(steamId, (a = {
        kills: 0, deaths: 0, assists: 0, headshots: 0, damage: 0,
        utilityDamage: 0, enemiesFlashed: 0, teammatesFlashed: 0, roundsPlayed: new Set(),
      }));
    }
    return a;
  };

  const killRows: SqlValue[][] = [];
  for (const e of ev('player_death')) {
    const tick = Number(e['tick']);
    const roundNum = roundOf(tick);
    const attacker = str(e['attacker_steamid']);
    const victim = str(e['user_steamid']);
    const assister = str(e['assister_steamid']);

    if (roundNum !== null) {
      if (attacker && attacker !== victim) {
        const a = aggOf(attacker);
        a.kills++;
        if (bool(e['headshot'])) a.headshots++;
      }
      if (victim) aggOf(victim).deaths++;
      if (assister) aggOf(assister).assists++;
    }

    killRows.push([
      nextId(), job.matchId, roundNum, tick,
      attacker, victim, assister,
      sideOf(roundNum, attacker ?? ''), sideOf(roundNum, victim ?? ''),
      str(e['weapon']), bool(e['headshot']), num(e['penetrated']),
      bool(e['noscope']), bool(e['attackerblind']), bool(e['thrusmoke']),
      bool(e['attackerinair']), num(e['distance']),
      null, null, null, null, null, null,
      null, null, null, null, null, null,
      bool(e['assistedflash']),
    ]);
  }
  await db.bulkInsert(
    'kills',
    [
      'kill_id', 'match_id', 'round_num', 'tick',
      'attacker_steam_id', 'victim_steam_id', 'assister_steam_id',
      'attacker_side', 'victim_side',
      'weapon', 'headshot', 'penetrated', 'noscope', 'attacker_blind',
      'thru_smoke', 'attacker_in_air', 'distance',
      'attacker_x', 'attacker_y', 'attacker_z', 'victim_x', 'victim_y', 'victim_z',
      'is_first_kill_of_round', 'is_entry', 'is_trade_kill', 'traded_kill_id',
      'death_was_traded', 'traded_by_kill_id',
      'assisted_flash',
    ],
    killRows,
  );
  progress('derive', 0.4);

  const UTILITY = new Set(['hegrenade', 'molotov', 'inferno', 'incgrenade', 'flashbang', 'decoy']);
  const damageRows: SqlValue[][] = [];
  for (const e of ev('player_hurt')) {
    const tick = Number(e['tick']);
    const roundNum = roundOf(tick);
    const attacker = str(e['attacker_steamid']);
    const victim = str(e['user_steamid']);
    const weapon = str(e['weapon']) ?? '';
    const dmg = num(e['dmg_health']) ?? 0;

    const attackerSide = sideOf(roundNum, attacker ?? '');
    const victimSide = sideOf(roundNum, victim ?? '');
    const teamDamage = attackerSide !== null && attackerSide === victimSide;
    const isUtility = UTILITY.has(weapon);

    if (roundNum !== null && attacker && !teamDamage) {
      const a = aggOf(attacker);
      a.damage += dmg;
      if (isUtility) a.utilityDamage += dmg;
    }

    damageRows.push([
      nextId(), job.matchId, roundNum, tick, attacker, victim, weapon,

      dmg, num(e['dmg_armor']), str(e['hitgroup']), num(e['health']), num(e['armor']),
      isUtility, teamDamage,
    ]);
  }
  await db.bulkInsert(
    'damages',
    [
      'damage_id', 'match_id', 'round_num', 'tick', 'attacker_steam_id',
      'victim_steam_id', 'weapon', 'dmg_health', 'dmg_armor', 'hitgroup',
      'health_after', 'armor_after', 'is_utility', 'is_team_damage',
    ],
    damageRows,
  );
  progress('derive', 0.6);

  const fireRows: SqlValue[][] = ev('weapon_fire').map((e) => {
    const tick = Number(e['tick']);
    return [
      nextId(), job.matchId, roundOf(tick), tick,
      str(e['user_steamid']), str(e['weapon']),
      null, null, null, null, null, null, null, null, null,
    ];
  });
  await db.bulkInsert(
    'weapon_fires',
    [
      'fire_id', 'match_id', 'round_num', 'tick', 'steam_id', 'weapon',
      'x', 'y', 'z', 'pitch', 'yaw', 'punch_pitch', 'punch_yaw', 'is_scoped', 'speed',
    ],
    fireRows,
  );

  const blindRows: SqlValue[][] = [];
  for (const e of ev('player_blind')) {
    const tick = Number(e['tick']);
    const roundNum = roundOf(tick);
    const victim = str(e['user_steamid']);
    const thrower = str(e['attacker_steamid']);
    const teamFlash =
      sideOf(roundNum, victim ?? '') !== null &&
      sideOf(roundNum, victim ?? '') === sideOf(roundNum, thrower ?? '');

    if (roundNum !== null && thrower && victim !== thrower) {
      const a = aggOf(thrower);
      if (teamFlash) a.teammatesFlashed++;
      else a.enemiesFlashed++;
    }

    blindRows.push([
      nextId(), job.matchId, roundNum, tick, victim, thrower,
      num(e['blind_duration']), teamFlash, null, null, null,
    ]);
  }
  await db.bulkInsert(
    'blinds',
    [
      'blind_id', 'match_id', 'round_num', 'tick', 'victim_steam_id',
      'thrower_steam_id', 'blind_duration', 'is_team_flash',
      'victim_died_while_blind', 'effective', 'effectiveness_model',
    ],
    blindRows,
  );

  const bombRows: SqlValue[][] = [];
  for (const [name, type] of [
    ['bomb_planted', 'planted'],
    ['bomb_defused', 'defused'],
    ['bomb_exploded', 'exploded'],
    ['bomb_begindefuse', 'begindefuse'],
  ] as const) {
    for (const e of ev(name)) {
      const tick = Number(e['tick']);
      const place = str(e['user_last_place_name']);
      bombRows.push([
        nextId(), job.matchId, roundOf(tick), tick, type,
        str(e['user_steamid']), siteFromPlace(place), null, null, null,
        place,
        type === 'begindefuse' ? bool(e['haskit']) : null,
      ]);
    }
  }
  await db.bulkInsert(
    'bomb_events',
    ['bomb_event_id', 'match_id', 'round_num', 'tick', 'event_type', 'steam_id', 'site', 'x', 'y', 'z',
      'place', 'has_kit'],
    bombRows,
  );

  const chatRows: SqlValue[][] = mergeChat([
    ...ev('player_chat'),
    ...ev('chat_message'),
  ]).map((m) => [
    nextId(), job.matchId, m.tick, m.steamId, m.name, m.text, m.isTeamOnly,
  ]);
  await db.bulkInsert(
    'chat_messages',
    ['chat_id', 'match_id', 'tick', 'steam_id', 'name', 'text', 'is_team_only'],
    chatRows,
  );

  const windows = live.map((r) => ({
    roundNum: r.roundNum!,
    startTick: r.startTick ?? r.freezeEndTick ?? r.endTick,
    endTick: r.endTick,
    freezeEndTick: r.freezeEndTick,
  }));
  const timers = readRoundTimers(
    job.demoPath,
    windows.map((w) => ({ roundNum: w.roundNum, tick: w.freezeEndTick ?? w.startTick })),
  );
  const bombInputs = bombRows.map((b) => ({ tick: Number(b[3]), type: b[4] as 'planted' | 'defused' | 'exploded' | 'begindefuse' }));
  const c4Timer = measureC4Timer(windows, bombInputs, tickRate);
  for (const w of windows) {
    const t = timers.get(w.roundNum);

    const plant = plantForRound(
      bombRows.map((b) => ({ tick: Number(b[3]), type: b[4] as 'planted', site: b[6] as string | null })),
      w,
    );
    await db.exec(
      `UPDATE rounds SET round_time_seconds = ?, freeze_time_seconds = ?,
              plant_site = COALESCE(?, plant_site)
        WHERE match_id = ? AND round_num = ?`,
      [t?.roundTimeSeconds ?? null, t?.freezeTimeSeconds ?? null, plant?.site ?? null, job.matchId, w.roundNum],
    );
  }
  progress('derive', 0.8);

  const liveCount = passA.segmentation.liveRoundCount;
  for (const [roundNum, sides] of sideByRound) {
    for (const steamId of sides.keys()) aggOf(steamId).roundsPlayed.add(roundNum);
  }

  const poi = new Set(job.poiSteamIds);

  const teamNameOf = (steamId: string): string | null => {
    const team = teams.teamOf.get(steamId);
    if (team === 'A') return teams.nameA;
    if (team === 'B') return teams.nameB;
    return null;
  };

  const firstSideOf = (steamId: string): Side | null => {
    for (const roundNum of [...sideByRound.keys()].sort((x, y) => x - y)) {
      const side = sideByRound.get(roundNum)!.get(steamId);
      if (side) return side;
    }
    return null;
  };

  const playerRows: SqlValue[][] = probe.players.map((p) => {

    const a = aggOf(p.steamId);
    const rounds = a.roundsPlayed.size;
    return [
      job.matchId, p.steamId, p.name, null,
      teamNameOf(p.steamId),

      teams.teamOf.get(p.steamId) ?? null,
      colorOf.get(p.steamId) ?? null,
      firstSideOf(p.steamId),
      p.steamId === job.userSteamId,
      poi.has(p.steamId),
      rounds, a.kills, a.deaths, a.assists, a.headshots, a.damage,
      rounds > 0 ? a.damage / rounds : null,

      0, null,
      0, 0, 0, 0, 0, 0, 0,
      a.utilityDamage, a.enemiesFlashed, a.teammatesFlashed,
    ];
  });
  await db.bulkInsert(
    'player_match',
    [
      'match_id', 'steam_id', 'name', 'user_id', 'team_name', 'team_slot',
      'team_color', 'starting_side',
      'is_user', 'is_poi', 'rounds_played', 'kills', 'deaths', 'assists',
      'headshots', 'damage_total', 'adr', 'kast_rounds', 'kast_pct',
      'opening_kills', 'opening_deaths', 'trade_kills', 'traded_deaths',
      'clutches_won', 'clutches_tried', 'mvps',
      'utility_damage', 'enemies_flashed', 'teammates_flashed',
    ],
    playerRows,
  );

  const validation = validate(passA.segmentation, teams, killRows.length, agg, sideByRound);

  const playedAt = resolvePlayedAt(
    job.fileName,
    job.originalMtimeMs === null ? null : new Date(job.originalMtimeMs),
  );

  await db.bulkInsert(
    'matches',
    [
      'match_id', 'demo_sha256', 'file_name', 'file_path', 'file_size_bytes',
      'source', 'source_confidence', 'server_name', 'client_name',
      'map_name', 'map_raw', 'has_radar',
      'tick_rate', 'tick_rate_source', 'last_tick', 'duration_seconds',
      'is_pov', 'has_voice',
      'match_start_tick', 'restart_count', 'knife_round_tick',
      'team_a_name', 'team_b_name', 'score_a', 'score_b', 'rounds_played', 'overtime',
      'played_at', 'played_at_source', 'ingested_at',
      'parser_version', 'app_version', 'schema_version',
      'ingest_duration_ms', 'ingest_peak_rss_mb', 'bulk_state', 'pinned', 'validation_json',
      'stored_demo_path', 'replay_data_version',
      'c4_timer_seconds', 'c4_timer_source',
      'demo_build', 'demo_format',
    ],
    [[
      job.matchId, job.sha256, job.fileName, job.originalPath, job.fileSizeBytes,
      probe.source, 'heuristic', probe.serverName, probe.clientName,
      probe.mapName, probe.mapRaw, probe.hasRadar,
      tickRate, 'inferred', passA.lastTick, clock.toSeconds(passA.lastTick),
      false,

      false,
      passA.segmentation.matchStartTick,
      passA.segmentation.restartCount,
      passA.segmentation.knifeRoundTick,
      teams.nameA, teams.nameB, teams.scoreA, teams.scoreB, liveCount,
      live.some((r) => r.isOvertime),

      playedAt ? toSqlTimestamp(playedAt.at) : null,
      playedAt?.source ?? null,
      toSqlTimestamp(new Date()),
      job.parserVersion, job.appVersion, 1,
      Date.now() - startedAt, Math.round(peakRss / MB),

      'pruned', false,
      JSON.stringify(validation),
      job.demoPath, REPLAY_DATA_VERSION,
      c4Timer.seconds, c4Timer.source,
      probe.build, probe.format,
    ]],
  );

  progress('derive', 1);

  progress('replay_ticks', 0);
  mkdirSync(job.bulkDir, { recursive: true });
  const passC = await runPassC({
    demoPath: job.demoPath,
    matchId: job.matchId,
    db,
    clock,
    segmentation: passA.segmentation,
    teamOf: teams.teamOf,
    parquetPath: join(job.bulkDir, 'ticks_replay.parquet'),
    onProgress: (f) => progress('replay_ticks', f),
  });

  if (passC.droppedProps.length > 0) {
    const hudMissing = HUD_PROPS.filter((prop) => passC.droppedProps.includes(prop));
    console.warn(
      `[ingest] esta demo nao entregou: ${passC.droppedProps.join(', ')}` +
        (hudMissing.length > 0 ? ' — o HUD do replay fica incompleto' : ''),
    );
    if (hudMissing.length > 0) {
      await db.exec('UPDATE matches SET replay_data_version = 1 WHERE match_id = ?', [job.matchId]);
    }
  }

  await db.exec('UPDATE matches SET replay_slot_count = ? WHERE match_id = ?', [
    passC.slotCount,
    job.matchId,
  ]);
  progress('replay_ticks', 1);

  progress('grenades', 0);
  const passB = await runPassB({
    demoPath: job.demoPath,
    matchId: job.matchId,
    db,
    segmentation: passA.segmentation,
    events: passA.events,
    stride: passC.stride,
    parquetPath: join(job.bulkDir, 'grenade_paths.parquet'),
  });
  progress('grenades', 1);

  progress('analysis_ticks', 0);
  const passD = await runPassD({
    demoPath: job.demoPath,
    matchId: job.matchId,
    db,
    clock,
    segmentation: passA.segmentation,
    events: passA.events,
    slots: passC.slots,
    lastTick: passA.lastTick,
    parquetPath: join(job.bulkDir, 'ticks_window.parquet'),
    onProgress: (f) => progress('analysis_ticks', f),
  });
  progress('analysis_ticks', 1);

  progress('economy', 0);
  const passE = await runPassE({
    demoPath: job.demoPath,
    matchId: job.matchId,
    db,
    segmentation: passA.segmentation,
  });
  progress('economy', 1);

  progress('derive', 0.5);
  const mapMeta = job.mapsDir && existsSync(join(job.mapsDir, probe.mapName, 'meta.json5'))
    ? parseMapMeta(probe.mapName, readFileSync(join(job.mapsDir, probe.mapName, 'meta.json5'), 'utf8'))
    : null;

  progress('derive', 0.6);
  const passU = await runPassU({
    demoPath: job.demoPath,
    matchId: job.matchId,
    mapName: probe.mapName,
    db,
    clock,
  });

  const passF = await runPassF({
    matchId: job.matchId,
    db,
    clock,
    windowParquet: join(job.bulkDir, 'ticks_window.parquet'),
    replayParquet: join(job.bulkDir, 'ticks_replay.parquet'),
    mapMeta,
  });
  progress('derive', 1);

  await db.exec(`UPDATE matches SET bulk_state = 'full' WHERE match_id = ?`, [job.matchId]);

  const voice = await runVoice(job, db, probe.source, tickRate, live, progress);

  await db.checkpoint();
  await db.close();

  const summary: IngestSummary = {
    matchId: job.matchId,
    mapName: probe.mapName,
    tickRate,
    liveRounds: liveCount,
    discardedRounds: passA.segmentation.rounds.length - liveCount,
    knifeRoundTick: passA.segmentation.knifeRoundTick,
    restartCount: passA.segmentation.restartCount,
    durationMs: Date.now() - startedAt,
    peakRssMb: Math.round(peakRss / MB),
    replayRows: passC.rows,
    replayStride: passC.stride,
    grenades: passB.grenades,
    detonations: passB.detonations,
    windowRows: passD.rows,
    interestTicks: passD.interestTicks,
    economyRows: passE.rows,
    engagements: passF.engagements,
    utilityThrows: passU.throws,
    heatmapBins: passF.heatmapBins,
    voice,
    bulkState: 'full',
    tables: [...PASS_A_TABLES],
    validation,
  };
  send({ type: 'done', summary });
}

async function runVoice(
  job: JobSpec,
  db: DuckDb,
  source: string | null,
  tickRate: number,
  live: { roundNum: number | null; startTick: number | null; freezeEndTick: number | null; endTick: number }[],
  progress: (stage: 'voice', fraction: number, message?: string) => void,
): Promise<IngestSummary['voice']> {
  const empty = { talkers: 0, segments: 0, speechSeconds: 0, bytes: 0 };
  progress('voice', 0);

  if (source === 'valve_mm') {
    progress('voice', 1);
    return { status: 'skipped_mm', ...empty, detail: 'demos de matchmaking nao gravam voz' };
  }
  if (!voiceExtractorAvailable(job.voiceExtractorDir)) {
    progress('voice', 1);
    return { status: 'unavailable', ...empty, detail: 'extrator de voz nao instalado' };
  }

  try {
    const rounds = live
      .filter((r) => r.roundNum !== null)
      .map((r) => ({
        roundNum: r.roundNum!,
        startTick: r.startTick ?? r.freezeEndTick ?? r.endTick,
        endTick: r.endTick,
      }));
    const result = await runPassV({
      extractorDir: job.voiceExtractorDir,
      demoPath: job.demoPath,
      workDir: join(job.bulkDir, '.voice-tmp'),
      outDir: join(job.bulkDir, 'voice'),
      matchId: job.matchId,
      tickRate,
      rounds,
      onProgress: (f, m) => progress('voice', f, m),
    });
    if (result.rows.length > 0) {
      await db.bulkInsert('voice_segments', [...VOICE_COLUMNS], result.rows);
      await db.exec('UPDATE matches SET has_voice = TRUE WHERE match_id = ?', [job.matchId]);
    }
    progress('voice', 1);
    return {
      status: result.rows.length > 0 ? 'ok' : 'none',
      talkers: result.talkers,
      segments: result.segments,
      speechSeconds: Math.round(result.speechSeconds),
      bytes: result.bytesWritten,
      detail: result.droppedSegments > 0
        ? `${result.droppedSegments} trecho(s) do aquecimento/round faca descartado(s)`
        : null,
    };
  } catch (err) {
    progress('voice', 1);
    return { status: 'failed', ...empty, detail: err instanceof Error ? err.message : String(err) };
  }
}

function validate(
  segmentation: { liveRoundCount: number; rounds: { phase: string }[] },
  teams: { scoreA: number; scoreB: number; unresolved: string[] },
  killCount: number,
  agg: Map<string, { kills: number }>,
  sideByRound: Map<number, Map<string, Side>>,
): ValidationResult[] {
  const out: ValidationResult[] = [];

  const scoreSum = teams.scoreA + teams.scoreB;
  out.push({
    check: 'placar fecha com os rounds live',
    ok: scoreSum === segmentation.liveRoundCount,
    detail: `${teams.scoreA} + ${teams.scoreB} = ${scoreSum}, rounds live = ${segmentation.liveRoundCount}`,
  });

  const killsFromPlayers = [...agg.values()].reduce((a, p) => a + p.kills, 0);
  out.push({
    check: 'kills dos jogadores <= kills registradas',
    ok: killsFromPlayers <= killCount,
    detail: `jogadores somam ${killsFromPlayers}, tabela tem ${killCount} (a diferenca sao suicidios e mortes fora de round live)`,
  });

  out.push({
    check: 'existe pelo menos um round live',
    ok: segmentation.liveRoundCount > 0,
    detail: `${segmentation.liveRoundCount} rounds live`,
  });

  out.push({
    check: 'todo jogador tem time',
    ok: teams.unresolved.length === 0,
    detail: teams.unresolved.length === 0
      ? 'todos resolvidos pela coloracao do elenco'
      : `${teams.unresolved.length} sem time: ${teams.unresolved.join(', ')}`,
  });

  const vazios: string[] = [];
  const contagens: string[] = [];
  for (const [roundNum, sides] of [...sideByRound].sort((a, b) => a[0] - b[0])) {
    let ct = 0;
    let t = 0;
    for (const side of sides.values()) {
      if (side === 'CT') ct += 1;
      else t += 1;
    }
    if (ct === 0 || t === 0) vazios.push(`r${roundNum}=${ct}v${t}`);
    if (ct !== 5 || t !== 5) contagens.push(`r${roundNum}=${ct}v${t}`);
  }
  out.push({
    check: 'todo round live tem os dois lados ocupados',
    ok: vazios.length === 0,
    detail: vazios.length > 0
      ? `lado vazio em: ${vazios.join(' ')}`
      : `${sideByRound.size} rounds` +
        (contagens.length > 0 ? `; fora de 5v5: ${contagens.join(' ')}` : '; todos 5v5'),
  });

  return out;
}

main().catch((err: unknown) => {
  send({
    type: 'error',
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
