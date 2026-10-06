import { useCallback, useEffect, useRef } from 'react';
import { transport } from '@/lib/transport';

interface Bin {
  binX: number;
  binY: number;
  split: number;
  count: number;
}

interface Props {
  mapName: string;
  bins: Bin[];
  gridSize: number;
  maxCount: number;

  layersRef?: React.MutableRefObject<HTMLCanvasElement[] | null>;
}

export function HeatmapCanvas({ mapName, bins, gridSize, maxCount, layersRef }: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement | null>(null);

  const draw = useCallback(() => {
    const base = baseRef.current;
    const heat = heatRef.current;
    if (!base || !heat) return;

    const baseCtx = base.getContext('2d');
    const heatCtx = heat.getContext('2d');
    if (!baseCtx || !heatCtx) return;

    baseCtx.clearRect(0, 0, base.width, base.height);
    if (image.current) baseCtx.drawImage(image.current, 0, 0, base.width, base.height);

    const W = heat.width;
    const H = heat.height;
    heatCtx.clearRect(0, 0, W, H);

    const cell = W / gridSize;

    const radius = cell * 1.6;

    heatCtx.globalCompositeOperation = 'lighter';

    for (const bin of bins) {
      const cx = (bin.binX + 0.5) * cell;

      const cy = H - (bin.binY + 0.5) * cell;
      const intensity = Math.min(1, bin.count / maxCount);

      const gradient = heatCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);

      gradient.addColorStop(0, `rgba(250, 204, 21, ${0.55 * intensity + 0.25})`);
      gradient.addColorStop(0.5, `rgba(249, 115, 22, ${0.35 * intensity + 0.1})`);
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');

      heatCtx.fillStyle = gradient;
      heatCtx.beginPath();
      heatCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      heatCtx.fill();
    }

    heatCtx.globalCompositeOperation = 'source-over';
  }, [bins, gridSize, maxCount]);

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
      for (const ref of [baseRef, heatRef]) {
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
      baseRef.current && heatRef.current ? [baseRef.current, heatRef.current] : null;
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
      <canvas ref={heatRef} className="absolute inset-0" />
    </div>
  );
}
