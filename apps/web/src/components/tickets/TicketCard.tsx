import { formatCategoryLabel, formatSessionDate, formatSlot } from '../../lib/format';
import { cn } from '../../lib/utils';
import { SeatsBadge } from '../catalog/SeatsBadge';
import { TicketPrice, TicketRating } from './TicketContent';
import { TicketStub } from './TicketStub';
import { TicketAction, TicketLink } from './TicketPrimitives';
import type { TicketVariantProps } from './types';

export function TicketCard(props: TicketVariantProps & { variant?: 'default' | 'featured' }) {
  const featured = props.variant === 'featured';
  if (props.loading) return <div role="status" aria-label="Đang tải vé workshop" className={cn('h-64 animate-pulse rounded-ticket border border-stone-200 bg-stone-50-skeleton', props.className)} />;
  const { workshop, studio, session, artisan, className } = props;
  const date = session.startAt ? formatSessionDate(session.startAt, { parts: true }) : undefined;
  return (
    <TicketLink {...props} className={cn('horizontal-ticket', featured && 'horizontal-ticket-featured', className)}>
      <article className={cn('flex h-full min-w-0 overflow-hidden rounded-ticket border border-stone-200 bg-stone-50', featured && 'min-h-72')}>
        <TicketStub imageUrl={workshop.imageUrl} alt={`${workshop.title} tại ${studio.name}`} categoryId={workshop.categoryId} featured={featured}>
            <span className={cn('font-heading text-4xl font-bold leading-none', featured && 'sm:text-7xl')}>{date?.day ?? '—'}</span>
            <span className="mt-2 text-[13px] font-bold">{date ? `THG ${date.month}` : 'Chưa có lịch'}</span>
            <span className="mt-2 text-sm font-bold">{date?.time}</span>
        </TicketStub>
        <div className="@container flex min-w-0 flex-1 flex-col p-3 lg:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-stone-700">
            <span>{formatCategoryLabel(workshop.categoryId)}</span>
            {featured && <span className="rounded bg-primary px-2 py-1 text-white">Gợi ý cho bạn</span>}
          </div>
          <h3 className={cn('mt-2 line-clamp-2 font-heading text-lg font-bold leading-tight', featured && 'sm:text-3xl')} title={workshop.title}>{workshop.title}</h3>
          <p className="mt-2 text-[13px] font-semibold tabular-nums text-stone-700">
            {session.startAt ? formatSlot(session.startAt).split(' · ')[0] : 'Chưa có lịch'} · {session.durationMinutes} phút
          </p>
          <div className="mb-3 mt-2 flex min-w-0 flex-col items-start gap-1.5 text-[13px] text-stone-700">
            <span className="line-clamp-2" title={`${studio.name} · ${studio.provinceName}`}>{studio.name} · {studio.provinceName}</span>
            {artisan && <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
              {artisan.avatarUrl && <img src={artisan.avatarUrl} alt="" loading="lazy" className="size-5 shrink-0 rounded-full object-cover" />}
              <span className="min-w-0 truncate">{artisan.name}</span>
            </span>}
          </div>
          {featured && (workshop.reason || workshop.description) && (
            <p className="mb-4 max-w-[60ch] line-clamp-2 text-sm text-stone-700">{workshop.reason || workshop.description}</p>
          )}
          <footer className={cn('mt-auto flex flex-wrap items-center justify-between gap-3 @min-[22rem]:flex-nowrap border-t border-dashed border-stone-400 pt-3 text-[13px] text-stone-700', featured && 'sm:justify-start sm:gap-x-8')}>
            <div className="flex flex-col items-start gap-y-1">
              <TicketPrice price={workshop.price} compact className="text-lg tabular-nums [&>span]:hidden" />
              <TicketRating workshop={workshop} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <SeatsBadge availableSeats={session.seatsLeft} />
              <TicketAction />
            </div>
          </footer>
        </div>
      </article>
    </TicketLink>
  );
}
