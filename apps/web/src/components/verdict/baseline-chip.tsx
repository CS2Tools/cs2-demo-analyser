import { useTranslation } from 'react-i18next';
import { Hourglass, Ruler, User, Users } from 'lucide-react';
import type { BaselineWire, VerdictWire } from '@cs2/contract';
import type { SupportedLocale } from '@cs2/i18n';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatMetric } from './format-metric';

export function BaselineChip({
  baseline,
  unit,
  className,
}: {
  baseline: BaselineWire;
  unit: VerdictWire['unit'];
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as SupportedLocale;
  const fmt = (v: number) => formatMetric(v, unit, locale);

  let icon: React.ReactNode;
  let label: string;
  let tip: string;
  let variant: 'default' | 'outline' = 'outline';
  let extra = '';

  switch (baseline.kind) {
    case 'own_history':
      icon = <User />;
      variant = 'default';
      label = t('baseline.ownHistory', { count: baseline.matches });
      tip = t('baseline.ownHistoryTip', {
        count: baseline.matches,
        p50: fmt(baseline.p50),
        p25: fmt(baseline.p25),
        p75: fmt(baseline.p75),
      });
      break;
    case 'match_relative':
      icon = <Users />;
      label = t('baseline.matchRelative', { rank: baseline.rank, of: baseline.of });
      tip = t('baseline.matchRelativeTip', { of: baseline.of, mean: fmt(baseline.mean) });
      break;
    case 'fixed_reference':
      icon = <Ruler />;
      label = t('baseline.fixedReferenceValue', {
        value: formatMetric(baseline.value, baseline.unit, locale),
      });
      tip = `${t(baseline.labelKey)} — ${t(baseline.rationaleKey, {
        value: formatMetric(baseline.value, baseline.unit, locale),
      })}`;
      break;
    case 'insufficient_data':
      icon = <Hourglass />;
      extra = 'border-dashed text-muted-foreground';
      label = t('baseline.insufficient', { required: baseline.required, have: baseline.have });
      tip = t(
        baseline.wouldBe === 'own_history'
          ? 'baseline.insufficientHistoryTip'
          : 'baseline.insufficientMatchTip',
        { required: baseline.required, have: baseline.have },
      );
      break;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant={variant}
            data-baseline={baseline.kind}
            className={cn('cursor-help text-[10px] font-normal', extra, className)}
          />
        }
      >
        {icon}
        {label}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}
