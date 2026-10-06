export function practiceCommand(point: {
  x: number;
  y: number;
  z: number;
  pitch: number | null;
  yaw: number | null;
}): string {
  const n = (v: number) => (Math.round(v * 100) / 100).toString();
  const pos = `setpos ${n(point.x)} ${n(point.y)} ${n(point.z)}`;
  if (point.pitch === null || point.yaw === null) return pos;
  return `${pos}; setang ${n(point.pitch)} ${n(point.yaw)}`;
}

export const THROW_SPEED = {

  still: 10,

  running: 140,
} as const;

export function describeThrow(point: {
  crouched: boolean | null;
  onGround: boolean | null;
  speed: number | null;
  throwStrength: number | null;
}): {
  movement: 'parado' | 'andando' | 'correndo' | 'jumpthrow' | 'run jumpthrow' | 'desconhecido';
  crouched: boolean | null;

  click: 'esquerdo' | 'direito' | 'os dois' | null;
} {
  const movement = describeMovement(point);

  const s = point.throwStrength;
  const click =
    s === null ? null : s >= 0.75 ? 'esquerdo' : s <= 0.25 ? 'direito' : 'os dois';

  return { movement, crouched: point.crouched, click };
}

function describeMovement(point: {
  onGround: boolean | null;
  speed: number | null;
}): 'parado' | 'andando' | 'correndo' | 'jumpthrow' | 'run jumpthrow' | 'desconhecido' {
  const { onGround, speed } = point;

  if (onGround === false) {

    if (speed === null) return 'jumpthrow';
    return speed >= THROW_SPEED.running ? 'run jumpthrow' : 'jumpthrow';
  }

  if (speed === null) return 'desconhecido';
  if (speed < THROW_SPEED.still) return 'parado';
  if (speed < THROW_SPEED.running) return 'andando';
  return 'correndo';
}
