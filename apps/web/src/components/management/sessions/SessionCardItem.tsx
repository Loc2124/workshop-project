import { Clock3, Pencil, UsersRound } from 'lucide-react';
import { formatPrice, formatSessionDate } from '@/lib/format';
import { StudioBadge, StudioButton, StudioCard } from '../StudioPrimitives';
import type { StudioSession } from '@/types/management';

export function getRelativeDateTag(
  startsAtStr: string,
  endsAtStr: string,
  status: string,
) {
  if (status === 'cancelled') return null;
  const now = new Date();
  const ends = new Date(endsAtStr);
  if (ends.getTime() < now.getTime()) {
    return { label: 'Đã qua', tone: 'neutral' as const };
  }
  const vnNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
  );
  const vnStarts = new Date(
    new Date(startsAtStr).toLocaleString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }),
  );
  const isSameDay =
    vnNow.getFullYear() === vnStarts.getFullYear() &&
    vnNow.getMonth() === vnStarts.getMonth() &&
    vnNow.getDate() === vnStarts.getDate();
  if (isSameDay) {
    return { label: 'Hôm nay', tone: 'success' as const };
  }
  const tomorrow = new Date(vnNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    tomorrow.getFullYear() === vnStarts.getFullYear() &&
    tomorrow.getMonth() === vnStarts.getMonth() &&
    tomorrow.getDate() === vnStarts.getDate();
  if (isTomorrow) {
    return { label: 'Ngày mai', tone: 'warning' as const };
  }
  return null;
}

export interface SessionCardItemProps {
  session: StudioSession;
  isCanceling: boolean;
  onEdit: (session: StudioSession) => void;
  onRequestCancel: (session: StudioSession) => void;
}

export function SessionCardItem({
  session,
  isCanceling,
  onEdit,
  onRequestCancel,
}: SessionCardItemProps) {
  const starts = formatSessionDate(session.startsAt, { parts: true });
  const ends = formatSessionDate(session.endsAt, { parts: true });
  const booked = session.seatsHeld + session.seatsSold;
  const remaining = Math.max(0, session.capacity - booked);
  const progress =
    session.capacity > 0 ? Math.min(100, (booked / session.capacity) * 100) : 0;
  const isCancelled = session.status === 'cancelled';
  const isPast = Date.parse(session.endsAt) < Date.now();
  const isFull = !isCancelled && remaining === 0;

  const relativeTag = getRelativeDateTag(
    session.startsAt,
    session.endsAt,
    session.status,
  );

  const statusTone = isCancelled
    ? 'danger'
    : isPast
      ? 'neutral'
      : isFull
        ? 'warning'
        : 'success';

  const statusLabel = isCancelled
    ? 'Đã hủy'
    : isPast
      ? 'Đã diễn ra'
      : isFull
        ? 'Đã kín chỗ'
        : 'Đã lên lịch';

  return (
    <li className="min-w-0">
      <StudioCard
        className={`flex h-full flex-col justify-between p-4 transition duration-200 hover:shadow-studio-card-hover sm:p-5 ${
          isCancelled ? 'opacity-60 bg-studio-subtle/50' : ''
        }`}
      >
        <div className="flex gap-4 sm:gap-5">
          {/* Ô ngày tháng nổi bật */}
          <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center self-start rounded-studio-control bg-studio-selected px-2 py-3 text-center text-studio-primary">
            <span className="font-heading text-2xl font-bold leading-none">
              {starts.day}
            </span>
            <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide">
              Tháng {starts.month}
            </span>
          </div>

          {/* Nội dung buổi học */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StudioBadge tone={statusTone}>{statusLabel}</StudioBadge>
              {relativeTag && (
                <StudioBadge tone={relativeTag.tone}>
                  {relativeTag.label}
                </StudioBadge>
              )}
            </div>

            <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-studio-ink break-words">
              {session.workshopTitle}
            </h3>

            <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-studio-muted">
              <Clock3 aria-hidden="true" className="size-4 shrink-0" />
              <span>
                {starts.time} – {ends.time}
                {starts.date !== ends.date ? ` · ${ends.date}` : ''}
              </span>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="font-semibold text-studio-ink">
                {formatPrice(session.price)}đ
              </span>
              {!isCancelled && (
                <span className="inline-flex items-center gap-1.5 text-studio-muted font-medium">
                  <UsersRound aria-hidden="true" className="size-4" />
                  Còn {remaining}/{session.capacity} chỗ
                </span>
              )}
            </div>

            {/* Thanh tỷ lệ lấp đầy */}
            {!isCancelled && (
              <div className="mt-3">
                <div
                  aria-label={`Đã đặt ${booked} trên ${session.capacity} chỗ`}
                  aria-valuemax={session.capacity}
                  aria-valuemin={0}
                  aria-valuenow={Math.min(booked, session.capacity)}
                  className="h-2 overflow-hidden rounded-full bg-studio-subtle"
                  role="progressbar"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-studio motion-reduce:transition-none ${
                      isFull ? 'bg-amber-500' : 'bg-studio-primary'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thao tác Sửa / Hủy */}
        {session.status === 'scheduled' && !isPast && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-studio-border pt-3">
            <StudioButton
              disabled={isCanceling}
              onClick={() => onEdit(session)}
              type="button"
              variant="secondary"
              className="text-xs min-h-9"
            >
              <Pencil aria-hidden="true" className="size-3.5 mr-1" />
              Sửa lịch
            </StudioButton>
            <StudioButton
              disabled={isCanceling}
              onClick={() => onRequestCancel(session)}
              type="button"
              variant="ghost"
              className="text-xs min-h-9 text-studio-danger hover:bg-studio-danger/10"
            >
              Hủy buổi
            </StudioButton>
          </div>
        )}
      </StudioCard>
    </li>
  );
}
