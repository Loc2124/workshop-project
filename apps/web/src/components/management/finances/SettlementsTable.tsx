import { WalletCards } from 'lucide-react';
import { formatPrice } from '@/lib/core/format';
import { StudioBadge, StudioEmptyState } from '../StudioPrimitives';
import { dateLabel } from '@/pages/customer/CustomerBookingsPage';

export type Transfer = {
  id: string;
  amount: number;
  status: string;
  provider: string | null;
  reference: string | null;
  settledAt: string | null;
  bankName: string | null;
  accountLast4: string | null;
};

export type Settlement = {
  id: string;
  bookingId: string;
  orderCode: string;
  workshopTitle: string;
  sessionStartsAt: string;
  sessionEndsAt: string | null;
  amount: number;
  collectedDeposit: number;
  directAmount?: number;
  isDirectPaid?: boolean;
  refundsRecorded: number;
  feesRecorded: number;
  dueAt: string | null;
  status: string;
  transfers: Transfer[];
};

const settlementTone = (status: string) => {
  if (status === 'paid') return 'success' as const;
  if (['awaiting_approval', 'approved', 'processing'].includes(status))
    return 'warning' as const;
  if (['failed', 'manual_review'].includes(status)) return 'danger' as const;
  return 'neutral' as const;
};

const settlementLabel = (status: string) => {
  switch (status) {
    case 'paid':
      return 'Đã chuyển tiền';
    case 'awaiting_approval':
      return 'Chờ sàn duyệt chi';
    case 'approved':
    case 'processing':
      return 'Đang chuyển khoản';
    case 'manual_review':
      return 'Cần rà soát';
    case 'failed':
      return 'Chuyển thất bại';
    default:
      return status;
  }
};

export function SettlementsTable({
  settlements,
}: {
  settlements: Settlement[];
}) {
  if (!settlements.length) {
    return (
      <StudioEmptyState
        icon={WalletCards}
        title="Chưa có đợt quyết toán nào"
        description="Sau khi buổi học kết thúc, sàn sẽ tự động chốt doanh thu cọc và lên lịch chi trả về tài khoản của bạn tại đây."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead className="bg-studio-subtle text-xs font-semibold uppercase tracking-wide text-studio-muted">
            <tr>
              <th className="px-4 py-3">Mã đơn / Workshop</th>
              <th className="px-3 py-3">Thời gian buổi học</th>
              <th className="px-3 py-3">Tiền cọc sàn thu</th>
              <th className="px-3 py-3">Thu tại studio</th>
              <th className="px-3 py-3">Sàn chi trả</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Chi tiết chuyển tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-studio-border text-sm">
            {settlements.map((s) => {
              const lastTransfer = s.transfers[0];
              return (
                <tr
                  key={s.id}
                  className="hover:bg-studio-selected/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-studio-ink">
                      #{s.orderCode}
                    </p>
                    <p
                      className="mt-0.5 truncate text-xs text-studio-muted"
                      title={s.workshopTitle}
                    >
                      {s.workshopTitle}
                    </p>
                  </td>
                  <td className="px-3 py-4 text-xs text-studio-muted">
                    <time dateTime={s.sessionStartsAt}>
                      {dateLabel(s.sessionStartsAt)}
                    </time>
                  </td>
                  <td className="px-3 py-4">
                    <p className="font-medium tabular-nums text-studio-ink">
                      {formatPrice(s.collectedDeposit)} đ
                    </p>
                    {s.refundsRecorded > 0 && (
                      <p className="text-xs text-studio-danger">
                        -{formatPrice(s.refundsRecorded)} đ hoàn
                      </p>
                    )}
                    {s.feesRecorded > 0 && (
                      <p className="text-xs text-studio-muted">
                        -{formatPrice(s.feesRecorded)} đ phí
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <p
                      className={`font-semibold tabular-nums ${
                        s.isDirectPaid ? 'text-emerald-700' : 'text-studio-ink'
                      }`}
                    >
                      {formatPrice(s.directAmount ?? 0)} đ
                    </p>
                    <p
                      className={`text-xs ${
                        s.isDirectPaid
                          ? 'font-medium text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {s.isDirectPaid
                        ? 'Đã thu tại studio'
                        : 'Chưa ghi nhận thu'}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <p className="font-bold tabular-nums text-studio-primary text-base">
                      {formatPrice(s.amount)} đ
                    </p>
                    <p className="text-[11px] text-studio-muted">
                      Chờ sàn chuyển
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <StudioBadge tone={settlementTone(s.status)}>
                      {settlementLabel(s.status)}
                    </StudioBadge>
                    {s.dueAt && s.status !== 'paid' && (
                      <p className="mt-1 text-[11px] text-studio-muted">
                        Hạn: {new Date(s.dueAt).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {lastTransfer && lastTransfer.status === 'succeeded' ? (
                      <div className="text-xs space-y-0.5">
                        <p className="font-medium text-studio-success">
                          {lastTransfer.reference
                            ? `FT: ${lastTransfer.reference}`
                            : 'Đã chuyển'}
                        </p>
                        {lastTransfer.settledAt && (
                          <p className="text-[11px] text-studio-muted">
                            {new Date(
                              lastTransfer.settledAt,
                            ).toLocaleDateString('vi-VN')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-studio-muted">
                        Đang xử lý
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
