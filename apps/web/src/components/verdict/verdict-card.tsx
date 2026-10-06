import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import type { VerdictWire } from '@cs2/contract';
import type { SupportedLocale } from '@cs2/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cleanName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BaselineChip } from './baseline-chip';
import { formatMetric, isSignedMetric } from './format-metric';

export const SEVERITY_STYLES: Record<VerdictWire['severity'], { strip: string; text: string }> = {
  critical: { strip: 'bg-destructive', text: 'text-destructive' },
  warning: { strip: 'bg-amber-500', text: 'text-amber-400' },
  positive: { strip: 'bg-emerald-500', text: 'text-emerald-400' },
  neutral: { strip: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
};

function baselineCenter(v: VerdictWire): number | null {
  switch (v.baseline.kind) {
    case 'own_history':
    case 'match_relative':
      return v.baseline.mean;
    case 'fixed_reference':
      return v.baseline.value;
    case 'insufficient_data':
      return null;
  }
}

function formatDelta(v: VerdictWire, locale: SupportedLocale): string | null {
  const center = baselineCenter(v);
  if (center === null) return null;

  const d = v.ruleId === 'aim.pitch_bias' ? Math.abs(v.value) - center : v.value - center;
  const body = formatMetric(Math.abs(d), v.unit, locale);
  return `${d >= 0 ? '+' : '−'}${body}`;
}

function localizeParams(
  params: Record<string, string | number> | undefined,
  locale: SupportedLocale,
): Record<string, string> {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return Object.fromEntries(
    Object.entries(params ?? {}).map(([k, v]) => [k, typeof v === 'number' ? nf.format(v) : v]),
  );
}

export function VerdictCard({
  verdict,
  onSeek,
  canSeek,
}: {
  verdict: VerdictWire;
  onSeek?: (roundNum: number, tick: number) => void;
  canSeek: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as SupportedLocale;
  const style = SEVERITY_STYLES[verdict.severity];
  const name = cleanName(verdict.playerName);
  const signed = isSignedMetric(verdict.ruleId);
  const value = formatMetric(verdict.value, verdict.unit, locale, signed);
  const delta = formatDelta(verdict, locale);

  return (
    <Card className="relative gap-0 overflow-hidden py-0" data-verdict={verdict.id}>
      <div className={cn('absolute inset-y-0 left-0 w-1', style.strip)} aria-hidden />
      <CardContent className="flex flex-col gap-2 py-3 pl-4">
        <div className="flex items-center gap-2 text-[11px]">
          <span className={cn('font-semibold uppercase tracking-wide', style.text)}>
            {t(`verdict.severity.${verdict.severity}`)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="truncate text-muted-foreground">{name}</span>
        </div>

        <div className="text-sm font-semibold leading-snug">{t(verdict.titleKey)}</div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-2xl tabular-nums">{value}</span>
          {delta ? (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {delta} {t('verdict.vsBaseline')}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <BaselineChip baseline={verdict.baseline} unit={verdict.unit} />
          <Badge variant="ghost" className="text-[10px] font-normal text-muted-foreground">
            {t(`verdict.confidence.${verdict.confidence}`)} · {t('verdict.sample', { n: verdict.sampleN })}
          </Badge>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(verdict.bodyKey, { ...verdict.params, name, value })}
        </p>

        {verdict.evidence.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {verdict.evidence.map((e) => (
              <Button
                key={`${e.roundNum}-${e.tick}`}
                variant="outline"
                size="xs"
                disabled={!canSeek || !onSeek}
                title={canSeek ? t('verdict.evidence') : undefined}
                onClick={() => onSeek?.(e.roundNum, e.tick)}
                className="h-6 gap-1 px-2 text-[10px] font-normal"
              >
                <Play className="size-2.5" />
                {t(e.labelKey, { ...localizeParams(e.params, locale), round: e.roundNum })}
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
