import {
  CircleCheck,
  Clock,
  CalendarClock,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { formatPrice } from '@/lib/core/format';

type SummaryData = {
  totalEarned?: number;
  totalPaidOut: number;
  pendingPayout: number;
  estimatedUpcoming: number;
  directCollected: number;
};

export function FinanceMetricsSummary({ summary }: { summary: SummaryData }) {
  const platformEarned = summary.totalPaidOut + summary.pendingPayout;
  const totalEarned =
    summary.totalEarned ?? platformEarned + summary.directCollected;

  return (
    <div className="space-y-3">
      <div className="rounded-studio-card border border-studio-primary/25 bg-studio-selected/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-studio-primary">
            <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tổng doanh thu đã kiếm
            </span>
          </div>
          <span className="text-xs font-medium text-studio-muted">
            Các buổi học đã hoàn tất
          </span>
        </div>
        <p className="mt-2 font-heading text-2xl font-bold tabular-nums text-studio-ink sm:text-3xl">
          {formatPrice(totalEarned)} đ
        </p>
        <p className="mt-1.5 text-xs text-studio-muted sm:text-sm">
          Qua sàn (đã chuyển + chờ chi):{' '}
          <strong className="font-semibold tabular-nums text-studio-ink">
            {formatPrice(platformEarned)} đ
          </strong>{' '}
          · Thu tại studio:{' '}
          <strong className="font-semibold tabular-nums text-studio-ink">
            {formatPrice(summary.directCollected)} đ
          </strong>
        </p>
      </div>

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
          <p className="mt-1 text-xs text-studio-muted">
            Đã chuyển về tài khoản
          </p>
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
    </div>
  );
}
