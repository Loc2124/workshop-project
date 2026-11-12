import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Ticket,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice, formatSessionDate } from '../../../lib/format';
import { studioPage } from '../../../lib/studio-dashboard';
import type { StudioSession } from '../../../types/management';
import { StudioBadge, StudioButton, StudioCard } from '../StudioPrimitives';

export interface OverviewNextSessionCardProps {
  studioId: string;
  nextSession: StudioSession | null;
}

export function OverviewNextSessionCard({
  studioId,
  nextSession,
}: OverviewNextSessionCardProps) {
  if (!nextSession) {
    return (
      <StudioCard
        aria-labelledby="next-session-title"
        className="p-6 text-center"
      >
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-studio-subtle text-studio-muted">
          <CalendarDays size={20} aria-hidden="true" />
        </div>
        <h2
          id="next-session-title"
          className="mt-3 font-heading text-base font-semibold text-studio-ink"
        >
          Chưa có buổi học nào sắp tới
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-xs text-studio-muted">
          Các buổi trước đã kết thúc hoặc bạn chưa lên lịch mới.
        </p>
        <div className="mt-3.5">
          <StudioButton asChild size="sm" className="min-h-11">
            <Link to={studioPage(studioId, 'sessions')}>
              <CalendarPlus size={14} aria-hidden="true" />
              Lên lịch buổi ngay
            </Link>
          </StudioButton>
        </div>
      </StudioCard>
    );
  }

  const bookedSeats = nextSession.seatsSold + nextSession.seatsHeld;
  const remainingSeats = Math.max(0, nextSession.capacity - bookedSeats);
  const occupancyPercent =
    nextSession.capacity > 0
      ? Math.min(100, Math.round((bookedSeats / nextSession.capacity) * 100))
      : 0;

  return (
    <StudioCard aria-labelledby="next-session-title" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-studio-border pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-studio-primary-soft text-studio-primary">
            <CalendarClock size={14} aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
            Buổi học gần nhất
          </span>
        </div>
        <StudioBadge
          tone={
            remainingSeats === 0
              ? 'danger'
              : remainingSeats <= 3
                ? 'warning'
                : 'success'
          }
          className="text-xs"
        >
          {remainingSeats === 0
            ? 'Đã kín chỗ'
            : remainingSeats <= 3
              ? `Chỉ còn ${remainingSeats} chỗ`
              : 'Đang mở đặt chỗ'}
        </StudioBadge>
      </div>

      <div className="mt-3.5">
        <h2
          id="next-session-title"
          className="font-heading text-lg sm:text-xl font-bold text-studio-ink"
        >
          {nextSession.workshopTitle}
        </h2>
        <p className="mt-1 text-sm font-medium text-studio-muted">
          {formatSessionDate(nextSession.startsAt)}
        </p>
      </div>

      {/* Thanh lấp đầy chỗ ngồi */}
      <div className="mt-4 rounded-studio-control bg-studio-subtle/70 p-3.5">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-studio-muted">Tỷ lệ lấp đầy:</span>
          <span className="font-semibold tabular-nums text-studio-ink">
            {bookedSeats} / {nextSession.capacity} chỗ ({occupancyPercent}%)
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-studio-border">
          <div
            className={`h-full transition-all duration-300 ${
              occupancyPercent >= 100
                ? 'bg-studio-danger'
                : occupancyPercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-studio-primary'
            }`}
            style={{ width: `${occupancyPercent}%` }}
          />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-studio-muted">
          <span>
            Đã bán:{' '}
            <strong className="text-studio-ink font-semibold">
              {nextSession.seatsSold}
            </strong>
          </span>
          <span>
            Đang giữ:{' '}
            <strong className="text-studio-ink font-semibold">
              {nextSession.seatsHeld}
            </strong>
          </span>
          <span>
            Còn trống:{' '}
            <strong className="text-studio-ink font-semibold">
              {remainingSeats}
            </strong>
          </span>
          <span>
            Giá:{' '}
            <strong className="text-studio-ink font-semibold">
              {formatPrice(nextSession.price)} đ
            </strong>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-1">
        <StudioButton asChild size="sm" className="min-h-11">
          <Link to={studioPage(studioId, 'bookings')}>
            <Ticket size={14} aria-hidden="true" />
            Khách & Điểm danh
          </Link>
        </StudioButton>
        <StudioButton
          asChild
          variant="secondary"
          size="sm"
          className="min-h-11"
        >
          <Link to={studioPage(studioId, 'sessions')}>
            Chi tiết lịch
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </StudioButton>
      </div>
    </StudioCard>
  );
}
