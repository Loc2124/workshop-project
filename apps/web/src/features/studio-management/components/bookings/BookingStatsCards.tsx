import { ClipboardList, Coins, CheckCircle2, UsersRound } from 'lucide-react';
import { formatPrice } from '@/lib/format';

export interface BookingStats {
  totalCount: number;
  needsCollectionCount: number;
  needsCollectionAmount: number;
  paidCount: number;
  totalGuests: number;
  workshops: string[];
}

export function BookingStatsCards({ stats }: { stats: BookingStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-studio-muted">
            Tổng đặt chỗ
          </span>
          <div className="flex size-8 items-center justify-center rounded-full bg-studio-subtle text-studio-muted">
            <ClipboardList className="size-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-studio-ink">
          {stats.totalCount}
        </p>
        <p className="mt-1 text-xs text-studio-muted">Đơn đặt qua hệ thống</p>
      </div>

      <div className="rounded-studio-card border border-amber-200/80 bg-amber-50/50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-amber-900">
            Cần thu tại studio
          </span>
          <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Coins className="size-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900">
          {stats.needsCollectionCount}{' '}
          <span className="text-sm font-normal text-amber-700">đơn</span>
        </p>
        <p className="mt-1 text-xs font-semibold text-amber-800">
          Còn phải thu {formatPrice(stats.needsCollectionAmount)} đ
        </p>
      </div>

      <div className="rounded-studio-card border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-emerald-900">
            Đã thanh toán đủ
          </span>
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900">
          {stats.paidCount}{' '}
          <span className="text-sm font-normal text-emerald-700">đơn</span>
        </p>
        <p className="mt-1 text-xs text-emerald-700">Hoàn tất 100% tiền</p>
      </div>

      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-studio-muted">
            Khách tham gia
          </span>
          <div className="flex size-8 items-center justify-center rounded-full bg-studio-subtle text-studio-muted">
            <UsersRound className="size-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-studio-ink">
          {stats.totalGuests}{' '}
          <span className="text-sm font-normal text-studio-muted">người</span>
        </p>
        <p className="mt-1 text-xs text-studio-muted">Tổng số lượng vé đặt</p>
      </div>
    </div>
  );
}
