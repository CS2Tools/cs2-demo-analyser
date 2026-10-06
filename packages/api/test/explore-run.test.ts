import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { exploreSpecSchema } from '@cs2/contract';
import {
  EXAMPLE_QUERIES,
  exploreCatalog,
  listSavedQueries,
  removeSavedQuery,
  runExplore,
  saveQuery,
} from '../src/explore/queries.js';

let dir: string;
let db: DuckDb;

async function seed(): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, ingested_at, schema_version, bulk_state, pinned,
                          team_a_name, team_b_name)
     VALUES ('m1', 'sha', 'a.dem', 'de_mirage', TRUE, 64, 'inferred', ?, 1, 'full', FALSE,
             'Nos', 'Eles')`,
    [new Date()],
  );
  await db.exec(
    `INSERT INTO player_match (match_id, steam_id, name) VALUES ('m1', 'p1', 'eu'), ('m1', 'p2', 'ele')`,
  );
  await db.exec(
    `INSERT INTO kills (kill_id, match_id, round_num, tick, attacker_steam_id, victim_steam_id,
                        attacker_side, victim_side, weapon, headshot, penetrated, distance,
                        is_entry, is_trade_kill, death_was_traded)
     VALUES (1, 'm1', 1, 100, 'p1', 'p2', 'CT', 'T', 'ak47', TRUE, 0, 500, TRUE, FALSE, FALSE),
            (2, 'm1', 1, 200, 'p1', 'p2', 'CT', 'T', 'awp', FALSE, 1, 1500, FALSE, FALSE, TRUE),
            (3, 'm1', 2, 300, 'p2', 'p1', 'T', 'CT', 'ak47', TRUE, 0, 300, TRUE, TRUE, FALSE)`,
  );
  await db.exec(
    `INSERT INTO damages (damage_id, match_id, round_num, tick, attacker_steam_id,
                          victim_steam_id, weapon, dmg_health, is_utility, is_team_damage)
     VALUES (1, 'm1', 1, 90, 'p1', 'p2', 'hegrenade', 40, TRUE, FALSE),
            (2, 'm1', 1, 95, 'p1', 'p2', 'ak47', 100, FALSE, FALSE)`,
  );
  await db.exec(
    `INSERT INTO rounds (match_id, round_num, phase, winner_side, win_reason, ct_buy_type,
                         t_buy_type, ct_equip_value, t_equip_value, half)
     VALUES ('m1', 1, 'live', 'CT', 'ct_killed', 'full_buy', 'force_buy', 20000, 12000, 1),
            ('m1', 2, 'live', 'T', 't_killed', 'eco', 'force_buy', 4000, 13000, 1)`,
  );
  await db.exec(
    `INSERT INTO economy (match_id, round_num, steam_id, side, start_balance, spent, equip_value,
                          buy_type, team_buy_type, primary_weapon)
     VALUES ('m1', 1, 'p1', 'CT', 5000, 4000, 4700, 'full_buy', 'full_buy', 'ak47'),
            ('m1', 1, 'p2', 'T', 2000, 1900, 2400, 'force_buy', 'force_buy', 'galilar')`,
  );
  await db.exec(
    `INSERT INTO player_round_stats (match_id, round_num, steam_id, side, kills, deaths, damage,
                                     utility_damage, survived, opening_kill, opening_death,
                                     buy_type, unused_utility_value)
     VALUES ('m1', 1, 'p1', 'CT', 2, 0, 140, 40, TRUE, TRUE, FALSE, 'full_buy', 0),
            ('m1', 1, 'p2', 'T', 0, 1, 0, 0, FALSE, FALSE, TRUE, 'force_buy', 500)`,
  );
  await db.exec(
    `INSERT INTO utility_throws (match_id, throw_id, map_name, round_num, steam_id, side,
                                 grenade_type, throw_tick, throw_x, throw_y, throw_z,
                                 crouched, on_ground, speed, throw_strength,
                                 enemies_blinded, enemy_damage, kills_after)
     VALUES ('m1', 1, 'de_mirage', 1, 'p1', 'CT', 'smoke', 80, 1, 2, 3, FALSE, TRUE, 0, 1, 0, 0, 0),
            ('m1', 2, 'de_mirage', 1, 'p1', 'CT', 'flashbang', 85, 1, 2, 3, FALSE, FALSE, 200, 0.5, 2, 0, 1)`,
  );
  await db.exec(
    `INSERT INTO engagements (eng_id, match_id, round_num, player_steam_id, enemy_steam_id,
                              tick_first_shot, preaim_total_deg, firstshot_total_deg, distance,
                              weapon, outcome, player_was_moving, player_was_blind)
     VALUES (1, 'm1', 1, 'p1', 'p2', 100, 2.5, 1.2, 500, 'ak47', 'kill', FALSE, FALSE)`,
  );
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2explore-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
  await seed();
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

const spec = (patch: Record<string, unknown>) => exploreSpecSchema.parse(patch);

describe('explorador', () => {
  it('responde "kills por arma" com os numeros certos', async () => {
    const out = await runExplore(db, spec({
      subject: 'kills', groupBy: ['weapon'], measures: [{ agg: 'count' }],
    }));
    expect(out.columns.map((c) => c.key)).toEqual(['weapon', 'count']);
    expect(out.rows).toEqual([['ak47', 2], ['awp', 1]]);
    expect(out.sql).toContain('GROUP BY');
  });

  it('% de headshot sai como porcentagem, nao como fracao', async () => {
    const out = await runExplore(db, spec({
      subject: 'kills', groupBy: ['weapon'],
      measures: [{ agg: 'share', field: 'headshot' }],
      orderBy: { index: 0, dir: 'asc' },
    }));
    expect(out.rows).toEqual([['ak47', 100], ['awp', 0]]);
  });

  it('filtro de texto nao executa SQL, so nao acha nada', async () => {
    const out = await runExplore(db, spec({
      subject: 'kills',
      filters: [{ field: 'player', op: 'is', value: "'; DROP TABLE kills; --" }],
      measures: [{ agg: 'count' }],
    }));
    expect(out.rows).toEqual([[0]]);

    const still = await db.queryOne<{ n: number }>('SELECT COUNT(*)::INTEGER AS n FROM kills');
    expect(Number(still!.n)).toBe(3);
  });

  it('sem agrupamento, mostra as linhas e onde abrir o replay', async () => {
    const out = await runExplore(db, spec({ subject: 'kills' }));
    expect(out.rows).toHaveLength(3);
    expect(out.replay).not.toBeNull();
    const row = out.rows[0]!;
    expect(row[out.replay!.matchIdIndex]).toBe('m1');
    expect(typeof row[out.replay!.tickIndex!]).toBe('number');
  });

  it('campo fora do catalogo vira erro de pergunta, nao erro de banco', async () => {
    await expect(
      runExplore(db, spec({ subject: 'kills', groupBy: ['tabela_secreta'] })),
    ).rejects.toThrow(/campo desconhecido/);
  });

  it('todas as perguntas prontas rodam', async () => {
    for (const example of EXAMPLE_QUERIES) {
      const out = await runExplore(db, spec(example.spec));
      expect(out.columns.length, example.name).toBeGreaterThan(0);
      expect(out.sql, example.name).not.toContain('undefined');
    }
  });

  it('o catalogo nao expoe uma linha de SQL', () => {
    const json = JSON.stringify(exploreCatalog());
    expect(json).not.toMatch(/SELECT|JOIN|match_id/i);
    expect(exploreCatalog().find((s) => s.id === 'kills')!.canOpenReplay).toBe(true);
  });

  it('pergunta salva volta igual e pode ser apagada', async () => {
    const saved = await saveQuery(db, {
      name: 'minhas kills de awp',
      spec: spec({
        subject: 'kills',
        filters: [{ field: 'weapon', op: 'is', value: 'awp' }],
        groupBy: ['player'],
        measures: [{ agg: 'count' }],
      }),
    });

    const list = await listSavedQueries(db);
    expect(list).toHaveLength(1);
    expect(list[0]!.spec).toEqual(saved.spec);

    const out = await runExplore(db, list[0]!.spec);
    expect(out.rows).toEqual([['eu', 1]]);

    expect(await removeSavedQuery(db, saved.queryId)).toBe(true);
    expect(await listSavedQueries(db)).toHaveLength(0);
  });

  it('pergunta que nao compila nao entra na lista de salvas', async () => {
    await expect(
      saveQuery(db, { name: 'ruim', spec: spec({ subject: 'kills', groupBy: ['nao_existe'] }) }),
    ).rejects.toThrow();
    expect(await listSavedQueries(db)).toHaveLength(0);
  });
});
