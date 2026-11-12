import { ArrowRight, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../../lib/format';
import { studioPage } from '../../../lib/studio-dashboard';
import { StudioBadge, StudioCard } from '../StudioPrimitives';

export type StudioFinancesData = {
  summary: {
    pendingPayout: number;
    totalPaidOut: number;
    directCollected: number;
    settledDeposit: number;
  };
  currentAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    last4: string;
    status: 'pending' | 'verified' | 'rejected';
  } | null;
};

export interface OverviewFinancesCardProps {
  studioId: string;
  financesData: StudioFinancesData | undefined;
  isLoading: boolean;
}

export function OverviewFinancesCard({
  studioId,
  financesData,
  isLoading,
}: OverviewFinancesCardProps) {
  return (
    <StudioCard
      aria-labelledby="studio-finance-card-title"
      className="p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-2 border-b border-studio-border pb-3">
        <div className="flex items-center gap-2">
          <WalletCards
            size={17}
            aria-hidden="true"
            className="shrink-0 text-studio-primary"
          />
          <h2
            id="studio-finance-card-title"
            className="font-heading text-base font-semibold text-studio-ink"
          >
            Doanh thu & Quyết toán
          </h2>
        </div>
        <StudioBadge tone="neutral" className="text-xs py-0.5">
          Tự động
        </StudioBadge>
      </div>

      <div className="mt-3.5 space-y-2.5">
        <div className="rounded-studio-control bg-studio-subtle/70 p-3">
          <p className="text-xs font-medium text-studio-muted">
            Tiền cọc Open Slot chuẩn bị chi trả
          </p>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-studio-primary">
            {isLoading
              ? '…'
              : `${formatPrice(financesData?.summary.pendingPayout ?? 0)} đ`}
          </p>
        </div>

        <div className="rounded-studio-control border border-studio-border bg-studio-surface p-3">
          <p className="text-xs font-medium text-studio-muted">
            Tổng tiền đã nhận về tài khoản
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-studio-ink">
            {isLoading
              ? '…'
              : `${formatPrice(financesData?.summary.totalPaidOut ?? 0)} đ`}
          </p>
        </div>

        {financesData?.currentAccount ? (
          <div className="flex items-center justify-between gap-2 pt-1 text-xs text-studio-muted">
            <span className="truncate">
              {financesData.currentAccount.bankName} (••••{' '}
              {financesData.currentAccount.last4})
            </span>
            <StudioBadge
              tone={
                financesData.currentAccount.status === 'verified'
                  ? 'success'
                  : 'warning'
              }
              className="px-2 py-0 text-[11px]"
            >
              {financesData.currentAccount.status === 'verified'
                ? 'Đã xác minh'
                : 'Chờ duyệt'}
            </StudioBadge>
          </div>
        ) : (
          <p className="pt-1 text-xs text-amber-700">
            Chưa cài đặt tài khoản ngân hàng nhận tiền.
          </p>
        )}
      </div>

      <Link
        to={studioPage(studioId, 'finances')}
        className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-studio-primary hover:underline"
      >
        Chi tiết dòng tiền & đối soát
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </StudioCard>
  );
}
