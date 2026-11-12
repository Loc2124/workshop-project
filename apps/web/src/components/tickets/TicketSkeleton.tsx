import { cn } from '@/lib/utils';
import { TicketShell } from './TicketShell';

const pulse =
  'rounded-ticket-info bg-ticket-skeleton motion-safe:animate-pulse';

export function TicketSkeleton({
  variant = 'card',
  className,
}: {
  variant?: 'row' | 'card';
  className?: string;
}) {
  const row = variant === 'row';
  return (
    <div
      role="status"
      aria-label="Đang tải vé workshop"
      className={cn('w-full', row && 'mx-auto max-w-ticket-row', className)}
    >
      <TicketShell
        variant={variant}
        stubClassName={row ? 'p-3' : undefined}
        body={
          <div aria-hidden="true">
            {!row && <div className={cn(pulse, 'aspect-[4/3] rounded-none')} />}
            <div
              className={cn(
                'grid gap-3 p-5',
                row && 'min-h-[134px] content-center p-4',
              )}
            >
              <div className={cn(pulse, 'h-6 w-4/5')} />
              <div className={cn(pulse, 'h-3.5 w-3/5')} />
              {row ? (
                <div className={cn(pulse, 'h-4 w-1/2')} />
              ) : (
                <div className="grid gap-3">
                  <div className={cn(pulse, 'h-7 w-4/5')} />
                  <div className={cn(pulse, 'h-5 w-full')} />
                </div>
              )}
            </div>
          </div>
        }
        stub={
          <div
            aria-hidden="true"
            className={cn(
              'flex h-full flex-col justify-center gap-3',
              !row && 'min-h-24',
            )}
          >
            <div className={cn(pulse, 'h-5 w-4/5')} />
            <div className={cn(pulse, 'h-4 w-3/5')} />
          </div>
        }
      />
    </div>
  );
}
