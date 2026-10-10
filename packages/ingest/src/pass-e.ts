import { parseTicks } from '@laihoe/demoparser2';
import {
  classifyBuy,
  classifyTeamBuy,
  equipmentValue,
  sideFromTeamNum,
  weaponClass,
  type Segmentation,
  type Side,
} from '@cs2/core';
import type { DuckDb, SqlValue } from '@cs2/db';
import { parseResilient } from './props.js';

type Row = Record<string, unknown>;

const PROPS_ECON = {
  required: ['team_num'],
  optional: [
    'balance',
    'start_balance',
    'cash_spent_this_round',
    'armor_value',
    'has_helmet',
    'has_defuser',
    'inventory',
  ],
} as const;

export interface PassEResult {
  rows: number;
  rounds: number;

  droppedProps: string[];
}

export function isPistolRound(roundNum: number, half: number | null, roundsPerHalf = 12): boolean {
  if (half !== null) return roundNum === (half - 1) * roundsPerHalf + 1;
  return roundNum === 1;
}

export async function runPassE(options: {
  demoPath: string;
  matchId: string;
  db: DuckDb;
  segmentation: Segmentation;
}): Promise<PassEResult> {
  const { demoPath, matchId, db, segmentation } = options;

  const live = segmentation.rounds.filter((r) => r.phase === 'live' && r.roundNum !== null);
  const byTick = new Map<number, { roundNum: number; half: number | null }>();
  for (const r of live) {
    const tick = r.freezeEndTick ?? r.startTick;
    if (tick === null) continue;
    byTick.set(tick, { roundNum: r.roundNum!, half: r.half });
  }

  const ticks = [...byTick.keys()].sort((a, b) => a - b);
  if (ticks.length === 0) return { rows: 0, rounds: 0, droppedProps: [] };

  const { rows, dropped } = parseResilient<Row>(
    (props) => parseTicks(demoPath, props, ticks) as Row[],
    PROPS_ECON,
  );

  interface Entry {
    roundNum: number;
    steamId: string;

    side: Side;
    startBalance: number;
    spent: number;
    equipValue: number;
    hasArmor: boolean;
    hasHelmet: boolean;
    hasDefuser: boolean;
    primary: string | null;
    isPistol: boolean;
  }

  const entries: Entry[] = [];

  for (const row of rows) {
    const tick = Number(row['tick']);
    const round = byTick.get(tick);
    const steamId = String(row['steamid'] ?? '');
    if (!round || !steamId || steamId === '0') continue;

    const side = sideFromTeamNum(Number(row['team_num'] ?? 0));
    if (!side) continue;

    const inventory = Array.isArray(row['inventory'])
      ? (row['inventory'] as unknown[]).map(String)
      : [];

    const hasArmor = Number(row['armor_value'] ?? 0) > 0;
    const hasHelmet = row['has_helmet'] === true;

    const ranked = inventory
      .map((name) => ({ name, cls: weaponClass(name) }))
      .filter((w) => w.cls !== 'knife' && w.cls !== 'grenade' && w.cls !== 'unknown');
    const primary =
      ranked.find((w) => w.cls !== 'pistol')?.name ?? ranked[0]?.name ?? null;

    entries.push({
      roundNum: round.roundNum,
      steamId,
      side,
      startBalance: Number(row['start_balance'] ?? 0),
      spent: Number(row['cash_spent_this_round'] ?? 0),
      equipValue: equipmentValue({
        inventory,
        hasArmor,
        hasHelmet,
        hasDefuser: row['has_defuser'] === true,
      }),
      hasArmor,
      hasHelmet,
      hasDefuser: row['has_defuser'] === true,
      primary,
      isPistol: isPistolRound(round.roundNum, round.half),
    });
  }

  const teamValue = new Map<string, number>();

  const teamCount = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.roundNum}|${e.side}`;
    teamValue.set(key, (teamValue.get(key) ?? 0) + e.equipValue);
    teamCount.set(key, (teamCount.get(key) ?? 0) + 1);
  }

  const out: SqlValue[][] = entries.map((e) => {
    const teamTotal = teamValue.get(`${e.roundNum}|${e.side}`) ?? 0;
    const teamN = teamCount.get(`${e.roundNum}|${e.side}`) ?? 5;
    return [
      matchId,
      e.roundNum,
      e.steamId,
      e.side,
      e.startBalance,
      e.spent,
      null,
      null,
      e.equipValue,
      e.hasArmor,
      e.hasHelmet,
      e.hasDefuser,
      e.primary,
      classifyBuy({
        equipValue: e.equipValue,
        spent: e.spent,
        startBalance: e.startBalance,
        isPistolRound: e.isPistol,
      }),
      classifyTeamBuy(teamTotal, e.isPistol, teamN),
    ];
  });

  await db.bulkInsert(
    'economy',
    [
      'match_id', 'round_num', 'steam_id', 'side',
      'start_balance', 'spent', 'earned', 'money_saved',
      'equip_value', 'has_armor', 'has_helmet', 'has_defuser',
      'primary_weapon', 'buy_type', 'team_buy_type',
    ],
    out,
  );

  for (const round of live) {
    const roundNum = round.roundNum!;
    const ct = teamValue.get(`${roundNum}|CT`) ?? 0;
    const t = teamValue.get(`${roundNum}|T`) ?? 0;
    const nCt = teamCount.get(`${roundNum}|CT`) ?? 5;
    const nT = teamCount.get(`${roundNum}|T`) ?? 5;
    const pistol = isPistolRound(roundNum, round.half);
    await db.exec(
      `UPDATE rounds SET ct_equip_value = ?, t_equip_value = ?,
                         ct_buy_type = ?, t_buy_type = ?
        WHERE match_id = ? AND round_num = ?`,
      [ct, t, classifyTeamBuy(ct, pistol, nCt), classifyTeamBuy(t, pistol, nT), matchId, roundNum],
    );
  }

  return { rows: out.length, rounds: live.length, droppedProps: dropped };
}
