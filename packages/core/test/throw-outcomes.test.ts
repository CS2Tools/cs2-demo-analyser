import { describe, expect, it } from 'vitest';
import {
  EMPTY_OUTCOME,
  throwOutcomes,
  type BlindRef,
  type DamageRef,
  type GrenadeRef,
} from '../src/analytics/utility.js';

const g = (
  grenadeId: number,
  type: string,
  detonateTick: number,
  thrower = 'ana',
  roundNum = 1,
): GrenadeRef => ({ grenadeId, roundNum, throwerSteamId: thrower, type, throwTick: detonateTick - 96, detonateTick });

const d = (
  tick: number,
  damage: number,
  weapon: string,
  victim: string,
  attacker = 'ana',
  isTeamDamage = false,
): DamageRef => ({ roundNum: 1, tick, attackerSteamId: attacker, victimSteamId: victim, weapon, damage, isTeamDamage });

const b = (
  tick: number,
  duration: number,
  victim: string,
  thrower = 'ana',
  isTeamFlash = false,
): BlindRef => ({
  roundNum: 1, tick, throwerSteamId: thrower, victimSteamId: victim, duration,
  isTeamFlash, effective: duration >= 1.1, facingAway: null, distance: null,
});

describe('throwOutcomes', () => {
  it('a HE leva o dano e conta as vitimas distintas', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'hegrenade', 1000)],
      damages: [d(1002, 40, 'hegrenade', 'rui'), d(1002, 31, 'hegrenade', 'ze'), d(1003, 9, 'hegrenade', 'rui')],
      blinds: [],
    });
    expect(out.byGrenade.get(1)).toEqual({ ...EMPTY_OUTCOME, damage: 80, enemiesHit: 2 });
  });

  it('dano no proprio time nunca entra', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'hegrenade', 1000)],
      damages: [d(1002, 50, 'hegrenade', 'aliado', 'ana', true)],
      blinds: [],
    });
    expect(out.byGrenade.get(1)).toEqual(EMPTY_OUTCOME);
  });

  it('entre duas HE do mesmo jogador, o dano vai para a detonacao mais proxima', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'hegrenade', 1000), g(2, 'hegrenade', 3000)],
      damages: [d(1010, 40, 'hegrenade', 'rui'), d(2990, 20, 'hegrenade', 'ze')],
      blinds: [],
    });
    expect(out.byGrenade.get(1)!.damage).toBe(40);
    expect(out.byGrenade.get(2)!.damage).toBe(20);
  });

  it('o dano de fogo vem com a arma inferno e nao contamina a HE', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'hegrenade', 1000), g(2, 'molotov', 1005)],
      damages: [d(1200, 33, 'inferno', 'rui')],
      blinds: [],
    });
    expect(out.byGrenade.get(1)!.damage).toBe(0);
    expect(out.byGrenade.get(2)!.damage).toBe(33);
  });

  it('a flash leva os cegados: soma, maior cegueira e inimigos distintos', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'flashbang', 1000)],
      blinds: [b(1001, 2.4, 'rui'), b(1001, 0.6, 'ze'), b(1001, 1.2, 'rui')],
      damages: [],
    });
    expect(out.byGrenade.get(1)).toEqual({
      ...EMPTY_OUTCOME,
      enemiesBlinded: 2,
      blindSeconds: 4.2,
      bestBlindSeconds: 2.4,
    });
  });

  it('flash no proprio time nao vira efeito', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'flashbang', 1000)],
      blinds: [b(1001, 3, 'aliado', 'ana', true)],
      damages: [],
    });
    expect(out.byGrenade.get(1)).toEqual(EMPTY_OUTCOME);
  });

  it('smoke e decoy saem zeradas, e presentes: o app nao mede bloqueio de visao', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'smokegrenade', 1000), g(2, 'decoy', 1100)],
      damages: [],
      blinds: [],
    });
    expect(out.byGrenade.get(1)).toEqual(EMPTY_OUTCOME);
    expect(out.byGrenade.get(2)).toEqual(EMPTY_OUTCOME);
  });

  it('granada de outro jogador nao recebe o dano', () => {
    const out = throwOutcomes({
      grenades: [g(1, 'hegrenade', 1000, 'bruno')],
      damages: [d(1001, 40, 'hegrenade', 'rui', 'ana')],
      blinds: [],
    });
    expect(out.byGrenade.get(1)).toEqual(EMPTY_OUTCOME);
  });

  it('granada de outro round tambem nao', () => {
    const grenade = { ...g(1, 'hegrenade', 1000), roundNum: 2 };
    const out = throwOutcomes({ grenades: [grenade], damages: [d(1001, 40, 'hegrenade', 'rui')], blinds: [] });
    expect(out.byGrenade.get(1)).toEqual(EMPTY_OUTCOME);
  });

  it('dano sem granada correspondente nao some: vira total declarado', () => {
    const out = throwOutcomes({
      grenades: [],
      damages: [d(1001, 57, 'hegrenade', 'rui'), d(1001, 40, 'hegrenade', 'ze')],
      blinds: [b(1001, 2, 'rui')],
    });
    expect(out.unattributedDamage).toBe(97);
    expect(out.unattributedBlindSeconds).toBe(2);
    expect(out.byGrenade.size).toBe(0);
  });
});
