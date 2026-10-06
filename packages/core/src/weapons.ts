export type WeaponClass =
  | 'pistol'
  | 'smg'
  | 'rifle'
  | 'sniper'
  | 'heavy'
  | 'knife'
  | 'grenade'
  | 'equipment'
  | 'unknown';

interface WeaponInfo {
  price: number;
  class: WeaponClass;
}

export function normalizeWeaponName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^weapon_/, '')
    .replace(/[^a-z0-9]/g, '');
}

const WEAPONS: Record<string, WeaponInfo> = {

  glock: { price: 200, class: 'pistol' },
  glock18: { price: 200, class: 'pistol' },
  usps: { price: 200, class: 'pistol' },
  uspsilencer: { price: 200, class: 'pistol' },
  hkp2000: { price: 200, class: 'pistol' },
  p2000: { price: 200, class: 'pistol' },
  p250: { price: 300, class: 'pistol' },
  fiveseven: { price: 500, class: 'pistol' },
  tec9: { price: 500, class: 'pistol' },
  cz75a: { price: 500, class: 'pistol' },
  cz75auto: { price: 500, class: 'pistol' },
  dualberettas: { price: 300, class: 'pistol' },
  elite: { price: 300, class: 'pistol' },
  deagle: { price: 700, class: 'pistol' },
  deserteagle: { price: 700, class: 'pistol' },
  revolver: { price: 600, class: 'pistol' },
  r8revolver: { price: 600, class: 'pistol' },

  mac10: { price: 1050, class: 'smg' },
  mp9: { price: 1250, class: 'smg' },
  mp7: { price: 1500, class: 'smg' },
  mp5sd: { price: 1500, class: 'smg' },
  ump45: { price: 1200, class: 'smg' },
  p90: { price: 2350, class: 'smg' },
  ppbizon: { price: 1400, class: 'smg' },
  bizon: { price: 1400, class: 'smg' },

  galilar: { price: 1800, class: 'rifle' },
  galil: { price: 1800, class: 'rifle' },
  famas: { price: 2050, class: 'rifle' },
  ak47: { price: 2700, class: 'rifle' },
  m4a4: { price: 3100, class: 'rifle' },

  m4a1: { price: 3100, class: 'rifle' },
  m4a1s: { price: 2900, class: 'rifle' },
  m4a1silencer: { price: 2900, class: 'rifle' },
  sg553: { price: 3000, class: 'rifle' },
  aug: { price: 3300, class: 'rifle' },

  ssg08: { price: 1700, class: 'sniper' },
  awp: { price: 4750, class: 'sniper' },
  scar20: { price: 5000, class: 'sniper' },
  g3sg1: { price: 5000, class: 'sniper' },

  nova: { price: 1050, class: 'heavy' },
  xm1014: { price: 2000, class: 'heavy' },
  sawedoff: { price: 1100, class: 'heavy' },
  mag7: { price: 1300, class: 'heavy' },
  m249: { price: 5200, class: 'heavy' },
  negev: { price: 1700, class: 'heavy' },

  flashbang: { price: 200, class: 'grenade' },
  smokegrenade: { price: 300, class: 'grenade' },
  hegrenade: { price: 300, class: 'grenade' },
  highexplosivegrenade: { price: 300, class: 'grenade' },
  molotov: { price: 400, class: 'grenade' },
  incgrenade: { price: 600, class: 'grenade' },
  incendiarygrenade: { price: 600, class: 'grenade' },
  decoy: { price: 50, class: 'grenade' },
  decoygrenade: { price: 50, class: 'grenade' },

  c4explosive: { price: 0, class: 'equipment' },
  c4: { price: 0, class: 'equipment' },
};

export const ARMOR_PRICE = 650;
export const HELMET_EXTRA = 350;
export const DEFUSER_PRICE = 300;

export function weaponInfo(name: string): WeaponInfo {
  const key = normalizeWeaponName(name);
  if (WEAPONS[key]) return WEAPONS[key];

  if (key.includes('knife') || key.includes('bayonet') || key.includes('karambit')) {
    return { price: 0, class: 'knife' };
  }
  if (key === 'taser' || key === 'zeus' || key.startsWith('c4')) {
    return { price: 0, class: 'equipment' };
  }
  return { price: 0, class: 'unknown' };
}

export const weaponPrice = (name: string): number => weaponInfo(name).price;
export const weaponClass = (name: string): WeaponClass => weaponInfo(name).class;

const AIM_DUEL_CLASSES: ReadonlySet<WeaponClass> = new Set([
  'pistol', 'smg', 'rifle', 'sniper', 'heavy',
]);

export const isAimDuelWeapon = (name: string | null | undefined): boolean =>
  name != null && AIM_DUEL_CLASSES.has(weaponClass(name));

export function equipmentValue(options: {
  inventory: string[];
  hasArmor: boolean;
  hasHelmet: boolean;
  hasDefuser: boolean;
}): number {
  let total = 0;
  for (const item of options.inventory) total += weaponPrice(item);
  if (options.hasHelmet) total += ARMOR_PRICE + HELMET_EXTRA;
  else if (options.hasArmor) total += ARMOR_PRICE;
  if (options.hasDefuser) total += DEFUSER_PRICE;
  return total;
}

export type BuyCategory = 'pistol' | 'full_eco' | 'eco' | 'semi_eco' | 'force_buy' | 'full_buy';

export const BUY_THRESHOLDS = {
  eco: 2000,
  semiEco: 3500,
  force: 5000,
} as const;

export function classifyBuy(options: {
  equipValue: number;
  spent: number;
  startBalance: number;
  isPistolRound: boolean;
}): BuyCategory {
  if (options.isPistolRound) return 'pistol';

  if (options.spent === 0 && options.startBalance >= 4000) return 'full_eco';
  if (options.equipValue < BUY_THRESHOLDS.eco) return 'eco';
  if (options.equipValue < BUY_THRESHOLDS.semiEco) return 'semi_eco';
  if (options.equipValue < BUY_THRESHOLDS.force) return 'force_buy';
  return 'full_buy';
}

export const PER_PLAYER_TEAM_BUY_THRESHOLDS = {
  eco: 1000,
  semiEco: 2000,
  force: 4000,
} as const;

export const TEAM_BUY_THRESHOLDS = {
  eco: PER_PLAYER_TEAM_BUY_THRESHOLDS.eco * 5,
  semiEco: PER_PLAYER_TEAM_BUY_THRESHOLDS.semiEco * 5,
  force: PER_PLAYER_TEAM_BUY_THRESHOLDS.force * 5,
} as const;

export function classifyTeamBuy(
  totalEquipValue: number,
  isPistolRound: boolean,
  playersOnSide = 5,
): BuyCategory {
  if (isPistolRound) return 'pistol';
  const n = Math.max(1, playersOnSide);
  const limite = (porPessoa: number) => porPessoa * n;
  if (totalEquipValue < limite(PER_PLAYER_TEAM_BUY_THRESHOLDS.eco)) return 'eco';
  if (totalEquipValue < limite(PER_PLAYER_TEAM_BUY_THRESHOLDS.semiEco)) return 'semi_eco';
  if (totalEquipValue < limite(PER_PLAYER_TEAM_BUY_THRESHOLDS.force)) return 'force_buy';
  return 'full_buy';
}

const MAX_SPEED: Record<string, number> = {

  glock: 240, glock18: 240,
  usps: 240, uspsilencer: 240, hkp2000: 240, p2000: 240,
  p250: 240, fiveseven: 240, tec9: 240,
  cz75a: 240, cz75auto: 240,
  dualberettas: 240, elite: 240,
  deagle: 230, deserteagle: 230,
  revolver: 220, r8revolver: 220,

  mac10: 240, mp9: 240, mp7: 220, mp5sd: 235, ump45: 230, p90: 230,
  ppbizon: 240, bizon: 240,

  galilar: 215, galil: 215, famas: 220, ak47: 215,
  m4a4: 225, m4a1: 225, m4a1s: 225, m4a1silencer: 225,
  sg553: 210, aug: 220,

  ssg08: 230, awp: 200, scar20: 160, g3sg1: 215,

  nova: 220, xm1014: 215, sawedoff: 210, mag7: 225, m249: 195, negev: 150,
};

export const ACCURATE_SPEED_FRACTION = 0.34;

export function weaponMaxSpeed(name: string): number | null {
  return MAX_SPEED[normalizeWeaponName(name)] ?? null;
}

export function shotWasSlowEnough(weapon: string, speed: number | null): boolean | null {
  if (speed === null || !Number.isFinite(speed)) return null;
  const max = weaponMaxSpeed(weapon);
  if (max === null) return null;
  return speed <= max * ACCURATE_SPEED_FRACTION;
}
