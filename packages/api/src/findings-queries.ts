import {
  evaluate,
  METRICS,
  summarizeAccuracy,
  summarizeFlow,
  MIN_HISTORY_MATCHES,
  hasEnoughPresence,
  RULES,
  RULES_VERSION,
  selectSummary,
  TEAM_FLASH_PENALTY,
  type Evidence,
  type MetricObservation,
} from '@cs2/core';
import type { MatchFindings, Settings, VerdictWire } from '@cs2/contract';
import type { Db, SqlValue } from '@cs2/db';
import { computeMatchFlow, getTradeChains } from './round-flow-queries.js';
import { ensureRoster } from './roster-queries.js';

const CHRONO = 'COALESCE(m.played_at, m.ingested_at)';

export async function computeMatchMetrics(db: Db, matchId: string): Promise<MetricObservation[]> {
  const out: MetricObservation[] = [];
  const push = (steamId: string, metricId: string, value: number | null, sampleN: number) => {
    if (value === null || !Number.isFinite(value)) return;
    out.push({ steamId, metricId, value, sampleN });
  };

  const aim = await db.query<{
    steam_id: string; preaim: number | null; n_preaim: number;
    pitch: number | null; n_pitch: number; firstshot: number | null; n_firstshot: number;
  }>(
    `SELECT player_steam_id AS steam_id,
            MEDIAN(preaim_total_deg) AS preaim, COUNT(preaim_total_deg)::INTEGER AS n_preaim,
            MEDIAN(preaim_pitch_deg) AS pitch, COUNT(preaim_pitch_deg)::INTEGER AS n_pitch,
            MEDIAN(firstshot_total_deg) AS firstshot,
            COUNT(firstshot_total_deg)::INTEGER AS n_firstshot
       FROM engagements
      WHERE match_id = ? AND player_steam_id IS NOT NULL
      GROUP BY player_steam_id`,
    [matchId],
  );
  for (const a of aim) {
    push(a.steam_id, METRICS.preaim, num(a.preaim), Number(a.n_preaim));
    push(a.steam_id, METRICS.preaimPitch, num(a.pitch), Number(a.n_pitch));
    push(a.steam_id, METRICS.firstShot, num(a.firstshot), Number(a.n_firstshot));
  }

  const pm = await db.query<{
    steam_id: string; opening_kills: number; opening_deaths: number;
    traded_deaths: number; deaths: number; adr: number | null; rounds_played: number;
  }>(
    `SELECT steam_id, opening_kills, opening_deaths, traded_deaths, deaths, adr, rounds_played
       FROM player_match WHERE match_id = ?`,
    [matchId],
  );
  for (const p of pm) {
    const attempts = Number(p.opening_kills) + Number(p.opening_deaths);
    const deaths = Number(p.deaths);
    push(p.steam_id, METRICS.entrySuccess,
      attempts > 0 ? Number(p.opening_kills) / attempts : null, attempts);
    push(p.steam_id, METRICS.tradedDeathRate,
      deaths > 0 ? Number(p.traded_deaths) / deaths : null, deaths);
    push(p.steam_id, METRICS.adr, num(p.adr), Number(p.rounds_played));
  }

  const flashes = await db.query<{
    steam_id: string; thrown: number; enemy_seconds: number | null; team_seconds: number | null;
  }>(
    `SELECT thrower_steam_id AS steam_id,
            COUNT(DISTINCT tick)::INTEGER AS thrown,
            SUM(CASE WHEN NOT is_team_flash THEN blind_duration ELSE 0 END) AS enemy_seconds,
            SUM(CASE WHEN is_team_flash THEN blind_duration ELSE 0 END) AS team_seconds
       FROM blinds
      WHERE match_id = ? AND round_num IS NOT NULL AND thrower_steam_id IS NOT NULL
      GROUP BY thrower_steam_id`,
    [matchId],
  );
  for (const f of flashes) {
    const net = Number(f.enemy_seconds ?? 0) - TEAM_FLASH_PENALTY * Number(f.team_seconds ?? 0);
    push(f.steam_id, METRICS.flashNet, net, Number(f.thrown));
  }

  const econ = await db.query<{ steam_id: string; damage: number; spent: number; rounds: number }>(
    `SELECT e.steam_id,
            COALESCE(SUM(s.damage), 0)::INTEGER AS damage,
            SUM(e.spent)::INTEGER AS spent,
            COUNT(*)::INTEGER AS rounds
       FROM economy e
       LEFT JOIN player_round_stats s
              ON s.match_id = e.match_id AND s.round_num = e.round_num AND s.steam_id = e.steam_id
      WHERE e.match_id = ?
      GROUP BY e.steam_id`,
    [matchId],
  );
  for (const e of econ) {
    const spent = Number(e.spent);
    push(e.steam_id, METRICS.dmgPer1000,
      spent > 0 ? (Number(e.damage) / spent) * 1000 : null, Number(e.rounds));
  }

  const perRound = await db.query<{
    steam_id: string;
    unused_value: number | null; deaths: number;
    left_on_table: number | null; full_buy_rounds: number;
    force_damage: number | null; force_rounds: number;
  }>(
    `SELECT s.steam_id,
            SUM(CASE WHEN NOT s.survived THEN COALESCE(s.unused_utility_value, 0) ELSE 0 END) AS unused_value,
            SUM(CASE WHEN NOT s.survived AND s.unused_utility_value IS NOT NULL THEN 1 ELSE 0 END)::INTEGER AS deaths,
            SUM(CASE WHEN e.team_buy_type = 'full_buy'
                     THEN GREATEST(0, COALESCE(e.start_balance, 0) - COALESCE(e.spent, 0))
                     ELSE 0 END) AS left_on_table,
            SUM(CASE WHEN e.team_buy_type = 'full_buy' THEN 1 ELSE 0 END)::INTEGER AS full_buy_rounds,
            SUM(CASE WHEN e.team_buy_type = 'force_buy' THEN s.damage ELSE 0 END) AS force_damage,
            SUM(CASE WHEN e.team_buy_type = 'force_buy' THEN 1 ELSE 0 END)::INTEGER AS force_rounds
       FROM player_round_stats s
       LEFT JOIN economy e
              ON e.match_id = s.match_id AND e.round_num = s.round_num AND e.steam_id = s.steam_id
      WHERE s.match_id = ?
      GROUP BY s.steam_id`,
    [matchId],
  );

  for (const r of perRound) {
    const deaths = Number(r.deaths);
    push(r.steam_id, METRICS.unusedUtility,
      deaths > 0 ? Number(r.unused_value ?? 0) / deaths : null, deaths);

    const fullBuys = Number(r.full_buy_rounds);
    push(r.steam_id, METRICS.leftOnTable,
      fullBuys > 0 ? Number(r.left_on_table ?? 0) / fullBuys : null, fullBuys);

    const forceRounds = Number(r.force_rounds);
    push(r.steam_id, METRICS.forceDamage,
      forceRounds > 0 ? Number(r.force_damage ?? 0) / forceRounds : null, forceRounds);
  }

  const nades = await db.query<{ steam_id: string; thrown: number; damage: number | null }>(
    `SELECT g.thrower_steam_id AS steam_id,
            COUNT(*)::INTEGER AS thrown,
            (SELECT COALESCE(SUM(d.dmg_health), 0)
               FROM damages d
              WHERE d.match_id = g.match_id
                AND d.attacker_steam_id = g.thrower_steam_id
                AND d.is_utility = TRUE AND d.is_team_damage = FALSE
                AND lower(d.weapon) IN ('hegrenade', 'inferno', 'molotov', 'incgrenade')) AS damage
       FROM grenades g
      WHERE g.match_id = ? AND g.round_num IS NOT NULL
        AND g.thrower_steam_id IS NOT NULL
        AND lower(g.grenade_type) IN ('he', 'molotov')
      GROUP BY g.thrower_steam_id, g.match_id`,
    [matchId],
  );

  for (const n of nades) {
    const thrown = Number(n.thrown);
    push(n.steam_id, METRICS.nadeDamage,
      thrown > 0 ? Number(n.damage ?? 0) / thrown : null, thrown);
  }

  const tickRate = Number(
    (await db.queryOne<{ tick_rate: number }>(
      'SELECT tick_rate FROM matches WHERE match_id = ?',
      [matchId],
    ))?.tick_rate ?? 64,
  );

  const shots = await db.query<{
    steam_id: string; weapon: string; tick: number;
    speed: number | null; is_scoped: boolean | null;
  }>(
    `SELECT steam_id, weapon, tick, speed, is_scoped
       FROM weapon_fires
      WHERE match_id = ? AND round_num IS NOT NULL
        AND steam_id IS NOT NULL AND weapon IS NOT NULL`,
    [matchId],
  );
  const hits = await db.query<{
    attacker_steam_id: string; victim_steam_id: string | null;
    tick: number; dmg_health: number | null; hitgroup: string | null;
  }>(
    `SELECT attacker_steam_id, victim_steam_id, tick, dmg_health, hitgroup
       FROM damages
      WHERE match_id = ? AND round_num IS NOT NULL
        AND NOT is_utility AND NOT is_team_damage AND attacker_steam_id IS NOT NULL`,
    [matchId],
  );

  const accuracy = summarizeAccuracy(
    shots.map((x) => ({
      steamId: x.steam_id,
      weapon: x.weapon,
      tick: Number(x.tick),
      speed: x.speed === null ? null : Number(x.speed),
      isScoped: x.is_scoped,
    })),
    hits.map((h) => ({
      attackerSteamId: h.attacker_steam_id,
      victimSteamId: h.victim_steam_id ?? '',
      tick: Number(h.tick),
      damage: Number(h.dmg_health ?? 0),
      hitgroup: h.hitgroup,
    })),
    tickRate,
  );

  for (const p of accuracy.players) {
    push(p.steamId, METRICS.accuracy, p.accuracy, p.shots);

    push(p.steamId, METRICS.counterStrafe, p.counterStrafe, p.judgedShots);
  }

  const flow = summarizeFlow(await computeMatchFlow(db, matchId));
  for (const k of flow.kast) {
    push(k.steamId, METRICS.kast, k.kast, k.rounds);
  }

  for (const t of await getTradeChains(db, matchId, tickRate)) {
    push(
      t.steamId,
      METRICS.tradeAttempt,
      t.opportunities > 0 ? t.attempts / t.opportunities : null,
      t.opportunities,
    );
  }

  return out;
}

function num(v: number | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export async function ensureMetricHistory(db: Db): Promise<void> {
  const missing = await db.query<{ match_id: string; played_at: Date | string }>(
    `SELECT m.match_id, ${CHRONO} AS played_at
       FROM matches m
      WHERE COALESCE(m.metrics_version, 0) <> ?
         OR NOT EXISTS (
           SELECT 1 FROM player_metric_history h WHERE h.match_id = m.match_id
         )`,
    [RULES_VERSION],
  );

  for (const m of missing) {
    const metrics = await computeMatchMetrics(db, m.match_id);
    if (metrics.length === 0) continue;
    const playedAt = m.played_at instanceof Date ? m.played_at : new Date(String(m.played_at));
    await db.transaction(async (tx) => {
      await tx.exec('DELETE FROM player_metric_history WHERE match_id = ?', [m.match_id]);
      await tx.bulkInsert(
        'player_metric_history',
        ['steam_id', 'match_id', 'metric_id', 'value', 'sample_n', 'played_at'],
        metrics.map((o) => [o.steamId, m.match_id, o.metricId, o.value, o.sampleN, playedAt]),
      );
      await tx.exec('UPDATE matches SET metrics_version = ? WHERE match_id = ?', [
        RULES_VERSION,
        m.match_id,
      ]);
    });
  }
}

async function loadEvidence(db: Db, matchId: string) {
  const byKey = new Map<string, Evidence[]>();
  const add = (ruleId: string, steamId: string, e: Evidence) => {
    const key = `${ruleId}|${steamId}`;
    const list = byKey.get(key) ?? [];
    list.push(e);
    byKey.set(key, list);
  };

  for (const [ruleId, column] of [
    ['aim.preaim', 'preaim_total_deg'],
    ['aim.firstshot', 'firstshot_total_deg'],
    ['aim.pitch_bias', 'ABS(preaim_pitch_deg)'],
  ] as const) {
    const rows = await db.query<{
      steam_id: string; round_num: number; tick: number; value: number; pitch: number | null;
    }>(
      `SELECT player_steam_id AS steam_id, round_num,
              COALESCE(tick_first_shot, tick_resolved) AS tick,
              ${column} AS value, preaim_pitch_deg AS pitch
         FROM engagements
        WHERE match_id = ? AND ${column} IS NOT NULL AND round_num IS NOT NULL
      QUALIFY ROW_NUMBER() OVER (PARTITION BY player_steam_id ORDER BY ${column} DESC) <= 3`,
      [matchId],
    );
    for (const r of rows) {
      add(ruleId, r.steam_id, {
        roundNum: Number(r.round_num),
        tick: Number(r.tick),
        labelKey: ruleId === 'aim.pitch_bias' ? 'verdict.ev.pitch' : 'verdict.ev.aimError',
        params: {
          deg: Math.round(Number(ruleId === 'aim.pitch_bias' ? r.pitch : r.value) * 10) / 10,
        },
      });
    }
  }

  const entryDeaths = await db.query<{ steam_id: string; round_num: number; tick: number }>(
    `SELECT victim_steam_id AS steam_id, round_num, tick
       FROM kills
      WHERE match_id = ? AND is_entry AND round_num IS NOT NULL
    QUALIFY ROW_NUMBER() OVER (PARTITION BY victim_steam_id ORDER BY tick) <= 3`,
    [matchId],
  );
  for (const r of entryDeaths) {
    add('duels.entry_success', r.steam_id, {
      roundNum: Number(r.round_num), tick: Number(r.tick), labelKey: 'verdict.ev.entryDeath',
    });
  }

  const untraded = await db.query<{ steam_id: string; round_num: number; tick: number }>(
    `SELECT victim_steam_id AS steam_id, round_num, tick
       FROM kills
      WHERE match_id = ? AND NOT COALESCE(death_was_traded, FALSE)
        AND attacker_side IS DISTINCT FROM victim_side AND round_num IS NOT NULL
    QUALIFY ROW_NUMBER() OVER (PARTITION BY victim_steam_id ORDER BY tick) <= 3`,
    [matchId],
  );
  for (const r of untraded) {
    add('duels.traded_death_rate', r.steam_id, {
      roundNum: Number(r.round_num), tick: Number(r.tick), labelKey: 'verdict.ev.untraded',
    });
  }

  const teamFlashes = await db.query<{
    steam_id: string; round_num: number; tick: number; seconds: number;
  }>(
    `SELECT thrower_steam_id AS steam_id, round_num, tick, blind_duration AS seconds
       FROM blinds
      WHERE match_id = ? AND is_team_flash AND round_num IS NOT NULL
    QUALIFY ROW_NUMBER() OVER (PARTITION BY thrower_steam_id ORDER BY blind_duration DESC) <= 3`,
    [matchId],
  );
  for (const r of teamFlashes) {
    add('utility.flash_net', r.steam_id, {
      roundNum: Number(r.round_num),
      tick: Number(r.tick),
      labelKey: 'verdict.ev.teamFlash',
      params: { seconds: Math.round(Number(r.seconds) * 10) / 10 },
    });
  }

  return (ruleId: string, steamId: string) => byKey.get(`${ruleId}|${steamId}`) ?? [];
}

export async function getMatchFindings(
  db: Db,
  matchId: string,
  settings: Pick<Settings, 'userSteamId' | 'playersOfInterest'>,
): Promise<MatchFindings> {
  const match = await db.queryOne<{ chrono: Date | string }>(
    `SELECT ${CHRONO} AS chrono FROM matches m WHERE m.match_id = ?`,
    [matchId],
  );
  if (!match) throw new Error(`Partida nao encontrada: ${matchId}`);

  await ensureRoster(db);
  await ensureMetricHistory(db);

  const players = await db.query<{ steam_id: string; name: string; rounds_played: number }>(
    'SELECT steam_id, name, rounds_played FROM player_match WHERE match_id = ?',
    [matchId],
  );
  const names = new Map(players.map((p) => [p.steam_id, p.name]));

  const liveRounds = Number(
    (await db.queryOne<{ n: number }>(
      `SELECT COUNT(*)::INTEGER AS n FROM rounds
        WHERE match_id = ? AND phase = 'live'`,
      [matchId],
    ))?.n ?? 0,
  );
  const semPresenca = players.filter(
    (p) => !hasEnoughPresence(Number(p.rounds_played), liveRounds),
  );
  const fora = new Set(semPresenca.map((p) => p.steam_id));

  const observations = (
    await db.query<{ steam_id: string; metric_id: string; value: number; sample_n: number }>(
      `SELECT steam_id, metric_id, value, sample_n
         FROM player_metric_history WHERE match_id = ?`,
      [matchId],
    )
  )
    .filter((r) => !fora.has(r.steam_id))
    .map((r) => ({
      steamId: r.steam_id,
      metricId: r.metric_id,
      value: Number(r.value),
      sampleN: Number(r.sample_n),
    }));

  const chrono = match.chrono instanceof Date ? match.chrono : new Date(String(match.chrono));
  const prior = await db.query<{
    steam_id: string; metric_id: string; value: number; match_id: string;
  }>(
    `SELECT h.steam_id, h.metric_id, h.value, h.match_id
       FROM player_metric_history h
       JOIN matches m ON m.match_id = h.match_id
      WHERE h.match_id <> ?
        AND ${CHRONO} < ?
        AND h.steam_id IN (SELECT steam_id FROM player_match WHERE match_id = ?)`,
    [matchId, chrono as unknown as SqlValue, matchId],
  );

  const history = new Map<string, Map<string, number[]>>();
  const priorMatches = new Map<string, Set<string>>();
  for (const r of prior) {
    const byMetric = history.get(r.steam_id) ?? new Map<string, number[]>();
    const list = byMetric.get(r.metric_id) ?? [];
    list.push(Number(r.value));
    byMetric.set(r.metric_id, list);
    history.set(r.steam_id, byMetric);
    const set = priorMatches.get(r.steam_id) ?? new Set<string>();
    set.add(r.match_id);
    priorMatches.set(r.steam_id, set);
  }

  const verdicts = evaluate({
    observations,
    history,
    evidence: await loadEvidence(db, matchId),
    rules: RULES,
  });

  const wire: VerdictWire[] = verdicts.map((v) => ({
    ...v,
    playerName: names.get(v.steamId) ?? v.steamId,
  }));

  const focus = resolveFocus(settings, new Set(names.keys()));
  const focusSet = new Set(focus.steamIds);
  const inFocus = focus.kind === 'match' ? wire : wire.filter((v) => focusSet.has(v.steamId));

  const summary = selectSummary(inFocus, {

    maxPerPlayer: focus.kind === 'match' ? 1 : focus.steamIds.length > 1 ? 2 : Infinity,
  });

  await persist(db, matchId, wire, summary);

  return {
    matchId,
    focus,
    summary,
    all: wire,
    history: (focus.kind === 'match' ? [] : focus.steamIds).map((steamId) => ({
      steamId,
      name: names.get(steamId) ?? steamId,
      priorMatches: priorMatches.get(steamId)?.size ?? 0,
      required: MIN_HISTORY_MATCHES,
    })),
    insufficientPresence: semPresenca.map((p) => ({
      steamId: p.steam_id,
      name: p.name,
      roundsPlayed: Number(p.rounds_played),
      liveRounds,
    })),
    rulesVersion: RULES_VERSION,
  };
}

export function resolveFocus(
  settings: Pick<Settings, 'userSteamId' | 'playersOfInterest'>,
  inMatch: Set<string>,
): MatchFindings['focus'] {
  if (settings.userSteamId && inMatch.has(settings.userSteamId)) {
    return { kind: 'user', steamIds: [settings.userSteamId] };
  }
  const pois = settings.playersOfInterest.map((p) => p.steamId).filter((id) => inMatch.has(id));
  if (pois.length > 0) return { kind: 'poi', steamIds: pois };
  return { kind: 'match', steamIds: [] };
}

async function persist(db: Db, matchId: string, all: VerdictWire[], summary: VerdictWire[]) {
  const rank = new Map(summary.map((v, i) => [v.id, i + 1]));
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.exec('DELETE FROM match_findings WHERE match_id = ?', [matchId]);
    if (all.length === 0) return;
    await tx.bulkInsert(
      'match_findings',
      [
        'finding_id', 'match_id', 'steam_id', 'metric_id', 'value', 'unit', 'severity', 'rank',
        'confidence', 'baseline_kind', 'baseline_json', 'title_key', 'body_key', 'params_json',
        'evidence_json', 'approximation_json', 'computed_at', 'rules_version',
      ],
      all.map((v) => [
        `${matchId}:${v.id}`, matchId, v.steamId, v.metricId, v.value, v.unit, v.severity,
        rank.get(v.id) ?? null, v.confidence, v.baseline.kind, JSON.stringify(v.baseline),
        v.titleKey, v.bodyKey, JSON.stringify(v.params), JSON.stringify(v.evidence), null,
        now, RULES_VERSION,
      ]),
    );
  });
}
