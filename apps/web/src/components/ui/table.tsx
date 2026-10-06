import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn('w-full text-sm', className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-y bg-muted/40 text-xs text-muted-foreground">{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Th({
  children,
  tip,
  align = 'right',
  className,
}: {
  children: React.ReactNode;

  tip?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const base = cn(
    'py-1.5 font-medium',
    align === 'left' ? 'px-3 text-left' : 'px-2 text-right',
    className,
  );

  if (!tip) return <th className={base}>{children}</th>;

  return (
    <th className={base}>
      <Tooltip>
        <TooltipTrigger render={<span className="cursor-help underline decoration-dotted underline-offset-2" />}>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left font-normal">{tip}</TooltipContent>
      </Tooltip>
    </th>
  );
}

export function Tr({
  children,
  className,
  onClick,
  highlighted,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  highlighted?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b last:border-0',
        onClick && 'cursor-pointer hover:bg-accent/40',
        highlighted && 'bg-accent/60',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = 'right',
  muted,
  className,
  title,
  colSpan,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';

  muted?: boolean;
  className?: string;
  title?: string;
  colSpan?: number;
}) {
  return (
    <td
      title={title}
      colSpan={colSpan}
      className={cn(
        'py-1.5',
        align === 'left' ? 'px-3' : 'px-2 text-right font-mono tabular-nums',
        muted && 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function GroupRow({ children, colSpan, highlighted }: {
  children: React.ReactNode;
  colSpan: number;
  highlighted?: boolean;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={cn(
          'px-3 py-1 text-xs font-medium',
          highlighted ? 'bg-primary/10' : 'bg-muted/20',
        )}
      >
        {children}
      </td>
    </tr>
  );
}
