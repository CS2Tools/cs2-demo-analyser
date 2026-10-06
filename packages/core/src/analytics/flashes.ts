import type { Side } from '../types.js';

export const EFFECTIVE_BLIND_SECONDS = 1.1;

export const POP_FLASH_SECONDS = 0.9;

export const TEAM_FLASH_PENALTY = 2;

export interface BlindInput {
  blindId: number;
  roundNum: number;
  tick: number;
  victimSteamId: string | null;
  throwerSteamId: string | null;
  blindDuration: number;
  victimSide: Side | null;
  throwerSide: Side | null;
}

export interface BlindFlags {
  blindId: number;
  isTeamFlash: boolean;
  isSelfFlash: boolean;
  effective: boolean;
}

export function classifyBlinds(blinds: BlindInput[]): BlindFlags[] {
  return blinds.map((b) => {
    const isSelfFlash = b.throwerSteamId !== null && b.throwerSteamId === b.victimSteamId;
    const isTeamFlash =
      !isSelfFlash &&
      b.throwerSide !== null &&
      b.victimSide !== null &&
      b.throwerSide === b.victimSide;

    return {
      blindId: b.blindId,
      isTeamFlash,
      isSelfFlash,
      effective: !isTeamFlash && !isSelfFlash && b.blindDuration >= EFFECTIVE_BLIND_SECONDS,
    };
  });
}

export interface FlashSummary {

  enemiesFlashed: number;

  effectiveFlashes: number;
  teammatesFlashed: number;
  selfFlashes: number;
  enemyBlindSeconds: number;
  teamBlindSeconds: number;

  netValueSeconds: number;
}

export function summarizeFlashes(
  blinds: BlindInput[],
  flags: BlindFlags[],
  throwerSteamId: string,
): FlashSummary {
  const byId = new Map(flags.map((f) => [f.blindId, f]));

  let enemiesFlashed = 0;
  let effectiveFlashes = 0;
  let teammatesFlashed = 0;
  let selfFlashes = 0;
  let enemyBlindSeconds = 0;
  let teamBlindSeconds = 0;

  for (const b of blinds) {
    if (b.throwerSteamId !== throwerSteamId) continue;
    const f = byId.get(b.blindId);
    if (!f) continue;

    if (f.isSelfFlash) {
      selfFlashes++;
    } else if (f.isTeamFlash) {
      teammatesFlashed++;
      teamBlindSeconds += b.blindDuration;
    } else {
      enemiesFlashed++;
      enemyBlindSeconds += b.blindDuration;
      if (f.effective) effectiveFlashes++;
    }
  }

  return {
    enemiesFlashed,
    effectiveFlashes,
    teammatesFlashed,
    selfFlashes,
    enemyBlindSeconds,
    teamBlindSeconds,
    netValueSeconds: enemyBlindSeconds - TEAM_FLASH_PENALTY * teamBlindSeconds,
  };
}

export function isPopFlash(options: {
  throwTick: number;
  detonateTick: number;
  tickRate: number;
  maxEnemyBlindSeconds: number;
}): boolean {
  const flightSeconds = (options.detonateTick - options.throwTick) / options.tickRate;
  return (
    flightSeconds < POP_FLASH_SECONDS &&
    options.maxEnemyBlindSeconds >= EFFECTIVE_BLIND_SECONDS
  );
}
