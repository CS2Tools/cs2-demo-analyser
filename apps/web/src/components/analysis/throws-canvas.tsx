import { useCallback, useEffect, useRef } from 'react';
import type { UtilityThrow } from '@cs2/contract';
import { transport } from '@/lib/transport';

export const THROW_COLORS: Record<UtilityThrow['kind'], string> = {
  smoke: '#94a3b8',
  flash: '#facc15',
  fire: '#f97316',
  he: '#ef4444',
  decoy: '#a78bfa',
};

export type DrawableThrow = Pick<
  UtilityThrow,
  'grenadeId' | 'kind' | 'throwPx' | 'throwPy' | 'detPx' | 'detPy' | 'split'
>;

export function ThrowsCanvas({
  mapName,
  throws,
  layersRef,
}: {
  mapName: string;
  throws: DrawableThrow[];
  layersRef?: React.MutableRefObject<HTMLCanvasElement[] | null>;
}) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement | null>(null);

  const draw = useCallback(() => {
    const base = baseRef.current;
    const dots = dotsRef.current;
    if (!base || !dots) return;
    const baseCtx = base.getContext('2d');
    const ctx = dots.getContext('2d');
    if (!baseCtx || !ctx) return;

    baseCtx.clearRect(0, 0, base.width, base.height);
    if (image.current) baseCtx.drawImage(image.current, 0, 0, base.width, base.height);

    const W = dots.width;
    const H = dots.height;
    ctx.clearRect(0, 0, W, H);

    const toXY = (px: number, py: number) => ({ x: (px / 100) * W, y: H - (py / 100) * H });
    const radius = Math.max(3, W / 160);

    for (const g of throws) {
      if (g.detPx === null || g.detPy === null) continue;
      const to = toXY(g.detPx, g.detPy);
      const color = THROW_COLORS[g.kind];

      if (g.throwPx !== null && g.throwPy !== null) {
        const from = toXY(g.throwPx, g.throwPy);
        ctx.strokeStyle = `${color}33`;
        ctx.lineWidth = Math.max(1, W / 800);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      ctx.fillStyle = `${color}cc`;
      ctx.beginPath();
      ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00000066';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [throws]);

  useEffect(() => {
    const img = new Image();
    img.src = transport.assetUrl('radar', `${mapName}/radar.png`);
    img.onload = () => {
      image.current = img;
      draw();
    };
    return () => {
      img.onload = null;
    };
  }, [mapName, draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const size = container.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const ref of [baseRef, dotsRef]) {
        const c = ref.current;
        if (!c) continue;
        c.width = Math.round(size * dpr);
        c.height = Math.round(size * dpr);
        c.style.width = `${size}px`;
        c.style.height = `${size}px`;
      }
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => draw(), [draw]);

  useEffect(() => {
    if (!layersRef) return;
    layersRef.current =
      baseRef.current && dotsRef.current ? [baseRef.current, dotsRef.current] : null;
    return () => {
      layersRef.current = null;
    };
  }, [layersRef]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-lg bg-black/60"
    >
      <canvas ref={baseRef} className="absolute inset-0 opacity-70" />
      <canvas ref={dotsRef} className="absolute inset-0" />
    </div>
  );
}
