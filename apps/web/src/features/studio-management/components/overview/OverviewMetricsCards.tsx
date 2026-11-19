import { CalendarDays, PanelsTopLeft, Ticket, UsersRound } from 'lucide-react';

export interface OverviewMetricsCardsProps {
  upcomingSessions: number | null;
  totalUpcomingBookedSeats: number | null;
  availableSeats: number | null;
  openWorkshops: number | null;
}

export function OverviewMetricsCards({
  upcomingSessions,
  totalUpcomingBookedSeats,
  availableSeats,
  openWorkshops,
}: OverviewMetricsCardsProps) {
  const metricCards = [
    {
      label: 'Buổi sắp tới',
      value: upcomingSessions,
      note: 'Buổi đã lên lịch',
      icon: CalendarDays,
    },
    {
      label: 'Chỗ đã đặt',
      value: totalUpcomingBookedSeats,
      note: 'Khách đã giữ / thanh toán',
      icon: UsersRound,
    },
    {
      label: 'Chỗ còn trống',
      value: availableSeats,
      note: 'Sẵn sàng đón khách mới',
      icon: Ticket,
    },
    {
      label: 'Workshop đang mở',
      value: openWorkshops,
      note: 'Đang mở nhận khách',
      icon: PanelsTopLeft,
    },
  ];

  return (
    <section
      aria-label="Số liệu studio"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {metricCards.map((item) => (
        <div
          key={item.label}
          className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40"
        >
          <div className="flex items-center justify-between text-studio-muted">
            <span className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
              {item.label}
            </span>
            <item.icon
              size={16}
              aria-hidden="true"
              className="shrink-0 text-studio-primary"
            />
          </div>
          <div className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
            {item.value === null ? (
              <span role="status" aria-label="Đang tải">
                <span
                  aria-hidden="true"
                  className="block h-7 w-12 rounded-studio-control bg-studio-subtle motion-safe:animate-pulse"
                />
              </span>
            ) : (
              item.value
            )}
          </div>
          <p className="mt-1 text-xs text-studio-muted truncate">{item.note}</p>
        </div>
      ))}
    </section>
  );
}
