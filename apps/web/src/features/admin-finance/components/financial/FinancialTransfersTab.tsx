import {
  dateTime,
  errorMessage,
  money,
  obligationName,
  type Obligation,
  type Transfer,
} from './financialTypes';
import { StatusBadge } from './StatusBadge';
import { FinancialTransferHistory } from './FinancialTransferHistory';

export type QueueFilter =
  'all' | 'uncertain' | 'overdue' | 'due_soon' | 'failed';

export interface FinancialTransfersTabProps {
  isQueue: boolean;
  transfers: Transfer[] | undefined;
  obligations: Obligation[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  queueFilter: QueueFilter;
  onQueueFilterChange: (filter: QueueFilter) => void;
  onNavigateToObligations: () => void;
  userId?: string;
  transferDetails: Record<
    string,
    { provider: string; reference: string; fee: string }
  >;
  onTransferDetailsChange: (
    id: string,
    details: { provider: string; reference: string; fee: string },
  ) => void;
  transferReason: Record<string, string>;
  onTransferReasonChange: (id: string, reason: string) => void;
  onApprove: (t: Transfer) => void;
  isApprovePending: boolean;
  onOpenVietqr: (obligationId: string) => void;
  isOpenVietqrPending: boolean;
  onRecordResult: (
    t: Transfer,
    outcome: 'succeeded' | 'failed' | 'manual_review',
  ) => void;
  isRecordResultPending: boolean;
}

export function FinancialTransfersTab({
  isQueue,
  transfers,
  obligations,
  isLoading,
  isError,
  error,
  queueFilter,
  onQueueFilterChange,
  onNavigateToObligations,
  userId,
  transferDetails,
  onTransferDetailsChange,
  transferReason,
  onTransferReasonChange,
  onApprove,
  isApprovePending,
  onOpenVietqr,
  isOpenVietqrPending,
  onRecordResult,
  isRecordResultPending,
}: FinancialTransfersTabProps) {
  return (
    <section
      className="space-y-4"
      aria-label={isQueue ? 'Hàng chờ đối soát' : 'Lịch sử giao dịch'}
    >
      {isQueue && (
        <div className="rounded-xl border border-line bg-soft p-4">
          <h2 className="font-heading text-base sm:text-lg font-semibold text-ink">
            Khoản cần xử lý
          </h2>
          <p className="mt-1 text-sm text-stone-700">
            Ưu tiên khoản quá hạn, chưa rõ kết quả và sắp đến hạn. Giao dịch
            chưa rõ kết quả vẫn giữ tiền để tránh chi trùng.
          </p>
          {Boolean(
            obligations?.some(
              (o) => o.dueState && o.status !== 'manual_review',
            ),
          ) && (
            <button
              type="button"
              onClick={onNavigateToObligations}
              className="mt-2 min-h-10 rounded-lg border border-primary bg-surface px-3 text-sm font-semibold text-primary hover:bg-paper"
            >
              Xem nghĩa vụ sắp hoặc đã quá hạn
            </button>
          )}
          {Boolean(obligations?.some((o) => o.dueState)) && (
            <ul className="mt-3 space-y-2">
              {obligations
                ?.filter((o) => o.dueState)
                .slice(0, 5)
                .map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                  >
                    <span>
                      <strong>#{o.orderCode}</strong> · {obligationName(o.kind)}{' '}
                      ·{' '}
                      {money(
                        Math.max(
                          0,
                          Number(o.amount) -
                            Number(o.settledAmount) -
                            Number(o.reservedAmount),
                        ),
                      )}
                    </span>
                    <span
                      className={
                        o.dueState === 'overdue'
                          ? 'font-semibold text-rose-800'
                          : 'font-semibold text-amber-950'
                      }
                    >
                      {o.dueState === 'overdue' ? 'Quá hạn' : 'Sắp đến hạn'} ·{' '}
                      {dateTime(o.dueAt)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Lọc hàng chờ"
          >
            {(
              [
                ['all', 'Tất cả'],
                ['uncertain', 'Chưa rõ kết quả'],
                ['overdue', 'Quá hạn'],
                ['due_soon', 'Sắp đến hạn'],
                ['failed', 'Chuyển thất bại'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={queueFilter === key}
                onClick={() => onQueueFilterChange(key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-medium ${
                  queueFilter === key
                    ? 'border-primary bg-primary text-white'
                    : 'border-stone-300 bg-white text-ink hover:bg-paper'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-stone-600">Đang tải giao dịch…</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-brick">
          {errorMessage(error)}
        </p>
      ) : !transfers?.length ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          {isQueue
            ? 'Không có giao dịch cần xử lý theo bộ lọc này.'
            : 'Chưa có giao dịch nào.'}
        </div>
      ) : (
        transfers.map((t) => (
          <article
            key={t.id}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-base sm:text-lg font-semibold">
                  {obligationName(t.kind)} ·{' '}
                  {t.direction === 'inbound' ? 'Tiền về' : 'Tiền đi'}
                </h2>
                <p className="text-sm text-stone-600">
                  #{t.orderCode} · {money(t.amount)}
                  {t.providerFee !== null
                    ? ` · Phí thực tế ${money(t.providerFee)}`
                    : ''}
                </p>
              </div>
              <StatusBadge value={t.status} />
            </div>

            {t.reference && (
              <p className="text-sm text-stone-700">
                {t.provider} · Mã đối chiếu {t.reference}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-stone-700">
                Hạn xử lý: {dateTime(t.dueAt)}
              </span>
              {t.dueState && t.status !== 'succeeded' && (
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    t.dueState === 'overdue'
                      ? 'bg-rose-100 text-rose-900'
                      : 'bg-amber-100 text-amber-950'
                  }`}
                >
                  {t.dueState === 'overdue' ? 'Quá hạn' : 'Sắp đến hạn'}
                </span>
              )}
            </div>

            {t.destinationLast4 && (
              <p
                className={`text-sm ${
                  t.destinationValid === false && t.status !== 'succeeded'
                    ? 'font-semibold text-rose-800'
                    : 'text-stone-700'
                }`}
              >
                Tài khoản nhận:{' '}
                {t.destinationBank ? (
                  <>
                    {t.destinationBank} · {t.destinationName} ·{' '}
                  </>
                ) : (
                  <>Chi tiết đã xóa · </>
                )}
                ****{t.destinationLast4}
                {t.destinationValid === false && t.status !== 'succeeded'
                  ? ' · Tài khoản đã đổi hoặc chưa còn hợp lệ'
                  : ''}
              </p>
            )}

            {t.failureReason && (
              <p className="text-sm text-rose-800">{t.failureReason}</p>
            )}

            {t.status === 'manual_review' && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-950">
                Chưa rõ tiền đã chuyển hay chưa. Đối chiếu với ngân hàng trước
                khi ghi nhận kết quả; không lập giao dịch khác cho khoản này.
              </p>
            )}

            {t.status === 'failed' && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
                <p>
                  Đã xác nhận chuyển thất bại. Có thể lập giao dịch mới từ khoản
                  còn phải xử lý.
                </p>
                <button
                  type="button"
                  onClick={onNavigateToObligations}
                  className="min-h-9 font-semibold text-primary underline"
                >
                  Xem khoản cần xử lý
                </button>
              </div>
            )}

            {t.status === 'pending_approval' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(t)}
                  disabled={isApprovePending}
                  className="min-h-10 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft disabled:opacity-50"
                >
                  Duyệt giao dịch
                </button>
                {t.direction === 'outbound' && (
                  <button
                    type="button"
                    onClick={() => onOpenVietqr(t.obligationId)}
                    disabled={isOpenVietqrPending}
                    className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    Quét VietQR & Xác nhận chuyển (1 bước)
                  </button>
                )}
              </div>
            )}

            {t.status === 'approved' && t.direction === 'outbound' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenVietqr(t.obligationId)}
                  disabled={isOpenVietqrPending}
                  className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  Mở mã VietQR chuyển khoản
                </button>
              </div>
            )}

            {['approved', 'manual_review'].includes(t.status) && (
              <div className="grid gap-2 rounded-lg bg-soft p-3 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
                <label className="text-xs font-medium">
                  Nhà cung cấp
                  <input
                    value={transferDetails[t.id]?.provider ?? t.provider ?? ''}
                    onChange={(e) =>
                      onTransferDetailsChange(t.id, {
                        provider: e.target.value,
                        reference:
                          transferDetails[t.id]?.reference ?? t.reference ?? '',
                        fee: transferDetails[t.id]?.fee ?? '',
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Mã đối chiếu
                  <input
                    value={
                      transferDetails[t.id]?.reference ?? t.reference ?? ''
                    }
                    onChange={(e) =>
                      onTransferDetailsChange(t.id, {
                        provider:
                          transferDetails[t.id]?.provider ?? t.provider ?? '',
                        reference: e.target.value,
                        fee: transferDetails[t.id]?.fee ?? '',
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Phí thực tế
                  <input
                    type="number"
                    min="0"
                    value={transferDetails[t.id]?.fee ?? ''}
                    onChange={(e) =>
                      onTransferDetailsChange(t.id, {
                        provider:
                          transferDetails[t.id]?.provider ?? t.provider ?? '',
                        reference:
                          transferDetails[t.id]?.reference ?? t.reference ?? '',
                        fee: e.target.value,
                      })
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onRecordResult(t, 'succeeded')}
                  disabled={
                    isRecordResultPending ||
                    !(
                      transferDetails[t.id]?.provider ??
                      t.provider ??
                      ''
                    ).trim() ||
                    !(
                      transferDetails[t.id]?.reference ??
                      t.reference ??
                      ''
                    ).trim() ||
                    transferDetails[t.id]?.fee === undefined ||
                    transferDetails[t.id]?.fee === '' ||
                    Number(transferDetails[t.id]?.fee) < 0
                  }
                  className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  Đã chuyển xong
                </button>
                <label className="text-xs font-medium sm:col-span-4">
                  Ghi chú đối chiếu khi thất bại hoặc chưa rõ kết quả
                  <textarea
                    value={transferReason[t.id] ?? ''}
                    onChange={(e) =>
                      onTransferReasonChange(t.id, e.target.value)
                    }
                    minLength={10}
                    maxLength={500}
                    className="mt-1 min-h-16 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                    placeholder="Ghi căn cứ đối chiếu với ngân hàng"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onRecordResult(t, 'failed')}
                  disabled={
                    isRecordResultPending ||
                    (transferReason[t.id]?.trim().length ?? 0) < 10
                  }
                  className="min-h-10 rounded-lg border border-stone-400 px-4 text-sm font-semibold disabled:opacity-50"
                >
                  Chuyển thất bại
                </button>
                <button
                  type="button"
                  onClick={() => onRecordResult(t, 'manual_review')}
                  disabled={
                    isRecordResultPending ||
                    (transferReason[t.id]?.trim().length ?? 0) < 10
                  }
                  className="min-h-10 rounded-lg border border-amber-600 px-4 text-sm font-semibold text-amber-950 disabled:opacity-50"
                >
                  Chưa rõ kết quả
                </button>
              </div>
            )}
            <FinancialTransferHistory id={t.id} userId={userId} />
          </article>
        ))
      )}
    </section>
  );
}
