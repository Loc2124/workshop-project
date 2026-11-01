import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { buttonVariants } from '../ui/button';
import type { TicketData } from './types';

export function TicketLink({
  workshop,
  session,
  href,
  className,
  children,
}: Pick<TicketData, 'workshop' | 'session'> & {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={href ?? `/workshop/${workshop.id}`}
      aria-label={`Xem workshop ${workshop.title}`}
      className={cn(
        'ticket-link group block h-full w-full min-w-0 rounded-ticket text-ticket-ink no-underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ticket-accent motion-safe:transition-transform motion-safe:hover:-translate-y-0.5',
        session.seatsLeft < 1 &&
          'ticket-sold-out [&_.ticket-photo]:opacity-50 [&_.ticket-stub]:bg-ticket-stub/60 [&_.ticket-stub_img]:opacity-50',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function TicketHeading({
  workshop,
  studio,
  artisan,
  variant = 'card',
  showStudio = true,
}: Pick<TicketData, 'workshop' | 'studio' | 'artisan'> & {
  variant?: 'card' | 'row' | 'booking';
  showStudio?: boolean;
}) {
  return (
    <header className="min-w-0">
      <h3
        title={workshop.title}
        className={cn(
          'ticket-title break-words font-heading font-bold leading-[1.2] tracking-tight',
          variant === 'row'
            ? 'line-clamp-2 text-xl lg:text-[22px]'
            : 'text-2xl',
          variant === 'card' && 'min-h-[2.4em] line-clamp-2',
        )}
      >
        {workshop.title}
      </h3>
      {showStudio && (
        <div
          className={cn(
            'mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-relaxed',
            variant === 'row' && 'ticket-row-meta mt-1',
          )}
        >
          <p
            className={cn(
              'ticket-studio',
              variant === 'card' && 'min-h-[3em] line-clamp-2',
            )}
          >
            {studio.name} · {studio.provinceName}
          </p>
          {variant === 'row' && artisan && <p>{artisan.name}</p>}
        </div>
      )}
    </header>
  );
}

export function TicketAction({
  label = 'Xem chi tiết',
  light = false,
}: {
  label?: string;
  light?: boolean;
}) {
  return (
    <span
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'ticket-action min-h-9 w-fit justify-between gap-2 border-primary bg-transparent px-3 text-[13px] font-semibold text-primary hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white group-focus-visible:bg-primary group-focus-visible:text-white',
        light &&
          'border border-primary bg-transparent text-primary hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white group-focus-visible:bg-primary group-focus-visible:text-white',
      )}
    >
      {label}
      <ArrowUpRight size={18} aria-hidden="true" />
    </span>
  );
}
