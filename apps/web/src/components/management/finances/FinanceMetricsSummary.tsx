import { CircleCheck, Clock, CalendarClock, WalletCards } from 'lucide-react';
import { formatPrice } from '@/lib/core/format';

type SummaryData = {
  totalPaidOut: number;
  pendingPayout: number;
  estimatedUpcoming: number;
  directCollected: number;
};

export function FinanceMetricsSummary({ summary }: { summary: SummaryData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Sàn đã chuyển
          </span>
          <CircleCheck className="size-4 text-studio-success" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
          {formatPrice(summary.totalPaidOut)} đ
        </p>
        <p className="mt-1 text-xs text-studio-muted">Đã chuyển về tài khoản</p>
      </div>

      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Chuẩn bị chi trả
          </span>
          <Clock className="size-4 text-amber-600" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-amber-700">
          {formatPrice(summary.pendingPayout)} đ
        </p>
        <p className="mt-1 text-xs text-studio-muted">
          Buổi xong, đang đối soát
        </p>
      </div>

      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Cọc đơn sắp tới
          </span>
          <CalendarClock className="size-4 text-studio-primary" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
          {formatPrice(summary.estimatedUpcoming)} đ
        </p>
        <p className="mt-1 text-xs text-studio-muted">
          Khách cọc, chưa diễn ra
        </p>
      </div>

      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
        <div className="flex items-center justify-between text-studio-muted">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Thu tại studio
          </span>
          <WalletCards className="size-4 text-studio-accent" />
        </div>
        <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
          {formatPrice(summary.directCollected)} đ
        </p>
        <p className="mt-1 text-xs text-studio-muted">
          Phần còn lại thu trực tiếp
        </p>
      </div>
    </div>
  );
}
