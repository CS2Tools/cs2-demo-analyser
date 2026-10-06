import { useEffect, useRef, useState } from 'react';
import { transport } from '@/lib/transport';
import { cn } from '@/lib/utils';

export function CsIcon({
  rel,
  fallback,
  title,
  className,
}: {
  rel: string | null;
  fallback?: string;
  title?: string;
  className?: string;
}) {

  const [broken, setBroken] = useState(false);
  if (!rel || broken) {
    return fallback ? (
      <span className={cn('text-[10px] text-muted-foreground', className)} title={title}>
        {fallback}
      </span>
    ) : null;
  }
  return (
    <img
      src={transport.assetUrl('icon', rel)}
      alt={title ?? fallback ?? ''}
      title={title ?? fallback}
      draggable={false}
      onError={() => setBroken(true)}
      className={cn('inline-block h-3.5 w-auto object-contain', className)}
    />
  );
}

export function useIconImage(rel: string, onLoad?: () => void) {
  const ref = useRef<HTMLImageElement | null>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  useEffect(() => {
    const img = new Image();
    img.src = transport.assetUrl('icon', rel);
    img.onload = () => {
      ref.current = img;
      onLoadRef.current?.();
    };
    return () => {
      img.onload = null;
    };
  }, [rel]);
  return ref;
}
