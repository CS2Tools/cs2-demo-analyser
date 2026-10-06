type EquipmentIcon = string;

const WEAPONS: Record<string, EquipmentIcon> = {

  glock: 'glock', glock18: 'glock',
  usps: 'usp_silencer', uspsilencer: 'usp_silencer',
  hkp2000: 'hkp2000', p2000: 'hkp2000',
  p250: 'p250', fiveseven: 'fiveseven', tec9: 'tec9',
  cz75a: 'cz75a', cz75auto: 'cz75a',
  elite: 'elite', dualberettas: 'elite',
  deagle: 'deagle', deserteagle: 'deagle',
  revolver: 'revolver', r8revolver: 'revolver',
  taser: 'taser', zeusx27: 'taser',

  mac10: 'mac10', mp9: 'mp9', mp7: 'mp7', mp5sd: 'mp5sd', ump45: 'ump45',
  p90: 'p90', bizon: 'bizon', ppbizon: 'bizon',

  galilar: 'galilar', galil: 'galilar', famas: 'famas', ak47: 'ak47',
  m4a4: 'm4a1', m4a1: 'm4a1',
  m4a1s: 'm4a1_silencer', m4a1silencer: 'm4a1_silencer',
  sg553: 'sg556', sg556: 'sg556', aug: 'aug',

  ssg08: 'ssg08', awp: 'awp', scar20: 'scar20', g3sg1: 'g3sg1',

  nova: 'nova', xm1014: 'xm1014', sawedoff: 'sawedoff', mag7: 'mag7',
  m249: 'm249', negev: 'negev',

  flashbang: 'flashbang', smokegrenade: 'smokegrenade',
  hegrenade: 'hegrenade', highexplosivegrenade: 'hegrenade',
  molotov: 'molotov', incgrenade: 'incgrenade', incendiarygrenade: 'incgrenade',
  inferno: 'inferno', decoy: 'decoy', decoygrenade: 'decoy',

  c4: 'c4', c4explosive: 'c4', plantedc4: 'planted_c4',
  defuser: 'defuser', defusekit: 'defuser',

  knife: 'knife', knifet: 'knife_t',
  bayonet: 'bayonet', m9bayonet: 'knife_m9_bayonet',
  karambit: 'knife_karambit', butterflyknife: 'knife_butterfly',
  flipknife: 'knife_flip', gutknife: 'knife_gut', huntsmanknife: 'knife_tactical',
  falchionknife: 'knife_falchion', bowieknife: 'knife_survival_bowie',
  shadowdaggers: 'knife_push', navajaknife: 'knife_gypsy_jackknife',
  stilettoknife: 'knife_stiletto', talonknife: 'knife_widowmaker',
  ursusknife: 'knife_ursus', skeletonknife: 'knife_skeleton',
  classicknife: 'knife_css', kukriknife: 'knife_kukri',
  nomadknife: 'knife_outdoor', paracordknife: 'knife_cord',
  survivalknife: 'knife_canis',
};

const DIRECT = new Set(Object.values(WEAPONS));

export function normalize(name: string): string {
  return name.toLowerCase().replace(/^weapon_/, '').replace(/[^a-z0-9]/g, '');
}

export function weaponIcon(name: string | null | undefined): string | null {
  if (!name) return null;
  const raw = name.toLowerCase().replace(/^weapon_/, '');

  if (DIRECT.has(raw)) return `equipment/${raw}.svg`;
  const hit = WEAPONS[normalize(name)];
  if (hit) return `equipment/${hit}.svg`;

  if (/knife|bayonet|dagger/i.test(name)) return 'equipment/knife.svg';
  return null;
}

export const EQUIPMENT_ICONS = {
  c4: 'equipment/c4.svg',
  plantedC4: 'equipment/planted_c4.svg',
  defuser: 'equipment/defuser.svg',
  armor: 'equipment/armor.svg',
  armorHelmet: 'equipment/armor_helmet.svg',
  flashAssist: 'equipment/flashbang_assist.svg',
} as const;

export const KILLFEED_ICONS = {
  headshot: 'deathnotice/icon_headshot.svg',
  penetrated: 'deathnotice/penetrate.svg',
  thruSmoke: 'deathnotice/smoke_kill.svg',
  attackerBlind: 'deathnotice/blind_kill.svg',
  noscope: 'deathnotice/noscope.svg',
  inAir: 'deathnotice/inairkill.svg',
  suicide: 'deathnotice/icon_suicide.svg',
} as const;

export const SIDE_ICONS = {
  CT: 'radar/radarctlogo.svg',
  T: 'radar/radartlogo.svg',
} as const;

export function mapIcon(mapName: string, available?: ReadonlySet<string>): string | null {
  if (!/^de_[a-z0-9]+$/.test(mapName)) return null;
  const rel = `maps/map_icon_${mapName}.svg`;
  return available && !available.has(rel) ? null : rel;
}

export function inventoryCategory(name: string): 'primary' | 'secondary' | 'grenade' | 'c4' | 'knife' | 'other' {
  const n = normalize(name);
  if (n === 'c4explosive' || n === 'c4') return 'c4';
  if (/knife|bayonet|dagger/.test(n) || n === 'knifet') return 'knife';
  if (/grenade|flashbang|molotov|decoy|inc/.test(n)) return 'grenade';
  if (/glock|usp|p2000|p250|fiveseven|tec9|cz75|elite|beretta|deagle|deserteagle|revolver|taser|zeus/.test(n)) {
    return 'secondary';
  }
  return WEAPONS[n] ? 'primary' : 'other';
}
