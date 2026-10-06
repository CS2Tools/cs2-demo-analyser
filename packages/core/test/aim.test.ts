import { describe, expect, it } from 'vitest';
import {
  aimErrorToHead,
  CALIBRATED_PUNCH_MODEL,
  CALIBRATION_MEDIAN_DEG,
  CALIBRATION_P90_DEG,
  describe as describeDist,
  EYE_HEIGHT_STANDING,
  HEAD_OFFSET_FROM_EYE,
  passesCalibration,
  SHOT_TICK_OFFSET_AT_64,
  shotDirection,
  type AimSample,
} from '../src/index.js';

const base: AimSample = {
  shooter: { x: 0, y: 0, z: 0 },
  shooterDuck: 0,
  eyePitch: 0,
  eyeYaw: 0,
  punchPitch: 0,
  punchYaw: 0,
  cmdPitch: null,
  cmdYaw: null,
  victim: { x: 1000, y: 0, z: 0 },
  victimDuck: 0,
};

describe('shotDirection', () => {
  it('sem tranco, todos os modelos concordam', () => {
    const a = shotDirection(base, 'none');
    for (const model of ['add', 'subtract'] as const) {
      const b = shotDirection(base, model);
      expect(b.x).toBeCloseTo(a.x, 9);
      expect(b.z).toBeCloseTo(a.z, 9);
    }
  });

  it('`add` soma o tranco ao angulo de visao', () => {
    const s = { ...base, eyePitch: 10, punchPitch: 5 };

    expect(shotDirection(s, 'add').z).toBeCloseTo(-Math.sin((15 * Math.PI) / 180), 9);
  });

  it('`subtract` vai para o lado OPOSTO de `add` — dai o sinal importar tanto', () => {
    const s = { ...base, eyePitch: 10, punchPitch: 5 };
    const add = shotDirection(s, 'add').z;
    const sub = shotDirection(s, 'subtract').z;
    const none = shotDirection(s, 'none').z;

    expect(add).toBeLessThan(none);
    expect(sub).toBeGreaterThan(none);
  });

  it('`usercmd` usa o angulo do comando e ignora o tranco', () => {
    const s = { ...base, eyePitch: 10, punchPitch: 5, cmdPitch: 2, cmdYaw: 0 };
    expect(shotDirection(s, 'usercmd').z).toBeCloseTo(-Math.sin((2 * Math.PI) / 180), 9);
  });

  it('`usercmd` cai no angulo de visao quando o comando nao existe', () => {
    const s = { ...base, eyePitch: 7, cmdPitch: null, cmdYaw: null };
    expect(shotDirection(s, 'usercmd').z).toBeCloseTo(shotDirection(s, 'none').z, 9);
  });
});

describe('aimErrorToHead', () => {
  it('mira na cabeca da erro zero', () => {

    const e = aimErrorToHead(base, 'none');
    expect(e.totalDeg).toBeCloseTo(0, 6);
    expect(e.pitchDeg).toBeCloseTo(0, 6);
  });

  it('mirar nos PES em vez da cabeca gera erro grande e para baixo', () => {

    const aimAtFeet = Math.atan2(-EYE_HEIGHT_STANDING, 1000) * (180 / Math.PI);
    const s = { ...base, eyePitch: -aimAtFeet };
    const e = aimErrorToHead(s, 'none');
    expect(e.totalDeg).toBeGreaterThan(3);

    expect(e.pitchDeg).toBeLessThan(0);
  });

  it('agachar baixa o olho e muda o erro', () => {
    const emPe = aimErrorToHead(base, 'none');
    const agachado = aimErrorToHead({ ...base, victimDuck: 1 }, 'none');
    expect(agachado.totalDeg).toBeGreaterThan(emPe.totalDeg);
  });

  it('missUnits traduz o angulo em unidades do jogo', () => {
    const s = { ...base, eyeYaw: 5 };
    const e = aimErrorToHead(s, 'none');
    expect(e.missUnits).toBeCloseTo(1000 * Math.tan((5 * Math.PI) / 180), 3);
  });
});

describe('parametros calibrados (ADR 0005)', () => {
  it('o recuo SOMA ao angulo de visao', () => {

    expect(CALIBRATED_PUNCH_MODEL).toBe('add');
  });

  it('o disparo acontece 2 ticks antes do evento de morte, a 64 tick', () => {

    expect(SHOT_TICK_OFFSET_AT_64).toBe(-2);
  });

  it('a cabeca fica na altura do olho', () => {

    expect(HEAD_OFFSET_FROM_EYE).toBe(0);
  });

  it('os limites do portao sao os do plano', () => {
    expect(CALIBRATION_MEDIAN_DEG).toBe(1.5);
    expect(CALIBRATION_P90_DEG).toBe(4);
  });
});

describe('passesCalibration', () => {
  it('aprova o resultado medido na demo de referencia', () => {

    expect(passesCalibration({ n: 40, median: 1.07, p90: 3.1, mean: 1.3, under1deg: 0.48 }))
      .toBe(true);
  });

  it('reprova quando so a mediana passa', () => {

    expect(passesCalibration({ n: 40, median: 0.93, p90: 5.09, mean: 1.8, under1deg: 0.55 }))
      .toBe(false);
  });

  it('reprova amostra vazia em vez de aprovar por omissao', () => {
    expect(passesCalibration({ n: 0, median: NaN, p90: NaN, mean: NaN, under1deg: 0 }))
      .toBe(false);
  });
});

describe('describe (distribuicao)', () => {
  it('calcula mediana e p90', () => {
    const d = describeDist([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(d.n).toBe(10);
    expect(d.median).toBe(6);
    expect(d.p90).toBe(10);
  });

  it('conta a fracao abaixo de 1 grau', () => {
    expect(describeDist([0.5, 0.8, 1.2, 3]).under1deg).toBe(0.5);
  });

  it('nao explode com amostra vazia', () => {
    const d = describeDist([]);
    expect(d.n).toBe(0);
    expect(Number.isNaN(d.median)).toBe(true);
  });
});
