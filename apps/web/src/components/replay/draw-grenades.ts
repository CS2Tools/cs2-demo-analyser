import type { Detonation, GrenadeKind, RoundReplay } from '@cs2/contract';

export const GRENADE_COLORS: Record<GrenadeKind, string> = {
  smoke: '#cbd5e1',
  flashbang: '#fde68a',
  he: '#fb7185',
  molotov: '#fb923c',
  decoy: '#a78bfa',
  unknown: '#94a3b8',
};

export interface DrawContext {
  ctx: CanvasRenderingContext2D;

  px: (p: number) => number;
  py: (p: number) => number;

  scale: number;

  pctToPx: number;
}

export function drawGrenadeTrails(
  d: DrawContext,
  replay: RoundReplay,
  nowTick: number,
): void {
  const { ctx, px, py, scale } = d;

  for (const g of replay.grenades) {
    if (g.path.length < 2) continue;
    const end = g.detonateTick ?? g.path[g.path.length - 1]!.tick;
    if (nowTick < g.throwTick || nowTick > end + replay.stride) continue;

    const visible = g.path.filter((p) => p.tick <= nowTick);
    if (visible.length < 2) continue;

    const color = GRENADE_COLORS[g.kind];

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * scale;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(px(visible[0]!.x), py(visible[0]!.y));
    for (const p of visible.slice(1)) ctx.lineTo(px(p.x), py(p.y));
    ctx.stroke();

    const head = visible[visible.length - 1]!;
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px(head.x), py(head.y), 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function isActive(det: Detonation, nowTick: number, stride: number): boolean {
  if (nowTick < det.tick) return false;
  if (det.expireTick !== null) return nowTick <= det.expireTick;

  return nowTick <= det.tick + stride * 2;
}

export function drawDetonations(
  d: DrawContext,
  replay: RoundReplay,
  nowTick: number,
): void {
  const { ctx, px, py, scale, pctToPx } = d;

  for (const det of replay.detonations) {
    if (!isActive(det, nowTick, replay.stride)) continue;

    const cx = px(det.x);
    const cy = py(det.y);
    const r = det.radiusPercent * pctToPx;
    const color = GRENADE_COLORS[det.kind];

    let alpha = 1;
    if (det.expireTick !== null) {
      const life = det.expireTick - det.tick;
      const remaining = det.expireTick - nowTick;
      if (life > 0 && remaining < life * 0.15) alpha = Math.max(0, remaining / (life * 0.15));
    }

    if (det.kind === 'smoke') {
      ctx.globalAlpha = 0.4 * alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.9 * alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([4 * scale, 3 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);
      approximationGlyph(d, cx, cy, alpha);
    } else if (det.kind === 'molotov') {

      ctx.globalAlpha = 0.35 * alpha;
      ctx.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + det.tick;
        const dist = r * 0.45;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.9 * alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * scale;
      ctx.setLineDash([4 * scale, 3 * scale]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      approximationGlyph(d, cx, cy, alpha);
    } else if (det.kind === 'he') {
      ctx.globalAlpha = 0.6 * alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      ctx.setLineDash([3 * scale, 3 * scale]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (det.kind === 'flashbang') {
      ctx.globalAlpha = 0.9 * alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}

function approximationGlyph(d: DrawContext, cx: number, cy: number, alpha: number): void {
  const { ctx, scale } = d;
  ctx.globalAlpha = 0.75 * alpha;
  ctx.fillStyle = '#0a0a0a';
  ctx.font = `${11 * scale}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('≈', cx, cy);
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

export function drawTracers(
  d: DrawContext,
  replay: RoundReplay,
  nowTick: number,
  poseOf: (slot: number, frame: number) => { x: number; y: number; yaw: number } | null,
): void {
  const { ctx, px, py, scale } = d;
  const ticksAlive = (replay.tickRate * 150) / 1000;

  for (const shot of replay.shots) {
    const age = nowTick - shot.tick;
    if (age < 0 || age > ticksAlive) continue;

    const frame = (shot.tick - replay.startTick) / replay.stride;
    const pose = poseOf(shot.slot, frame);
    if (!pose) continue;

    const alpha = 1 - age / ticksAlive;
    const angle = (-pose.yaw * Math.PI) / 180;
    const length = 60 * scale;

    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(px(pose.x), py(pose.y));
    ctx.lineTo(px(pose.x) + Math.cos(angle) * length, py(pose.y) + Math.sin(angle) * length);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
