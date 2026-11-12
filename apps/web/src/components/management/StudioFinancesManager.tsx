import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-client';
import { RefreshCw } from 'lucide-react';
import { StudioButton, StudioCard, StudioSkeleton } from './StudioPrimitives';
import { FinancialAccountForm } from './FinancialAccountForm';
import { FinanceMetricsSummary } from './finances/FinanceMetricsSummary';
import {
  FinanceAccountBanner,
  type CurrentAccount,
} from './finances/FinanceAccountBanner';
import { SettlementsTable, type Settlement } from './finances/SettlementsTable';
import {
  UpcomingBookingsTable,
  type UpcomingBooking,
} from './finances/UpcomingBookingsTable';
import type { MemberStudio } from '@/types';

type StudioFinancesData = {
  summary: {
    totalPaidOut: number;
    pendingPayout: number;
    estimatedUpcoming: number;
    directCollected: number;
  };
  currentAccount: CurrentAccount;
  settlements: Settlement[];
  upcomingBookings: UpcomingBooking[];
};

export function StudioFinancesManager({ studio }: { studio: MemberStudio }) {
  const [tab, setTab] = useState<'settlements' | 'upcoming' | 'account'>(
    'settlements',
  );

  const query = useQuery<StudioFinancesData>({
    queryKey: ['studio-finances', studio.id],
    queryFn: () => apiFetch(`/studios/${studio.id}/finances`),
    refetchInterval: 30_000,
  });

  if (query.isPending) {
    return (
      <div
        className="space-y-studio-card"
        aria-label="Đang tải dữ liệu tài chính"
      >
        <StudioSkeleton
          label="Đang tải số liệu doanh thu và quyết toán…"
          className="h-32"
        />
        <StudioSkeleton
          label="Đang tải danh sách quyết toán…"
          className="h-64"
        />
      </div>
    );
  }

  if (query.isError) {
    return (
      <StudioCard className="space-y-4" role="alert">
        <p className="text-studio-danger font-medium">
          Không thể tải thông tin tài chính: {query.error.message}
        </p>
        <StudioButton onClick={() => void query.refetch()} variant="secondary">
          Thử tải lại
        </StudioButton>
      </StudioCard>
    );
  }

  const data = query.data;

  return (
    <div className="space-y-5">
      {/* 4 Thẻ chỉ số tổng quan tài chính */}
      <FinanceMetricsSummary summary={data.summary} />

      {/* Thông tin tài khoản nhận tiền tóm tắt & Hướng dẫn cơ chế */}
      <FinanceAccountBanner
        currentAccount={data.currentAccount}
        onSelectAccountTab={() => setTab('account')}
      />

      {/* Thanh tab chuyển đổi */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-border pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('settlements')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 min-h-11 sm:min-h-9 ${
              tab === 'settlements'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'text-studio-muted hover:text-studio-ink hover:bg-studio-subtle'
            }`}
          >
            <span>Đợt chi trả</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                tab === 'settlements'
                  ? 'bg-white/20 text-white'
                  : 'bg-studio-subtle text-studio-muted'
              }`}
            >
              {data.settlements.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('upcoming')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 min-h-11 sm:min-h-9 ${
              tab === 'upcoming'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'text-studio-muted hover:text-studio-ink hover:bg-studio-subtle'
            }`}
          >
            <span>Đơn đã cọc sắp tới</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${
                tab === 'upcoming'
                  ? 'bg-white/20 text-white'
                  : 'bg-studio-subtle text-studio-muted'
              }`}
            >
              {data.upcomingBookings.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('account')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors min-h-11 sm:min-h-9 ${
              tab === 'account'
                ? 'bg-studio-primary text-white shadow-xs'
                : 'text-studio-muted hover:text-studio-ink hover:bg-studio-subtle'
            }`}
          >
            Cài đặt tài khoản ngân hàng
          </button>
        </div>
        <StudioButton
          variant="ghost"
          onClick={() => void query.refetch()}
          type="button"
          size="sm"
          className="text-xs min-h-11 sm:min-h-9"
        >
          <RefreshCw
            className={`size-3.5 mr-1 ${query.isFetching ? 'animate-spin' : ''}`}
          />
          Cập nhật
        </StudioButton>
      </div>

      {/* Tab 1: Đợt chi trả từ sàn */}
      {tab === 'settlements' && (
        <SettlementsTable settlements={data.settlements} />
      )}

      {/* Tab 2: Đơn đã cọc sắp tới */}
      {tab === 'upcoming' && (
        <UpcomingBookingsTable upcomingBookings={data.upcomingBookings} />
      )}

      {/* Tab 3: Cài đặt tài khoản */}
      {tab === 'account' && (
        <FinancialAccountForm
          endpoint={`/studios/${studio.id}/payout-account`}
          title="Tài khoản ngân hàng nhận tiền quyết toán"
          description="Open Slot sẽ chuyển khoản toàn bộ tiền cọc của khách sau buổi học vào tài khoản này. Vui lòng nhập chính xác số tài khoản và ngân hàng thụ hưởng."
        />
      )}
    </div>
  );
}
