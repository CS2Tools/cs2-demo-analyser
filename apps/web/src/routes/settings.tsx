import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  HardDrive,
  Map as MapIcon,
  Mic,
  Plus,
  ShieldCheck,
  Stethoscope,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import type { Diagnostics, PlayerOfInterest, Settings, Storage } from '@cs2/contract';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CsIcon } from '@/components/cs-icon';
import { MapsView } from '@/routes/maps';
import { mapIcon } from '@/lib/icons';
import { formatDateTime } from '@/lib/format';
import { useAction, useRoute } from '@/lib/use-route';
import { transport } from '@/lib/transport';
import { wouldPrune } from '@/lib/retention';

const STEAM_ID_RE = /^\d{17}$/;

const POI_COLOURS = ['#a855f7', '#22c55e', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'];

export function SettingsView() {
  const { t } = useTranslation();
  const { data: loaded, loading, reload } = useRoute('settings.get', {});
  const { data: health } = useRoute('app.health', {});
  const { data: matches } = useRoute('matches.list', { filter: 'all' });
  const storage = useRoute('app.storage', {});
  const save = useAction('settings.set');

  const [steamId, setSteamId] = useState('');
  const [retention, setRetention] = useState(50);
  const [pois, setPois] = useState<PlayerOfInterest[]>([]);
  const [labels, setLabels] = useState<Settings['replayPlayerLabels']>('number');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    setSteamId(loaded.userSteamId ?? '');
    setRetention(loaded.retentionBulkMatches);
    setPois(loaded.playersOfInterest);
    setLabels(loaded.replayPlayerLabels);
    setDirty(false);
  }, [loaded]);

  const pruneCount = useMemo(
    () => (matches ? wouldPrune(matches, retention) : 0),
    [matches, retention],
  );

  if (loading || !loaded) return <Skeleton className="h-96 w-full max-w-2xl" />;

  const steamIdInvalid = steamId !== '' && !STEAM_ID_RE.test(steamId);

  const onSave = () => {
    if (steamIdInvalid) return;
    const patch: Partial<Settings> = {
      userSteamId: steamId === '' ? null : steamId,
      retentionBulkMatches: retention,
      playersOfInterest: pois,
      replayPlayerLabels: labels,
    };
    void save.run(patch).then((r) => {
      if (r) {
        reload();

        storage.reload();
      }
    });
  };

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.title')}</CardTitle>
          <CardDescription>{t('settings.offlineNote')}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={steamIdInvalid || undefined}>
              <FieldLabel htmlFor="steamId">{t('settings.steamId')}</FieldLabel>
              <Input
                id="steamId"
                inputMode="numeric"
                placeholder="76561198000000000"
                value={steamId}
                aria-invalid={steamIdInvalid || undefined}
                onChange={(e) => change(setSteamId)(e.target.value.trim())}
              />
              {steamIdInvalid ? (
                <FieldError>{t('settings.steamIdInvalid')}</FieldError>
              ) : (
                <FieldDescription>{t('settings.steamIdHint')}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="retention">{t('settings.retention')}</FieldLabel>
              <Input
                id="retention"
                type="number"
                min={0}
                value={retention}
                onChange={(e) => change(setRetention)(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
              <FieldDescription>{t('settings.retentionHint')}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="labels">{t('settings.replayLabels')}</FieldLabel>
              <select
                id="labels"
                value={labels}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                onChange={(e) =>
                  change(setLabels)(e.target.value as Settings['replayPlayerLabels'])
                }
              >
                <option value="number">{t('settings.replayLabelsNumber')}</option>
                <option value="always">{t('settings.replayLabelsAlways')}</option>
                <option value="hover">{t('settings.replayLabelsHover')}</option>
              </select>
              <FieldDescription>{t('settings.replayLabelsHint')}</FieldDescription>
            </Field>

            {pruneCount > 0 ? (
              <Alert>
                <TriangleAlert />
                <AlertTitle>{t('settings.retentionWarnTitle', { count: pruneCount })}</AlertTitle>
                <AlertDescription>{t('settings.retentionWarn')}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      {storage.data ? <StorageCard storage={storage.data} /> : null}

      <PlayersOfInterestCard
        pois={pois}
        userSteamId={steamId}
        onChange={change(setPois)}
      />

      <div className="flex items-center gap-2">
        <Button onClick={onSave} disabled={!dirty || steamIdInvalid || save.pending}>
          {save.pending ? <Spinner data-icon="inline-start" /> : null}
          {t('common.save')}
        </Button>
        {save.error ? <span className="text-sm text-destructive">{save.error}</span> : null}
        {!dirty && !save.pending && save.error === null ? (
          <span className="text-xs text-muted-foreground">{t('settings.appliesToLibrary')}</span>
        ) : null}
      </div>

      <DiagnosticsCard />
    </div>
  );
}

function DiagnosticsCard() {
  const { t, i18n } = useTranslation();
  const { data, loading, error } = useRoute('app.diagnostics', {});
  const [showRadar, setShowRadar] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="size-4" />
          {t('settings.diagnostics')}
        </CardTitle>
        <CardDescription>
          {t('ui.diagnosticsHint')} {t('frag.localOnly')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{t('misc.diagnosticsUnavailable')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : loading || !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <Rows
              rows={[
                [t('common.version'), data.app.version, true],
                [t('settings.transport'), transport.kind, true],
                [
                  'Banco / regras',
                  `schema ${data.app.schemaVersion} · regras ${data.app.rulesVersion}`,
                  true,
                ],
                [
                  'Biblioteca',
                  `${data.library.matches} partida(s) · ${data.library.players} jogador(es)` +
                    (data.library.pruned > 0 ? ` · ${data.library.pruned} sem replay` : ''),
                ],
                [
                  'Periodo',
                  data.library.oldest && data.library.newest
                    ? `${day(data.library.oldest, i18n.language)} → ${day(data.library.newest, i18n.language)}`
                    : '—',
                ],
              ]}
            />

            <BuildsBlock data={data} locale={i18n.language} />
            <VoiceBlock data={data} />
            <RadarBlock data={data} />
          </>
        )}

        <div className="border-t pt-3">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowRadar((v) => !v)}
          >
            <MapIcon className="size-3.5" />
            {t('ui.advancedRadar')}
            <ChevronDown
              className={`size-3 transition-transform ${showRadar ? 'rotate-180' : ''}`}
            />
          </button>
          {showRadar ? (
            <div className="mt-3">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {t('frag5.radarCheck')}
              </p>
              <MapsView />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

const day = (iso: string, locale: string) => formatDateTime(iso, locale).split(',')[0]!;

function Rows({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value, mono]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={mono ? 'text-right font-mono text-xs' : 'text-right'}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BuildsBlock({ data, locale }: { data: Diagnostics; locale: string }) {
  const { t } = useTranslation();
  if (data.builds.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium">{t('misc.cs2Builds')}</h3>
      <table className="w-full text-xs">
        <tbody>
          {data.builds.map((b) => (
            <tr key={`${b.build}-${b.format}`} className="border-t">
              <td className="py-1 font-mono">{b.build ?? 'nao detectada'}</td>
              <td className="py-1 text-muted-foreground">{b.format ?? '—'}</td>
              <td className="py-1 text-right tabular-nums">{b.matches}</td>
              <td className="py-1 text-right text-muted-foreground">
                {b.newest ? day(b.newest, locale) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.builds.some((b) => b.build === null) ? (
        <p className="text-[11px] text-muted-foreground">
          {t('ui.buildHint')}
        </p>
      ) : null}
    </div>
  );
}

function VoiceBlock({ data }: { data: Diagnostics }) {
  const { t } = useTranslation();
  const total = data.voice.withVoice + data.voice.withoutVoice;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex items-center gap-1.5 text-xs font-medium">
        <Mic className="size-3.5" />
        {t('ui.voice')}
      </h3>
      {data.voice.extractorInstalled ? (
        <p className="text-xs text-muted-foreground">
          {t('frag2.voiceInstalled', { with: data.voice.withVoice, total })}
          {data.voice.withoutVoice > 0 ? t('frag2.voiceServerNote') : ''}
        </p>
      ) : (
        <Alert>
          <TriangleAlert />
          <AlertTitle>{t('misc.voiceMissing')}</AlertTitle>
          <AlertDescription>
            {t('frag2.voiceMissingWhere')}{' '}
            <span className="font-mono">
              {data.voice.extractorDir ?? t('frag2.notConfigured')}
            </span>.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function RadarBlock({ data }: { data: Diagnostics }) {
  const { t } = useTranslation();
  const used = data.radars.filter((r) => r.matches > 0).length;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium">Radares instalados ({data.radars.length})</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {data.radars.map((r) => (
          <Tooltip key={r.name}>
            <TooltipTrigger
              render={
                <Badge
                  variant={r.matches > 0 ? 'secondary' : 'outline'}
                  className="gap-1 text-[10px]"
                />
              }
            >
              <CsIcon rel={mapIcon(r.name)} title={r.name} className="size-3.5" />
              {r.name}
              {r.matches > 0 ? <span className="tabular-nums">{r.matches}</span> : null}
            </TooltipTrigger>
            <TooltipContent>
              {r.matches > 0
                ? `${r.matches} partida(s) da biblioteca neste mapa.`
                : 'Radar disponivel; nenhuma partida sua neste mapa.'}
              {r.splitCount > 0 ? ' Mapa de dois andares.' : ''}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{t('frag2.radarsInUse', { n: used })}</p>
      {data.mapsWithoutRadar.length > 0 ? (
        <Alert className="mt-1">
          <MapIcon />
          <AlertTitle>{t('misc.noVendoredRadar')}</AlertTitle>
          <AlertDescription>
            {t('frag2.noRadarMaps', {
              maps: data.mapsWithoutRadar.map((m) => `${m.name} (${m.matches})`).join(', '),
            })}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function PlayersOfInterestCard({
  pois,
  userSteamId,
  onChange,
}: {
  pois: PlayerOfInterest[];
  userSteamId: string;
  onChange: (next: PlayerOfInterest[]) => void;
}) {
  const { t } = useTranslation();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const idInvalid = id !== '' && !STEAM_ID_RE.test(id);
  const duplicate = pois.some((p) => p.steamId === id);
  const isUser = id !== '' && id === userSteamId;
  const canAdd = STEAM_ID_RE.test(id) && name.trim() !== '' && !duplicate && !isUser;

  const add = () => {
    if (!canAdd) return;
    const used = new Set(pois.map((p) => p.colour));
    const colour = POI_COLOURS.find((c) => !used.has(c)) ?? POI_COLOURS[pois.length % POI_COLOURS.length]!;
    onChange([...pois, { steamId: id, displayName: name.trim(), note: note.trim(), colour }]);
    setId('');
    setName('');
    setNote('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.playersOfInterest')}</CardTitle>
        <CardDescription>{t('settings.playersOfInterestHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pois.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.poiEmpty')}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {pois.map((p) => (
              <li key={p.steamId} className="flex items-center gap-3 px-3 py-2">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.colour }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.displayName}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {p.steamId}
                    {p.note ? <span className="font-sans"> · {p.note}</span> : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('settings.poiRemove', { name: p.displayName })}
                  onClick={() => onChange(pois.filter((x) => x.steamId !== p.steamId))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            aria-label={t('settings.poiSteamId')}
            placeholder="76561198000000000"
            inputMode="numeric"
            value={id}
            aria-invalid={idInvalid || duplicate || isUser || undefined}
            onChange={(e) => setId(e.target.value.trim())}
          />
          <Input
            aria-label={t('settings.poiName')}
            placeholder={t('settings.poiName')}
            maxLength={64}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!canAdd}>
            <Plus data-icon="inline-start" />
            {t('settings.poiAdd')}
          </Button>
          <Input
            className="sm:col-span-2"
            aria-label={t('settings.poiNote')}
            placeholder={t('settings.poiNote')}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </form>

        {idInvalid ? <p className="text-xs text-destructive">{t('settings.steamIdInvalid')}</p> : null}
        {duplicate ? <p className="text-xs text-destructive">{t('settings.poiDuplicate')}</p> : null}
        {isUser ? <p className="text-xs text-destructive">{t('settings.poiIsUser')}</p> : null}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserRound className="size-3.5" />
          {t('settings.poiWhereToFind')}
        </p>
      </CardContent>
    </Card>
  );
}

function StorageCard({ storage }: { storage: Storage }) {
  const { t, i18n } = useTranslation();
  const fmt = (bytes: number) => {
    const gb = bytes / 1024 ** 3;
    return new Intl.NumberFormat(i18n.language, {
      style: 'unit',
      unit: gb >= 1 ? 'gigabyte' : 'megabyte',
      maximumFractionDigits: 1,
    }).format(gb >= 1 ? gb : bytes / 1024 ** 2);
  };
  const rows: [string, number, string?][] = [
    [t('settings.storageDemos', { count: storage.demoCount }), storage.demos],
    [t('settings.storageReplays'), storage.replays],
    [t('settings.storageVoice'), storage.voice],
    [t('settings.storageDatabase'), storage.database, t('settings.storageDatabaseHint')],
  ];
  const total = storage.demos + storage.replays + storage.voice + storage.database;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4" />
          {t('settings.storage')}
        </CardTitle>
        <CardDescription>{t('settings.storageHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([label, bytes, hint]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">
                {label}
                {hint ? <span className="block text-[11px] text-muted-foreground/70">{hint}</span> : null}
              </dt>
              <dd className="text-right font-mono tabular-nums">{fmt(bytes)}</dd>
            </div>
          ))}
          <dt className="border-t pt-1.5 font-medium">{t('settings.storageTotal')}</dt>
          <dd className="border-t pt-1.5 text-right font-mono font-medium tabular-nums">{fmt(total)}</dd>
        </dl>
        <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">{storage.dataDir}</p>
      </CardContent>
    </Card>
  );
}
