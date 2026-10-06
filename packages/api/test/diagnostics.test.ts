import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuckDb, migrate } from '@cs2/db';
import type { MapInfo } from '@cs2/contract';
import { getDiagnostics } from '../src/diagnostics.js';

let dir: string;
let db: DuckDb;

const MAPS: MapInfo[] = [
  { name: 'de_mirage', hasRadar: true, resolution: 5, offset: { x: 0, y: 0 }, splitCount: 0 },
  { name: 'de_nuke', hasRadar: true, resolution: 5, offset: { x: 0, y: 0 }, splitCount: 1 },
];

async function seedMatch(opts: {
  id: string;
  map: string;
  build?: string | null;
  format?: string | null;
  voice?: boolean;
  pruned?: boolean;
  pinned?: boolean;
  day?: number;
}): Promise<void> {
  await db.exec(
    `INSERT INTO matches (match_id, demo_sha256, file_name, map_name, has_radar, tick_rate,
                          tick_rate_source, schema_version, ingested_at, played_at, bulk_state,
                          pinned, has_voice, demo_build, demo_format, team_a_name, team_b_name)
     VALUES (?, ?, ?, ?, TRUE, 64, 'inferred', 3, ?, ?, ?, ?, ?, ?, ?, 'Nos', 'Eles')`,
    [opts.id, opts.id.repeat(10).slice(0, 64), `${opts.id}.dem`, opts.map,
     new Date(Date.UTC(2026, 0, opts.day ?? 1)), new Date(Date.UTC(2026, 0, opts.day ?? 1)),
     opts.pruned ? 'pruned' : 'full', opts.pinned ?? false, opts.voice ?? false,
     opts.build ?? null, opts.format ?? null],
  );
  await db.exec(
    `INSERT INTO player_match (match_id, steam_id, name) VALUES (?, '76561198000000001', 'eu')`,
    [opts.id],
  );
}

const run = (voiceDir?: string) =>
  getDiagnostics({
    db,
    dataDir: dir,
    appVersion: '9.9.9',
    transport: 'http',
    voiceExtractorDir: voiceDir,
    maps: MAPS,
  });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cs2diag-'));
  db = await DuckDb.open(join(dir, 'library.duckdb'));
  await migrate(db);
});

afterEach(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('diagnostico', () => {
  it('biblioteca vazia responde sem quebrar', async () => {
    const d = await run();
    expect(d.library.matches).toBe(0);
    expect(d.builds).toEqual([]);
    expect(d.mapsWithoutRadar).toEqual([]);

    expect(d.radars.map((r) => r.name)).toEqual(['de_mirage', 'de_nuke']);
    expect(d.radars.every((r) => r.matches === 0)).toBe(true);
  });

  it('agrupa as builds do CS2 e nao esconde as nao detectadas', async () => {
    await seedMatch({ id: 'm1', map: 'de_mirage', build: '14182', format: 'valve_demo_2', day: 3 });
    await seedMatch({ id: 'm2', map: 'de_mirage', build: '14182', format: 'valve_demo_2', day: 4 });
    await seedMatch({ id: 'm3', map: 'de_nuke', day: 1 });

    const d = await run();

    expect(d.builds.map((b) => [b.build, b.matches])).toEqual([['14182', 2], [null, 1]]);
    expect(d.builds[0]!.format).toBe('valve_demo_2');
  });

  it('conta partidas por radar e denuncia o mapa sem radar', async () => {
    await seedMatch({ id: 'm1', map: 'de_mirage' });
    await seedMatch({ id: 'm2', map: 'de_mirage' });
    await seedMatch({ id: 'm3', map: 'de_cbble' });

    const d = await run();
    expect(d.radars.find((r) => r.name === 'de_mirage')!.matches).toBe(2);
    expect(d.radars.find((r) => r.name === 'de_nuke')!.matches).toBe(0);
    expect(d.mapsWithoutRadar).toEqual([{ name: 'de_cbble', matches: 1 }]);
  });

  it('sem o extrator instalado, o diagnostico diz que NENHUMA partida teria voz', async () => {
    await seedMatch({ id: 'm1', map: 'de_mirage', voice: true });
    await seedMatch({ id: 'm2', map: 'de_mirage', voice: false });

    const semExtrator = await run(join(dir, 'nao-existe'));
    expect(semExtrator.voice.extractorInstalled).toBe(false);
    expect([semExtrator.voice.withVoice, semExtrator.voice.withoutVoice]).toEqual([1, 1]);

    const bin = join(dir, 'voz');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'csgove.exe'), '');
    expect((await run(bin)).voice.extractorInstalled).toBe(true);

    expect((await run()).voice.extractorInstalled).toBe(false);
  });

  it('conta poda, fixadas e jogadores distintos', async () => {
    await seedMatch({ id: 'm1', map: 'de_mirage', pruned: true, day: 1 });
    await seedMatch({ id: 'm2', map: 'de_nuke', pinned: true, day: 2 });
    await db.exec(
      `INSERT INTO player_match (match_id, steam_id, name) VALUES ('m2', '76561198000000002', 'ele')`,
    );

    const d = await run();
    expect([d.library.matches, d.library.pruned, d.library.pinned]).toEqual([2, 1, 1]);

    expect(d.library.players).toBe(2);
    expect(d.library.oldest! < d.library.newest!).toBe(true);
  });

  it('carrega a versao do schema e das regras, que e o que se pergunta no suporte', async () => {
    const d = await run();
    expect(d.app.version).toBe('9.9.9');
    expect(d.app.transport).toBe('http');
    expect(d.app.schemaVersion).toBeGreaterThan(0);
    expect(d.app.rulesVersion).toBeGreaterThan(0);
    expect(d.storage.dataDir).toBe(dir);
  });
});
