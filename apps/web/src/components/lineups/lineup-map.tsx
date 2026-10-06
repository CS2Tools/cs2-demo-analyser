import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef } from 'react';

import { transport } from '@/lib/transport';

export interface MapPoint {
  lineupId: string;
  grenadeType: string;

  throwPx: number | null;
  throwPy: number | null;
  detPx: number | null;
  detPy: number | null;
}

export const LINEUP_COLORS: Record<string, string> = {
  smoke: '#94a3b8',
  flashbang: '#facc15',
  molotov: '#f97316',
  he: '#ef4444',
  decoy: '#a78bfa',
  unknown: '#64748b',
};

export function LineupMap({
  mapName,
  lineups,
  selectedId,
  onSelect,
}: {
  mapName: string;
  lineups: MapPoint[];
  selectedId: string | null;
  onSelect: (lineupId: string | null) => void;
}) {
  const { t } = useTranslation();
  const baseRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement | null>(null);

  const hits = useRef<{ lineupId: string; x: number; y: number; r: number }[]>([]);

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
    hits.current = [];

    const toXY = (px: number, py: number) => ({ x: (px / 100) * W, y: H - (py / 100) * H });

    for (const s of lineups) {
      if (s.detPx === null || s.detPy === null) continue;
      const to = toXY(s.detPx, s.detPy);
      const color = LINEUP_COLORS[s.grenadeType] ?? LINEUP_COLORS.unknown!;
      const selected = s.lineupId === selectedId;
      const radius = Math.max(5, W / 170);
      hits.current.push({ lineupId: s.lineupId, x: to.x, y: to.y, r: radius + 4 });

      if (selected && s.throwPx !== null && s.throwPy !== null) {
        const from = toXY(s.throwPx, s.throwPy);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, W / 500);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = color;
        ctx.fillRect(from.x - radius, from.y - radius, radius * 2, radius * 2);
        ctx.strokeStyle = '#000000aa';
        ctx.lineWidth = 1;
        ctx.strokeRect(from.x - radius, from.y - radius, radius * 2, radius * 2);
      }

      ctx.fillStyle = selected ? color : `${color}aa`;
      ctx.beginPath();
      ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffffff' : '#00000066';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.stroke();
    }
  }, [lineups, selectedId]);

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

  const onClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = dotsRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (event.clientX - rect.left) * scale;
    const y = (event.clientY - rect.top) * scale;

    let best: { lineupId: string; distance: number } | null = null;
    for (const hit of hits.current) {
      const distance = Math.hypot(hit.x - x, hit.y - y);
      if (distance <= hit.r && (!best || distance < best.distance)) {
        best = { lineupId: hit.lineupId, distance };
      }
    }
    onSelect(best?.lineupId ?? null);
  };

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-black/60"
    >
      <canvas ref={baseRef} className="absolute inset-0 opacity-70" />
      <canvas
        ref={dotsRef}
        className="absolute inset-0 cursor-pointer"
        onClick={onClick}
        aria-label={t('misc2.lineupMap')}
      />
    </div>
  );
}
