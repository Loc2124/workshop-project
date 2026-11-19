import { Calendar, UsersRound, CheckCircle2, CalendarDays } from 'lucide-react';

export interface SessionStats {
  upcoming: number;
  availableSeats: number;
  fullSessions: number;
  past: number;
  cancelled: number;
  total: number;
}

export function SessionStatsCards({ stats }: { stats: SessionStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Sắp diễn ra
          </span>
          <Calendar className="size-4 text-studio-primary" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
          {stats.upcoming}
        </p>
        <p className="mt-1 text-xs text-studio-muted">buổi đang mở</p>
      </div>

      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Chỗ còn trống
          </span>
          <UsersRound className="size-4 text-studio-accent" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
          {stats.availableSeats}
        </p>
        <p className="mt-1 text-xs text-studio-muted">ghế sẵn sàng đón khách</p>
      </div>

      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Đã kín chỗ
          </span>
          <CheckCircle2 className="size-4 text-studio-success" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-success">
          {stats.fullSessions}
        </p>
        <p className="mt-1 text-xs text-studio-muted">buổi đạt 100% sức chứa</p>
      </div>

      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Tổng số buổi
          </span>
          <CalendarDays className="size-4 text-studio-muted" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
          {stats.total}
        </p>
        <p className="mt-1 text-xs text-studio-muted">
          {stats.past} đã xong · {stats.cancelled} đã hủy
        </p>
      </div>
    </div>
  );
}
