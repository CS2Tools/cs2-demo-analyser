import { describe, expect, it } from 'vitest';
import {
  ARMOR_PRICE,
  classifyBuy,
  classifyTeamBuy,
  equipmentValue,
  HELMET_EXTRA,
  isAimDuelWeapon,
  normalizeWeaponName,
  weaponClass,
  weaponPrice,
} from '../src/weapons.js';

describe('normalizeWeaponName', () => {
  it('aceita as varias formas que o jogo usa para a mesma arma', () => {

    for (const forma of ['AK-47', 'weapon_ak47', 'ak47', 'AK47']) {
      expect(normalizeWeaponName(forma)).toBe('ak47');
    }
  });

  it('normaliza nomes com sufixo silenciado', () => {
    expect(normalizeWeaponName('USP-S')).toBe('usps');
    expect(normalizeWeaponName('M4A1-S')).toBe('m4a1s');
  });
});

const NOMES_REAIS = [
  'AK-47', 'AWP', 'C4 Explosive', 'Decoy Grenade', 'Desert Eagle', 'Dual Berettas',
  'FAMAS', 'Falchion Knife', 'Five-SeveN', 'Flashbang', 'Galil AR', 'Glock-18',
  'Gut Knife', 'High Explosive Grenade', 'Huntsman Knife', 'Incendiary Grenade',
  'M4A1-S', 'M4A4', 'MAC-10', 'MP7', 'MP9', 'Molotov', 'Nomad Knife', 'P250',
  'Paracord Knife', 'R8 Revolver', 'SSG 08', 'Smoke Grenade', 'Survival Knife',
  'Tec-9', 'USP-S', 'XM1014', 'knife', 'knife_t',
];

describe('cobertura dos nomes reais da demo', () => {
  it('reconhece TODOS os 34 nomes que a demo de referencia produz', () => {
    const desconhecidas = NOMES_REAIS.filter((n) => weaponClass(n) === 'unknown');
    expect(desconhecidas).toEqual([]);
  });

  it('as armas compraveis tem preco maior que zero', () => {
    const compraveis = NOMES_REAIS.filter((n) =>
      ['pistol', 'smg', 'rifle', 'sniper', 'heavy', 'grenade'].includes(weaponClass(n)),
    );
    expect(compraveis.length).toBeGreaterThan(15);
    for (const n of compraveis) {
      expect(weaponPrice(n), `${n} deveria ter preco`).toBeGreaterThan(0);
    }
  });

  it('todas as facas caem na classe faca, apesar das skins', () => {
    for (const n of ['Falchion Knife', 'Gut Knife', 'Huntsman Knife', 'Nomad Knife',
      'Paracord Knife', 'Survival Knife', 'knife', 'knife_t']) {
      expect(weaponClass(n), n).toBe('knife');
    }
  });
});

describe('weaponPrice', () => {
  it('sabe os precos das armas mais compradas', () => {
    expect(weaponPrice('AK-47')).toBe(2700);
    expect(weaponPrice('M4A4')).toBe(3100);
    expect(weaponPrice('AWP')).toBe(4750);
    expect(weaponPrice('Desert Eagle')).toBe(700);
  });

  it('interno m4a1 e a M4A4 (convencao da Valve), nao a M4A1-S', () => {
    expect(weaponPrice('m4a1')).toBe(weaponPrice('M4A4'));
    expect(weaponPrice('weapon_m4a1')).toBe(3100);
    expect(weaponPrice('m4a1_silencer')).toBe(weaponPrice('M4A1-S'));
    expect(weaponPrice('M4A1-S')).toBe(2900);
  });

  it('faca nao tem preco de compra', () => {
    expect(weaponPrice('Huntsman Knife')).toBe(0);
    expect(weaponClass('Huntsman Knife')).toBe('knife');
  });

  it('arma desconhecida vale zero em vez de quebrar', () => {
    expect(weaponPrice('Arma Que Nao Existe')).toBe(0);
    expect(weaponClass('Arma Que Nao Existe')).toBe('unknown');
  });
});

describe('isAimDuelWeapon', () => {
  it('armas de fogo sao duelo de mira, nos dois formatos de nome', () => {
    for (const w of ['ak47', 'AK-47', 'awp', 'glock', 'usp_silencer', 'mp9', 'xm1014', 'revolver']) {
      expect(isAimDuelWeapon(w), w).toBe(true);
    }
  });

  it('utilitario, faca e zeus nao sao — a kill de molotov de 145 graus', () => {
    for (const w of ['inferno', 'hegrenade', 'molotov', 'knife', 'Huntsman Knife', 'taser', 'world']) {
      expect(isAimDuelWeapon(w), w).toBe(false);
    }
    expect(isAimDuelWeapon(null)).toBe(false);
  });
});

describe('equipmentValue', () => {
  it('soma armas, utilitario e colete', () => {
    const value = equipmentValue({
      inventory: ['AK-47', 'Glock-18', 'Flashbang', 'Smoke Grenade'],
      hasArmor: true,
      hasHelmet: true,
      hasDefuser: false,
    });

    expect(value).toBe(4400);
  });

  it('capacete NAO soma em cima do colete: o total e 1000, nao 1650', () => {
    const semCapacete = equipmentValue({
      inventory: [], hasArmor: true, hasHelmet: false, hasDefuser: false,
    });
    const comCapacete = equipmentValue({
      inventory: [], hasArmor: true, hasHelmet: true, hasDefuser: false,
    });
    expect(semCapacete).toBe(ARMOR_PRICE);
    expect(comCapacete).toBe(ARMOR_PRICE + HELMET_EXTRA);
  });

  it('kit de desarme entra no valor', () => {
    const com = equipmentValue({
      inventory: [], hasArmor: false, hasHelmet: false, hasDefuser: true,
    });
    expect(com).toBe(300);
  });

  it('inventario so com faca vale zero', () => {
    expect(
      equipmentValue({
        inventory: ['Huntsman Knife'], hasArmor: false, hasHelmet: false, hasDefuser: false,
      }),
    ).toBe(0);
  });
});

describe('classifyBuy', () => {
  const base = { spent: 3000, startBalance: 5000, isPistolRound: false };

  it('round de pistola tem categoria propria', () => {
    expect(classifyBuy({ ...base, equipValue: 800, isPistolRound: true })).toBe('pistol');

    expect(classifyBuy({ ...base, equipValue: 6000, isPistolRound: true })).toBe('pistol');
  });

  it('economia deliberada: tinha dinheiro e escolheu nao gastar', () => {
    expect(classifyBuy({ equipValue: 300, spent: 0, startBalance: 6000, isPistolRound: false }))
      .toBe('full_eco');
  });

  it('quem NAO tinha dinheiro e um eco comum, nao um save', () => {
    expect(classifyBuy({ equipValue: 300, spent: 0, startBalance: 1000, isPistolRound: false }))
      .toBe('eco');
  });

  it('separa as faixas pelo valor do equipamento', () => {
    expect(classifyBuy({ ...base, equipValue: 1500 })).toBe('eco');
    expect(classifyBuy({ ...base, equipValue: 2500 })).toBe('semi_eco');
    expect(classifyBuy({ ...base, equipValue: 4000 })).toBe('force_buy');
    expect(classifyBuy({ ...base, equipValue: 5500 })).toBe('full_buy');
  });

  it('o limite e exclusivo: 5000 exatos ja e buy completo', () => {
    expect(classifyBuy({ ...base, equipValue: 4999 })).toBe('force_buy');
    expect(classifyBuy({ ...base, equipValue: 5000 })).toBe('full_buy');
  });
});

describe('classifyTeamBuy', () => {
  it('usa o total do time, nao a media', () => {
    expect(classifyTeamBuy(4000, false)).toBe('eco');
    expect(classifyTeamBuy(12000, false)).toBe('force_buy');
    expect(classifyTeamBuy(25000, false)).toBe('full_buy');
  });

  it('pistol round manda em tudo', () => {
    expect(classifyTeamBuy(25000, true)).toBe('pistol');
  });
});

describe('classifyTeamBuy por elenco', () => {
  it('com CINCO, os numeros sao os mesmos de antes, em cada fronteira', () => {
    for (const [valor, esperado] of [
      [4999, 'eco'], [5000, 'semi_eco'],
      [9999, 'semi_eco'], [10000, 'force_buy'],
      [19999, 'force_buy'], [20000, 'full_buy'],
    ] as const) {
      expect(classifyTeamBuy(valor, false, 5)).toBe(esperado);

      expect(classifyTeamBuy(valor, false)).toBe(esperado);
    }
  });

  it('com SEIS, o limite acompanha: 5900 ainda e eco', () => {

    expect(classifyTeamBuy(5900, false, 6)).toBe('eco');
    expect(classifyTeamBuy(5900, false, 5)).toBe('semi_eco');
    expect(classifyTeamBuy(6000, false, 6)).toBe('semi_eco');
  });

  it('com QUATRO, o limite desce: 4100 ja e semi-eco', () => {
    expect(classifyTeamBuy(4100, false, 4)).toBe('semi_eco');
    expect(classifyTeamBuy(4100, false, 5)).toBe('eco');
    expect(classifyTeamBuy(3999, false, 4)).toBe('eco');
  });

  it('round de pistola ignora o valor e o elenco', () => {
    expect(classifyTeamBuy(30000, true, 6)).toBe('pistol');
  });

  it('elenco zero nao divide por zero nem inverte a classificacao', () => {
    expect(classifyTeamBuy(0, false, 0)).toBe('eco');
  });
});
