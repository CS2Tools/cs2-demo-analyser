export type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date';

export interface ExploreField {
  id: string;

  pt: string;
  en: string;

  sql: string;
  type: FieldType;
  filterable?: boolean;
  groupable?: boolean;
  measurable?: boolean;

  values?: string[];
}

export interface ExploreSubject {
  id: string;
  pt: string;
  en: string;

  rowPt: string;
  rowEn: string;

  from: string;

  where?: string;
  fields: ExploreField[];

  replay?: { matchId: string; round: string; tick?: string };
}

const SIDES = ['CT', 'T'];
const BUY_TYPES = ['pistol', 'full_eco', 'eco', 'semi_eco', 'force_buy', 'full_buy'];

const playerFlags = (alias: string): ExploreField[] => [
  {
    id: 'isMe', pt: 'Sou eu', en: 'Is me',
    sql: `${alias}.is_user`, type: 'boolean',
    filterable: true, groupable: true, measurable: true,
  },
  {
    id: 'isPoi', pt: 'Jogador de interesse', en: 'Player of interest',
    sql: `${alias}.is_poi`, type: 'boolean',
    filterable: true, groupable: true, measurable: true,
  },
];

const matchFields = (prefix: string): ExploreField[] => [
  {
    id: 'map', pt: 'Mapa', en: 'Map',
    sql: 'm.map_name', type: 'string', filterable: true, groupable: true,
  },
  {
    id: 'match', pt: 'Partida', en: 'Match',
    sql: `m.team_a_name || ' x ' || m.team_b_name || ' (' || m.map_name || ')'`,
    type: 'string', filterable: true, groupable: true,
  },
  {
    id: 'matchDate', pt: 'Data da partida', en: 'Match date',
    sql: 'm.ingested_at', type: 'date', filterable: true,
  },
  {
    id: 'round', pt: 'Round', en: 'Round',
    sql: `${prefix}.round_num`, type: 'number', filterable: true, groupable: true, measurable: true,
  },
];

const KILL_FLAGS: ExploreField[] = [
  { id: 'headshot', pt: 'Headshot', en: 'Headshot', sql: 'k.headshot', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'wallbang', pt: 'Wallbang', en: 'Wallbang', sql: 'k.penetrated > 0', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'thruSmoke', pt: 'Através de smoke', en: 'Through smoke', sql: 'k.thru_smoke', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'attackerBlind', pt: 'Atacante cego', en: 'Attacker blind', sql: 'k.attacker_blind', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'noscope', pt: 'Noscope', en: 'Noscope', sql: 'k.noscope', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'inAir', pt: 'Atacante no ar', en: 'Attacker airborne', sql: 'k.attacker_in_air', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'entry', pt: 'Entry (primeira do round)', en: 'Entry kill', sql: 'k.is_entry', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'trade', pt: 'Troca', en: 'Trade kill', sql: 'k.is_trade_kill', type: 'boolean', filterable: true, groupable: true, measurable: true },
  { id: 'flashAssist', pt: 'Assistência de flash', en: 'Flash assist', sql: 'k.assisted_flash', type: 'boolean', filterable: true, groupable: true, measurable: true },
];

const KILL_FROM = `kills k
     JOIN matches m ON m.match_id = k.match_id
     LEFT JOIN player_match pa ON pa.match_id = k.match_id AND pa.steam_id = k.attacker_steam_id
     LEFT JOIN player_match pv ON pv.match_id = k.match_id AND pv.steam_id = k.victim_steam_id`;

export const SUBJECTS: ExploreSubject[] = [
  {
    id: 'kills',
    pt: 'Kills', en: 'Kills',
    rowPt: 'uma linha por kill', rowEn: 'one row per kill',
    from: KILL_FROM,
    where: 'k.round_num IS NOT NULL',
    replay: { matchId: 'k.match_id', round: 'k.round_num', tick: 'k.tick' },
    fields: [
      { id: 'player', pt: 'Quem matou', en: 'Killer', sql: 'pa.name', type: 'string', filterable: true, groupable: true },
      { id: 'playerId', pt: 'SteamID de quem matou', en: 'Killer SteamID', sql: 'k.attacker_steam_id', type: 'string', filterable: true },
      { id: 'victim', pt: 'Quem morreu', en: 'Victim', sql: 'pv.name', type: 'string', filterable: true, groupable: true },
      { id: 'weapon', pt: 'Arma', en: 'Weapon', sql: 'k.weapon', type: 'string', filterable: true, groupable: true },
      { id: 'side', pt: 'Lado de quem matou', en: 'Killer side', sql: 'k.attacker_side', type: 'enum', values: SIDES, filterable: true, groupable: true },
      { id: 'distance', pt: 'Distância', en: 'Distance', sql: 'k.distance', type: 'number', filterable: true, measurable: true },
      ...KILL_FLAGS,
      ...matchFields('k'),
      ...playerFlags('pa'),
    ],
  },
  {
    id: 'deaths',
    pt: 'Mortes', en: 'Deaths',
    rowPt: 'uma linha por morte', rowEn: 'one row per death',
    from: KILL_FROM,
    where: 'k.round_num IS NOT NULL',
    replay: { matchId: 'k.match_id', round: 'k.round_num', tick: 'k.tick' },
    fields: [
      { id: 'player', pt: 'Quem morreu', en: 'Victim', sql: 'pv.name', type: 'string', filterable: true, groupable: true },
      { id: 'playerId', pt: 'SteamID de quem morreu', en: 'Victim SteamID', sql: 'k.victim_steam_id', type: 'string', filterable: true },
      { id: 'killer', pt: 'Quem matou', en: 'Killer', sql: 'pa.name', type: 'string', filterable: true, groupable: true },
      { id: 'weapon', pt: 'Arma', en: 'Weapon', sql: 'k.weapon', type: 'string', filterable: true, groupable: true },
      { id: 'side', pt: 'Lado de quem morreu', en: 'Victim side', sql: 'k.victim_side', type: 'enum', values: SIDES, filterable: true, groupable: true },
      { id: 'traded', pt: 'Morte trocada', en: 'Death traded', sql: 'k.death_was_traded', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'openingDeath', pt: 'Morreu na entrada', en: 'Opening death', sql: 'k.is_entry', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'distance', pt: 'Distância', en: 'Distance', sql: 'k.distance', type: 'number', filterable: true, measurable: true },
      ...matchFields('k'),
      ...playerFlags('pv'),
    ],
  },
  {
    id: 'damages',
    pt: 'Dano', en: 'Damage',
    rowPt: 'uma linha por evento de dano', rowEn: 'one row per damage event',
    from: `damages d
     JOIN matches m ON m.match_id = d.match_id
     LEFT JOIN player_match pa ON pa.match_id = d.match_id AND pa.steam_id = d.attacker_steam_id
     LEFT JOIN player_match pv ON pv.match_id = d.match_id AND pv.steam_id = d.victim_steam_id`,
    where: 'd.round_num IS NOT NULL',
    replay: { matchId: 'd.match_id', round: 'd.round_num', tick: 'd.tick' },
    fields: [
      { id: 'player', pt: 'Quem causou', en: 'Attacker', sql: 'pa.name', type: 'string', filterable: true, groupable: true },
      { id: 'victim', pt: 'Quem levou', en: 'Victim', sql: 'pv.name', type: 'string', filterable: true, groupable: true },
      { id: 'weapon', pt: 'Arma', en: 'Weapon', sql: 'd.weapon', type: 'string', filterable: true, groupable: true },
      { id: 'damage', pt: 'Dano', en: 'Damage', sql: 'd.dmg_health', type: 'number', filterable: true, measurable: true },
      { id: 'utility', pt: 'Dano de utilitário', en: 'Utility damage', sql: 'd.is_utility', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'teamDamage', pt: 'Dano no próprio time', en: 'Team damage', sql: 'd.is_team_damage', type: 'boolean', filterable: true, groupable: true, measurable: true },
      ...matchFields('d'),
      ...playerFlags('pa'),
    ],
  },
  {
    id: 'rounds',
    pt: 'Rounds', en: 'Rounds',
    rowPt: 'uma linha por round', rowEn: 'one row per round',
    from: `rounds r JOIN matches m ON m.match_id = r.match_id`,
    where: `r.phase = 'live'`,
    replay: { matchId: 'r.match_id', round: 'r.round_num' },
    fields: [
      { id: 'winnerSide', pt: 'Lado vencedor', en: 'Winner side', sql: 'r.winner_side', type: 'enum', values: SIDES, filterable: true, groupable: true },
      { id: 'winReason', pt: 'Como terminou', en: 'Win reason', sql: 'r.win_reason', type: 'string', filterable: true, groupable: true },
      { id: 'ctBuy', pt: 'Compra do CT', en: 'CT buy', sql: 'r.ct_buy_type', type: 'enum', values: BUY_TYPES, filterable: true, groupable: true },
      { id: 'tBuy', pt: 'Compra do T', en: 'T buy', sql: 'r.t_buy_type', type: 'enum', values: BUY_TYPES, filterable: true, groupable: true },
      { id: 'ctEquip', pt: 'Equipamento CT', en: 'CT equipment', sql: 'r.ct_equip_value', type: 'number', filterable: true, measurable: true },
      { id: 'tEquip', pt: 'Equipamento T', en: 'T equipment', sql: 'r.t_equip_value', type: 'number', filterable: true, measurable: true },
      { id: 'half', pt: 'Metade', en: 'Half', sql: 'r.half', type: 'number', filterable: true, groupable: true },
      { id: 'planted', pt: 'Bomba plantada', en: 'Bomb planted', sql: 'r.bomb_plant_tick IS NOT NULL', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'site', pt: 'Site do plantio', en: 'Plant site', sql: 'r.plant_site', type: 'string', filterable: true, groupable: true },
      ...matchFields('r'),
    ],
  },
  {
    id: 'economy',
    pt: 'Economia por round', en: 'Economy per round',
    rowPt: 'uma linha por jogador e round', rowEn: 'one row per player and round',
    from: `economy e
     JOIN matches m ON m.match_id = e.match_id
     LEFT JOIN player_match p ON p.match_id = e.match_id AND p.steam_id = e.steam_id`,
    replay: { matchId: 'e.match_id', round: 'e.round_num' },
    fields: [
      { id: 'player', pt: 'Jogador', en: 'Player', sql: 'p.name', type: 'string', filterable: true, groupable: true },
      { id: 'side', pt: 'Lado', en: 'Side', sql: 'e.side', type: 'enum', values: SIDES, filterable: true, groupable: true },
      { id: 'buyType', pt: 'Tipo de compra', en: 'Buy type', sql: 'e.buy_type', type: 'enum', values: BUY_TYPES, filterable: true, groupable: true },
      { id: 'teamBuyType', pt: 'Compra do time', en: 'Team buy', sql: 'e.team_buy_type', type: 'enum', values: BUY_TYPES, filterable: true, groupable: true },
      { id: 'startBalance', pt: 'Saldo no início', en: 'Start balance', sql: 'e.start_balance', type: 'number', filterable: true, measurable: true },
      { id: 'spent', pt: 'Gasto', en: 'Spent', sql: 'e.spent', type: 'number', filterable: true, measurable: true },
      { id: 'equipValue', pt: 'Valor do equipamento', en: 'Equipment value', sql: 'e.equip_value', type: 'number', filterable: true, measurable: true },
      { id: 'primary', pt: 'Arma principal', en: 'Primary weapon', sql: 'e.primary_weapon', type: 'string', filterable: true, groupable: true },
      ...matchFields('e'),
      ...playerFlags('p'),
    ],
  },
  {
    id: 'performance',
    pt: 'Desempenho por round', en: 'Per-round performance',
    rowPt: 'uma linha por jogador e round', rowEn: 'one row per player and round',
    from: `player_round_stats s
     JOIN matches m ON m.match_id = s.match_id
     LEFT JOIN player_match p ON p.match_id = s.match_id AND p.steam_id = s.steam_id`,
    replay: { matchId: 's.match_id', round: 's.round_num' },
    fields: [
      { id: 'player', pt: 'Jogador', en: 'Player', sql: 'p.name', type: 'string', filterable: true, groupable: true },
      { id: 'side', pt: 'Lado', en: 'Side', sql: 's.side', type: 'enum', values: SIDES, filterable: true, groupable: true },
      { id: 'kills', pt: 'Kills', en: 'Kills', sql: 's.kills', type: 'number', filterable: true, measurable: true },
      { id: 'deaths', pt: 'Mortes', en: 'Deaths', sql: 's.deaths', type: 'number', filterable: true, measurable: true },
      { id: 'damage', pt: 'Dano', en: 'Damage', sql: 's.damage', type: 'number', filterable: true, measurable: true },
      { id: 'utilityDamage', pt: 'Dano de utilitário', en: 'Utility damage', sql: 's.utility_damage', type: 'number', filterable: true, measurable: true },
      { id: 'survived', pt: 'Sobreviveu', en: 'Survived', sql: 's.survived', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'openingKill', pt: 'Entry kill', en: 'Opening kill', sql: 's.opening_kill', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'openingDeath', pt: 'Morte na entrada', en: 'Opening death', sql: 's.opening_death', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'buyType', pt: 'Tipo de compra', en: 'Buy type', sql: 's.buy_type', type: 'enum', values: BUY_TYPES, filterable: true, groupable: true },
      { id: 'unusedUtility', pt: 'Utilitário na morte', en: 'Unused utility', sql: 's.unused_utility_value', type: 'number', filterable: true, measurable: true },
      ...matchFields('s'),
      ...playerFlags('p'),
    ],
  },
  {
    id: 'utility',
    pt: 'Arremessos de utilitário', en: 'Utility throws',
    rowPt: 'uma linha por granada jogada', rowEn: 'one row per grenade thrown',
    from: `utility_throws u
     JOIN matches m ON m.match_id = u.match_id
     LEFT JOIN player_match p ON p.match_id = u.match_id AND p.steam_id = u.steam_id`,
    replay: { matchId: 'u.match_id', round: 'u.round_num', tick: 'u.throw_tick' },
    fields: [
      { id: 'player', pt: 'Jogador', en: 'Player', sql: 'p.name', type: 'string', filterable: true, groupable: true },
      { id: 'type', pt: 'Tipo', en: 'Type', sql: 'u.grenade_type', type: 'enum', values: ['smoke', 'flashbang', 'he', 'molotov', 'decoy'], filterable: true, groupable: true },
      { id: 'side', pt: 'Lado', en: 'Side', sql: 'u.side', type: 'enum', values: SIDES, filterable: true, groupable: true },
      { id: 'jumpThrow', pt: 'Jump throw', en: 'Jump throw', sql: 'u.on_ground = FALSE', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'crouched', pt: 'Agachado', en: 'Crouched', sql: 'u.crouched', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'speed', pt: 'Velocidade', en: 'Speed', sql: 'u.speed', type: 'number', filterable: true, measurable: true },
      { id: 'strength', pt: 'Força do arremesso', en: 'Throw strength', sql: 'u.throw_strength', type: 'number', filterable: true, measurable: true },
      { id: 'blinded', pt: 'Inimigos cegados', en: 'Enemies blinded', sql: 'u.enemies_blinded', type: 'number', filterable: true, measurable: true },
      { id: 'damage', pt: 'Dano', en: 'Damage', sql: 'u.enemy_damage', type: 'number', filterable: true, measurable: true },
      { id: 'killsAfter', pt: 'Kills depois', en: 'Kills after', sql: 'u.kills_after', type: 'number', filterable: true, measurable: true },
      ...matchFields('u'),
      ...playerFlags('p'),
    ],
  },
  {
    id: 'aim',
    pt: 'Duelos de mira', en: 'Aim duels',
    rowPt: 'uma linha por duelo', rowEn: 'one row per duel',
    from: `engagements g
     JOIN matches m ON m.match_id = g.match_id
     LEFT JOIN player_match p ON p.match_id = g.match_id AND p.steam_id = g.player_steam_id`,
    replay: { matchId: 'g.match_id', round: 'g.round_num', tick: 'g.tick_first_shot' },
    fields: [
      { id: 'player', pt: 'Jogador', en: 'Player', sql: 'p.name', type: 'string', filterable: true, groupable: true },
      { id: 'weapon', pt: 'Arma', en: 'Weapon', sql: 'g.weapon', type: 'string', filterable: true, groupable: true },
      { id: 'outcome', pt: 'Desfecho', en: 'Outcome', sql: 'g.outcome', type: 'string', filterable: true, groupable: true },
      { id: 'preaim', pt: 'Pré-aim (graus)', en: 'Pre-aim (degrees)', sql: 'g.preaim_total_deg', type: 'number', filterable: true, measurable: true },
      { id: 'preaimPitch', pt: 'Pré-aim vertical', en: 'Pre-aim pitch', sql: 'g.preaim_pitch_deg', type: 'number', filterable: true, measurable: true },
      { id: 'firstShot', pt: 'Precisão no tiro', en: 'First-shot error', sql: 'g.firstshot_total_deg', type: 'number', filterable: true, measurable: true },
      { id: 'distance', pt: 'Distância', en: 'Distance', sql: 'g.distance', type: 'number', filterable: true, measurable: true },
      { id: 'moving', pt: 'Em movimento', en: 'Moving', sql: 'g.player_was_moving', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'blind', pt: 'Cego', en: 'Blind', sql: 'g.player_was_blind', type: 'boolean', filterable: true, groupable: true, measurable: true },
      ...matchFields('g'),
      ...playerFlags('p'),
    ],
  },
  {

    id: 'shots',
    pt: 'Tiros', en: 'Shots',
    rowPt: 'uma linha por disparo', rowEn: 'one row per shot',
    from: `weapon_fires f
     JOIN matches m ON m.match_id = f.match_id
     LEFT JOIN player_match p ON p.match_id = f.match_id AND p.steam_id = f.steam_id`,
    where: 'f.round_num IS NOT NULL',
    replay: { matchId: 'f.match_id', round: 'f.round_num', tick: 'f.tick' },
    fields: [
      { id: 'player', pt: 'Jogador', en: 'Player', sql: 'p.name', type: 'string', filterable: true, groupable: true },
      { id: 'weapon', pt: 'Arma', en: 'Weapon', sql: 'f.weapon', type: 'string', filterable: true, groupable: true },
      { id: 'speed', pt: 'Velocidade no tiro', en: 'Speed when firing', sql: 'f.speed', type: 'number', filterable: true, measurable: true },
      { id: 'scoped', pt: 'Com zoom', en: 'Scoped', sql: 'f.is_scoped', type: 'boolean', filterable: true, groupable: true, measurable: true },
      { id: 'punchPitch', pt: 'Recuo vertical', en: 'Recoil pitch', sql: 'f.punch_pitch', type: 'number', filterable: true, measurable: true },
      ...matchFields('f'),
      ...playerFlags('p'),
    ],
  },
];

export const subjectById = (id: string): ExploreSubject | undefined =>
  SUBJECTS.find((s) => s.id === id);

export const fieldById = (subject: ExploreSubject, id: string): ExploreField | undefined =>
  subject.fields.find((f) => f.id === id);
