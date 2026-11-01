import { ArtisanAvatar } from './ArtisanAvatar';
import { Star } from 'lucide-react';
import {
  formatCategoryLabel,
  formatPrice,
  formatSessionDate,
} from '../../lib/format';
import { cn } from '../../lib/utils';
import { SeatsBadge } from '../catalog/SeatsBadge';
import { MediaImage } from '../ui/MediaImage';
import { TicketAction } from './TicketPrimitives';
import { TicketInfoBox } from './TicketInfoBox';
import type { TicketData } from './types';

export function TicketPhoto({
  workshop,
  studio,
  className,
}: Pick<TicketData, 'workshop' | 'studio'> & { className?: string }) {
  const category = formatCategoryLabel(workshop.categoryId);
  return (
    <MediaImage
      src={workshop.imageUrl}
      alt={`${workshop.title} tại ${studio.name}`}
      placeholder={category}
      showPlaceholderText
      width={600}
      height={450}
      className={cn(
        'ticket-photo aspect-[4/3] shrink-0',
        className,
      )}
    />
  );
}

export function TicketInfo({
  session,
  partySize,
}: Pick<TicketData, 'session'> & { partySize?: number }) {
  const date = session.startAt
    ? formatSessionDate(session.startAt, { parts: true })
    : undefined;
  return (
    <dl
      className={cn(
        'ticket-info-grid grid grid-cols-2 gap-2',
        partySize !== undefined && 'md:grid-cols-4',
      )}
    >
      <TicketInfoBox
        label="Ngày"
        value={date?.date ?? '—'}
        detail={date?.weekday ?? 'Chưa có lịch'}
      />
      <TicketInfoBox label="Giờ" value={date?.time ?? '—'} />
      <TicketInfoBox
        label="Thời lượng"
        value={`${session.durationMinutes} phút`}
        className={cn(
          partySize === undefined &&
            'col-span-2 flex items-center justify-between gap-3 [&>dd]:mt-0',
        )}
      />
      {partySize !== undefined && (
        <TicketInfoBox label="Số người" value={partySize} />
      )}
    </dl>
  );
}

export function TicketArtisan({ artisan }: Pick<TicketData, 'artisan'>) {
  if (!artisan) return null;
  return (
    <p className="ticket-artisan flex min-h-7 min-w-0 items-center gap-2 text-sm">
      <ArtisanAvatar name={artisan.name} src={artisan.avatarUrl} />
      <span className="truncate">
        Nghệ nhân {artisan.name.replace(/^Nghệ nhân\s+/i, '')}
      </span>
    </p>
  );
}

export function TicketRating({ workshop }: Pick<TicketData, 'workshop'>) {
  return (
    <span className="ticket-rating inline-flex items-center gap-1 text-sm font-bold text-stone-800">
      {workshop.rating !== undefined ? (
        <span
          className="inline-flex items-center gap-1"
          aria-label={`Đánh giá ${workshop.rating.toFixed(1)} trên 5, ${workshop.ratingCount ?? 0} đánh giá`}
        >
          <Star
            size={15}
            fill="currentColor"
            className="shrink-0 text-rating"
            aria-hidden="true"
          />
          {workshop.rating.toFixed(1)} ({workshop.ratingCount ?? 0})
        </span>
      ) : (
        'Chưa có đánh giá'
      )}
    </span>
  );
}

export function TicketPrice({
  price,
  compact = false,
  className,
}: {
  price: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'ticket-price whitespace-nowrap text-[22px] font-bold',
        compact && 'text-xl',
        className,
      )}
    >
      {formatPrice(price)} đ{' '}
      <span className="text-[13px] font-normal text-stone-600">/ người</span>
    </p>
  );
}

export function TicketFooter({
  workshop,
  session,
  layout = 'stacked',
}: Pick<TicketData, 'workshop' | 'session'> & {
  layout?: 'inline' | 'stacked';
}) {
  if (layout === 'inline')
    return (
      <div className="ticket-row-bottom flex flex-wrap items-center justify-between gap-x-4 gap-y-3 md:flex-nowrap">
        <div className="ticket-row-price-meta flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-sm md:w-auto">
          <TicketPrice price={workshop.price} compact />
          <TicketRating workshop={workshop} />
          <SeatsBadge availableSeats={session.seatsLeft} />
        </div>
        <div className="w-full shrink-0 md:w-auto [&>span]:w-full">
          <TicketAction />
        </div>
      </div>
    );
  return (
    <div className="ticket-footer-content flex flex-col gap-3">
      <TicketPrice price={workshop.price} />
      <div className="ticket-footer-meta flex flex-wrap items-center justify-between gap-2 text-sm">
        <TicketRating workshop={workshop} />
        <SeatsBadge availableSeats={session.seatsLeft} />
      </div>
      <TicketAction />
    </div>
  );
}
