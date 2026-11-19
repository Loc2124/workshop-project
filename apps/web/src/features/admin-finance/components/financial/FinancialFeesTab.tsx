import { errorMessage, money, type PaymentFee } from './financialTypes';

export interface FinancialFeesTabProps {
  fees: PaymentFee[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  collectionFees: Record<
    string,
    { provider: string; reference: string; fee: string }
  >;
  onCollectionFeeChange: (
    paymentId: string,
    val: { provider: string; reference: string; fee: string },
  ) => void;
  onRecordFee: (p: PaymentFee) => void;
  isRecordFeePending: boolean;
}

export function FinancialFeesTab({
  fees,
  isLoading,
  isError,
  error,
  collectionFees,
  onCollectionFeeChange,
  onRecordFee,
  isRecordFeePending,
}: FinancialFeesTabProps) {
  return (
    <section className="space-y-4" aria-label="Đối soát phí thu tiền cọc">
      <p className="max-w-3xl text-sm leading-6 text-stone-700">
        Nhập phí thật theo báo cáo từng giao dịch đã xác nhận. Phí được khấu trừ
        vào khoản chi của cùng buổi học. Nếu khoản chi đã hoàn tất, phần phí
        phát sinh được theo dõi riêng cho studio và buổi đó.
      </p>

      {isLoading ? (
        <p className="text-sm text-stone-600">Đang tải khoản thu…</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-brick">
          {errorMessage(error)}
        </p>
      ) : !fees?.length ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          Đã đối soát phí cho tất cả khoản cọc đã nhận.
        </div>
      ) : (
        fees.map((p) => {
          const v = collectionFees[p.paymentId] ?? {
            provider: p.provider,
            reference: p.providerReference ?? '',
            fee: '',
          };

          return (
            <article
              key={p.paymentId}
              className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_9rem_auto] md:items-end"
            >
              <div className="md:col-span-4">
                <h2 className="font-heading text-base sm:text-lg font-semibold">
                  #{p.orderCode} · {p.workshopTitle}
                </h2>
                <p className="text-sm text-stone-600">
                  {p.studioName} · Đã thu {money(p.amount)} · Mã giao dịch{' '}
                  {p.providerReference ?? 'Chưa có'}
                </p>
              </div>

              <label className="text-xs font-medium">
                Nhà cung cấp
                <input
                  value={v.provider}
                  onChange={(e) =>
                    onCollectionFeeChange(p.paymentId, {
                      ...v,
                      provider: e.target.value,
                    })
                  }
                  className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                />
              </label>

              <label className="text-xs font-medium">
                Mã giao dịch
                <input
                  value={v.reference}
                  onChange={(e) =>
                    onCollectionFeeChange(p.paymentId, {
                      ...v,
                      reference: e.target.value,
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
                  value={v.fee}
                  onChange={(e) =>
                    onCollectionFeeChange(p.paymentId, {
                      ...v,
                      fee: e.target.value,
                    })
                  }
                  className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={() => onRecordFee(p)}
                disabled={
                  isRecordFeePending ||
                  !v.fee ||
                  !v.reference.trim() ||
                  !v.provider.trim()
                }
                className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                Ghi phí thật
              </button>
            </article>
          );
        })
      )}
    </section>
  );
}
