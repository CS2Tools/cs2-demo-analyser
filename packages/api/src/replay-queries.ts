import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '@cs2/db';
import { parseMapMeta, worldToRadarPercent, type MapMeta } from '@cs2/radar';
import {
  SLOTS_PER_FRAME,
  type Detonation,
  type GrenadeKind,
  type GrenadeTrack,
  type VoiceTrack,
  type ReplayHud,
  type ReplayEvent,
  type RoundReplay,
  type Shot,
} from '@cs2/contract';
import { NOMINAL_RADAR_SIZE } from '@cs2/radar';
import { C4_TIMER_REFERENCE_SECONDS, plantForRound, scoreBeforeRound, siteFromPlace, type BombEventInput } from '@cs2/core';
import { INVENTORY_SEPARATOR } from '@cs2/ingest';
import { buildBombTrack, buildHudSeries, type BombPosition, type HudRow } from './replay-hud.js';

const metaCache = new Map<string, MapMeta>();

function loadMapMeta(mapsDir: string, mapName: string): MapMeta | null {
  const hit = metaCache.get(mapName);
  if (hit) return hit;
  const path = join(mapsDir, mapName, 'meta.json5');
  if (!existsSync(path)) return null;
  const meta = parseMapMeta(mapName, readFileSync(path, 'utf8'));
  metaCache.set(mapName, meta);
  return meta;
}

export function replayParquetPath(dataDir: string, matchId: string): string {
  return join(dataDir, 'bulk', matchId, 'ticks_replay.parquet');
}

export function grenadePathsParquet(dataDir: string, matchId: string): string {
  return join(dataDir, 'bulk', matchId, 'grenade_paths.parquet');
}

function radiusToPercent(units: number, meta: MapMeta): number {
  return (units / meta.resolution / NOMINAL_RADAR_SIZE) * 100;
}

export class ReplayUnavailableError extends Error {
  constructor(readonly reason: 'pruned' | 'no_radar' | 'empty') {
    super(
      reason === 'pruned'
        ? 'Os dados de tick desta partida foram removidos pela politica de retencao. As analises e graficos continuam completos.'
        : reason === 'no_radar'
          ? 'Este mapa nao tem radar vendorizado, entao o visualizador 2D fica indisponivel. Todas as outras analises funcionam normalmente.'
          : 'Este round nao tem dados de replay.',
    );
    this.name = 'ReplayUnavailableError';
  }
}

interface TickRow {
  tick: number;
  slot: number;
  weapon: string | null;
  armor: number | null;
  money: number | null;
  has_helmet: boolean | null;
  has_defuser: boolean | null;
  inventory: string | null;
  is_defusing: boolean | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  life_state: number;
  flash_duration: number;
  side: number;
  steam_id: string;
}

export async function getRoundReplay(
  db: Db,
  dataDir: string,
  mapsDir: string,
  matchId: string,
  roundNum: number,
): Promise<RoundReplay> {
  const match = await db.queryOne<{
    map_name: string; has_radar: boolean; tick_rate: number; bulk_state: string;
    replay_data_version: number | null; c4_timer_seconds: number | null; c4_timer_source: string | null;
    team_a_name: string | null; team_b_name: string | null; replay_slot_count: number | null;
  }>(
    `SELECT map_name, has_radar, tick_rate, bulk_state, replay_data_version,
            c4_timer_seconds, c4_timer_source, team_a_name, team_b_name,
            replay_slot_count
       FROM matches WHERE match_id = ?`,
    [matchId],
  );
  if (!match) throw new Error(`Partida nao encontrada: ${matchId}`);
  if (!match.has_radar) throw new ReplayUnavailableError('no_radar');

  const parquet = replayParquetPath(dataDir, matchId);
  if (!existsSync(parquet)) throw new ReplayUnavailableError('pruned');

  const meta = loadMapMeta(mapsDir, match.map_name);
  if (!meta) throw new ReplayUnavailableError('no_radar');

  const round = await db.queryOne<{
    start_tick: number | null; freeze_end_tick: number | null; end_tick: number;
    round_time_seconds: number | null; freeze_time_seconds: number | null;
  }>(
    `SELECT start_tick, freeze_end_tick, end_tick, round_time_seconds, freeze_time_seconds
       FROM rounds WHERE match_id = ? AND round_num = ?`,
    [matchId, roundNum],
  );
  if (!round) throw new ReplayUnavailableError('empty');

  const scoreRows = await db.query<{
    round_num: number | null; score_a_after: number | null;
    score_b_after: number | null; winner_team: string | null;
  }>(
    `SELECT round_num, score_a_after, score_b_after, winner_team
       FROM rounds WHERE match_id = ? AND phase = 'live'`,
    [matchId],
  );
  const score = scoreBeforeRound(
    scoreRows.map((r) => ({
      roundNum: r.round_num === null ? null : Number(r.round_num),
      scoreAAfter: r.score_a_after === null ? null : Number(r.score_a_after),
      scoreBAfter: r.score_b_after === null ? null : Number(r.score_b_after),
      winnerTeam: (r.winner_team as 'A' | 'B' | null) ?? null,
    })),
    roundNum,
  );

  const dataVersion = Number(match.replay_data_version ?? 1);
  const hudCols =
    dataVersion >= 2
      ? 'money, has_helmet, has_defuser, inventory, is_defusing'
      : 'NULL AS money, NULL AS has_helmet, NULL AS has_defuser, NULL AS inventory, NULL AS is_defusing';
  const rows = await db.query<TickRow>(
    `SELECT tick, slot, x, y, z, yaw, health, life_state, flash_duration, side, steam_id,
            weapon, armor, ${hudCols}
       FROM read_parquet(?)
      WHERE match_id = ? AND round_num = ?
      ORDER BY tick, slot`,
    [parquet, matchId, roundNum],
  );
  if (rows.length === 0) throw new ReplayUnavailableError('empty');

  const frameTicks: number[] = [];
  let lastTick = -1;
  for (const r of rows) {
    const t = Number(r.tick);
    if (t !== lastTick) {
      frameTicks.push(t);
      lastTick = t;
    }
  }
  const frameOf = new Map(frameTicks.map((t, i) => [t, i]));
  const frames = frameTicks.length;

  const slotsPerFrame = Number(match.replay_slot_count ?? SLOTS_PER_FRAME);
  const size = frames * slotsPerFrame;

  const x = new Array<number>(size).fill(Number.NaN);
  const y = new Array<number>(size).fill(Number.NaN);
  const z = new Array<number>(size).fill(Number.NaN);
  const yaw = new Array<number>(size).fill(Number.NaN);
  const split = new Array<number>(size).fill(-1);
  const health = new Array<number>(size).fill(0);
  const lifeState = new Array<number>(size).fill(1);
  const flash = new Array<number>(size).fill(0);

  const sideBySlot = new Map<number, 'CT' | 'T'>();
  const steamIdBySlot = new Map<number, string>();
  const hudRows: HudRow[] = [];

  for (const r of rows) {
    const frame = frameOf.get(Number(r.tick));
    if (frame === undefined) continue;
    const slot = Number(r.slot);
    if (slot < 0 || slot >= slotsPerFrame) continue;
    const i = frame * slotsPerFrame + slot;

    const p = worldToRadarPercent({ x: Number(r.x), y: Number(r.y), z: Number(r.z) }, meta);
    x[i] = p.px;
    y[i] = p.py;
    z[i] = Number(r.z);
    split[i] = p.split;
    yaw[i] = Number(r.yaw);
    health[i] = Number(r.health);
    lifeState[i] = Number(r.life_state);
    flash[i] = Number(r.flash_duration);
    hudRows.push({
      frame,
      slot,
      weapon: r.weapon,
      armor: r.armor === null ? null : Number(r.armor),
      money: r.money === null ? null : Number(r.money),
      helmet: r.has_helmet,
      defuser: r.has_defuser,
      inventory: r.inventory,
      defusing: r.is_defusing,
    });

    if (!steamIdBySlot.has(slot)) steamIdBySlot.set(slot, r.steam_id);
    if (!sideBySlot.has(slot)) {
      const s = Number(r.side);

      if (s === 3) sideBySlot.set(slot, 'CT');
      else if (s === 2) sideBySlot.set(slot, 'T');
    }
  }

  const players = await db.query<{
    steam_id: string; name: string; team_name: string | null; team_slot: string | null;
    is_user: boolean; is_poi: boolean; team_color: string | null;
  }>(
    `SELECT steam_id, name, team_name, team_slot, is_user, is_poi, team_color
       FROM player_match WHERE match_id = ?`,
    [matchId],
  );
  const byId = new Map(players.map((p) => [p.steam_id, p]));

  const before = await db.query<{
    steam_id: string; kills: number; deaths: number; assists: number;
  }>(
    `SELECT prs.steam_id,
            sum(prs.kills)   AS kills,
            sum(prs.deaths)  AS deaths,
            sum(prs.assists) AS assists
       FROM player_round_stats prs
       JOIN rounds r USING (match_id, round_num)
      WHERE prs.match_id = ? AND r.phase = 'live' AND prs.round_num < ?
      GROUP BY prs.steam_id`,
    [matchId, roundNum],
  );
  const beforeById = new Map(before.map((b) => [b.steam_id, b]));

  const teamNames = await db.queryOne<{ team_a_name: string | null }>(
    'SELECT team_a_name FROM matches WHERE match_id = ?',
    [matchId],
  );

  const slots = [...steamIdBySlot.entries()]

    .filter(([slot]) => sideBySlot.has(slot))
    .sort(([a], [b]) => a - b)
    .map(([slot, steamId]) => {
      const p = byId.get(steamId);
      return {
        slot,
        steamId,
        name: p?.name ?? steamId,

        team: (p?.team_slot === 'A' || p?.team_slot === 'B' ? p.team_slot : null) as
          | 'A' | 'B' | null,
        side: sideBySlot.get(slot) ?? null,
        isUser: Boolean(p?.is_user),
        isPoi: Boolean(p?.is_poi),
        teamColor: p?.team_color ?? null,
        killsBefore: Number(beforeById.get(steamId)?.kills ?? 0),
        deathsBefore: Number(beforeById.get(steamId)?.deaths ?? 0),
        assistsBefore: Number(beforeById.get(steamId)?.assists ?? 0),
      };
    });
  void teamNames;

  return {
    matchId,
    roundNum,
    mapName: match.map_name,
    hasRadar: match.has_radar,
    tickRate: Number(match.tick_rate),
    startTick: frameTicks[0]!,
    endTick: frameTicks[frames - 1]!,
    stride: frames > 1 ? frameTicks[1]! - frameTicks[0]! : 1,
    frames,
    score: { ...score, teamAName: match.team_a_name, teamBName: match.team_b_name },
    slots,
    slotsPerFrame,
    x, y, z, yaw, split, health, lifeState, flash,
    events: await roundEvents(db, matchId, roundNum, steamIdBySlot, meta),
    grenades: await roundGrenades(db, dataDir, matchId, roundNum, steamIdBySlot, meta),
    detonations: await roundDetonations(db, matchId, roundNum, meta),
    shots: await roundShots(db, matchId, roundNum, steamIdBySlot),
    voice: await roundVoice(db, dataDir, matchId, roundNum, steamIdBySlot),
    hud: await roundHud(db, matchId, roundNum, {
      dataVersion,
      round,
      match,
      frameTicks,
      hudRows,
      steamIdBySlot,
      slotsPerFrame,
      positionAt: (f, slot) => {
        const i = f * slotsPerFrame + slot;
        return Number.isNaN(x[i]!) ? null : { x: x[i]!, y: y[i]!, split: split[i]! };
      },
    }),
  };
}

function frameAtOrAfter(frameTicks: number[], tick: number): number {
  let lo = 0;
  let hi = frameTicks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frameTicks[mid]! < tick) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

async function roundHud(
  db: Db,
  matchId: string,
  roundNum: number,
  ctx: {
    dataVersion: number;
    round: { start_tick: number | null; freeze_end_tick: number | null; end_tick: number;
      round_time_seconds: number | null; freeze_time_seconds: number | null };
    match: { c4_timer_seconds: number | null; c4_timer_source: string | null };
    frameTicks: number[];
    hudRows: HudRow[];
    steamIdBySlot: Map<number, string>;

    slotsPerFrame: number;
    positionAt: (frame: number, slot: number) => BombPosition | null;
  },
): Promise<ReplayHud> {
  const { round, frameTicks } = ctx;
  const slotOf = new Map([...ctx.steamIdBySlot].map(([slot, id]) => [id, slot]));
  const window = {
    startTick: Number(round.start_tick ?? round.freeze_end_tick ?? round.end_tick),
    endTick: Number(round.end_tick),
  };

  const bombRows = await db.query<{
    tick: number; event_type: string; steam_id: string | null; site: string | null;
    place: string | null; has_kit: boolean | null;
  }>(
    `SELECT tick, event_type, steam_id, site, place, has_kit FROM bomb_events
      WHERE match_id = ? AND tick BETWEEN ? AND ? ORDER BY tick`,
    [matchId, window.startTick, window.endTick],
  );
  const bombEvents = bombRows.map((b) => ({ ...b, tick: Number(b.tick), type: b.event_type as BombEventInput['type'] }));
  const plantEv = plantForRound(bombEvents, window);

  const series = buildHudSeries(
    ctx.hudRows, frameTicks.length, INVENTORY_SEPARATOR, ctx.slotsPerFrame,
  );
  const plantFrame = plantEv ? frameAtOrAfter(frameTicks, plantEv.tick) : null;
  const plantSlot = plantEv?.steam_id ? (slotOf.get(plantEv.steam_id) ?? null) : null;

  const outcomeEv = bombEvents.find((e) => (e.type === 'defused' || e.type === 'exploded') && (!plantEv || e.tick >= plantEv.tick));

  return {
    dataVersion: ctx.dataVersion,

    roundEndTick: window.endTick,
    roundTimeSeconds: round.round_time_seconds === null ? null : Number(round.round_time_seconds),
    freezeTimeSeconds: round.freeze_time_seconds === null ? null : Number(round.freeze_time_seconds),
    freezeEndTick: round.freeze_end_tick === null ? null : Number(round.freeze_end_tick),
    c4TimerSeconds: Number(ctx.match.c4_timer_seconds ?? C4_TIMER_REFERENCE_SECONDS),
    c4TimerSource: ctx.match.c4_timer_source === 'measured' ? 'measured' : 'reference',
    ...series,
    plant: plantEv
      ? {
          tick: plantEv.tick,
          site: (plantEv.site === 'A' || plantEv.site === 'B' ? plantEv.site : siteFromPlace(plantEv.place)),
          place: plantEv.place,
          slot: plantSlot,
        }
      : null,
    defuses: bombEvents
      .filter((e) => e.type === 'begindefuse')
      .map((e) => ({
        tick: e.tick,
        slot: e.steam_id ? (slotOf.get(e.steam_id) ?? null) : null,
        hasKit: e.has_kit,
      })),
    outcome: outcomeEv ? { type: outcomeEv.type as 'defused' | 'exploded', tick: outcomeEv.tick } : null,
    bombTrack:
      ctx.dataVersion >= 2
        ? buildBombTrack(
            frameTicks.length,
            series.inventory,
            ctx.positionAt,
            plantFrame === null ? null : { frame: plantFrame, slot: plantSlot },
          )
        : [],
  };
}

async function roundVoice(
  db: Db,
  dataDir: string,
  matchId: string,
  roundNum: number,
  steamIdBySlot: Map<number, string>,
): Promise<VoiceTrack[]> {
  const rows = await db.query<{
    steam_id: string; start_tick: number; end_tick: number;
    file_offset_ms: number; duration_ms: number; rel_path: string;
  }>(
    `SELECT steam_id, start_tick, end_tick, file_offset_ms, duration_ms, rel_path
       FROM voice_segments
      WHERE match_id = ? AND round_num = ?
      ORDER BY steam_id, start_tick`,
    [matchId, roundNum],
  );
  const slotOf = new Map([...steamIdBySlot].map(([slot, id]) => [id, slot]));
  const tracks = new Map<string, VoiceTrack>();
  for (const r of rows) {
    const file = r.rel_path.replace(/^voice\//, '');
    if (!existsSync(join(dataDir, 'bulk', matchId, 'voice', file))) continue;
    let t = tracks.get(r.steam_id);
    if (!t) {
      t = { steamId: r.steam_id, slot: slotOf.get(r.steam_id) ?? null, fileId: `${matchId}/${file}`, segments: [] };
      tracks.set(r.steam_id, t);
    }
    t.segments.push({
      startTick: Number(r.start_tick),
      endTick: Number(r.end_tick),
      offsetMs: Number(r.file_offset_ms),
      durationMs: Number(r.duration_ms),
    });
  }
  return [...tracks.values()];
}

async function roundGrenades(
  db: Db,
  dataDir: string,
  matchId: string,
  roundNum: number,
  steamIdBySlot: Map<number, string>,
  meta: MapMeta,
): Promise<GrenadeTrack[]> {
  const parquet = grenadePathsParquet(dataDir, matchId);
  if (!existsSync(parquet)) return [];

  const slotOf = new Map([...steamIdBySlot].map(([slot, id]) => [id, slot]));

  const meta_ = await db.query<{
    grenade_id: number; grenade_type: string; thrower_steam_id: string | null;
    throw_tick: number; detonate_tick: number | null;
  }>(
    `SELECT grenade_id, grenade_type, thrower_steam_id, throw_tick, detonate_tick
       FROM grenades WHERE match_id = ? AND round_num = ? ORDER BY throw_tick`,
    [matchId, roundNum],
  );
  if (meta_.length === 0) return [];

  const paths = await db.query<{ grenade_id: number; tick: number; x: number; y: number; z: number }>(
    `SELECT grenade_id, tick, x, y, z FROM read_parquet(?)
      WHERE match_id = ? AND round_num = ? ORDER BY grenade_id, tick`,
    [parquet, matchId, roundNum],
  );

  const byId = new Map<number, GrenadeTrack['path']>();
  for (const p of paths) {
    const id = Number(p.grenade_id);
    const point = worldToRadarPercent({ x: Number(p.x), y: Number(p.y), z: Number(p.z) }, meta);
    const list = byId.get(id) ?? [];
    list.push({ tick: Number(p.tick), x: point.px, y: point.py, split: point.split });
    byId.set(id, list);
  }

  return meta_.map((g) => ({
    grenadeId: Number(g.grenade_id),
    kind: g.grenade_type as GrenadeKind,
    throwerSlot: g.thrower_steam_id ? (slotOf.get(g.thrower_steam_id) ?? null) : null,
    throwTick: Number(g.throw_tick),
    detonateTick: g.detonate_tick === null ? null : Number(g.detonate_tick),
    path: byId.get(Number(g.grenade_id)) ?? [],
  }));
}

async function roundDetonations(
  db: Db,
  matchId: string,
  roundNum: number,
  meta: MapMeta,
): Promise<Detonation[]> {
  const rows = await db.query<{
    grenade_type: string; tick: number; expire_tick: number | null;
    x: number; y: number; z: number; approx_radius: number; approx_model: string;
  }>(
    `SELECT grenade_type, tick, expire_tick, x, y, z, approx_radius, approx_model
       FROM grenade_detonations WHERE match_id = ? AND round_num = ? ORDER BY tick`,
    [matchId, roundNum],
  );

  return rows.map((r) => {
    const p = worldToRadarPercent({ x: Number(r.x), y: Number(r.y), z: Number(r.z) }, meta);
    return {
      kind: r.grenade_type as GrenadeKind,
      tick: Number(r.tick),
      expireTick: r.expire_tick === null ? null : Number(r.expire_tick),
      x: p.px,
      y: p.py,
      split: p.split,
      radiusPercent: radiusToPercent(Number(r.approx_radius), meta),
      approxModel: r.approx_model,
      isApproximation: true as const,
    };
  });
}

async function roundShots(
  db: Db,
  matchId: string,
  roundNum: number,
  steamIdBySlot: Map<number, string>,
): Promise<Shot[]> {
  const slotOf = new Map([...steamIdBySlot].map(([slot, id]) => [id, slot]));
  const rows = await db.query<{ tick: number; steam_id: string | null; weapon: string | null }>(
    `SELECT tick, steam_id, weapon FROM weapon_fires
      WHERE match_id = ? AND round_num = ? ORDER BY tick`,
    [matchId, roundNum],
  );

  const out: Shot[] = [];
  for (const r of rows) {
    const slot = r.steam_id ? slotOf.get(r.steam_id) : undefined;
    if (slot === undefined) continue;
    out.push({ tick: Number(r.tick), slot, weapon: r.weapon });
  }
  return out;
}

async function roundEvents(
  db: Db,
  matchId: string,
  roundNum: number,
  steamIdBySlot: Map<number, string>,
  meta: MapMeta,
): Promise<ReplayEvent[]> {
  const slotOf = new Map([...steamIdBySlot].map(([slot, id]) => [id, slot]));

  const kills = await db.query<{
    tick: number; attacker_steam_id: string | null; victim_steam_id: string | null;
    assister_steam_id: string | null;
    weapon: string | null; headshot: boolean | null;
    penetrated: number | null; thru_smoke: boolean | null; attacker_blind: boolean | null;
    noscope: boolean | null; assisted_flash: boolean | null;
    victim_x: number | null; victim_y: number | null; victim_z: number | null;
  }>(
    `SELECT tick, attacker_steam_id, victim_steam_id, assister_steam_id, weapon, headshot,
            penetrated, thru_smoke, attacker_blind, noscope, assisted_flash,
            victim_x, victim_y, victim_z
       FROM kills WHERE match_id = ? AND round_num = ? ORDER BY tick`,
    [matchId, roundNum],
  );

  const events: ReplayEvent[] = kills.map((k) => {

    const hasPos = k.victim_x !== null && k.victim_y !== null;
    const p = hasPos
      ? worldToRadarPercent(
          { x: Number(k.victim_x), y: Number(k.victim_y), z: Number(k.victim_z ?? 0) },
          meta,
        )
      : null;
    return {
      tick: Number(k.tick),
      kind: 'kill' as const,
      actorSlot: k.attacker_steam_id ? (slotOf.get(k.attacker_steam_id) ?? null) : null,
      targetSlot: k.victim_steam_id ? (slotOf.get(k.victim_steam_id) ?? null) : null,
      weapon: k.weapon,
      headshot: k.headshot,
      x: p?.px ?? null,
      y: p?.py ?? null,
      split: p?.split ?? null,
      penetrated: k.penetrated === null ? null : Number(k.penetrated) > 0,
      thruSmoke: k.thru_smoke,
      attackerBlind: k.attacker_blind,
      noscope: k.noscope,
      assisterSlot: k.assister_steam_id ? (slotOf.get(k.assister_steam_id) ?? null) : null,
      flashAssist: k.assisted_flash,
    };
  });

  const bomb = await db.query<{ tick: number; event_type: string; steam_id: string | null }>(
    `SELECT b.tick, b.event_type, b.steam_id FROM bomb_events b
       JOIN rounds r ON r.match_id = b.match_id AND r.round_num = ?
      WHERE b.match_id = ? AND b.event_type IN ('planted','defused','exploded')
        AND b.tick BETWEEN COALESCE(r.start_tick, r.freeze_end_tick, r.end_tick) AND r.end_tick
      ORDER BY b.tick`,
    [roundNum, matchId],
  );

  for (const b of bomb) {
    events.push({
      tick: Number(b.tick),
      kind: `bomb_${b.event_type}` as ReplayEvent['kind'],
      actorSlot: b.steam_id ? (slotOf.get(b.steam_id) ?? null) : null,
      targetSlot: null,
      weapon: null,
      headshot: null,
      x: null,
      y: null,
      split: null,
      penetrated: null,
      thruSmoke: null,
      attackerBlind: null,
      noscope: null,
      assisterSlot: null,
      flashAssist: null,
    });
  }

  return events.sort((a, b) => a.tick - b.tick);
}
