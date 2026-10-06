import { describe, expect, it } from 'vitest';
import {
  classifyBlinds,
  EFFECTIVE_BLIND_SECONDS,
  isPopFlash,
  summarizeFlashes,
  TEAM_FLASH_PENALTY,
  type BlindInput,
} from '../src/analytics/flashes.js';

let nextId = 1;
const blind = (o: Partial<BlindInput> = {}): BlindInput => ({
  blindId: nextId++,
  roundNum: 1,
  tick: 1000,
  victimSteamId: 'INIMIGO',
  throwerSteamId: 'EU',
  blindDuration: 2,
  victimSide: 'T',
  throwerSide: 'CT',
  ...o,
});

describe('classifyBlinds', () => {
  it('cegueira longa em inimigo e efetiva', () => {
    const b = blind({ blindDuration: 2.5 });
    expect(classifyBlinds([b])[0]!.effective).toBe(true);
  });

  it('cegueira curta NAO e efetiva: da para continuar lutando', () => {
    const b = blind({ blindDuration: EFFECTIVE_BLIND_SECONDS - 0.2 });
    expect(classifyBlinds([b])[0]!.effective).toBe(false);
  });

  it('o limiar e inclusivo', () => {
    const b = blind({ blindDuration: EFFECTIVE_BLIND_SECONDS });
    expect(classifyBlinds([b])[0]!.effective).toBe(true);
  });

  it('cegar companheiro e team flash, nunca efetiva', () => {
    const b = blind({ victimSide: 'CT', victimSteamId: 'ALIADO', blindDuration: 5 });
    const f = classifyBlinds([b])[0]!;
    expect(f.isTeamFlash).toBe(true);
    expect(f.effective).toBe(false);
  });

  it('cegar a si mesmo e contado a parte, nao como team flash', () => {
    const b = blind({ victimSteamId: 'EU', victimSide: 'CT', blindDuration: 4 });
    const f = classifyBlinds([b])[0]!;
    expect(f.isSelfFlash).toBe(true);
    expect(f.isTeamFlash).toBe(false);
    expect(f.effective).toBe(false);
  });
});

describe('summarizeFlashes', () => {
  it('separa inimigo, aliado e a si mesmo', () => {
    const bs = [
      blind({ blindDuration: 3 }),
      blind({ blindDuration: 2 }),
      blind({ victimSide: 'CT', victimSteamId: 'ALIADO', blindDuration: 1.5 }),
      blind({ victimSteamId: 'EU', victimSide: 'CT', blindDuration: 1 }),
    ];
    const s = summarizeFlashes(bs, classifyBlinds(bs), 'EU');

    expect(s.enemiesFlashed).toBe(2);
    expect(s.effectiveFlashes).toBe(2);
    expect(s.teammatesFlashed).toBe(1);
    expect(s.selfFlashes).toBe(1);
    expect(s.enemyBlindSeconds).toBe(5);
    expect(s.teamBlindSeconds).toBe(1.5);
  });

  it('o valor liquido desconta o DOBRO do tempo cegando aliado', () => {
    const bs = [
      blind({ blindDuration: 4 }),
      blind({ victimSide: 'CT', victimSteamId: 'ALIADO', blindDuration: 1 }),
    ];
    const s = summarizeFlashes(bs, classifyBlinds(bs), 'EU');
    expect(s.netValueSeconds).toBe(4 - TEAM_FLASH_PENALTY * 1);
  });

  it('o valor liquido fica NEGATIVO quando as flashes atrapalharam mais', () => {
    const bs = [
      blind({ blindDuration: 0.5 }),
      blind({ victimSide: 'CT', victimSteamId: 'ALIADO', blindDuration: 3 }),
    ];
    const s = summarizeFlashes(bs, classifyBlinds(bs), 'EU');
    expect(s.netValueSeconds).toBeLessThan(0);
  });

  it('ignora flashes de outras pessoas', () => {
    const bs = [blind({ throwerSteamId: 'OUTRO', blindDuration: 5 })];
    const s = summarizeFlashes(bs, classifyBlinds(bs), 'EU');
    expect(s.enemiesFlashed).toBe(0);
    expect(s.enemyBlindSeconds).toBe(0);
  });
});

describe('isPopFlash', () => {
  const base = { throwTick: 1000, tickRate: 64, maxEnemyBlindSeconds: 2 };

  it('detonou rapido E cegou: e pop flash', () => {
    expect(isPopFlash({ ...base, detonateTick: 1000 + 32 })).toBe(true);
  });

  it('detonou devagar: nao e pop flash', () => {
    expect(isPopFlash({ ...base, detonateTick: 1000 + 128 })).toBe(false);
  });

  it('detonou rapido mas nao cegou ninguem: nao conta', () => {

    expect(isPopFlash({ ...base, detonateTick: 1032, maxEnemyBlindSeconds: 0.3 })).toBe(false);
  });

  it('funciona igual a 128 tick', () => {

    expect(isPopFlash({ throwTick: 0, detonateTick: 32, tickRate: 64, maxEnemyBlindSeconds: 2 }))
      .toBe(true);
    expect(isPopFlash({ throwTick: 0, detonateTick: 64, tickRate: 128, maxEnemyBlindSeconds: 2 }))
      .toBe(true);
  });
});
