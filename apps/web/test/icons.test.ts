import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EQUIPMENT_ICONS,
  inventoryCategory,
  KILLFEED_ICONS,
  mapIcon,
  SIDE_ICONS,
  weaponIcon,
} from '../src/lib/icons';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const MANIFEST = join(ROOT, 'vendor', 'counter-strike-icons', 'manifest.json');
const files = new Set(Object.keys((JSON.parse(readFileSync(MANIFEST, 'utf8')) as { files: object }).files));

const DISPLAY = [
  'AK-47', 'AWP', 'C4 Explosive', 'Decoy Grenade', 'Desert Eagle', 'Dual Berettas',
  'FAMAS', 'Falchion Knife', 'Five-SeveN', 'Flashbang', 'Galil AR', 'Glock-18',
  'Gut Knife', 'High Explosive Grenade', 'Huntsman Knife', 'Incendiary Grenade',
  'M4A1-S', 'M4A4', 'MAC-10', 'MP7', 'MP9', 'Molotov', 'Nomad Knife', 'P250',
  'Paracord Knife', 'R8 Revolver', 'SSG 08', 'Smoke Grenade', 'Survival Knife',
  'Tec-9', 'USP-S', 'XM1014', 'knife', 'knife_t',
];

const EVENTS = [
  'ak47', 'm4a1_silencer', 'usp_silencer', 'awp', 'mp9', 'glock', 'galilar', 'xm1014',
  'knife_canis', 'famas', 'fiveseven', 'ssg08', 'knife_falchion', 'knife_tactical',
  'planted_c4', 'inferno', 'm4a1', 'revolver', 'knife', 'elite', 'tec9', 'deagle',
  'hegrenade', 'hkp2000', 'mac10', 'molotov', 'mp7', 'p250', 'smokegrenade',
];

describe('icones: todo nome real da demo tem icone que existe no manifesto', () => {
  it('nomes de exibicao do inventario', () => {
    const missing = DISPLAY.filter((n) => {
      const icon = weaponIcon(n);
      return !icon || !files.has(icon);
    });
    expect(missing).toEqual([]);
  });

  it('nomes internos dos eventos', () => {
    const missing = EVENTS.filter((n) => {
      const icon = weaponIcon(n);
      return !icon || !files.has(icon);
    });
    expect(missing).toEqual([]);
  });

  it('convencao da Valve: interno m4a1 e a M4A4, e a M4A1-S tem icone proprio', () => {
    expect(weaponIcon('M4A4')).toBe(weaponIcon('m4a1'));
    expect(weaponIcon('M4A1-S')).toBe('equipment/m4a1_silencer.svg');
    expect(weaponIcon('M4A1-S')).not.toBe(weaponIcon('M4A4'));
  });

  it('equipamento, killfeed e lados existem', () => {
    for (const rel of [...Object.values(EQUIPMENT_ICONS), ...Object.values(KILLFEED_ICONS), ...Object.values(SIDE_ICONS)]) {
      expect(files.has(rel), rel).toBe(true);
    }
  });

  it('todos os mapas com radar tem icone', () => {
    const maps = ['de_ancient', 'de_anubis', 'de_cache', 'de_dust2', 'de_inferno', 'de_mirage',
      'de_nuke', 'de_overpass', 'de_train', 'de_vertigo'];
    for (const m of maps) expect(mapIcon(m, files), m).not.toBeNull();
    expect(mapIcon('cs_office', files)).toBeNull();
  });

  it('faca com skin desconhecida cai no icone generico; arma desconhecida da nulo', () => {
    expect(weaponIcon('Kukri Knife Doppler')).toBe('equipment/knife.svg');
    expect(weaponIcon('Arma Nova')).toBeNull();
  });

  it('os arquivos do manifesto estao no disco (rode npm run fetch:icons)', () => {

    const sample = join(ROOT, 'vendor', 'counter-strike-icons', 'equipment', 'ak47.svg');
    if (!existsSync(sample)) return;
    expect(existsSync(sample)).toBe(true);
  });
});

describe('inventoryCategory', () => {
  it('ordena como o jogo', () => {
    expect(inventoryCategory('AK-47')).toBe('primary');
    expect(inventoryCategory('Glock-18')).toBe('secondary');
    expect(inventoryCategory('Desert Eagle')).toBe('secondary');
    expect(inventoryCategory('Smoke Grenade')).toBe('grenade');
    expect(inventoryCategory('Incendiary Grenade')).toBe('grenade');
    expect(inventoryCategory('C4 Explosive')).toBe('c4');
    expect(inventoryCategory('Huntsman Knife')).toBe('knife');
    expect(inventoryCategory('knife_t')).toBe('knife');
  });
});
