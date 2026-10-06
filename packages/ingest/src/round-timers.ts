import { parseTicks } from '@laihoe/demoparser2';

const ROUND_TIME = 'CCSGameRulesProxy.CCSGameRules.m_iRoundTime';
const FREEZE_TIME = 'CCSGameRulesProxy.CCSGameRules.m_iFreezeTime';

export interface RoundTimer {
  roundTimeSeconds: number | null;
  freezeTimeSeconds: number | null;
}

export function readRoundTimers(
  demoPath: string,
  rounds: { roundNum: number; tick: number }[],
): Map<number, RoundTimer> {
  const out = new Map<number, RoundTimer>();
  if (rounds.length === 0) return out;

  const byTick = new Map<number, number[]>();
  for (const r of rounds) {
    const list = byTick.get(r.tick) ?? [];
    list.push(r.roundNum);
    byTick.set(r.tick, list);
  }

  const rows = parseTicks(demoPath, [ROUND_TIME, FREEZE_TIME], [...byTick.keys()]) as Record<string, unknown>[];
  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

  for (const row of rows) {
    const tick = Number(row['tick']);
    for (const roundNum of byTick.get(tick) ?? []) {
      if (out.has(roundNum)) continue;
      out.set(roundNum, {
        roundTimeSeconds: num(row[ROUND_TIME]),
        freezeTimeSeconds: num(row[FREEZE_TIME]),
      });
    }
  }
  return out;
}
