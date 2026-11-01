import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import './tickets.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  variant?: 'row' | 'card';
  body: ReactNode;
  stub: ReactNode;
  pattern?: boolean;
  stubClassName?: string;
  perforated?: boolean;
};

export const TicketShell = forwardRef<HTMLDivElement, Props>(
  function TicketShell(
    {
      variant = 'card',
      body,
      stub,
      pattern = false,
      stubClassName,
      perforated = false,
      className,
      ...props
    },
    ref,
  ) {
    const patternId = useId().replace(/:/g, '');
    const horizontal = variant === 'row';
    return (
      <div
        ref={ref}
        className={cn(
          'ticket-shell isolate grid h-full min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[1fr_auto] text-ticket-ink',
          horizontal &&
            'ticket-shell-row md:grid-cols-[8rem_minmax(0,1fr)] md:grid-rows-1 print:grid-cols-[12rem_minmax(0,1fr)] print:grid-rows-1',
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            'ticket-body relative min-w-0 rounded-t-ticket bg-ticket',
            horizontal &&
              'md:col-start-2 md:row-start-1 md:rounded-none md:rounded-r-ticket print:col-start-2 print:row-start-1 print:rounded-none print:rounded-r-ticket',
          )}
        >
          <span
            className={cn(
              'ticket-separator pointer-events-none absolute inset-x-ticket-notch bottom-0 z-20 border-b-2 border-dashed border-ticket-accent',
              horizontal &&
                'md:inset-x-auto md:inset-y-ticket-notch md:left-0 md:border-b-0 md:border-l-2 print:inset-x-auto print:inset-y-ticket-notch print:left-0 print:border-b-0 print:border-l-2',
              perforated && 'border-dotted',
            )}
            aria-hidden="true"
          />
          {pattern && (
            <svg
              className="ticket-pattern pointer-events-none absolute inset-0 text-ticket-accent opacity-[.045]"
              width="100%"
              height="100%"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <pattern
                  id={patternId}
                  width="160"
                  height="120"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M15 60 Q40 20 65 60 T115 60 T165 60 M15 75 Q40 35 65 75 T115 75 T165 75 M15 90 Q40 50 65 90 T115 90 T165 90"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </svg>
          )}
          <div className="relative z-10 flex h-full min-w-0 flex-col">
            {body}
          </div>
        </div>
        <div
          className={cn(
            'ticket-stub relative min-w-0 rounded-b-ticket bg-ticket-stub',
            horizontal &&
              'md:col-start-1 md:row-start-1 md:rounded-none md:rounded-l-ticket print:col-start-1 print:row-start-1 print:rounded-none print:rounded-l-ticket',
          )}
        >
          <div className={cn('h-full p-5', stubClassName)}>{stub}</div>
        </div>
      </div>
    );
  },
);
