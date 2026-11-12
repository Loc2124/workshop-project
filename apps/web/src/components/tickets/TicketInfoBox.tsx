import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TicketInfoBox({
  label,
  value,
  detail,
  emphasis = false,
  compact = false,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  emphasis?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'ticket-info-box min-w-0 rounded-ticket-info border border-ticket-accent p-2.5',
        emphasis && 'border-2 p-[9px] font-semibold text-ticket-accent',
        compact && 'px-2.5 py-1.5',
        className,
      )}
      title={typeof value === 'string' ? value : undefined}
    >
      <dt
        className={cn(
          'ticket-info-label text-[13px] font-semibold uppercase leading-snug',
          compact && 'text-xs',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'ticket-info-value mt-1.5 break-words text-lg font-bold leading-snug',
          compact && 'mt-0.5 line-clamp-2 text-sm',
        )}
      >
        {value}
        {detail && (
          <span className="mt-1 block text-xs font-normal">{detail}</span>
        )}
      </dd>
    </div>
  );
}
