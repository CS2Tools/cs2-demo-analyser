import { describe, expect, it } from 'vitest';
import {
  fireStats,
  flashDepth,
  heStats,
  smokeStats,
  unusedUtilityValue,
  utilityInInventory,
} from '../src/analytics/utility.js';

describe('heStats', () => {
  const grenades = [
    { grenadeId: 1, roundNum: 1, throwerSteamId: 'a', type: 'hegrenade', throwTick: 100, detonateTick: 200 },
    { grenadeId: 2, roundNum: 2, throwerSteamId: 'a', type: 'hegrenade', throwTick: 300, detonateTick: 400 },
  ];

  it('agrupa o dano pela granada mais proxima no tempo', () => {
    const out = heStats({
      grenades,
      damages: [
        { roundNum: 1, tick: 201, attackerSteamId: 'a', victimSteamId: 'v1', weapon: 'hegrenade', damage: 40, isTeamDamage: false },
        { roundNum: 1, tick: 201, attackerSteamId: 'a', victimSteamId: 'v2', weapon: 'hegrenade', damage: 25, isTeamDamage: false },
        { roundNum: 2, tick: 401, attackerSteamId: 'a', victimSteamId: 'v1', weapon: 'hegrenade', damage: 10, isTeamDamage: false },
      ],
    });
    const a = out.byPlayer.find((p) => p.steamId === 'a')!;
    expect(a.grenades).toBe(2);
    expect(a.damage).toBe(75);
    expect(a.enemiesHit).toBe(3);

    expect(a.bestMultiHit).toBe(2);
  });

  it('dano no proprio time nao vira eficiencia', () => {
    const out = heStats({
      grenades,
      damages: [
        { roundNum: 1, tick: 201, attackerSteamId: 'a', victimSteamId: 'amigo', weapon: 'hegrenade', damage: 50, isTeamDamage: true },
      ],
    });
    const a = out.byPlayer.find((p) => p.steamId === 'a')!;
    expect(a.damage).toBe(0);
    expect(a.teamDamage).toBe(50);
  });
});

describe('fireStats', () => {
  const grenades = [
    { grenadeId: 10, roundNum: 1, throwerSteamId: 'b', type: 'molotov', throwTick: 100, detonateTick: 150 },
  ];

  it('soma dano, inimigos e kills de fogo', () => {
    const out = fireStats({
      grenades,
      damages: [
        { roundNum: 1, tick: 160, attackerSteamId: 'b', victimSteamId: 'v1', weapon: 'inferno', damage: 33, isTeamDamage: false },
        { roundNum: 1, tick: 170, attackerSteamId: 'b', victimSteamId: 'v1', weapon: 'inferno', damage: 22, isTeamDamage: false },
        { roundNum: 1, tick: 175, attackerSteamId: 'b', victimSteamId: 'v2', weapon: 'inferno', damage: 10, isTeamDamage: false },
      ],
      kills: [{ roundNum: 1, tick: 176, attackerSteamId: 'b', victimSteamId: 'v1', weapon: 'inferno' }],
    });
    const b = out.byPlayer.find((p) => p.steamId === 'b')!;
    expect(b.grenades).toBe(1);
    expect(b.damage).toBe(65);
    expect(b.enemiesHit).toBe(2);
    expect(b.kills).toBe(1);
  });

  it('kill de arma de fogo comum nao conta como kill de molotov', () => {
    const out = fireStats({
      grenades,
      damages: [],
      kills: [{ roundNum: 1, tick: 176, attackerSteamId: 'b', victimSteamId: 'v1', weapon: 'ak47' }],
    });
    expect(out.byPlayer.find((p) => p.steamId === 'b')!.kills).toBe(0);
  });
});

describe('smokeStats', () => {
  it('conta as smokes e em que momento do round sairam', () => {
    const out = smokeStats({
      grenades: [
        { grenadeId: 1, roundNum: 1, throwerSteamId: 'c', type: 'smokegrenade', throwTick: 100, detonateTick: 130 },
        { grenadeId: 2, roundNum: 1, throwerSteamId: 'c', type: 'smokegrenade', throwTick: 1000, detonateTick: 1030 },
      ],
      roundStartTicks: new Map([[1, 100]]),
      tickRate: 64,
      killsThroughSmoke: [{ roundNum: 1, attackerSteamId: 'c' }],
    });
    const c = out.byPlayer.find((p) => p.steamId === 'c')!;
    expect(c.smokes).toBe(2);
    expect(c.killsThroughSmoke).toBe(1);

    expect(c.medianSecondsIntoRound).toBeCloseTo(7.03, 1);
  });
});

describe('flashDepth', () => {
  const grenades = [
    { grenadeId: 1, roundNum: 1, throwerSteamId: 'd', type: 'flashbang', throwTick: 100, detonateTick: 204 },
    { grenadeId: 2, roundNum: 1, throwerSteamId: 'd', type: 'flashbang', throwTick: 300, detonateTick: 404 },
  ];

  it('conta arremessadas, efetivas, assist e a distancia mediana do estouro', () => {
    const out = flashDepth({
      grenades,
      tickRate: 64,
      blinds: [
        { roundNum: 1, tick: 204, throwerSteamId: 'd', victimSteamId: 'v1', duration: 3, isTeamFlash: false, effective: true, facingAway: false, distance: 200 },
        { roundNum: 1, tick: 404, throwerSteamId: 'd', victimSteamId: 'v2', duration: 2, isTeamFlash: false, effective: true, facingAway: true, distance: 600 },
      ],
      flashAssists: [{ roundNum: 1, flasherSteamId: 'd' }],
    });
    const d = out.byPlayer.find((p) => p.steamId === 'd')!;
    expect(d.flashes).toBe(2);
    expect(d.effectiveBlinds).toBe(2);
    expect(d.flashAssists).toBe(1);
    expect(d.blindedFacingAway).toBe(1);
    expect(d.medianDistance).toBe(400);
  });

  it('cegar o proprio time nunca entra como efetiva nem na distancia', () => {
    const out = flashDepth({
      grenades,
      tickRate: 64,
      blinds: [
        { roundNum: 1, tick: 204, throwerSteamId: 'd', victimSteamId: 'amigo', duration: 3, isTeamFlash: true, effective: true, facingAway: false, distance: 100 },
      ],
      flashAssists: [],
    });
    const d = out.byPlayer.find((p) => p.steamId === 'd')!;
    expect(d.effectiveBlinds).toBe(0);
    expect(d.teamFlashes).toBe(1);
    expect(d.medianDistance).toBeNull();
  });

  it('sem os ticks (partida antiga) a distancia fica nula em vez de zero', () => {
    const out = flashDepth({
      grenades,
      tickRate: 64,
      blinds: [
        { roundNum: 1, tick: 204, throwerSteamId: 'd', victimSteamId: 'v1', duration: 3, isTeamFlash: false, effective: true, facingAway: null, distance: null },
      ],
      flashAssists: [],
    });
    expect(out.byPlayer.find((p) => p.steamId === 'd')!.medianDistance).toBeNull();
  });
});

describe('utilitario que morreu na mao', () => {
  it('so granadas contam, e pelo preco de compra', () => {
    expect(utilityInInventory(['AK-47', 'Smoke Grenade', 'Flashbang', 'C4 Explosive']))
      .toEqual([{ name: 'Smoke Grenade', price: 300 }, { name: 'Flashbang', price: 200 }]);
    expect(unusedUtilityValue(['AK-47', 'Smoke Grenade', 'Flashbang'])).toBe(500);
    expect(unusedUtilityValue(['AK-47'])).toBe(0);
  });
});
