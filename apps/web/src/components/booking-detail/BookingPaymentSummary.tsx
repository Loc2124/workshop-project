import { useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatPrice } from '@/lib/format';
import { downloadQrPng } from '@/lib/download-qr';
import { parseVietQrPayload } from '@/lib/vietqr';
import { formatBankDisplay } from '@workshop/shared';
import type { CustomerBooking } from '@/services/customerBookingService';
import type { bookingDetailState } from '@/lib/booking-detail';

const primary =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60';
const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-center text-sm font-semibold text-primary transition-colors hover:bg-soft disabled:opacity-60';
const money = (amount: number) => `${formatPrice(amount)} đ`;

export interface BookingPaymentSummaryProps {
  booking: CustomerBooking;
  state: ReturnType<typeof bookingDetailState>;
  checkingExpiry: boolean;
  queryIsFetching: boolean;
  queryIsRefetchError: boolean;
  checkResult: string;
  retainedAfterCancel: number;
  refundNeeded: boolean;
  sessionState: string;
  paymentQrRef: RefObject<SVGSVGElement | null>;
  retryIsPending: boolean;
  retryIsError: boolean;
  retryErrorMessage?: string;
  checkoutBusy: boolean;
  onRefreshCheckout: () => void;
  onCheckPayment: () => void;
  onRetry: () => void;
  onSetCheckResult: (msg: string) => void;
}

export function BookingPaymentSummary({
  booking,
  state,
  checkingExpiry,
  queryIsFetching,
  queryIsRefetchError,
  checkResult,
  retainedAfterCancel,
  refundNeeded,
  sessionState,
  paymentQrRef,
  retryIsPending,
  retryIsError,
  retryErrorMessage,
  checkoutBusy,
  onRefreshCheckout,
  onCheckPayment,
  onRetry,
  onSetCheckResult,
}: BookingPaymentSummaryProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyText = async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  const parsedQr = parseVietQrPayload(state.deposit?.qrCode);
  const transferContent = String(
    state.deposit?.transferDescription ??
      state.deposit?.orderCode ??
      booking.orderCode,
  );
  return (
    <>
      {state.canPay && (
        <div
          className={
            'mb-4 rounded-xl border p-4 text-center ' +
            (state.remainingSeconds < 120
              ? 'border-amber-400 bg-amber-50 text-amber-950'
              : 'border-primary/20 bg-soft')
          }
        >
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Clock size={15} aria-hidden="true" />
            Chỗ của bạn được giữ trong
          </p>
          <p
            className="mt-1 font-heading text-2xl font-bold tabular-nums sm:text-3xl xl:text-4xl"
            aria-label={`Còn ${Math.floor(state.remainingSeconds / 60)} phút ${state.remainingSeconds % 60} giây`}
          >
            {Math.floor(state.remainingSeconds / 60)} {' : '}
            {state.remainingSeconds % 60}
          </p>
          <p className="mt-1.5 text-xs text-stone-700 sm:text-sm">
            Hết hạn lúc{' '}
            {new Intl.DateTimeFormat('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
              timeZone: 'Asia/Ho_Chi_Minh',
            }).format(new Date(booking.holdExpiresAt))}
            ,{' '}
            {new Intl.DateTimeFormat('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              timeZone: 'Asia/Ho_Chi_Minh',
            }).format(new Date(booking.holdExpiresAt))}
          </p>
        </div>
      )}

      {booking.paymentMode === 'in_studio' && !state.cancelled && (
        <p className="mb-4 rounded-lg border border-line/70 bg-soft/70 p-3 text-sm text-ink">
          {state.actualBalance > 0
            ? `Bạn sẽ thanh toán ${money(state.actualBalance)} tại studio.`
            : 'Bạn đã thanh toán đủ.'}
        </p>
      )}

      {state.expired && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-stone-100 p-3 font-semibold"
        >
          Hết thời gian giữ chỗ
        </p>
      )}

      {checkingExpiry && (
        <p role="status" className="mb-4 rounded-lg bg-soft p-3 text-sm">
          Đang kiểm tra thời gian giữ chỗ…
        </p>
      )}

      {!state.upcoming &&
        !state.confirmed &&
        !state.cancelled &&
        !state.expired && (
          <p className="mb-4 text-sm text-stone-600">
            Buổi học đã bắt đầu hoặc đã hủy. Không thể tiếp tục thanh toán cọc.
          </p>
        )}

      {booking.paymentAllowed === false &&
        booking.reservationStatus === 'pending' &&
        state.upcoming &&
        !state.expired &&
        !checkingExpiry && (
          <p role="status" className="mb-4 text-sm">
            Lịch này hiện không nhận thanh toán cọc. Bạn có thể hủy các chỗ chưa
            thanh toán hoặc liên hệ studio để được hỗ trợ.
          </p>
        )}

      <h2 className="font-heading text-lg font-semibold text-ink">
        Thanh toán
      </h2>
      <dl className="mt-3 space-y-2.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-stone-700">
            {(booking.seatRevision ?? 0) > 0
              ? state.cancelled
                ? 'Giá trị trước lần hủy cuối'
                : 'Giá trị chỗ còn giữ'
              : 'Tổng tiền'}
          </dt>
          <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">
            {money(booking.totalAmount)}
          </dd>
        </div>
        {booking.receivedAmount !== undefined &&
          ((booking.seatRevision ?? 0) > 0 ||
            state.cancelled ||
            refundNeeded) && (
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">Đã nhận trong cả đặt chỗ</dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">
                {money(booking.receivedAmount)}
              </dd>
            </div>
          )}
        {booking.paymentMode === 'payos_deposit' && !state.cancelled && (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">
                {state.depositPaid ? 'Tiền cọc đã nhận' : 'Tiền cọc'}
              </dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">
                {money(booking.depositAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2.5">
              <dt className="font-medium text-ink">
                {state.cancelled
                  ? 'Phần chưa thanh toán'
                  : state.depositPaid
                    ? 'Còn trả tại studio'
                    : 'Còn lại thanh toán tại studio'}
              </dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">
                {money(
                  state.depositPaid
                    ? state.actualBalance
                    : state.projectedStudioAmount,
                )}
              </dd>
            </div>
          </>
        )}
        {booking.paymentMode !== 'payos_deposit' && !state.cancelled && (
          <div className="flex justify-between gap-4 border-t border-line pt-2.5">
            <dt className="font-medium text-ink">Còn phải trả</dt>
            <dd className="whitespace-nowrap font-semibold tabular-nums text-ink">
              {money(state.actualBalance)}
            </dd>
          </div>
        )}
      </dl>

      {state.canPay && !queryIsRefetchError && (
        <div className="mt-4 rounded-xl border border-line bg-paper/70 p-4">
          <p className="mb-2 text-center text-sm font-semibold text-ink">
            Quét bằng app ngân hàng
          </p>
          <div className="mb-3 rounded-xl border border-line/80 bg-surface p-3 text-xs space-y-2.5">
            {parsedQr?.bin && (
              <div className="flex items-center justify-between gap-2 border-b border-line/50 pb-2">
                <span className="text-muted">Ngân hàng:</span>
                <span className="font-semibold text-ink text-right">
                  {formatBankDisplay(parsedQr.bin)}
                </span>
              </div>
            )}
            {parsedQr?.accountNumber && (
              <div className="flex items-center justify-between gap-2 border-b border-line/50 pb-2">
                <div className="text-left">
                  <span className="text-muted">Số tài khoản:</span>
                  <p className="font-mono text-sm font-bold text-ink">
                    {parsedQr.accountNumber}
                  </p>
                </div>
                <button
                  type="button"
                  title="Sao chép số tài khoản"
                  onClick={() =>
                    void copyText('accountNumber', parsedQr.accountNumber!)
                  }
                  className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-primary hover:text-primary active:scale-95 transition-all"
                >
                  {copiedField === 'accountNumber' ? (
                    <>
                      <Check
                        size={12}
                        className="text-studio-success"
                        aria-hidden="true"
                      />
                      <span className="text-studio-success">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} aria-hidden="true" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 border-b border-line/50 pb-2">
              <div className="text-left">
                <span className="text-muted">Số tiền cọc:</span>
                <p className="tabular-nums font-bold text-ink text-sm">
                  {money(booking.depositAmount)}
                </p>
              </div>
              <button
                type="button"
                title="Sao chép số tiền"
                onClick={() =>
                  void copyText('amount', String(booking.depositAmount))
                }
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-primary hover:text-primary active:scale-95 transition-all"
              >
                {copiedField === 'amount' ? (
                  <>
                    <Check
                      size={12}
                      className="text-studio-success"
                      aria-hidden="true"
                    />
                    <span className="text-studio-success">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden="true" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="min-w-0 flex-1 text-left">
                <span className="text-muted">Nội dung CK:</span>
                <p className="font-mono text-xs font-bold text-ink truncate">
                  {transferContent}
                </p>
              </div>
              <button
                type="button"
                title="Sao chép nội dung chuyển khoản"
                onClick={() => void copyText('description', transferContent)}
                className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-primary hover:text-primary active:scale-95 transition-all"
              >
                {copiedField === 'description' ? (
                  <>
                    <Check
                      size={12}
                      className="text-studio-success"
                      aria-hidden="true"
                    />
                    <span className="text-studio-success">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden="true" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          </div>
          {state.deposit?.qrCode && (
            <QRCodeSVG
              value={state.deposit.qrCode}
              size={184}
              title="Mã QR thanh toán tiền cọc"
              ref={paymentQrRef}
              className="mx-auto max-w-full rounded-xl border border-line bg-white p-2.5"
            />
          )}
          {state.deposit?.qrCode && (
            <button
              type="button"
              className={secondary + ' mt-3 w-full bg-surface'}
              onClick={() => {
                if (paymentQrRef.current)
                  void downloadQrPng(
                    paymentQrRef.current,
                    'ma-coc-' + booking.orderCode + '.png',
                  ).catch(() =>
                    onSetCheckResult('Chưa tải được mã, vui lòng thử lại.'),
                  );
              }}
            >
              <Download size={16} aria-hidden="true" />
              Tải mã QR
            </button>
          )}
          {state.deposit?.checkoutUrl && (
            <a
              href={state.deposit.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className={`${primary} mt-2.5`}
            >
              Mở trang thanh toán · Cọc {money(booking.depositAmount)}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            className={secondary + ' mt-2.5 w-full bg-surface'}
            disabled={queryIsFetching}
            onClick={onCheckPayment}
          >
            <RefreshCw
              size={15}
              className={queryIsFetching ? 'animate-spin' : undefined}
              aria-hidden="true"
            />
            {queryIsFetching ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán'}
          </button>
          <p className="mt-2 text-center text-sm leading-6 text-stone-700">
            Đặt chỗ sẽ được xác nhận ngay khi chúng tôi nhận được tiền cọc.
          </p>
        </div>
      )}

      {retainedAfterCancel > 0 && (
        <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
          Khoản cọc {money(retainedAfterCancel)} không được hoàn vì bạn hủy
          trong vòng 24 giờ trước buổi học.
        </p>
      )}

      {booking.refundStatus === 'refunded' && (
        <p role="status" className="mt-3 rounded-lg bg-soft p-3 text-sm">
          Open Slot đã chuyển khoản hoàn{' '}
          {money(booking.refundedAmount ?? booking.refundDueAmount ?? 0)}. Bạn
          vui lòng kiểm tra tài khoản nhận tiền.
        </p>
      )}

      {(refundNeeded || booking.refundStatus === 'pending') && (
        <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">
          Số tiền cần hoàn:{' '}
          {money(
            Math.max(
              0,
              (booking.refundDueAmount ?? booking.paidAmount) -
                (booking.refundedAmount ?? 0),
            ),
          )}
          . Open Slot đang đối soát và xử lý trong tối đa 7 ngày làm việc.
        </p>
      )}

      {state.expired && (
        <div className="mt-4">
          {booking.canRebook && state.upcoming ? (
            <button
              type="button"
              disabled={retryIsPending}
              className={primary}
              onClick={onRetry}
            >
              {retryIsPending ? 'Đang đặt lại…' : 'Đặt lại'}
            </button>
          ) : (
            <Link
              className={`${secondary} w-full`}
              to={`/workshop/${booking.workshopId}#lich-trai-nghiem`}
            >
              Xem lịch khác
            </Link>
          )}
          {retryIsError && (
            <p role="alert" className="mt-2 text-sm text-brick">
              {retryErrorMessage}{' '}
              <Link
                className="underline"
                to={`/workshop/${booking.workshopId}#lich-trai-nghiem`}
              >
                Xem lịch khác
              </Link>
            </p>
          )}
        </div>
      )}

      {sessionState === 'Đã kết thúc' && (
        <Link
          className={`${secondary} mt-4 w-full`}
          to={`/workshop/${booking.workshopId}#lich-trai-nghiem`}
        >
          Xem các buổi sắp tới
        </Link>
      )}

      {checkResult && (
        <p role="status" className="mt-3 rounded-lg bg-soft p-3 text-sm">
          {checkResult}
        </p>
      )}

      {queryIsRefetchError && (
        <p role="alert" className="mt-3 text-sm text-brick">
          Chưa đồng bộ được trạng thái. Vui lòng kiểm tra lại trước khi thanh
          toán.
        </p>
      )}

      {(!state.canPay || queryIsRefetchError) && (
        <button
          type="button"
          className={secondary + ' mt-3 w-full'}
          disabled={queryIsFetching}
          onClick={onCheckPayment}
        >
          {queryIsFetching ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán'}
        </button>
      )}

      {state.canPay &&
        (booking.seatRevision ?? 0) > 0 &&
        !state.deposit?.checkoutUrl && (
          <div className="mt-3 text-sm">
            <p>
              Đã cập nhật số chỗ. Bạn cần lấy mã cọc mới trước khi thanh toán;
              hạn giữ chỗ không đổi.
            </p>
            <button
              type="button"
              className={secondary + ' mt-2 w-full'}
              disabled={checkoutBusy}
              aria-busy={checkoutBusy}
              onClick={onRefreshCheckout}
            >
              {checkoutBusy ? 'Đang kiểm tra…' : 'Kiểm tra mã cọc mới'}
            </button>
          </div>
        )}
    </>
  );
}
