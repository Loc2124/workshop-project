import { formatPrice } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';

interface ScheduleStickyBarProps {
  total?: number;
  depositAmount: number;
  balanceAmount: number;
  confirmed: boolean;
  hasSelected: boolean;
  onScrollToSchedule: () => void;
}

export function ScheduleStickyBar({
  total,
  depositAmount,
  balanceAmount,
  confirmed,
  hasSelected,
  onScrollToSchedule,
}: ScheduleStickyBarProps) {
  const primaryButtonClass =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border disabled:border-[#DDD6C4] disabled:bg-[#E6E1D3] disabled:text-[#8A8375] disabled:opacity-100';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
      {total !== undefined && (
        <span className="flex min-w-0 flex-col">
          <span className="text-lg font-bold tabular-nums">
            {formatPrice(total)} đ
          </span>
          <span className="text-xs text-stone-600">
            {depositAmount > 0
              ? `Cọc ${formatPrice(depositAmount)} đ · còn ${formatPrice(balanceAmount)} đ tại studio`
              : 'Thanh toán tại studio'}
          </span>
        </span>
      )}
      <a
        href="#lich-trai-nghiem"
        onClick={onScrollToSchedule}
        className={cn(primaryButtonClass, 'flex-1')}
      >
        {confirmed ? 'Xem đặt chỗ' : hasSelected ? 'Chọn lịch' : 'Xem lịch'}
      </a>
    </div>
  );
}
