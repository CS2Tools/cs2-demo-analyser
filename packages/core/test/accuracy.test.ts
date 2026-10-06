import { describe, expect, it } from 'vitest';
import {
  burstPositions,
  summarizeAccuracy,
  type HitInput,
  type ShotInput,
} from '../src/accuracy.js';

const TICK = 64;

const shot = (patch: Partial<ShotInput> = {}): ShotInput => ({
  steamId: 'p1',
  weapon: 'weapon_ak47',
  tick: 1000,
  speed: null,
  isScoped: null,
  ...patch,
});

const hit = (patch: Partial<HitInput> = {}): HitInput => ({
  attackerSteamId: 'p1',
  victimSteamId: 'p2',
  tick: 1000,
  damage: 27,
  hitgroup: 'chest',
  ...patch,
});

describe('burstPositions', () => {
  it('tiros seguidos viram uma rajada; a pausa abre outra', () => {
    const shots = [
      shot({ tick: 1000 }), shot({ tick: 1006 }), shot({ tick: 1012 }),
      shot({ tick: 1100 }),
    ];
    const b = burstPositions(shots, TICK);
    expect(b.map((x) => x.position)).toEqual([0, 1, 2, 0]);
    expect(b.map((x) => x.burstSize)).toEqual([3, 3, 3, 1]);
  });

  it('armas diferentes sao rajadas diferentes, mesmo coladas', () => {
    const shots = [shot({ tick: 1000 }), shot({ tick: 1003, weapon: 'weapon_deagle' })];
    expect(burstPositions(shots, TICK).map((x) => x.position)).toEqual([0, 0]);
  });

  it('jogadores diferentes nao se misturam', () => {
    const shots = [shot({ tick: 1000 }), shot({ tick: 1003, steamId: 'p2' })];
    expect(burstPositions(shots, TICK).map((x) => x.position)).toEqual([0, 0]);
  });

  it('a ordem de entrada nao importa', () => {
    const fora = [shot({ tick: 1012 }), shot({ tick: 1000 }), shot({ tick: 1006 })];
    const b = burstPositions(fora, TICK);

    expect(b[1]!.position).toBe(0);
    expect(b[2]!.position).toBe(1);
    expect(b[0]!.position).toBe(2);
  });
});

describe('summarizeAccuracy', () => {
  it('tiro sem dano no mesmo tick e erro', () => {
    const s = summarizeAccuracy([shot({ tick: 1000 }), shot({ tick: 1200 })], [hit({ tick: 1000 })], TICK);
    const p = s.players[0]!;
    expect([p.shots, p.hits]).toEqual([2, 1]);
    expect(p.accuracy).toBe(0.5);
    expect(p.damage).toBe(27);
  });

  it('escopeta: quatro pelotas no mesmo tick sao UM acerto', () => {
    const s = summarizeAccuracy(
      [shot({ weapon: 'weapon_xm1014', tick: 500 })],
      [
        hit({ tick: 500, damage: 10 }), hit({ tick: 500, damage: 12 }),
        hit({ tick: 500, damage: 9 }), hit({ tick: 500, damage: 8 }),
      ],
      TICK,
    );
    const p = s.players[0]!;
    expect([p.shots, p.hits]).toEqual([1, 1]);
    expect(p.accuracy).toBe(1);

    expect(p.damage).toBe(39);
  });

  it('granada e faca ficam fora da precisao', () => {
    const s = summarizeAccuracy(
      [shot({ weapon: 'weapon_hegrenade' }), shot({ weapon: 'weapon_knife' }), shot({ weapon: 'weapon_ak47' })],
      [],
      TICK,
    );
    expect(s.players[0]!.shots).toBe(1);
  });

  it('separa o primeiro tiro do resto da rajada', () => {
    const shots = [
      shot({ tick: 1000 }), shot({ tick: 1006 }), shot({ tick: 1012 }), shot({ tick: 1018 }),
    ];
    const s = summarizeAccuracy(shots, [hit({ tick: 1012 })], TICK);
    const p = s.players[0]!;
    expect([p.firstShots, p.firstHits]).toEqual([1, 0]);
    expect([p.sprayShots, p.sprayHits]).toEqual([3, 1]);
    expect(p.firstAccuracy).toBe(0);
    expect(p.sprayAccuracy).toBeCloseTo(1 / 3);
  });

  it('dois tiros so nao viram spray', () => {
    const s = summarizeAccuracy([shot({ tick: 1000 }), shot({ tick: 1006 })], [], TICK);
    const p = s.players[0]!;
    expect(p.sprayShots).toBe(0);
    expect(p.sprayAccuracy).toBeNull();
  });

  it('counter-strafe: julga so o que da para julgar', () => {
    const s = summarizeAccuracy(
      [

        shot({ tick: 1000, speed: 20 }),
        shot({ tick: 2000, speed: 200 }),

        shot({ tick: 3000, speed: null }),

        shot({ tick: 4000, speed: 10, weapon: 'weapon_taser' }),
      ],
      [],
      TICK,
    );
    const p = s.players[0]!;
    expect([p.judgedShots, p.slowEnoughShots]).toEqual([2, 1]);
    expect(p.counterStrafe).toBe(0.5);
  });

  it('sem velocidade e sem grupo de acerto, a partida se declara sem dado de tiro', () => {
    const s = summarizeAccuracy([shot()], [hit({ hitgroup: null })], TICK);
    expect(s.hasShotData).toBe(false);
    expect(s.players[0]!.counterStrafe).toBeNull();
    expect(s.players[0]!.headshotHits).toBe(0);
  });

  it('conta onde a bala pegou, e a cabeca vira taxa sobre os ACERTOS', () => {
    const s = summarizeAccuracy(
      [shot({ tick: 1 }), shot({ tick: 200 }), shot({ tick: 400 })],
      [
        hit({ tick: 1, hitgroup: 'head', damage: 100 }),
        hit({ tick: 200, hitgroup: 'left_leg', damage: 11 }),
      ],
      TICK,
    );
    const p = s.players[0]!;
    expect(p.hitgroups).toEqual({ head: 1, left_leg: 1 });
    expect(p.headshotHits).toBe(1);
    expect(p.headshotAccuracy).toBe(0.5);
    expect(s.hasShotData).toBe(true);
  });

  it('por arma, cada uma com a sua conta', () => {
    const s = summarizeAccuracy(
      [
        shot({ tick: 1, weapon: 'weapon_ak47' }),
        shot({ tick: 300, weapon: 'weapon_m4a1_silencer' }),
        shot({ tick: 600, weapon: 'weapon_m4a1_silencer' }),
      ],
      [hit({ tick: 300 })],
      TICK,
    );
    const ak = s.byWeapon.find((w) => w.weapon === 'weapon_ak47')!;
    const m4 = s.byWeapon.find((w) => w.weapon === 'weapon_m4a1_silencer')!;
    expect([ak.shots, ak.hits]).toEqual([1, 0]);
    expect([m4.shots, m4.hits]).toEqual([2, 1]);
    expect(m4.accuracy).toBe(0.5);
  });

  it('o tiro de um nao vira acerto do outro, mesmo no mesmo tick', () => {
    const s = summarizeAccuracy(
      [shot({ tick: 1000, steamId: 'p1' }), shot({ tick: 1000, steamId: 'p9' })],
      [hit({ tick: 1000, attackerSteamId: 'p9' })],
      TICK,
    );
    expect(s.players.find((p) => p.steamId === 'p1')!.hits).toBe(0);
    expect(s.players.find((p) => p.steamId === 'p9')!.hits).toBe(1);
  });
});
