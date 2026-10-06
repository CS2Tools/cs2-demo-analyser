import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { computeMatchRoster, ensureRoster, ROSTER_VERSION } from '../src/roster-queries.js';

let dir: string;
let db: DuckDb;

const A = ['a1', 'a2', 'a3', 'a4'];
const B = ['b1', 'b2', 'b3', 'b4', 'b5'];
const ROUNDS = 24;
const META = 12;

async function base(nameA: string | null = 'Nos', nameB: string | null = 'Eles'): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, bulk_state, pinned,
                          team_a_name, team_b_name, score_a, score_b)
     VALUES ('m1', 'x', 'a.dem', 'de_anubis', TRUE, 64, 'inferred', 20, ?, 'full', FALSE, ?, ?, 0, 0)`,
    [new Date(), nameA, nameB],
  );
}

async function round(
  roundNum: number,
  ct: string[],
  t: string[],
  winnerSide: 'CT' | 'T',
): Promise<void> {
  await db.exec(
    `INSERT INTO rounds (match_id, round_num, phase, start_tick, freeze_end_tick, end_tick,
                         winner_side)
     VALUES ('m1', ?, 'live', ?, ?, ?, ?)`,
    [roundNum, roundNum * 1000, roundNum * 1000 + 640, roundNum * 1000 + 900, winnerSide],
  );
  for (const [side, ids] of [['CT', ct], ['T', t]] as const) {
    for (const steamId of ids) {
      await db.exec(
        `INSERT INTO player_round_stats (match_id, round_num, steam_id, side)
         VALUES ('m1', ?, ?, ?)`,
        [roundNum, steamId, side],
      );
    }
  }
}

async function player(steamId: string, teamName: string | null): Promise<void> {
  await db.exec(
    `INSERT INTO player_match (match_id, steam_id, name, team_name, rounds_played)
     VALUES ('m1', ?, ?, ?, 0)`,
    [steamId, steamId, teamName],
  );
}

async function comComplete(): Promise<void> {
  await base();
  for (const id of [...A, 'sai', 'entra']) await player(id, 'Eles');
  for (const id of B) await player(id, 'Eles');

  for (const id of A) {
    await db.exec(`UPDATE player_match SET team_name = 'Nos' WHERE steam_id = ?`, [id]);
  }
  await db.exec(`UPDATE player_match SET team_name = 'Nos' WHERE steam_id = 'sai'`);

  for (let r = 1; r <= ROUNDS; r += 1) {
    const timeA = r <= META ? [...A, 'sai'] : r <= META + 6 ? [...A, 'sai'] : [...A, 'entra'];
    const ctSide = r <= META ? timeA : B;
    const tSide = r <= META ? B : timeA;
    await round(r, ctSide, tSide, r % 3 === 0 ? 'T' : 'CT');
  }
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2roster-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('ensureRoster com complete', () => {
  it('o substituto cai no time CERTO, e nao no time B por omissao', async () => {
    await comComplete();
    await ensureRoster(db);

    const rows = await db.query<{ steam_id: string; team_slot: string | null; team_name: string | null }>(
      'SELECT steam_id, team_slot, team_name FROM player_match WHERE match_id = ?',
      ['m1'],
    );
    expect(rows).toHaveLength(11);
    const slotOf = new Map(rows.map((r) => [r.steam_id, r.team_slot]));
    for (const id of [...A, 'sai', 'entra']) expect(slotOf.get(id)).toBe('A');
    for (const id of B) expect(slotOf.get(id)).toBe('B');

    const nomeOf = new Map(rows.map((r) => [r.steam_id, r.team_name]));
    expect(nomeOf.get('entra')).toBe('Nos');
    expect(nomeOf.get('b1')).toBe('Eles');
  });

  it('a orientacao preserva quem e o time A: o placar nao troca de lugar', async () => {
    await comComplete();
    await ensureRoster(db);
    const m = await db.queryOne<{ score_a: number; score_b: number }>(
      'SELECT score_a, score_b FROM matches WHERE match_id = ?',
      ['m1'],
    );

    expect(Number(m!.score_a) + Number(m!.score_b)).toBe(ROUNDS);

    const vitoriasA = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM rounds WHERE match_id = 'm1' AND winner_team = 'A'`,
    );
    expect(Number(vitoriasA!.n)).toBe(Number(m!.score_a));
  });

  it('grava as janelas de presenca medidas', async () => {
    await comComplete();
    await ensureRoster(db);

    const spells = await db.query<{
      steam_id: string; team_slot: string; first_round: number; last_round: number; rounds: number;
    }>(
      `SELECT steam_id, team_slot, first_round, last_round, rounds
         FROM roster_spells WHERE match_id = 'm1' ORDER BY first_round, steam_id`,
    );

    expect(spells).toHaveLength(11);
    const porId = new Map(spells.map((s) => [s.steam_id, s]));
    expect(porId.get('sai')).toMatchObject({ first_round: 1, last_round: 18, rounds: 18 });
    expect(porId.get('entra')).toMatchObject({ first_round: 19, last_round: 24, rounds: 6 });
    expect(porId.get('a1')).toMatchObject({ first_round: 1, last_round: 24, rounds: 24 });
  });

  it('a troca e UMA, com o criterio declarado e sem campo de motivo', async () => {
    await comComplete();
    await ensureRoster(db);

    const h = await db.query<Record<string, unknown>>(
      `SELECT * FROM roster_handoffs WHERE match_id = 'm1'`,
    );
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({
      team_slot: 'A',
      out_steam_id: 'sai',
      out_last_round: 18,
      in_steam_id: 'entra',
      in_first_round: 19,
      gap_rounds: 0,
      inference: 'adjacent_window',
    });

    const colunas = Object.keys(h[0]!).join(' ').toLowerCase();
    expect(colunas).not.toMatch(/reason|motivo|kick|ban/);
  });

  it('conta quantos jogaram cada round, por lado', async () => {
    await comComplete();
    await ensureRoster(db);
    const r = await db.query<{ roster_ct: number; roster_t: number }>(
      `SELECT roster_ct, roster_t FROM rounds WHERE match_id = 'm1' ORDER BY round_num`,
    );
    expect(r).toHaveLength(ROUNDS);
    for (const x of r) {
      expect(Number(x.roster_ct)).toBe(5);
      expect(Number(x.roster_t)).toBe(5);
    }
  });

  it('rodar duas vezes nao duplica linha nem muda numero', async () => {
    await comComplete();
    await ensureRoster(db);
    const antes = await db.queryOne<{ s: number; h: number; a: number }>(
      `SELECT (SELECT COUNT(*) FROM roster_spells) AS s,
              (SELECT COUNT(*) FROM roster_handoffs) AS h,
              (SELECT score_a FROM matches WHERE match_id = 'm1') AS a`,
    );

    expect((await ensureRoster(db)).updated).toEqual([]);
    await db.exec(`UPDATE matches SET roster_version = 0 WHERE match_id = 'm1'`);
    await ensureRoster(db);
    const depois = await db.queryOne<{ s: number; h: number; a: number }>(
      `SELECT (SELECT COUNT(*) FROM roster_spells) AS s,
              (SELECT COUNT(*) FROM roster_handoffs) AS h,
              (SELECT score_a FROM matches WHERE match_id = 'm1') AS a`,
    );
    expect(depois).toEqual(antes);
  });

  it('marca a versao, para nao recalcular a biblioteca toda vez', async () => {
    await comComplete();
    await ensureRoster(db);
    const m = await db.queryOne<{ v: number }>(
      `SELECT roster_version AS v FROM matches WHERE match_id = 'm1'`,
    );
    expect(Number(m!.v)).toBe(ROSTER_VERSION);
  });
});

describe('casos que a tabela nao pode mentir sobre', () => {

  it('janelas sobrepostas: gap_rounds NEGATIVO e um round com seis', async () => {
    await base();
    for (const id of [...A, 'sai', 'entra', ...B]) await player(id, null);
    for (let r = 1; r <= 12; r += 1) {
      const comSai = r <= 6;
      const comEntra = r >= 6;
      const timeA = [...A, ...(comSai ? ['sai'] : []), ...(comEntra ? ['entra'] : [])];
      await round(r, timeA, B, 'CT');
    }
    await ensureRoster(db);

    const h = await db.queryOne<{ gap_rounds: number; out_steam_id: string; in_steam_id: string }>(
      `SELECT gap_rounds, out_steam_id, in_steam_id FROM roster_handoffs WHERE match_id = 'm1'`,
    );
    expect(h!.out_steam_id).toBe('sai');
    expect(h!.in_steam_id).toBe('entra');
    expect(Number(h!.gap_rounds)).toBe(-1);

    const seis = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM rounds WHERE match_id = 'm1' AND roster_ct = 6`,
    );
    expect(Number(seis!.n)).toBe(1);
  });

  it('round desfalcado: gap_rounds 1 e um round 4v5 registrado', async () => {
    await base();
    for (const id of [...A, 'sai', 'entra', ...B]) await player(id, null);
    for (let r = 1; r <= 12; r += 1) {
      const timeA = r <= 5 ? [...A, 'sai'] : r === 6 ? [...A] : [...A, 'entra'];
      await round(r, timeA, B, 'T');
    }
    await ensureRoster(db);

    const h = await db.queryOne<{ gap_rounds: number }>(
      `SELECT gap_rounds FROM roster_handoffs WHERE match_id = 'm1'`,
    );
    expect(Number(h!.gap_rounds)).toBe(1);

    const r6 = await db.queryOne<{ ct: number; t: number }>(
      `SELECT roster_ct AS ct, roster_t AS t FROM rounds WHERE match_id = 'm1' AND round_num = 6`,
    );
    expect(Number(r6!.ct)).toBe(4);
    expect(Number(r6!.t)).toBe(5);
  });

  it('partida de matchmaking (dois nomes nulos) nao colapsa os times', async () => {
    await base(null, null);
    for (const id of [...A, 'a5', ...B]) await player(id, null);
    for (let r = 1; r <= 12; r += 1) await round(r, [...A, 'a5'], B, 'CT');
    await ensureRoster(db);

    const r = await computeMatchRoster(db, 'm1');
    const ladoA = [...r.teamOf].filter(([, s]) => s === 'A').map(([id]) => id);
    const ladoB = [...r.teamOf].filter(([, s]) => s === 'B').map(([id]) => id);
    expect(ladoA.sort()).toEqual([...A, 'a5'].sort());
    expect(ladoB.sort()).toEqual([...B].sort());
  });

  it('partida sem complete: nenhuma troca, e isso e o normal', async () => {
    await base();
    for (const id of [...A, 'a5']) await player(id, 'Nos');
    for (const id of B) await player(id, 'Eles');
    for (let r = 1; r <= 12; r += 1) await round(r, [...A, 'a5'], B, 'CT');
    await ensureRoster(db);

    const h = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM roster_handoffs WHERE match_id = 'm1'`,
    );
    expect(Number(h!.n)).toBe(0);
    const s = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM roster_spells WHERE match_id = 'm1'`,
    );
    expect(Number(s!.n)).toBe(10);
  });
});

describe('recalculo do que supunha cinco por lado', () => {

  async function roundDesfalcado(): Promise<void> {
    await base();
    for (const id of [...A, 'sai', ...B]) await player(id, null);
    for (let r = 1; r <= 6; r += 1) {
      const ct = r === 6 ? A : [...A, 'sai'];
      await round(r, ct, B, 'T');
    }
  }

  async function economia(roundNum: number, ids: string[], side: 'CT' | 'T', valor: number) {
    for (const steamId of ids) {
      await db.exec(
        `INSERT INTO economy (match_id, round_num, steam_id, side, equip_value, buy_type)
         VALUES ('m1', ?, ?, ?, ?, 'force_buy')`,
        [roundNum, steamId, side, valor],
      );
    }
  }

  it('a compra do time usa limite POR PESSOA: quatro com 4100 ja e semi-eco', async () => {
    await roundDesfalcado();

    await economia(6, A, 'CT', 1025);
    await economia(6, B, 'T', 820);
    await ensureRoster(db);

    const r = await db.queryOne<{ ct: string; t: string }>(
      `SELECT ct_buy_type AS ct, t_buy_type AS t FROM rounds
        WHERE match_id = 'm1' AND round_num = 6`,
    );
    expect(r!.ct).toBe('semi_eco');
    expect(r!.t).toBe('eco');
  });

  it('com seis de um lado, a compra NAO e inflada', async () => {
    await base();
    for (const id of [...A, 'sai', 'entra', ...B]) await player(id, null);
    for (let r = 1; r <= 6; r += 1) {
      const ct = r === 3 ? [...A, 'sai', 'entra'] : [...A, 'sai'];
      await round(r, ct, B, 'CT');
    }

    await economia(3, [...A, 'sai', 'entra'], 'CT', 983);
    await economia(3, B, 'T', 983);
    await ensureRoster(db);

    const r = await db.queryOne<{ ct: string }>(
      `SELECT ct_buy_type AS ct FROM rounds WHERE match_id = 'm1' AND round_num = 3`,
    );
    expect(r!.ct).toBe('eco');
  });

  it('num round desfalcado, a primeira kill continua sendo entrada', async () => {
    await roundDesfalcado();
    await db.exec(
      `INSERT INTO kills (kill_id, match_id, round_num, tick, attacker_steam_id,
                          victim_steam_id, attacker_side, victim_side, is_entry)
       VALUES (1, 'm1', 6, 6700, 'a1', 'b1', 'CT', 'T', FALSE)`,
    );
    await ensureRoster(db);

    const k = await db.queryOne<{ is_entry: boolean }>(
      `SELECT is_entry FROM kills WHERE match_id = 'm1' AND kill_id = 1`,
    );
    expect(k!.is_entry).toBe(true);

    const prs = await db.queryOne<{ ok: boolean }>(
      `SELECT opening_kill AS ok FROM player_round_stats
        WHERE match_id = 'm1' AND round_num = 6 AND steam_id = 'a1'`,
    );
    expect(prs!.ok).toBe(true);
    const pm = await db.queryOne<{ n: number }>(
      `SELECT opening_kills AS n FROM player_match
        WHERE match_id = 'm1' AND steam_id = 'a1'`,
    );
    expect(Number(pm!.n)).toBe(1);
  });

  it('partida sem kill nem economia nao quebra o backfill', async () => {
    await roundDesfalcado();
    await expect(ensureRoster(db)).resolves.toBeTruthy();
  });
});

describe('cinco rounds desfalcados seguidos, e buraco dentro da janela', () => {
  async function comoNaDemo(): Promise<void> {
    await base();
    for (const id of [...A, 'sai', 'entra', ...B]) await player(id, null);
    for (let r = 1; r <= 25; r += 1) {

      const temSai = r <= 8 && r !== 3;
      const temEntra = r >= 14;
      const timeA = [...A, ...(temSai ? ['sai'] : []), ...(temEntra ? ['entra'] : [])];
      await round(r, timeA, B, 'CT');
    }
  }

  it('o buraco de um round NAO parte a janela em duas', async () => {
    await comoNaDemo();
    await ensureRoster(db);
    const s = await db.query<{ spell_seq: number; first_round: number; last_round: number; rounds: number }>(
      `SELECT spell_seq, first_round, last_round, rounds FROM roster_spells
        WHERE match_id = 'm1' AND steam_id = 'sai'`,
    );
    expect(s).toHaveLength(1);

    expect(s[0]).toMatchObject({ spell_seq: 0, first_round: 1, last_round: 8, rounds: 7 });
  });

  it('o intervalo de cinco rounds e registrado como cinco', async () => {
    await comoNaDemo();
    await ensureRoster(db);
    const h = await db.queryOne<{ gap_rounds: number; out_last_round: number; in_first_round: number }>(
      `SELECT gap_rounds, out_last_round, in_first_round FROM roster_handoffs
        WHERE match_id = 'm1'`,
    );
    expect(Number(h!.out_last_round)).toBe(8);
    expect(Number(h!.in_first_round)).toBe(14);
    expect(Number(h!.gap_rounds)).toBe(5);
  });

  it('os seis rounds desfalcados aparecem, e sao os seis certos', async () => {
    await comoNaDemo();
    await ensureRoster(db);
    const r = await db.query<{ round_num: number; roster_ct: number; roster_t: number }>(
      `SELECT round_num, roster_ct, roster_t FROM rounds
        WHERE match_id = 'm1' AND phase = 'live' AND roster_ct <> roster_t
        ORDER BY round_num`,
    );

    expect(r.map((x) => Number(x.round_num))).toEqual([3, 9, 10, 11, 12, 13]);
    for (const x of r) {
      expect(Number(x.roster_ct)).toBe(4);
      expect(Number(x.roster_t)).toBe(5);
    }
  });

  it('quem jogou pouquissimos rounds tem a janela certa', async () => {
    await base();
    for (const id of [...A, 'passagem', 'entra', ...B]) await player(id, null);
    for (let r = 1; r <= 26; r += 1) {
      const timeA = [...A, ...(r >= 3 && r <= 4 ? ['passagem'] : []), ...(r >= 6 ? ['entra'] : [])];
      await round(r, timeA, B, 'CT');
    }
    await ensureRoster(db);

    const s = await db.queryOne<{ first_round: number; last_round: number; rounds: number }>(
      `SELECT first_round, last_round, rounds FROM roster_spells
        WHERE match_id = 'm1' AND steam_id = 'passagem'`,
    );
    expect(s).toMatchObject({ first_round: 3, last_round: 4, rounds: 2 });
    const h = await db.queryOne<{ gap_rounds: number }>(
      `SELECT gap_rounds FROM roster_handoffs WHERE match_id = 'm1' AND out_steam_id = 'passagem'`,
    );
    expect(Number(h!.gap_rounds)).toBe(1);
  });
});
