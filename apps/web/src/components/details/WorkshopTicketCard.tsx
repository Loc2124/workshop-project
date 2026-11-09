import { Link } from 'react-router-dom';
import type { Workshop } from '../../types/workshop';
import { formatPrice, formatSessionDate } from '../../lib/format';
import { upcomingSessions } from '../../lib/workshopDetails';

export function WorkshopTicketCard({
  workshop,
  horizontal = false,
}: {
  workshop: Workshop;
  horizontal?: boolean;
}) {
  const sessions = upcomingSessions(workshop.sessions);
  const session =
    sessions.find((item) => item.availableSeats > 0) ?? sessions[0];
  const date = session
    ? formatSessionDate(session.startsAt, { parts: true })
    : undefined;
  return (
    <article
      className={`flex h-full min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-ticket ${horizontal ? 'flex-col sm:flex-row' : 'flex-col'}`}
    >
      <div
        className={`flex shrink-0 items-center justify-between gap-3 p-5 text-ink ${horizontal ? 'bg-beige' : 'bg-ticket'} ${horizontal ? 'sm:w-44 sm:flex-col sm:justify-center sm:text-center' : ''}`}
      >
        {date && session ? (
          <>
            <time dateTime={session.startsAt} className="font-semibold">
              <span className="block text-sm">{date.weekday}</span>
              <span className="font-heading text-3xl">{date.date}</span>
            </time>
            <span className="text-lg font-bold tabular-nums">{date.time}</span>
          </>
        ) : (
          <p className="font-semibold">Chưa có lịch mới</p>
        )}
      </div>
      <div
        className={`flex min-w-0 flex-1 flex-col gap-5 p-5 ${horizontal ? 'md:flex-row' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl font-semibold">
            {workshop.title}
          </h3>
          <p className="mt-2 text-sm text-stone-700">
            Thời lượng: {workshop.durationMinutes} phút
          </p>
          {(workshop.description || workshop.takeaway) && (
            <p className="mt-3 min-h-12 text-sm leading-relaxed text-stone-700">
              {workshop.description || workshop.takeaway}
            </p>
          )}
          {session && (
            <span className="mt-4 inline-block w-fit cursor-default rounded-md bg-[#E8E4D8] px-3 py-1 text-sm font-semibold text-[#4A453C]">
              {session.availableSeats > 0
                ? `Còn ${session.availableSeats} chỗ`
                : 'Đã hết chỗ'}
            </span>
          )}
        </div>
        <div
          className={`mt-auto flex flex-col gap-4 ${horizontal ? 'md:w-40 md:shrink-0 md:self-stretch md:justify-end' : ''}`}
        >
          <p className="text-lg font-bold tabular-nums text-ink">
            <span className="text-[13px] font-normal text-stone-700">Từ </span>
            {formatPrice(session?.price ?? workshop.basePrice)} đ
          </p>
          <Link
            to={`/workshop/${workshop.slug ?? workshop.id}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
    </article>
  );
}
