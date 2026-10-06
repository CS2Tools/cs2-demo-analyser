import { useTranslation } from 'react-i18next';
import { Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function PrunedBadge({ bulkState, className }: { bulkState: string; className?: string }) {
  const { t } = useTranslation();
  if (bulkState !== 'pruned') return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Badge variant="outline" className={className ?? 'cursor-help text-muted-foreground'} />}
      >
        <Archive />
        {t('retention.prunedBadge')}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{t('retention.prunedExplain')}</TooltipContent>
    </Tooltip>
  );
}
