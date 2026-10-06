import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Jargon({ k, className }: { k: string; className?: string }) {
  const { t } = useTranslation();
  const term = t(`glossary.${k}`);
  const desc = t(`glossary.${k}_desc`);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              'cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4',
              className,
            )}
          />
        }
      >
        {term}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{desc}</TooltipContent>
    </Tooltip>
  );
}
