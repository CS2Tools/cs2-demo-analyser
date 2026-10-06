import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { CHAT_SINCE_DATA_VERSION, getMatchChat } from '../src/chat-queries.js';

let dir: string;
let db: DuckDb;

const TICK = 64;

async function seed(dataVersion: number): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned,
                          replay_data_version)
     VALUES ('m1', 'x', 'a.dem', 'de_nuke', TRUE, ?, 'inferred', 3, ?, 'full', FALSE, ?)`,
    [TICK, new Date(), dataVersion],
  );

  await db.exec(
    `INSERT INTO rounds (match_id, round_num, phase, start_tick, freeze_end_tick, end_tick)
     VALUES ('m1', 1, 'live', 1000, 1640, 9000), ('m1', 2, 'live', 10000, 10640, 19000)`,
  );
  await db.exec(
    `INSERT INTO player_match (match_id, steam_id, name, team_name, rounds_played)
     VALUES ('m1', 'p1', 'ana', 'Nos', 2)`,
  );
}

const chat = async (id: number, tick: number, text: string, teamOnly: boolean | null) =>
  db.exec(
    `INSERT INTO chat_messages (chat_id, match_id, tick, steam_id, name, text, is_team_only)
     VALUES (?, 'm1', ?, 'p1', 'ana', ?, ?)`,
    [id, tick, text, teamOnly],
  );

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2chat-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('getMatchChat', () => {
  it('a fala cai no round que ja tinha comecado', async () => {
    await seed(CHAT_SINCE_DATA_VERSION);
    await chat(1, 2000, 'durante o round 1', true);
    await chat(2, 12000, 'durante o round 2', true);

    const r = await getMatchChat(db, 'm1');
    expect(r.messages.map((m) => m.roundNum)).toEqual([1, 2]);
  });

  it('fala no freezetime pertence ao round que vai comecar, com segundos NEGATIVOS', async () => {
    await seed(CHAT_SINCE_DATA_VERSION);
    await chat(1, 1200, 'no freezetime do round 1', true);

    const [m] = (await getMatchChat(db, 'm1')).messages;
    expect(m!.roundNum).toBe(1);

    expect(m!.secondsIntoRound).toBeCloseTo(-440 / TICK, 5);
  });

  it('fala no intervalo pertence ao round que ACABOU, e nao ao seguinte', async () => {
    await seed(CHAT_SINCE_DATA_VERSION);
    await chat(1, 9500, 'entre os rounds', true);

    expect((await getMatchChat(db, 'm1')).messages[0]!.roundNum).toBe(1);
  });

  it('fala antes do primeiro round nao inventa round', async () => {
    await seed(CHAT_SINCE_DATA_VERSION);
    await chat(1, 500, 'no aquecimento', true);

    const [m] = (await getMatchChat(db, 'm1')).messages;
    expect(m!.roundNum).toBeNull();
    expect(m!.secondsIntoRound).toBeNull();
  });

  it('sai em ordem de tick e conta quantas estao sem escopo', async () => {
    await seed(CHAT_SINCE_DATA_VERSION);
    await chat(1, 12000, 'segunda', null);
    await chat(2, 2000, 'primeira', true);

    const r = await getMatchChat(db, 'm1');
    expect(r.messages.map((m) => m.text)).toEqual(['primeira', 'segunda']);
    expect(r.unknownScope).toBe(1);
  });

  it('o time de quem falou vem do elenco, para o selo de time', async () => {
    await seed(CHAT_SINCE_DATA_VERSION);
    await chat(1, 2000, 'oi', true);
    expect((await getMatchChat(db, 'm1')).messages[0]!.teamName).toBe('Nos');
  });

  it('partida velha pede reprocessamento em vez de afirmar ausencia', async () => {
    await seed(CHAT_SINCE_DATA_VERSION - 1);
    const r = await getMatchChat(db, 'm1');
    expect(r.messages).toEqual([]);
    expect(r.needsReprocess).toBe(true);
  });

  it('partida na versao atual e sem chat afirma ausencia, e esta certa', async () => {
    await seed(CHAT_SINCE_DATA_VERSION);
    const r = await getMatchChat(db, 'm1');
    expect(r.messages).toEqual([]);
    expect(r.needsReprocess).toBe(false);
  });
});
