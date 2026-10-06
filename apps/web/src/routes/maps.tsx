import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Layers, MousePointerClick } from 'lucide-react';
import {
  parseMapMeta,
  radarPercentToWorld,
  radarToPixel,
  worldToRadarPercent,
  type MapMeta,
} from '@cs2/radar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useRoute } from '@/lib/use-route';
import { transport } from '@/lib/transport';

export function MapsView() {
  const { data: maps, loading } = useRoute('maps.list', {});
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && maps?.length) setSelected(maps[0]!.name);
  }, [maps, selected]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {maps?.map((m) => (
          <button
            key={m.name}
            type="button"
            onClick={() => setSelected(m.name)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              selected === m.name
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            {m.name}
            {m.splitCount > 0 ? (
              <Layers className="ml-1.5 inline size-3.5 align-text-top" />
            ) : null}
          </button>
        ))}
      </div>

      {selected ? <RadarInspector mapName={selected} /> : null}
    </div>
  );
}

const RADAR_PX = 2048;

function RadarInspector({ mapName }: { mapName: string }) {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<MapMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState({ x: 0, y: 0, z: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setError(null);

    fetch(transport.assetUrl('radar', `${mapName}/meta.json5`))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        if (!cancelled) setMeta(parseMapMeta(mapName, text));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [mapName]);

  const plotted = useMemo(() => (meta ? worldToRadarPercent(world, meta) : null), [meta, world]);

  const onRadarClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (!meta) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * 100;
    const py = 100 - ((ev.clientY - rect.top) / rect.height) * 100;
    const split = plotted?.split ?? -1;
    const w = radarPercentToWorld({ px, py }, meta, split);
    setWorld((prev) => ({ x: Math.round(w.x), y: Math.round(w.y), z: prev.z }));
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('misc.mapLoadError')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!meta || !plotted) return <Skeleton className="h-96 w-full" />;

  const dot = radarToPixel(plotted, 100, 100);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            className="relative aspect-square w-full cursor-crosshair bg-black/40"
            onClick={onRadarClick}
          >
            <img
              ref={imgRef}
              src={transport.assetUrl('radar', `${mapName}/radar.png`)}
              alt={mapName}
              width={RADAR_PX}
              height={RADAR_PX}
              className="absolute inset-0 size-full object-contain"
              draggable={false}
            />
            <img
              src={transport.assetUrl('radar', `${mapName}/overlay_buyzones.png`)}
              alt=""
              className="pointer-events-none absolute inset-0 size-full object-contain opacity-60"
              draggable={false}
            />
            <div
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-lg"
              style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{mapName}</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <MousePointerClick className="size-3.5" />
            {t('ui.clickRadar')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup>
            {(['x', 'y', 'z'] as const).map((axis) => (
              <Field key={axis} orientation="horizontal">
                <FieldLabel htmlFor={`coord-${axis}`} className="w-8 font-mono uppercase">
                  {axis}
                </FieldLabel>
                <Input
                  id={`coord-${axis}`}
                  type="number"
                  value={world[axis]}
                  onChange={(e) =>
                    setWorld((prev) => ({ ...prev, [axis]: Number(e.target.value) || 0 }))
                  }
                />
              </Field>
            ))}
          </FieldGroup>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t('misc.radarX')}</dt>
            <dd className="text-right font-mono">{plotted.px.toFixed(3)}%</dd>
            <dt className="text-muted-foreground">{t('misc.radarY')}</dt>
            <dd className="text-right font-mono">{plotted.py.toFixed(3)}%</dd>
            <dt className="text-muted-foreground">{t('misc.level')}</dt>
            <dd className="text-right">
              {plotted.split === -1 ? (
                <Badge variant="secondary">{t('misc.mainLevel')}</Badge>
              ) : (
                <Badge>{t('frag4.splitBadge', { n: plotted.split })}</Badge>
              )}
            </dd>
            <dt className="text-muted-foreground">resolution</dt>
            <dd className="text-right font-mono">{meta.resolution}</dd>
            <dt className="text-muted-foreground">offset</dt>
            <dd className="text-right font-mono">
              {meta.offset.x}, {meta.offset.y}
            </dd>
          </dl>

          {meta.splits.length > 0 ? (
            <Alert>
              <Layers />
              <AlertTitle>{t('misc.twoFloors')}</AlertTitle>
              <AlertDescription>
                <Trans
                  i18nKey="ui2.twoFloors"
                  values={{ from: meta.splits[0]!.bounds.bottom, to: meta.splits[0]!.bounds.top }}
                  components={{ a: <span className="font-mono" />, b: <span className="font-mono" /> }}
                />
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
