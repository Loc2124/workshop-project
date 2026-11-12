import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionHeading({
  id,
  title,
  description,
  action,
  className,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2
          id={id}
          className="text-balance font-heading text-2xl font-medium leading-tight tracking-tight md:text-3xl"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-3 max-w-prose text-base leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
