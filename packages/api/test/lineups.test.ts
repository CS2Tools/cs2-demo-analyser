import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import { deleteMatchRows } from '../src/match-queries.js';
import {
  getRoundThrows,
  getUtilityMaps,
  listCollection,
  removeFromCollection,
  renameInCollection,
  saveToCollection,
} from '../src/lineup-queries.js';

let dir: string;
let maps: string;
let db: DuckDb;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2lineup-'));
  maps = join(dir, 'maps');
  mkdirSync(maps, { recursive: true });
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);

  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar,
                          tick_rate, tick_rate_source, ingested_at, schema_version,
                          bulk_state, pinned)
     VALUES ('m1', 'sha1', 'a.dem', 'de_mirage', TRUE, 64, 'inferred', ?, 1, 'full', FALSE)`,
    [new Date()],
  );
  await db.exec(`INSERT INTO player_match (match_id, steam_id, name) VALUES ('m1', 'p1', 'jogador')`);
  await db.exec(
    `INSERT INTO rounds (match_id, round_num, phase, freeze_end_tick)
     VALUES ('m1', 3, 'live', 900)`,
  );
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

async function insertThrow(patch: { throwId: number; tick?: number; type?: string }): Promise<void> {
  await db.exec(
    `INSERT INTO utility_throws
       (match_id, throw_id, map_name, round_num, steam_id, side, grenade_type,
        throw_tick, detonate_tick, flight_time,
        throw_x, throw_y, throw_z, pitch, yaw, crouched, on_ground, speed, throw_strength,
        det_x, det_y, det_z, enemies_blinded, enemy_damage, kills_after)
     VALUES ('m1', ?, 'de_mirage', 3, 'p1', 'T', ?, ?, 1100, 100,
             100, 200, 64, -10, 90, FALSE, TRUE, 0, 1, 900, 900, 64, 1, 30, 1)`,
    [patch.throwId, patch.type ?? 'smoke', patch.tick ?? 1000],
  );
}

describe('granadas do round (painel do replay)', () => {
  it('lista as granadas com tempo de round e comando de treino', async () => {
    await insertThrow({ throwId: 1, tick: 1028 });
    await insertThrow({ throwId: 2, tick: 1540, type: 'flashbang' });

    const out = await getRoundThrows(db, maps, { matchId: 'm1', roundNum: 3 });
    expect(out.extracted).toBe(true);
    expect(out.throws).toHaveLength(2);

    expect(out.throws[0]!.secondsIntoRound).toBe(2);
    expect(out.throws[0]!.command).toMatch(/^setpos .* setang /);
    expect(out.throws[0]!.savedAs).toBeNull();
    expect(out.throws[1]!.grenadeType).toBe('flashbang');
  });

  it('diz quando a partida ainda nao foi extraida', async () => {
    const out = await getRoundThrows(db, maps, { matchId: 'm1', roundNum: 3 });
    expect(out.extracted).toBe(false);
    expect(out.throws).toEqual([]);
  });

  it('marca o que ja esta na colecao, para nao salvar duas vezes', async () => {
    await insertThrow({ throwId: 1, tick: 1028 });
    await saveToCollection(db, maps, {
      matchId: 'm1', throwId: 1, name: 'Smoke de janela', note: null,
    });

    const out = await getRoundThrows(db, maps, { matchId: 'm1', roundNum: 3 });
    expect(out.throws[0]!.savedAs).toBe('Smoke de janela');
  });
});

describe('colecao de utilitarias', () => {
  it('a biblioteca mostra SO o que foi salvo, nao toda granada da partida', async () => {
    await insertThrow({ throwId: 1 });
    await insertThrow({ throwId: 2, tick: 1200 });
    await insertThrow({ throwId: 3, tick: 1400 });

    expect(await getUtilityMaps(db)).toEqual([]);

    await saveToCollection(db, maps, { matchId: 'm1', throwId: 2, name: 'A escolhida', note: null });

    const mapsOut = await getUtilityMaps(db);
    expect(mapsOut).toEqual([{ mapName: 'de_mirage', hasRadar: true, saved: 1 }]);
    const collection = await listCollection(db, maps);
    expect(collection).toHaveLength(1);
    expect(collection[0]!.name).toBe('A escolhida');
  });

  it('filtra a colecao por mapa', async () => {
    await insertThrow({ throwId: 1 });
    await saveToCollection(db, maps, { matchId: 'm1', throwId: 1, name: 'x', note: null });

    expect(await listCollection(db, maps, 'de_mirage')).toHaveLength(1);
    expect(await listCollection(db, maps, 'de_nuke')).toHaveLength(0);
  });

  it('a utilitaria salva sobrevive a partida de origem ser apagada', async () => {
    await insertThrow({ throwId: 1 });
    const saved = await saveToCollection(db, maps, {
      matchId: 'm1', throwId: 1, name: 'Janela', note: 'da entrada',
    });
    expect(saved.canOpenReplay).toBe(true);

    await deleteMatchRows(db, 'm1');

    const collection = await listCollection(db, maps);
    expect(collection).toHaveLength(1);
    expect(collection[0]).toMatchObject({ name: 'Janela', note: 'da entrada' });
    expect(collection[0]!.command).toBe(saved.command);

    expect(collection[0]!.canOpenReplay).toBe(false);
  });

  it('partida podada mantem a utilitaria salva, sem o botao de replay', async () => {
    await insertThrow({ throwId: 1 });
    await saveToCollection(db, maps, { matchId: 'm1', throwId: 1, name: 'x', note: null });
    await db.exec(`UPDATE matches SET bulk_state = 'pruned' WHERE match_id = 'm1'`);

    const collection = await listCollection(db, maps);
    expect(collection[0]!.canOpenReplay).toBe(false);
  });

  it('renomear e apagar', async () => {
    await insertThrow({ throwId: 1 });
    const saved = await saveToCollection(db, maps, {
      matchId: 'm1', throwId: 1, name: 'sem nome', note: null,
    });

    const renamed = await renameInCollection(db, maps, {
      lineupId: saved.lineupId, name: 'Smoke do meio', note: 'sai do spawn',
    });
    expect(renamed).toMatchObject({ name: 'Smoke do meio', note: 'sai do spawn' });

    expect(await removeFromCollection(db, saved.lineupId)).toBe(true);
    expect(await removeFromCollection(db, saved.lineupId)).toBe(false);
    expect(await listCollection(db, maps)).toHaveLength(0);
  });
});
