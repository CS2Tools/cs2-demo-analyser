import { Trans, useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoundReplay } from '@cs2/contract';
import { lerp, lerpAngle } from '@cs2/core';
import { transport } from '@/lib/transport';
import { cleanName } from '@/lib/format';
import { drawDetonations, drawGrenadeTrails, drawTracers, type DrawContext } from './draw-grenades';
import { useIconImage } from '@/components/cs-icon';
import { EQUIPMENT_ICONS } from '@/lib/icons';
import { bombAt } from './hud-state';
import { numbersBySlot, planPlayerLabel, type PlayerLabelMode } from './labels';

const CT_COLOR = '#38bdf8';
const T_COLOR = '#fbbf24';
const DEAD_COLOR = '#6b7280';

const UNKNOWN_SIDE_COLOR = '#9ca3af';

const TELEPORT_PERCENT = 12;

const DEATH_MARKER_FRAMES = 8 * 4;

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

interface Camera {
  zoom: number;

  tx: number;
  ty: number;
}

const IDENTITY: Camera = { zoom: 1, tx: 0, ty: 0 };

interface Props {
  replay: RoundReplay;
  frame: number;
  highlightSlot?: number | null;
  onHoverSlot?: (slot: number | null) => void;

  labelMode?: PlayerLabelMode;

  poiColours?: Map<number, string> | null;

  layersRef?: React.MutableRefObject<HTMLCanvasElement[] | null>;
}

interface Pose {
  x: number;
  y: number;
  yaw: number;
  health: number;
  alive: boolean;
  split: number;
  flash: number;
}

function poseAt(replay: RoundReplay, slot: number, frame: number): Pose | null {
  const i0 = Math.max(0, Math.min(replay.frames - 1, Math.floor(frame)));
  const i1 = Math.min(replay.frames - 1, i0 + 1);
  const t = frame - i0;

  const a = i0 * replay.slotsPerFrame + slot;
  const b = i1 * replay.slotsPerFrame + slot;

  const xa = replay.x[a]!;
  if (Number.isNaN(xa)) return null;

  const xb = replay.x[b]!;
  const alive = replay.lifeState[a] === 0;
  const aliveNext = replay.lifeState[b] === 0;
  const splitChanged = replay.split[a] !== replay.split[b];
  const jumped =
    Number.isNaN(xb) || Math.hypot(xb - xa, replay.y[b]! - replay.y[a]!) > TELEPORT_PERCENT;

  const snap = alive !== aliveNext || splitChanged || jumped || t === 0;

  return {
    x: snap ? xa : lerp(xa, xb, t),
    y: snap ? replay.y[a]! : lerp(replay.y[a]!, replay.y[b]!, t),
    yaw: snap ? replay.yaw[a]! : lerpAngle(replay.yaw[a]!, replay.yaw[b]!, t),
    health: replay.health[a]!,
    alive,
    split: replay.split[a]!,
    flash: replay.flash[a]!,
  };
}

export function RadarCanvas({
  replay,
  frame,
  highlightSlot,
  onHoverSlot,
  layersRef,
  labelMode = 'hover',
  poiColours,
}: Props) {
  const { t } = useTranslation();
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!layersRef) return;
    layersRef.current =
      baseRef.current && liveRef.current ? [baseRef.current, liveRef.current] : null;
    return () => {
      layersRef.current = null;
    };
  }, [layersRef]);
  const containerRef = useRef<HTMLDivElement>(null);
  const radarImage = useRef<HTMLImageElement | null>(null);
  const hitBoxes = useRef<{ slot: number; x: number; y: number }[]>([]);
  const dragState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const [camera, setCamera] = useState<Camera>(IDENTITY);

  const sideOf = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const s of replay.slots) m.set(s.slot, s.side);
    return m;
  }, [replay.slots]);

  const nameOf = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of replay.slots) m.set(s.slot, cleanName(s.name));
    return m;
  }, [replay.slots]);

  const numberOf = useMemo(() => numbersBySlot(replay.slots), [replay.slots]);

  const drawLiveRef = useRef<() => void>(() => undefined);

  const c4Img = useIconImage(EQUIPMENT_ICONS.c4, () => drawLiveRef.current());
  const plantedImg = useIconImage(EQUIPMENT_ICONS.plantedC4, () => drawLiveRef.current());
  const drawBaseRef = useRef<() => void>(() => undefined);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const drawBase = useCallback(() => {
    const canvas = baseRef.current;
    const img = radarImage.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { zoom, tx, ty } = cameraRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, tx, ty, canvas.width * zoom, canvas.height * zoom);
  }, []);
  drawBaseRef.current = drawBase;

  useEffect(() => {
    const img = new Image();
    img.src = transport.assetUrl('radar', `${replay.mapName}/radar.png`);
    img.onload = () => {
      radarImage.current = img;
      drawBaseRef.current();
    };
    return () => {
      img.onload = null;
    };
  }, [replay.mapName]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const size = container.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const ref of [baseRef, liveRef]) {
        const c = ref.current;
        if (!c) continue;
        c.width = Math.round(size * dpr);
        c.height = Math.round(size * dpr);
        c.style.width = `${size}px`;
        c.style.height = `${size}px`;
      }
      drawBaseRef.current();
      drawLiveRef.current();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    drawBase();
  }, [camera, drawBase]);

  const drawLive = useCallback(() => {
    const canvas = liveRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const scale = W / 1000;
    const { zoom, tx, ty } = camera;

    ctx.clearRect(0, 0, W, H);

    const px = (p: number) => (p / 100) * W * zoom + tx;
    const py = (p: number) => ((100 - p) / 100) * H * zoom + ty;

    const drawCtx: DrawContext = { ctx, px, py, scale, pctToPx: (W / 100) * zoom };
    const nowTick = replay.startTick + frame * replay.stride;

    drawDetonations(drawCtx, replay, nowTick);
    drawGrenadeTrails(drawCtx, replay, nowTick);
    drawTracers(drawCtx, replay, nowTick, (slot, f) => {
      const p = poseAt(replay, slot, f);
      return p ? { x: p.x, y: p.y, yaw: p.yaw } : null;
    });

    for (const ev of replay.events) {
      if (ev.kind !== 'kill' || ev.x === null || ev.y === null) continue;
      const ageFrames = (nowTick - ev.tick) / replay.stride;
      if (ageFrames < 0 || ageFrames > DEATH_MARKER_FRAMES) continue;

      const alpha = 1 - ageFrames / DEATH_MARKER_FRAMES;
      const side = ev.targetSlot !== null ? sideOf.get(ev.targetSlot) : null;
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = side === 'CT' ? CT_COLOR : T_COLOR;
      ctx.lineWidth = 2 * scale;
      const cx = px(ev.x);
      const cy = py(ev.y);
      const r = 5 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const bomb = bombAt(replay.hud.bombTrack, frame);
    if (bomb && bomb.pos && (bomb.state === 'dropped' || bomb.state === 'planted')) {
      const bx = px(bomb.pos.x);
      const by = py(bomb.pos.y);
      const img = bomb.state === 'planted' ? plantedImg.current : c4Img.current;
      if (bomb.state === 'planted') {

        const plant = replay.hud.plant;
        const left = plant ? replay.hud.c4TimerSeconds - (nowTick - plant.tick) / replay.tickRate : 0;
        const period = Math.max(0.25, Math.min(1.2, left / 20));
        const phase = ((nowTick / replay.tickRate) % period) / period;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.9 - phase * 0.8})`;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(bx, by, (8 + phase * 14) * scale, 0, Math.PI * 2);
        ctx.stroke();
        const site = plant?.site;
        if (site) {
          ctx.font = `bold ${12 * scale}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3 * scale;
          ctx.strokeStyle = '#0a0a0a';
          ctx.fillStyle = '#fca5a5';
          ctx.strokeText(site, bx, by + 22 * scale);
          ctx.fillText(site, bx, by + 22 * scale);
        }
      } else {

        ctx.setLineDash([3 * scale, 3 * scale]);
        ctx.strokeStyle = '#fca5a5aa';
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.arc(bx, by, 9 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `${9 * scale}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = '#fca5a5';
        ctx.textAlign = 'left';
        ctx.fillText('≈', bx + 10 * scale, by - 6 * scale);
      }
      if (img) {
        const s = 12 * scale;
        const ratio = img.width / Math.max(1, img.height);
        ctx.drawImage(img, bx - (s * ratio) / 2, by - s / 2, s * ratio, s);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(bx - 3 * scale, by - 3 * scale, 6 * scale, 6 * scale);
      }
    }

    hitBoxes.current = [];

    for (const { slot } of replay.slots) {
      const pose = poseAt(replay, slot, frame);
      if (!pose) continue;

      const cx = px(pose.x);
      const cy = py(pose.y);
      const side = sideOf.get(slot);
      const color = !pose.alive
        ? DEAD_COLOR
        : side === 'CT'
          ? CT_COLOR
          : side === 'T'
            ? T_COLOR
            : UNKNOWN_SIDE_COLOR;
      const highlighted = highlightSlot === slot;

      const poiColour = poiColours?.get(slot) ?? null;

      const label = planPlayerLabel({
        mode: labelMode,
        name: nameOf.get(slot) ?? '',
        number: numberOf.get(slot) ?? null,
        highlighted,
      });

      hitBoxes.current.push({ slot, x: cx, y: cy });

      if (!pose.alive) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 * scale;
        const r = 4 * scale;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.moveTo(cx + r, cy - r);
        ctx.lineTo(cx - r, cy + r);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      const angle = (-pose.yaw * Math.PI) / 180;
      const coneLength = 26 * scale;
      const halfFov = (35 * Math.PI) / 180;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coneLength);
      gradient.addColorStop(0, `${color}66`);
      gradient.addColorStop(1, `${color}00`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, coneLength, angle - halfFov, angle + halfFov);
      ctx.closePath();
      ctx.fill();

      const hp = Math.max(0, Math.min(100, pose.health)) / 100;
      if (hp < 1) {
        ctx.strokeStyle = '#00000080';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 8 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * scale, -Math.PI / 2, -Math.PI / 2 + hp * Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, (label.inDot ? (highlighted ? 8 : 7) : highlighted ? 6 : 4.5) * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = poiColour ?? '#0a0a0a';
      ctx.lineWidth = (poiColour ? 2.5 : 1.5) * scale;
      ctx.stroke();

      if (pose.flash > 0.5) {
        ctx.globalAlpha = Math.min(1, pose.flash / 3);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, 11 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (bomb?.state === 'carried' && bomb.slot === slot && c4Img.current) {
        const s = 11 * scale;
        const ratio = c4Img.current.width / Math.max(1, c4Img.current.height);
        ctx.fillStyle = '#7f1d1dcc';
        ctx.beginPath();
        ctx.arc(cx + 9 * scale, cy - 9 * scale, s * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(c4Img.current, cx + 9 * scale - (s * ratio) / 2, cy - 9 * scale - s / 2, s * ratio, s);
      }

      if (label.inDot) {

        ctx.fillStyle = '#0a0a0a';
        ctx.font = `bold ${8 * scale}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.inDot, cx, cy + 0.5 * scale);
        ctx.textBaseline = 'alphabetic';
      }

      if (label.above) {
        ctx.fillStyle = '#fafafa';
        ctx.font = `${(highlighted ? 11 : 9.5) * scale}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 3 * scale;
        ctx.strokeText(label.above, cx, cy - 14 * scale);
        ctx.fillText(label.above, cx, cy - 14 * scale);
      }
    }
  }, [replay, frame, highlightSlot, sideOf, nameOf, numberOf, labelMode, poiColours, camera]);

  drawLiveRef.current = drawLive;
  useEffect(() => drawLive(), [drawLive]);

  const onWheel = useCallback((ev: WheelEvent) => {
    const canvas = liveRef.current;
    if (!canvas) return;
    ev.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const mx = (ev.clientX - rect.left) * dpr;
    const my = (ev.clientY - rect.top) * dpr;

    setCamera((cam) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
      if (next === cam.zoom) return cam;

      const ratio = next / cam.zoom;
      return clampCamera(
        { zoom: next, tx: mx - (mx - cam.tx) * ratio, ty: my - (my - cam.ty) * ratio },
        canvas.width,
        canvas.height,
      );
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onMouseDown = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (camera.zoom <= MIN_ZOOM) return;
    dragState.current = { x: ev.clientX, y: ev.clientY, tx: camera.tx, ty: camera.ty };
  };

  const onMouseMove = (ev: React.MouseEvent<HTMLDivElement>) => {
    const canvas = liveRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;

    if (dragState.current) {
      const d = dragState.current;
      setCamera((cam) =>
        clampCamera(
          {
            zoom: cam.zoom,
            tx: d.tx + (ev.clientX - d.x) * dpr,
            ty: d.ty + (ev.clientY - d.y) * dpr,
          },
          canvas.width,
          canvas.height,
        ),
      );
      return;
    }

    if (!onHoverSlot) return;
    const mx = (ev.clientX - rect.left) * dpr;
    const my = (ev.clientY - rect.top) * dpr;

    let best: number | null = null;
    let bestDist = 18 * (canvas.width / 1000);
    for (const hb of hitBoxes.current) {
      const dist = Math.hypot(hb.x - mx, hb.y - my);
      if (dist < bestDist) {
        bestDist = dist;
        best = hb.slot;
      }
    }
    onHoverSlot(best);
  };

  const endDrag = () => {
    dragState.current = null;
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative aspect-square w-full overflow-hidden rounded-lg bg-black/60"
        style={{ cursor: camera.zoom > MIN_ZOOM ? 'grab' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onDoubleClick={() => setCamera(IDENTITY)}
        onMouseLeave={() => {
          endDrag();
          onHoverSlot?.(null);
        }}
      >
        <canvas ref={baseRef} className="absolute inset-0" />
        <canvas ref={liveRef} className="absolute inset-0" />

        {camera.zoom > MIN_ZOOM ? (
          <button
            type="button"
            onClick={() => setCamera(IDENTITY)}
            className="absolute right-2 top-2 rounded bg-background/80 px-2 py-1 font-mono text-[10px] backdrop-blur hover:bg-background"
          >
            {t('frag4.zoomReset', { zoom: camera.zoom.toFixed(1) })}
          </button>
        ) : null}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        <Trans
          i18nKey="radar.approxNote"
          components={{ m: <span className="font-mono" />, b: <strong /> }}
        />
      </p>
    </div>
  );
}

function clampCamera(cam: Camera, W: number, H: number): Camera {
  const maxX = 0;
  const minX = W - W * cam.zoom;
  const maxY = 0;
  const minY = H - H * cam.zoom;
  return {
    zoom: cam.zoom,
    tx: Math.min(maxX, Math.max(minX, cam.tx)),
    ty: Math.min(maxY, Math.max(minY, cam.ty)),
  };
}
