import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertReadOnlySql, DuckDb, migrate, splitStatements, SCHEMA_VERSION } from '../src/index.js';

let dir: string;
let db: DuckDb;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2db-'));
  db = await DuckDb.open(join(dir, 'test.duckdb'));
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('migracoes', () => {
  it('aplica todas as migracoes e cria as tabelas principais', async () => {
    const { applied, current } = await migrate(db);
    expect(applied).toEqual(
      Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1),
    );
    expect(current).toBe(SCHEMA_VERSION);

    const tables = await db.listTables();
    for (const t of [
      'matches', 'players', 'player_match', 'rounds', 'kills', 'damages',
      'weapon_fires', 'blinds', 'bomb_events', 'grenades', 'grenade_detonations',
      'economy', 'engagements', 'heatmap_bins', 'match_findings',
      'player_metric_history', 'player_round_stats', 'ingest_jobs',
    ]) {
      expect(tables, `falta a tabela ${t}`).toContain(t);
    }
  });

  it('a migracao 002 adiciona o placar por TIME', async () => {
    await migrate(db);

    const row = await db.queryOne(
      `SELECT score_a_after, score_b_after, winner_team FROM rounds LIMIT 1`,
    );
    expect(row).toBeNull();
  });

  it('e idempotente: rodar de novo nao aplica nada', async () => {
    await migrate(db);
    const second = await migrate(db);
    expect(second.applied).toEqual([]);
  });

  it('splitStatements ignora ponto-e-virgula dentro de string e de comentario', () => {
    const sql = `
      -- um comentario; com ponto e virgula
      CREATE TABLE a(x VARCHAR);
      INSERT INTO a VALUES ('tem ; dentro');
      /* bloco; tambem */
      SELECT 1;
    `;
    expect(splitStatements(sql)).toHaveLength(3);
  });
});

describe('ids de evento por partida', () => {

  it('duas partidas podem ter o mesmo kill_id', async () => {
    await migrate(db);
    for (const matchId of ['partida-a', 'partida-b']) {
      await db.exec(
        'INSERT INTO kills (kill_id, match_id, tick) VALUES (?, ?, ?)',
        [1, matchId, 1000],
      );
    }
    const rows = await db.query<{ n: number }>('SELECT COUNT(*)::INTEGER AS n FROM kills');
    expect(Number(rows[0]!.n)).toBe(2);
  });

  it('o mesmo id repetido DENTRO da partida continua barrado', async () => {
    await migrate(db);
    await db.exec('INSERT INTO kills (kill_id, match_id, tick) VALUES (?, ?, ?)', [1, 'p', 10]);
    await expect(
      db.exec('INSERT INTO kills (kill_id, match_id, tick) VALUES (?, ?, ?)', [1, 'p', 20]),
    ).rejects.toThrow();
  });

  it('vale para todas as tabelas de evento, nao so kills', async () => {
    await migrate(db);
    const cases: [string, string][] = [
      ['damages', 'damage_id'],
      ['weapon_fires', 'fire_id'],
      ['blinds', 'blind_id'],
      ['bomb_events', 'bomb_event_id'],
      ['grenades', 'grenade_id'],
      ['grenade_detonations', 'det_id'],
      ['chat_messages', 'chat_id'],
      ['engagements', 'eng_id'],
    ];
    for (const [table, idColumn] of cases) {
      for (const matchId of ['partida-a', 'partida-b']) {
        await db.exec(
          `INSERT INTO ${table} (${idColumn}, match_id) VALUES (?, ?)`,
          [1, matchId],
        );
      }
      const rows = await db.query<{ n: number }>(
        `SELECT COUNT(*)::INTEGER AS n FROM ${table} WHERE ${idColumn} = 1`,
      );
      expect(Number(rows[0]!.n), table).toBe(2);
    }
  });
});

describe('tipos', () => {
  beforeEach(async () => {
    await migrate(db);
  });

  it('BIGINT volta como Number quando cabe, em vez de bigint', async () => {
    await db.exec(
      `INSERT INTO kills (kill_id, match_id, tick) VALUES (?, ?, ?)`,
      [1, 'm1', 119746],
    );
    const row = await db.queryOne<{ tick: unknown; kill_id: unknown }>(
      'SELECT tick, kill_id FROM kills',
    );
    expect(typeof row!.tick).toBe('number');
    expect(row!.tick).toBe(119746);
    expect(typeof row!.kill_id).toBe('number');
  });

  it('steam_id fica VARCHAR: um SteamID64 nao perde digito', async () => {
    const steamId = '76561198332912496';
    await db.exec(
      `INSERT INTO players (steam_id, last_known_name) VALUES (?, ?)`,
      [steamId, 'jorge'],
    );
    const row = await db.queryOne<{ steam_id: string }>('SELECT steam_id FROM players');
    expect(row!.steam_id).toBe(steamId);

    expect(String(Number(steamId))).not.toBe(steamId);
  });
});

describe('console SQL: guarda de somente-leitura', () => {
  it('aceita consultas de leitura', () => {
    for (const sql of [
      'SELECT 1',
      '  select * from matches ',
      'WITH x AS (SELECT 1) SELECT * FROM x',
      'DESCRIBE matches',
      'SHOW TABLES',
      'EXPLAIN SELECT 1',
      'SUMMARIZE matches',
      'FROM matches SELECT *',
    ]) {
      expect(() => assertReadOnlySql(sql), sql).not.toThrow();
    }
  });

  it('recusa qualquer coisa que escreva', () => {
    for (const sql of [
      'DROP TABLE matches',
      'DELETE FROM matches',
      'UPDATE matches SET score_a = 0',
      'INSERT INTO matches VALUES (1)',
      'ATTACH \'outro.duckdb\' AS x',
      'COPY matches TO \'saida.csv\'',
      'CREATE TABLE x(a INT)',
    ]) {
      expect(() => assertReadOnlySql(sql), sql).toThrow();
    }
  });

  it('recusa varias instrucoes de uma vez', () => {
    expect(() => assertReadOnlySql('SELECT 1; DROP TABLE matches')).toThrow(/uma consulta por vez/);
  });

  it('nao se deixa enganar por comentario antes do comando', () => {
    expect(() => assertReadOnlySql('-- SELECT\nDROP TABLE matches')).toThrow();
    expect(() => assertReadOnlySql('/* SELECT */ DELETE FROM matches')).toThrow();
  });

  it('ponto-e-virgula final sozinho e aceito', () => {
    expect(() => assertReadOnlySql('SELECT 1;')).not.toThrow();
  });
});

describe('rawConsoleQuery', () => {
  beforeEach(async () => {
    await migrate(db);
  });

  it('devolve colunas, tipos e tempo', async () => {
    const r = await db.rawConsoleQuery('SELECT 42 AS n, \'oi\' AS s', 100);
    expect(r.columns.map((c) => c.name)).toEqual(['n', 's']);
    expect(r.rows).toEqual([[42, 'oi']]);
    expect(r.rowCount).toBe(1);
    expect(r.truncated).toBe(false);
    expect(r.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('trunca no limite e avisa que truncou', async () => {
    const r = await db.rawConsoleQuery('SELECT * FROM range(1000)', 10);
    expect(r.rows).toHaveLength(10);
    expect(r.truncated).toBe(true);
  });
});

describe('transacoes', () => {
  beforeEach(async () => {
    await migrate(db);
  });

  it('desfaz tudo quando algo falha no meio', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec(`INSERT INTO players (steam_id, last_known_name) VALUES ('1', 'a')`);
        throw new Error('falha proposital');
      }),
    ).rejects.toThrow('falha proposital');

    const rows = await db.query('SELECT * FROM players');
    expect(rows).toHaveLength(0);
  });

  it('transacoes simultaneas nao colidem', async () => {

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        db.transaction(async (tx) => {
          await tx.exec('DELETE FROM players WHERE steam_id = ?', ['1']);
          await tx.exec(`INSERT INTO players (steam_id, last_known_name) VALUES ('1', ?)`, [`n${i}`]);
        }),
      ),
    );
    const rows = await db.query('SELECT * FROM players');
    expect(rows).toHaveLength(1);
  });

  it('uma transacao que falha nao trava a fila', async () => {
    await expect(db.transaction(async () => { throw new Error('x'); })).rejects.toThrow('x');
    const out = await db.transaction(async (tx) => {
      await tx.exec(`INSERT INTO players (steam_id, last_known_name) VALUES ('2', 'b')`);
      return 'ok';
    });
    expect(out).toBe('ok');
  });

  it('escrita fora da transacao nao entra de carona nela', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const tx = db.transaction(async (t) => {
      await t.exec(`INSERT INTO players (steam_id, last_known_name) VALUES ('3', 'c')`);
      await gate;
      throw new Error('desfaz');
    });

    await db.exec(`INSERT INTO players (steam_id, last_known_name) VALUES ('4', 'd')`);
    release();
    await expect(tx).rejects.toThrow('desfaz');

    const ids = (await db.query<{ steam_id: string }>('SELECT steam_id FROM players ORDER BY 1'))
      .map((r) => r.steam_id);

    expect(ids).toEqual(['4']);
  });
});
