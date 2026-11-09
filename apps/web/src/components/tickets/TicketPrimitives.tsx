import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/api-client';
import { useAuth } from '../../hooks/useAuth';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notificationState, setNotificationState] = useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');
  const detailHref = href ?? `/workshop/${workshop.id}`;
  return (
    <Link
      to={detailHref}
      onClick={(event) => {
        if (
          session.actionLabel === 'Nhận thông báo khi có lịch' &&
          ((event.target as HTMLElement).closest('[data-ticket-action]') ||
            event.detail === 0)
        ) {
          event.preventDefault();
          if (
            notificationState === 'pending' ||
            notificationState === 'success'
          )
            return;
          if (user?.role !== 'customer') {
            navigate(`/dang-nhap?redirect=${encodeURIComponent(detailHref)}`);
            return;
          }
          setNotificationState('pending');
          void apiFetch(`/workshops/${workshop.id}/schedule-subscription`, {
            method: 'POST',
          })
            .then(() => {
              setNotificationState('success');
              toast.success('Đã đăng ký nhận thông báo khi có lịch mới.');
            })
            .catch(() => {
              setNotificationState('error');
              toast.error('Chưa lưu được đăng ký. Vui lòng thử lại.');
            });
        }
      }}
      aria-label={
        session.actionLabel === 'Nhận thông báo khi có lịch'
          ? `Nhận thông báo khi có lịch cho workshop ${workshop.title}`
          : `Xem workshop ${workshop.title}`
      }
      className={cn(
        'ticket-link group block h-full w-full min-w-0 rounded-ticket text-ticket-ink no-underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ticket-accent motion-safe:transition-transform motion-safe:hover:-translate-y-0.5',
        session.statusLabel === 'Hết chỗ' &&
          'ticket-sold-out [&_.ticket-photo]:opacity-50 [&_.ticket-stub]:bg-ticket-stub/60 [&_.ticket-stub_img]:opacity-50',
        className,
      )}
    >
      {children}
      {notificationState === 'success' && (
        <span
          role="status"
          className="block p-3 text-sm font-semibold text-primary"
        >
          Đã đăng ký nhận thông báo
        </span>
      )}
      {notificationState === 'error' && (
        <span role="alert" className="block p-3 text-sm text-brick">
          Chưa lưu được đăng ký. Vui lòng thử lại.
        </span>
      )}
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
      data-ticket-action
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        `ticket-action min-h-9 w-fit justify-between gap-2 border-primary bg-transparent px-3 text-[13px] font-semibold text-primary hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white group-focus-visible:bg-primary group-focus-visible:text-white ${label === 'Nhận thông báo khi có lịch' ? 'max-[480px]:w-full max-[480px]:justify-center' : ''}`,
        light &&
          'border border-primary bg-transparent text-primary hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white group-focus-visible:bg-primary group-focus-visible:text-white',
      )}
    >
      {label}
      <ArrowUpRight size={18} aria-hidden="true" />
    </span>
  );
}
