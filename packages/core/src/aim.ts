import { anglesToDirection, eyePosition, aimError, type AimError, type Vec3 } from './geometry.js';

export type PunchModel =

  | 'none'

  | 'add'

  | 'subtract'

  | 'usercmd';

export interface AimSample {

  shooter: Vec3;
  shooterDuck: number;

  eyePitch: number;
  eyeYaw: number;

  punchPitch: number;
  punchYaw: number;

  cmdPitch: number | null;
  cmdYaw: number | null;

  victim: Vec3;
  victimDuck: number;
}

export function shotDirection(sample: AimSample, model: PunchModel): Vec3 {
  switch (model) {
    case 'none':
      return anglesToDirection(sample.eyePitch, sample.eyeYaw);
    case 'add':
      return anglesToDirection(
        sample.eyePitch + sample.punchPitch,
        sample.eyeYaw + sample.punchYaw,
      );
    case 'subtract':
      return anglesToDirection(
        sample.eyePitch - sample.punchPitch,
        sample.eyeYaw - sample.punchYaw,
      );
    case 'usercmd':
      return anglesToDirection(
        sample.cmdPitch ?? sample.eyePitch,
        sample.cmdYaw ?? sample.eyeYaw,
      );
  }
}

export function aimErrorToHead(sample: AimSample, model: PunchModel): AimError {
  const eye = eyePosition(sample.shooter, sample.shooterDuck);
  const head = eyePosition(sample.victim, sample.victimDuck);
  return aimError(eye, shotDirection(sample, model), head);
}

export interface Distribution {
  n: number;
  median: number;
  p90: number;
  mean: number;

  under1deg: number;
}

export function describe(values: number[]): Distribution {
  if (values.length === 0) return { n: 0, median: NaN, p90: NaN, mean: NaN, under1deg: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return {
    n: sorted.length,
    median: at(0.5),
    p90: at(0.9),
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    under1deg: sorted.filter((v) => v < 1).length / sorted.length,
  };
}

export const CALIBRATION_MEDIAN_DEG = 1.5;
export const CALIBRATION_P90_DEG = 4;

export const CALIBRATED_PUNCH_MODEL: PunchModel = 'add';

export const SHOT_TICK_OFFSET_AT_64 = -2;

export const HEAD_OFFSET_FROM_EYE = 0;

export function passesCalibration(d: Distribution): boolean {
  return d.n > 0 && d.median < CALIBRATION_MEDIAN_DEG && d.p90 < CALIBRATION_P90_DEG;
}
