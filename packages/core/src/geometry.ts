export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const EYE_HEIGHT_STANDING = 64.093;
export const EYE_HEIGHT_DUCKED = 46.04;

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

export const toRadians = (deg: number): number => deg * RAD;
export const toDegrees = (rad: number): number => rad * DEG;

export function wrap180(deg: number): number {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (a === -180) a = 180;
  return a;
}

export function eyeHeight(duckAmount: number): number {
  const d = clamp(duckAmount ?? 0, 0, 1);
  return EYE_HEIGHT_STANDING - d * (EYE_HEIGHT_STANDING - EYE_HEIGHT_DUCKED);
}

export function eyePosition(feet: Vec3, duckAmount: number): Vec3 {
  return { x: feet.x, y: feet.y, z: feet.z + eyeHeight(duckAmount) };
}

export function anglesToDirection(pitchDeg: number, yawDeg: number): Vec3 {
  const p = toRadians(pitchDeg);
  const y = toRadians(yawDeg);
  const cp = Math.cos(p);
  return { x: cp * Math.cos(y), y: cp * Math.sin(y), z: -Math.sin(p) };
}

export function directionToAngles(dir: Vec3): { pitch: number; yaw: number } {
  return {
    pitch: -toDegrees(Math.asin(clamp(dir.z, -1, 1))),
    yaw: wrap180(toDegrees(Math.atan2(dir.y, dir.x))),
  };
}

export const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
export const length2d = (v: Vec3): number => Math.hypot(v.x, v.y);
export const distance = (a: Vec3, b: Vec3): number => length(subtract(a, b));

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export interface AimError {

  totalDeg: number;

  pitchDeg: number;

  yawDeg: number;

  distance: number;

  missUnits: number;
}

export function aimError(eye: Vec3, aimDir: Vec3, target: Vec3): AimError {
  const to = subtract(target, eye);
  const dist = length(to);
  if (dist === 0) {
    return { totalDeg: 0, pitchDeg: 0, yawDeg: 0, distance: 0, missUnits: 0 };
  }
  const u: Vec3 = { x: to.x / dist, y: to.y / dist, z: to.z / dist };

  const totalDeg = toDegrees(Math.acos(clamp(dot(aimDir, u), -1, 1)));
  const aimPitch = -toDegrees(Math.asin(clamp(aimDir.z, -1, 1)));
  const tgtPitch = -toDegrees(Math.asin(clamp(u.z, -1, 1)));

  return {
    totalDeg,

    pitchDeg: tgtPitch - aimPitch,
    yawDeg: wrap180(toDegrees(Math.atan2(aimDir.y, aimDir.x)) - toDegrees(Math.atan2(u.y, u.x))),
    distance: dist,
    missUnits: dist * Math.tan(toRadians(totalDeg)),
  };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function lerpAngle(a: number, b: number, t: number): number {
  return wrap180(a + wrap180(b - a) * t);
}
