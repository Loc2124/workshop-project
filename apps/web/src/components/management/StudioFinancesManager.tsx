import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { formatPrice } from '../../lib/format';
import { formatBankDisplay } from '@workshop/shared';
import {
  WalletCards,
  CircleCheck,
  Clock,
  CreditCard,
  AlertCircle,
  Building2,
  CalendarClock,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  StudioBadge,
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioSkeleton,
} from './StudioPrimitives';
import { FinancialAccountForm } from './FinancialAccountForm';
import type { MemberStudio } from '../../types/management';
import { dateLabel } from '../../pages/CustomerBookingsPage';

type Transfer = {
  id: string;
  amount: number;
  status: string;
  provider: string | null;
  reference: string | null;
  settledAt: string | null;
  bankName: string | null;
  accountLast4: string | null;
};

type Settlement = {
  id: string;
  bookingId: string;
  orderCode: string;
  workshopTitle: string;
  sessionStartsAt: string;
  sessionEndsAt: string | null;
  amount: number;
  collectedDeposit: number;
  refundsRecorded: number;
  feesRecorded: number;
  dueAt: string | null;
  status: string;
  transfers: Transfer[];
};

type UpcomingBooking = {
  bookingId: string;
  orderCode: string;
  workshopTitle: string;
  sessionStartsAt: string;
  sessionEndsAt: string | null;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: string;
  isCompleted: boolean;
};

type StudioFinancesData = {
  summary: {
    totalPaidOut: number;
    pendingPayout: number;
    estimatedUpcoming: number;
    directCollected: number;
  };
  currentAccount: {
    id: string;
    bankName: string | null;
    bankBin: string | null;
    accountHolder: string;
    last4: string;
    status: 'pending' | 'verified' | 'rejected';
  } | null;
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
  const currentAcc = data.currentAccount;

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

  return (
    <div className="space-y-5">
      {/* 4 Thẻ chỉ số tổng quan tài chính */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-colors hover:border-studio-primary/40">
          <div className="flex items-center justify-between text-studio-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Sàn đã chuyển
            </span>
            <CircleCheck className="size-4 text-studio-success" />
          </div>
          <p className="mt-2 font-heading text-2xl sm:text-3xl font-bold tabular-nums text-studio-ink">
            {formatPrice(data.summary.totalPaidOut)} đ
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
            {formatPrice(data.summary.pendingPayout)} đ
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
            {formatPrice(data.summary.estimatedUpcoming)} đ
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
            {formatPrice(data.summary.directCollected)} đ
          </p>
          <p className="mt-1 text-xs text-studio-muted">
            Phần còn lại thu trực tiếp
          </p>
        </div>
      </div>

      {/* Thông tin tài khoản nhận tiền tóm tắt & Hướng dẫn cơ chế nhận tiền thu gọn */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-studio-subtle p-2.5 text-studio-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
                  Tài khoản nhận tiền quyết toán
                </p>
                {currentAcc ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-studio-ink text-sm">
                      {formatBankDisplay(
                        currentAcc.bankBin,
                        currentAcc.bankName,
                      )}{' '}
                      · ****{currentAcc.last4}
                    </span>
                    <span className="text-xs text-studio-muted">
                      ({currentAcc.accountHolder})
                    </span>
                    <StudioBadge
                      tone={
                        currentAcc.status === 'verified'
                          ? 'success'
                          : currentAcc.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                      className="text-xs py-0.2"
                    >
                      {currentAcc.status === 'verified'
                        ? 'Đã xác minh'
                        : currentAcc.status === 'rejected'
                          ? 'Cần nhập lại'
                          : 'Chờ đối chiếu'}
                    </StudioBadge>
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs font-medium text-amber-700 flex items-center gap-1">
                    <AlertCircle className="size-3.5" />
                    Chưa cài đặt tài khoản nhận tiền.
                  </p>
                )}
              </div>
            </div>
            <StudioButton
              variant="secondary"
              size="sm"
              onClick={() => setTab('account')}
              className="shrink-0"
            >
              <CreditCard className="size-3.5 mr-1" />
              {currentAcc ? 'Đổi tài khoản' : 'Thêm tài khoản'}
            </StudioButton>
          </div>
        </div>

        {/* Hộp giải thích cơ chế dạng tooltip / popover / toggle gọn */}
        <details className="group rounded-studio-card border border-studio-border bg-studio-surface p-4 text-xs transition-colors hover:border-studio-primary/40 open:bg-studio-selected/30">
          <summary className="flex cursor-pointer items-center justify-between gap-2 font-semibold text-studio-primary outline-none">
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5" />
              Cơ chế thanh toán sàn
            </span>
          </summary>
          <div className="mt-3 space-y-1.5 border-t border-studio-border pt-2 text-studio-muted leading-relaxed max-w-sm">
            <p>
              1. <strong>Cọc PayOS:</strong> Khách quét QR sàn giữ chỗ chắc
              chắn.
            </p>
            <p>
              2. <strong>Quyết toán tự động:</strong> Sàn đối soát &amp; chuyển
              khoản sau khi buổi học xong (1-3 ngày làm việc).
            </p>
            <p>
              3. <strong>Thu tại studio:</strong> Phần tiền còn lại khách trả
              trực tiếp cho studio tại buổi.
            </p>
          </div>
        </details>
      </div>

      {/* Thanh tab chuyển đổi */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-border pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('settlements')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
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
          className="text-xs"
        >
          <RefreshCw
            className={`size-3.5 mr-1 ${query.isFetching ? 'animate-spin' : ''}`}
          />
          Cập nhật
        </StudioButton>
      </div>

      {/* Tab 1: Đợt chi trả từ sàn */}
      {tab === 'settlements' && (
        <div className="space-y-4">
          {!data.settlements.length ? (
            <StudioEmptyState
              icon={WalletCards}
              title="Chưa có đợt quyết toán nào"
              description="Sau khi buổi học kết thúc, sàn sẽ tự động chốt doanh thu cọc và lên lịch chi trả về tài khoản của bạn tại đây."
            />
          ) : (
            <div className="overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[20%]" />
                    <col className="w-[18%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[15%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-studio-subtle text-xs font-semibold uppercase tracking-wide text-studio-muted">
                    <tr>
                      <th className="px-4 py-3">Mã đơn / Workshop</th>
                      <th className="px-3 py-3">Thời gian buổi học</th>
                      <th className="px-3 py-3">Tiền cọc sàn thu</th>
                      <th className="px-3 py-3">Thực nhận</th>
                      <th className="px-3 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">
                        Chi tiết chuyển tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-studio-border text-sm">
                    {data.settlements.map((s) => {
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
                            <p className="font-bold tabular-nums text-studio-primary text-base">
                              {formatPrice(s.amount)} đ
                            </p>
                          </td>
                          <td className="px-3 py-4">
                            <StudioBadge tone={settlementTone(s.status)}>
                              {settlementLabel(s.status)}
                            </StudioBadge>
                            {s.dueAt && s.status !== 'paid' && (
                              <p className="mt-1 text-[11px] text-studio-muted">
                                Hạn:{' '}
                                {new Date(s.dueAt).toLocaleDateString('vi-VN')}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {lastTransfer &&
                            lastTransfer.status === 'succeeded' ? (
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
          )}
        </div>
      )}

      {/* Tab 2: Đơn đã cọc sắp tới */}
      {tab === 'upcoming' && (
        <div className="space-y-4">
          {!data.upcomingBookings.length ? (
            <StudioEmptyState
              icon={CalendarClock}
              title="Không có đơn cọc nào đang chờ"
              description="Khi khách đặt cọc tham gia workshop sắp tới, đơn sẽ hiển thị tại đây để bạn tiện theo dõi trước khi buổi học diễn ra."
            />
          ) : (
            <div className="overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[20%]" />
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead className="bg-studio-subtle text-xs font-semibold uppercase tracking-wide text-studio-muted">
                    <tr>
                      <th className="px-4 py-3">Mã đơn / Workshop</th>
                      <th className="px-3 py-3">Thời gian buổi học</th>
                      <th className="px-3 py-3">Tiền cọc sàn giữ</th>
                      <th className="px-3 py-3">Thu tại studio</th>
                      <th className="px-4 py-3">Trạng thái buổi học</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-studio-border text-sm">
                    {data.upcomingBookings.map((b) => (
                      <tr
                        key={b.bookingId}
                        className="hover:bg-studio-selected/50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-studio-ink">
                            #{b.orderCode}
                          </p>
                          <p
                            className="mt-0.5 truncate text-xs text-studio-muted"
                            title={b.workshopTitle}
                          >
                            {b.workshopTitle}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-xs text-studio-muted">
                          <time dateTime={b.sessionStartsAt}>
                            {dateLabel(b.sessionStartsAt)}
                          </time>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold tabular-nums text-studio-ink">
                            {formatPrice(b.depositAmount)} đ
                          </p>
                          <p className="text-xs text-studio-muted">
                            {b.paidAmount >= b.depositAmount
                              ? 'Khách đã cọc thành công'
                              : 'Chờ cọc'}
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold tabular-nums text-studio-ink">
                            {formatPrice(b.balanceAmount)} đ
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {b.isCompleted ? (
                            <StudioBadge tone="warning">
                              Đã kết thúc (đang chốt)
                            </StudioBadge>
                          ) : (
                            <StudioBadge tone="neutral">
                              Sắp diễn ra
                            </StudioBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
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
