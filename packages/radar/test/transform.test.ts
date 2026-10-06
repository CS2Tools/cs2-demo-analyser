import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AVAILABLE_MAPS,
  hasRadar,
  heightFraction,
  normalizeMapName,
  parseMapMeta,
  radarPercentToWorld,
  radarToPixel,
  splitIndexForZ,
  stripLineComments,
  survivableDistance,
  UnsupportedMapMetaError,
  worldToPixel,
  worldToRadarPercent,
} from '../src/index.js';
import { loadMeta, VENDOR_DIR } from './helpers.js';

const GOLDEN = [
  { map: 'de_overpass', world: { x: 0, y: 0, z: 0 }, px: 91.057855, py: 66.738055, split: -1 },
  { map: 'de_overpass', world: { x: -1000, y: 500, z: 100 }, px: 72.205297, py: 76.164334, split: -1 },
  { map: 'de_mirage', world: { x: 0, y: 0, z: 0 }, px: 63.029133, py: 66.336218, split: -1 },
  { map: 'de_mirage', world: { x: -1500, y: -500, z: -200 }, px: 33.848979, py: 56.6095, split: -1 },
  { map: 'de_dust2', world: { x: 0, y: 0, z: 0 }, px: 54.820668, py: 27.854226, split: -1 },
  { map: 'de_dust2', world: { x: 1000, y: 1000, z: 0 }, px: 77.01527, py: 50.048828, split: -1 },

  { map: 'de_nuke', world: { x: 0, y: 0, z: -100 }, px: 46.029952, py: 83.805292, split: -1 },
  { map: 'de_nuke', world: { x: 0, y: 0, z: -1000 }, px: 46.029952, py: 37.805292, split: 0 },
  { map: 'de_nuke', world: { x: 500, y: -800, z: -700 }, px: 53.025385, py: 26.612598, split: 0 },

  { map: 'de_vertigo', world: { x: 0, y: 0, z: 11800 }, px: 76.589277, py: 74.817288, split: -1 },
  { map: 'de_vertigo', world: { x: 0, y: 0, z: 11600 }, px: 76.789277, py: 32.217288, split: 0 },
  { map: 'de_vertigo', world: { x: -1000, y: 200, z: 11600 }, px: 57.100517, py: 36.15504, split: 0 },
] as const;

describe('worldToRadarPercent — tabela golden', () => {
  for (const g of GOLDEN) {
    it(`${g.map} (${g.world.x}, ${g.world.y}, ${g.world.z})`, () => {
      const got = worldToRadarPercent(g.world, loadMeta(g.map));
      expect(got.px).toBeCloseTo(g.px, 5);
      expect(got.py).toBeCloseTo(g.py, 5);
      expect(got.split).toBe(g.split);
    });
  }
});

describe('selecao de nivel por Z', () => {
  it('os limites do split sao ESTRITAMENTE exclusivos', () => {
    const nuke = loadMeta('de_nuke');
    const { top, bottom } = nuke.splits[0]!.bounds;

    expect(splitIndexForZ(nuke, top)).toBe(-1);
    expect(splitIndexForZ(nuke, bottom)).toBe(-1);

    expect(splitIndexForZ(nuke, top - 0.001)).toBe(0);
    expect(splitIndexForZ(nuke, bottom + 0.001)).toBe(0);

    expect(splitIndexForZ(nuke, 0)).toBe(-1);
    expect(splitIndexForZ(nuke, -5000)).toBe(-1);
  });

  it('sem Z, nunca entra em split (o dot fica no andar principal)', () => {
    const nuke = loadMeta('de_nuke');
    expect(splitIndexForZ(nuke, undefined)).toBe(-1);
    expect(worldToRadarPercent({ x: 0, y: 0 }, nuke).split).toBe(-1);
  });

  it('mapas planos ignoram Z completamente', () => {
    const mirage = loadMeta('de_mirage');
    const a = worldToRadarPercent({ x: 100, y: 200, z: -9999 }, mirage);
    const b = worldToRadarPercent({ x: 100, y: 200, z: 9999 }, mirage);
    expect(a).toEqual(b);
  });

  it('a troca de andar desloca em pontos percentuais, nao em pixels', () => {
    const nuke = loadMeta('de_nuke');
    const upper = worldToRadarPercent({ x: 0, y: 0, z: -100 }, nuke);
    const lower = worldToRadarPercent({ x: 0, y: 0, z: -1000 }, nuke);
    expect(lower.py - upper.py).toBeCloseTo(nuke.splits[0]!.offset.y, 9);
    expect(lower.px - upper.px).toBeCloseTo(nuke.splits[0]!.offset.x, 9);
  });
});

describe('radarToPixel', () => {
  it('inverte o eixo Y: a origem do radar e embaixo, a do canvas e em cima', () => {
    expect(radarToPixel({ px: 0, py: 0 }, 2048, 2048)).toEqual({ x: 0, y: 2048 });
    expect(radarToPixel({ px: 100, py: 100 }, 2048, 2048)).toEqual({ x: 2048, y: 0 });
    expect(radarToPixel({ px: 50, py: 50 }, 2048, 2048)).toEqual({ x: 1024, y: 1024 });
  });

  it('worldToPixel combina as duas etapas', () => {
    const meta = loadMeta('de_overpass');
    const got = worldToPixel({ x: 0, y: 0, z: 0 }, meta, 2048, 2048);
    expect(got.x).toBeCloseTo((91.057855 / 100) * 2048, 3);
    expect(got.y).toBeCloseTo(((100 - 66.738055) / 100) * 2048, 3);
  });
});

describe('radarPercentToWorld', () => {
  it('faz round-trip em mapa plano', () => {
    const meta = loadMeta('de_dust2');
    const world = { x: -1234.5, y: 678.25, z: 0 };
    const back = radarPercentToWorld(worldToRadarPercent(world, meta), meta);
    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.y).toBeCloseTo(world.y, 6);
  });

  it('faz round-trip no andar de baixo de Nuke quando o split e informado', () => {
    const meta = loadMeta('de_nuke');
    const world = { x: 320, y: -900, z: -700 };
    const p = worldToRadarPercent(world, meta);
    expect(p.split).toBe(0);
    const back = radarPercentToWorld(p, meta, p.split);
    expect(back.x).toBeCloseTo(world.x, 6);
    expect(back.y).toBeCloseTo(world.y, 6);
  });
});

describe('heightFraction', () => {
  it('normaliza dentro da faixa do nivel ativo', () => {
    const meta = loadMeta('de_mirage');
    expect(heightFraction(meta, -300, -1)).toBe(0);
    expect(heightFraction(meta, 20, -1)).toBe(1);
    expect(heightFraction(meta, -140, -1)).toBeCloseTo(0.5, 2);
  });

  it('trunca fora da faixa em vez de extrapolar', () => {
    const meta = loadMeta('de_mirage');
    expect(heightFraction(meta, -9999, -1)).toBe(0);
    expect(heightFraction(meta, 9999, -1)).toBe(1);
  });

  it('usa a faixa do split quando o jogador esta no andar de baixo', () => {
    const meta = loadMeta('de_nuke');
    expect(heightFraction(meta, -770, 0)).toBe(0);
    expect(heightFraction(meta, -480, 0)).toBe(1);
  });

  it('devolve null quando o mapa nao declara zRange (de_cache)', () => {
    expect(loadMeta('de_cache').zRange).toBeUndefined();
    expect(heightFraction(loadMeta('de_cache'), 0, -1)).toBeNull();
  });
});

describe('survivableDistance', () => {
  it('indexa por floor(health / 5): 0 => 1 HP, 1 => 5 HP', () => {
    const meta = loadMeta('de_overpass');
    const t = meta.survivableDistance!;
    expect(survivableDistance(meta, 1, -1)).toBe(t[0]);
    expect(survivableDistance(meta, 5, -1)).toBe(t[1]);
    expect(survivableDistance(meta, 100, -1)).toBe(t[20]);
  });

  it('trunca no fim da tabela em vez de devolver undefined', () => {
    const meta = loadMeta('de_overpass');
    const t = meta.survivableDistance!;
    expect(survivableDistance(meta, 999, -1)).toBe(t[t.length - 1]);
  });

  it('devolve null quando o mapa nao traz a tabela (de_anubis)', () => {
    expect(survivableDistance(loadMeta('de_anubis'), 100, -1)).toBeNull();
  });
});

describe('normalizeMapName', () => {
  it('pega o ultimo segmento de um caminho de workshop', () => {
    expect(normalizeMapName('workshop/3070506740/de_mirage')).toBe('de_mirage');
    expect(normalizeMapName('de_nuke')).toBe('de_nuke');
    expect(normalizeMapName('  DE_Dust2 ')).toBe('de_dust2');
  });

  it('hasRadar reconhece mapa de workshop que aponta para um mapa conhecido', () => {
    expect(hasRadar('workshop/123/de_mirage')).toBe(true);
    expect(hasRadar('de_basalt')).toBe(false);
    expect(hasRadar('cs_italy')).toBe(false);
  });
});

describe('meta.json5', () => {
  it('so remove comentarios de linha inteira, preservando a contagem de linhas', () => {
    const src = '{\n  // um comentario\n  "a": 1\n}';
    const out = stripLineComments(src);
    expect(out.split('\n')).toHaveLength(4);
    expect(JSON.parse(out)).toEqual({ a: 1 });
  });

  it('rejeita versao de formato diferente de 4', () => {
    const raw = JSON.stringify({
      version: { radar: 1, format: 3 },
      resolution: 5,
      offset: { x: 0, y: 0 },
      splits: [],
    });
    expect(() => parseMapMeta('de_teste', raw)).toThrow(UnsupportedMapMetaError);
  });

  it('todos os mapas vendorizados fazem parse e estao no formato 4', () => {
    const dirs = readdirSync(VENDOR_DIR).filter((d) => d.startsWith('de_'));
    expect(dirs.sort()).toEqual([...AVAILABLE_MAPS].sort());
    for (const map of dirs) {
      const meta = parseMapMeta(map, readFileSync(join(VENDOR_DIR, map, 'meta.json5'), 'utf8'));
      expect(meta.version.format).toBe(4);
      expect(meta.resolution).toBeGreaterThan(0);
    }
  });

  it('os PNGs vendorizados sao 2048x2048 RGBA', () => {
    for (const map of AVAILABLE_MAPS) {
      const buf = readFileSync(join(VENDOR_DIR, map, 'radar.png'));
      expect(buf.readUInt32BE(16)).toBe(2048);
      expect(buf.readUInt32BE(20)).toBe(2048);
      expect(buf[25]).toBe(6);
    }
  });
});
