import { describe, expect, it } from 'vitest';
import {
  classifyDuels,
  DEFAULT_TRADE_WINDOW_SECONDS,
  ENTRY_MAX_SECONDS,
  summarizeDuels,
  type KillInput,
} from '../src/analytics/duels.js';

const TICK = 64;

let nextId = 1;
function kill(options: Partial<KillInput> & Pick<KillInput, 'tick'>): KillInput {
  return {
    killId: nextId++,
    roundNum: 1,
    attackerSteamId: 'A1',
    victimSteamId: 'B1',
    attackerSide: 'CT',
    victimSide: 'T',
    timeInRound: options.tick / TICK,
    ...options,
  };
}

const flagsOf = (kills: KillInput[]) => {
  const f = classifyDuels(kills, { tickRate: TICK });
  return new Map(f.map((x) => [x.killId, x]));
};

describe('primeira kill e entrada', () => {
  it('a primeira kill do round e marcada', () => {
    const k1 = kill({ tick: 640 });
    const k2 = kill({ tick: 1280 });
    const f = flagsOf([k1, k2]);
    expect(f.get(k1.killId)!.isFirstKillOfRound).toBe(true);
    expect(f.get(k2.killId)!.isFirstKillOfRound).toBe(false);
  });

  it('cada LADO tem a sua propria entrada', () => {
    const ct = kill({ tick: 640, attackerSide: 'CT', victimSide: 'T', attackerSteamId: 'A1', victimSteamId: 'B1' });
    const t = kill({ tick: 700, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B2', victimSteamId: 'A2' });
    const f = flagsOf([ct, t]);
    expect(f.get(ct.killId)!.isEntry).toBe(true);
    expect(f.get(t.killId)!.isEntry).toBe(true);
  });

  it('so a PRIMEIRA kill de cada lado e entrada', () => {
    const k1 = kill({ tick: 640, attackerSteamId: 'A1', victimSteamId: 'B1' });
    const k2 = kill({ tick: 700, attackerSteamId: 'A2', victimSteamId: 'B2' });
    const f = flagsOf([k1, k2]);
    expect(f.get(k1.killId)!.isEntry).toBe(true);
    expect(f.get(k2.killId)!.isEntry).toBe(false);
  });

  it('kill tardia NAO e entrada, mesmo sendo a primeira', () => {

    const tardia = kill({ tick: (ENTRY_MAX_SECONDS + 10) * TICK });
    expect(flagsOf([tardia]).get(tardia.killId)!.isEntry).toBe(false);
    expect(flagsOf([tardia]).get(tardia.killId)!.isFirstKillOfRound).toBe(true);
  });

  it('kill de time nunca e entrada', () => {
    const teamKill = kill({ tick: 640, attackerSide: 'CT', victimSide: 'CT', victimSteamId: 'A2' });
    expect(flagsOf([teamKill]).get(teamKill.killId)!.isEntry).toBe(false);
  });

  it('com o time ja desfalcado, deixa de contar como entrada', () => {

    const mortes = [0, 1, 2].map((i) =>
      kill({
        tick: 200 + i * 10,
        attackerSide: 'T', victimSide: 'CT',
        attackerSteamId: `B${i}`, victimSteamId: `A${i}`,
      }),
    );

    const ctTarde = kill({
      tick: 400, attackerSide: 'CT', victimSide: 'T',
      attackerSteamId: 'A4', victimSteamId: 'B4',
    });
    const f = flagsOf([...mortes, ctTarde]);
    expect(f.get(ctTarde.killId)!.isEntry).toBe(false);
  });
});

describe('trocas', () => {
  it('vingar o companheiro dentro da janela conta como troca', () => {
    const k1 = kill({
      tick: 1000, attackerSide: 'T', victimSide: 'CT',
      attackerSteamId: 'B1', victimSteamId: 'A1',
    });
    const k2 = kill({
      tick: 1000 + TICK,
      attackerSide: 'CT', victimSide: 'T',
      attackerSteamId: 'A2', victimSteamId: 'B1',
    });

    const f = flagsOf([k1, k2]);
    expect(f.get(k2.killId)!.isTradeKill).toBe(true);
    expect(f.get(k2.killId)!.tradedKillId).toBe(k1.killId);
    expect(f.get(k1.killId)!.deathWasTraded).toBe(true);
    expect(f.get(k1.killId)!.tradedByKillId).toBe(k2.killId);
  });

  it('fora da janela NAO e troca', () => {
    const k1 = kill({
      tick: 1000, attackerSide: 'T', victimSide: 'CT',
      attackerSteamId: 'B1', victimSteamId: 'A1',
    });
    const k2 = kill({
      tick: 1000 + (DEFAULT_TRADE_WINDOW_SECONDS + 1) * TICK,
      attackerSide: 'CT', victimSide: 'T',
      attackerSteamId: 'A2', victimSteamId: 'B1',
    });
    expect(flagsOf([k1, k2]).get(k2.killId)!.isTradeKill).toBe(false);
  });

  it('matar outra pessoa NAO e troca: tem que ser quem matou o companheiro', () => {
    const k1 = kill({
      tick: 1000, attackerSide: 'T', victimSide: 'CT',
      attackerSteamId: 'B1', victimSteamId: 'A1',
    });
    const k2 = kill({
      tick: 1032, attackerSide: 'CT', victimSide: 'T',
      attackerSteamId: 'A2', victimSteamId: 'B9',
    });
    expect(flagsOf([k1, k2]).get(k2.killId)!.isTradeKill).toBe(false);
  });

  it('cadeia A->B->C: cada elo troca o anterior', () => {
    const a = kill({ tick: 1000, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B1', victimSteamId: 'A1' });
    const b = kill({ tick: 1032, attackerSide: 'CT', victimSide: 'T', attackerSteamId: 'A2', victimSteamId: 'B1' });
    const c = kill({ tick: 1064, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B2', victimSteamId: 'A2' });

    const f = flagsOf([a, b, c]);
    expect(f.get(b.killId)!.isTradeKill).toBe(true);
    expect(f.get(b.killId)!.tradedKillId).toBe(a.killId);
    expect(f.get(c.killId)!.isTradeKill).toBe(true);
    expect(f.get(c.killId)!.tradedKillId).toBe(b.killId);
  });

  it('uma kill troca no maximo UMA morte', () => {

    const a1 = kill({ tick: 1000, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B1', victimSteamId: 'A1' });
    const a2 = kill({ tick: 1010, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B1', victimSteamId: 'A2' });
    const vinganca = kill({ tick: 1040, attackerSide: 'CT', victimSide: 'T', attackerSteamId: 'A3', victimSteamId: 'B1' });

    const f = flagsOf([a1, a2, vinganca]);
    expect(f.get(vinganca.killId)!.isTradeKill).toBe(true);

    expect(f.get(vinganca.killId)!.tradedKillId).toBe(a2.killId);
    expect(f.get(a2.killId)!.deathWasTraded).toBe(true);
    expect(f.get(a1.killId)!.deathWasTraded).toBe(false);
  });

  it('nao cruza rounds', () => {
    const k1 = kill({ roundNum: 1, tick: 1000, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B1', victimSteamId: 'A1' });
    const k2 = kill({ roundNum: 2, tick: 1020, attackerSide: 'CT', victimSide: 'T', attackerSteamId: 'A2', victimSteamId: 'B1' });
    expect(flagsOf([k1, k2]).get(k2.killId)!.isTradeKill).toBe(false);
  });

  it('kill de time nao vinga ninguem', () => {
    const k1 = kill({ tick: 1000, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B1', victimSteamId: 'A1' });
    const teamKill = kill({ tick: 1020, attackerSide: 'T', victimSide: 'T', attackerSteamId: 'B2', victimSteamId: 'B1' });
    expect(flagsOf([k1, teamKill]).get(teamKill.killId)!.isTradeKill).toBe(false);
  });
});

describe('ticks simultaneos', () => {
  it('classifica de forma deterministica quando duas mortes caem no mesmo tick', () => {
    const a = kill({ tick: 1000, attackerSteamId: 'A1', victimSteamId: 'B1' });
    const b = kill({ tick: 1000, attackerSteamId: 'A2', victimSteamId: 'B2' });

    const primeira = classifyDuels([a, b], { tickRate: TICK });
    const segunda = classifyDuels([b, a], { tickRate: TICK });
    expect(segunda).toEqual(primeira);
  });
});

describe('summarizeDuels', () => {
  it('conta entradas ganhas e perdidas separadamente', () => {
    const ganhou = kill({ tick: 300, attackerSteamId: 'EU', victimSteamId: 'B1' });
    const kills = [ganhou];
    const flags = classifyDuels(kills, { tickRate: TICK });

    const s = summarizeDuels(kills, flags, 'EU');
    expect(s.entryKills).toBe(1);
    expect(s.entryDeaths).toBe(0);
    expect(s.entryAttempts).toBe(1);
  });

  it('taxa de morte trocada e nula sem mortes, nao zero', () => {

    const s = summarizeDuels([], [], 'EU');
    expect(s.tradedDeathRate).toBeNull();
  });

  it('calcula a fracao de mortes vingadas', () => {
    const m1 = kill({ tick: 1000, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B1', victimSteamId: 'EU' });
    const vingada = kill({ tick: 1030, attackerSide: 'CT', victimSide: 'T', attackerSteamId: 'A2', victimSteamId: 'B1' });
    const m2 = kill({ tick: 3000, attackerSide: 'T', victimSide: 'CT', attackerSteamId: 'B5', victimSteamId: 'EU' });

    const kills = [m1, vingada, m2];
    const flags = classifyDuels(kills, { tickRate: TICK });
    const s = summarizeDuels(kills, flags, 'EU');

    expect(s.deaths).toBe(2);
    expect(s.tradedDeaths).toBe(1);
    expect(s.tradedDeathRate).toBe(0.5);
  });
});

describe('entrada em round desfalcado', () => {
  const roster = (ct: number, t: number) =>
    ({ rosterBySide: new Map([[1, { CT: ct, T: t }]]), tickRate: TICK });

  const flags = (kills: KillInput[], ct: number, t: number) => {
    const f = classifyDuels(kills, roster(ct, t));
    return new Map(f.map((x) => [x.killId, x]));
  };

  it('num 4v5, a primeira kill com todos vivos E entrada', () => {
    const k = kill({ tick: 640, attackerSide: 'CT', victimSide: 'T' });
    expect(flags([k], 4, 5).get(k.killId)!.isEntry).toBe(true);
  });

  it('num 4v5, a kill do time de CINCO tambem e entrada', () => {
    const k = kill({ tick: 640, attackerSide: 'T', victimSide: 'CT' });
    expect(flags([k], 4, 5).get(k.killId)!.isEntry).toBe(true);
  });

  it('depois de duas mortes do mesmo lado, nao e mais entrada', () => {
    const m1 = kill({ tick: 300, attackerSide: 'T', victimSide: 'CT', victimSteamId: 'A1' });
    const m2 = kill({ tick: 400, attackerSide: 'T', victimSide: 'CT', victimSteamId: 'A2' });
    const resposta = kill({ tick: 500, attackerSide: 'CT', victimSide: 'T' });
    const f = flags([m1, m2, resposta], 4, 5);
    expect(f.get(m1.killId)!.isEntry).toBe(true);
    expect(f.get(resposta.killId)!.isEntry).toBe(false);
  });

  it('num round com seis de um lado, a regua acompanha o elenco', () => {
    const perda = kill({ tick: 200, attackerSide: 'T', victimSide: 'CT', victimSteamId: 'A1' });
    const resposta = kill({ tick: 300, attackerSide: 'CT', victimSide: 'T' });
    const f = flags([perda, resposta], 6, 5);
    expect(f.get(resposta.killId)!.isEntry).toBe(true);
  });

  it('sem roster, cai em cinco: o comportamento de antes da F6', () => {
    const m1 = kill({ tick: 300, attackerSide: 'T', victimSide: 'CT', victimSteamId: 'A1' });
    const resposta = kill({ tick: 400, attackerSide: 'CT', victimSide: 'T' });
    const f = classifyDuels([m1, resposta], { tickRate: TICK });
    const byId = new Map(f.map((x) => [x.killId, x]));
    expect(byId.get(resposta.killId)!.isEntry).toBe(true);
  });

  it('o limite de tempo continua valendo em round desfalcado', () => {
    const k = kill({ tick: 640, timeInRound: ENTRY_MAX_SECONDS + 1 });
    expect(flags([k], 4, 5).get(k.killId)!.isEntry).toBe(false);
  });
});
