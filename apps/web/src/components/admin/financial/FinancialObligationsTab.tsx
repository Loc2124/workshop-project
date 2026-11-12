import { formatBankDisplay } from '@workshop/shared';
import {
  dateTime,
  errorMessage,
  money,
  obligationName,
  type Obligation,
} from './financialTypes';
import { StatusBadge } from './StatusBadge';

export interface FinancialObligationsTabProps {
  obligations: Obligation[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  selectedPurpose: Record<string, 'customer_refund' | 'platform_advance'>;
  onPurposeChange: (
    id: string,
    purpose: 'customer_refund' | 'platform_advance',
  ) => void;
  transferAmounts: Record<string, string>;
  onAmountChange: (id: string, amount: string) => void;
  reason: Record<string, string>;
  onReasonChange: (id: string, reason: string) => void;
  onOpenVietqr: (id: string) => void;
  isOpenVietqrPending: boolean;
  activeVietqrId?: string;
  onCreateTransfer: (
    o: Obligation,
    purpose: 'customer_refund' | 'platform_advance' | 'studio_payout' | 'studio_repayment',
  ) => void;
  isCreateTransferPending: boolean;
}

export function FinancialObligationsTab({
  obligations,
  isLoading,
  isError,
  error,
  selectedPurpose,
  onPurposeChange,
  transferAmounts,
  onAmountChange,
  reason,
  onReasonChange,
  onOpenVietqr,
  isOpenVietqrPending,
  activeVietqrId,
  onCreateTransfer,
  isCreateTransferPending,
}: FinancialObligationsTabProps) {
  return (
    <section className="space-y-4" aria-label="Nghĩa vụ tài chính">
      {isLoading ? (
        <p className="text-sm text-stone-600">Đang tải nghĩa vụ…</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-brick">
          {errorMessage(error)}
        </p>
      ) : !obligations?.length ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          Chưa có khoản nào cần xử lý.
        </div>
      ) : (
        obligations.map((o) => {
          const remaining = Math.max(
            0,
            Number(o.amount) - Number(o.settledAmount) - Number(o.reservedAmount),
          );

          return (
            <article
              key={o.id}
              className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:p-5"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-base sm:text-lg font-semibold text-ink">
                    {obligationName(o.kind)}
                  </h2>
                  <StatusBadge value={o.status} />
                  {o.dueState && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        o.dueState === 'overdue'
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-amber-100 text-amber-950'
                      }`}
                    >
                      {o.dueState === 'overdue' ? 'Quá hạn' : 'Sắp đến hạn'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-700">
                  #{o.orderCode} · {o.studioName}
                  {o.ticketId ? ' · Một vé' : ''}
                </p>
                <p className="text-sm text-stone-600">{o.reason}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span>
                    Tổng nghĩa vụ: <strong>{money(o.amount)}</strong>
                  </span>
                  <span>
                    Đã xử lý: <strong>{money(o.settledAmount)}</strong>
                  </span>
                  <span>
                    Còn lại: <strong>{money(remaining)}</strong>
                  </span>
                </div>
                <p className="text-xs font-medium text-stone-600">
                  Hạn: {dateTime(o.dueAt)}
                </p>
                {['customer_refund', 'studio_payout'].includes(o.kind) && (
                  <p className="text-sm text-stone-700">
                    {o.destinationLast4 ? (
                      <>
                        Tài khoản nhận:{' '}
                        <strong>
                          {formatBankDisplay(
                            o.destinationBankBin,
                            o.destinationBankName,
                          )}
                        </strong>{' '}
                        · {o.destinationHolder} · ****{o.destinationLast4}{' '}
                        <span className="text-xs text-stone-500">
                          (
                          {o.destinationStatus === 'verified'
                            ? 'Đã đối chiếu'
                            : 'Có thể quét VietQR ngay'}
                          )
                        </span>
                      </>
                    ) : (
                      <span className="text-amber-900">
                        Chờ người nhận bổ sung tài khoản ngân hàng.
                      </span>
                    )}
                  </p>
                )}
              </div>
              {remaining > 0 &&
                o.status !== 'manual_review' &&
                o.status !== 'cancelled' &&
                o.status !== 'paid' && (
                  <div className="w-full space-y-2 md:max-w-xs">
                    {['customer_refund', 'studio_payout'].includes(o.kind) &&
                      o.destinationLast4 && (
                        <button
                          type="button"
                          onClick={() => onOpenVietqr(o.id)}
                          disabled={isOpenVietqrPending}
                          className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
                        >
                          {isOpenVietqrPending && activeVietqrId === o.id
                            ? 'Đang tạo mã VietQR…'
                            : 'Quét VietQR & Xác nhận chuyển (1 bước)'}
                        </button>
                      )}
                    <details className="rounded-lg border border-stone-200 bg-soft/60 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-stone-700">
                        Lập giao dịch thủ công (nhiều bước)
                      </summary>
                      <div className="mt-3 space-y-2">
                        {o.kind === 'customer_refund' && (
                          <label className="block text-xs font-medium">
                            Loại chi
                            <select
                              value={
                                selectedPurpose[o.id] ?? 'customer_refund'
                              }
                              onChange={(e) =>
                                onPurposeChange(
                                  o.id,
                                  e.target.value as
                                    | 'customer_refund'
                                    | 'platform_advance',
                                )
                              }
                              className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                            >
                              <option value="customer_refund">
                                Hoàn từ tiền cọc đang giữ / Studio đã gửi
                              </option>
                              <option value="platform_advance">
                                Open Slot tạm ứng
                              </option>
                            </select>
                          </label>
                        )}
                        <label className="block text-xs font-medium">
                          Số tiền
                          <input
                            type="number"
                            min="1"
                            max={remaining}
                            value={transferAmounts[o.id] ?? remaining}
                            onChange={(e) =>
                              onAmountChange(o.id, e.target.value)
                            }
                            className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-medium">
                          Lý do
                          <textarea
                            value={reason[o.id] ?? ''}
                            onChange={(e) => onReasonChange(o.id, e.target.value)}
                            className="mt-1 min-h-16 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                            placeholder="Ghi căn cứ lập giao dịch (tối thiểu 10 ký tự nếu nhập)"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            onCreateTransfer(
                              o,
                              o.kind === 'customer_refund'
                                ? (selectedPurpose[o.id] ?? 'customer_refund')
                                : o.kind === 'studio_recovery'
                                  ? 'studio_repayment'
                                  : 'studio_payout',
                            )
                          }
                          disabled={
                            isCreateTransferPending ||
                            remaining <= 0 ||
                            (Boolean(reason[o.id]?.trim()) &&
                              (reason[o.id]?.trim().length ?? 0) < 10)
                          }
                          className="min-h-10 w-full rounded-lg border border-primary bg-white px-4 text-sm font-semibold text-primary hover:bg-paper disabled:opacity-50"
                        >
                          Lập giao dịch chờ duyệt
                        </button>
                      </div>
                    </details>
                  </div>
                )}
            </article>
          );
        })
      )}
    </section>
  );
}
