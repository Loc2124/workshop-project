import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { formatPrice } from '../../lib/format';

type Settlement = {
  bookingId: string;
  orderCode: string;
  studioName: string;
  workshopTitle: string;
  dueAt: string;
  closedAt: string;
  netAmount: string | number;
  breakdown: {
    collected?: string;
    refundsRecorded?: string;
    providerFees?: string;
    legacyPayout?: string;
  };
  currentPayoutAmount: string | number | null;
  payoutStatus: string | null;
  currentRefunds: string | number;
  refundsAfterClose: string | number | null;
  paidToStudio: string | number;
};
const money = (value: string | number) => `${formatPrice(Number(value))} đ`;
const time = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export function AdminSettlementPanel({ userId }: { userId?: string }) {
  const query = useQuery({
    queryKey: ['private', userId, 'financial-settlements'],
    queryFn: () =>
      apiFetch<{ items: Settlement[] }>('/admin/tai-chinh/doi-soat').then(
        (result) => result.items,
      ),
    refetchInterval: 60_000,
  });
  if (query.isPending) return <p>Đang tải số liệu chốt…</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-rose-800">
        Chưa tải được số liệu chốt. Vui lòng thử lại.
      </p>
    );
  if (!query.data.length)
    return (
      <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
        Chưa có buổi học nào đến hạn chốt chi trả.
      </p>
    );
  return (
    <section className="space-y-3" aria-label="Đối soát khoản chi studio">
      <p className="text-sm leading-6 text-stone-700">
        Số liệu chốt được giữ lại để đối chiếu. Khoản hoàn và phí phát sinh sau
        đó được xử lý riêng cho cùng buổi học.
      </p>
      {query.data.map((item) => (
        <article
          key={item.bookingId}
          className="rounded-sm border border-line bg-surface p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-ink">
                #{item.orderCode} · {item.workshopTitle}
              </h2>
              <p className="text-sm text-muted">
                Studio {item.studioName} · Chốt lúc {time(item.closedAt)}
              </p>
            </div>
            <strong className="text-lg tabular-nums text-primary">
              {money(item.netAmount)}
            </strong>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Đã thu</dt>
              <dd className="font-medium tabular-nums">
                {item.breakdown.collected !== undefined
                  ? money(item.breakdown.collected)
                  : 'Chưa có bản chốt chi tiết'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Hoàn đã ghi nhận khi chốt</dt>
              <dd className="font-medium tabular-nums">
                {item.breakdown.refundsRecorded !== undefined
                  ? money(item.breakdown.refundsRecorded)
                  : 'Chưa có bản chốt chi tiết'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Phí đã trừ khi chốt</dt>
              <dd className="font-medium tabular-nums">
                {item.breakdown.providerFees !== undefined
                  ? money(item.breakdown.providerFees)
                  : 'Chưa có bản chốt chi tiết'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Đã chi studio</dt>
              <dd className="font-medium tabular-nums">
                {money(item.paidToStudio)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Khoản chi sau đối soát phí</dt>
              <dd className="font-medium tabular-nums">
                {item.currentPayoutAmount === null
                  ? 'Không phát sinh'
                  : money(item.currentPayoutAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Hoàn phát sinh sau chốt</dt>
              <dd className="font-medium tabular-nums">
                {item.refundsAfterClose === null
                  ? 'Chưa xác định'
                  : money(item.refundsAfterClose)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Hạn chi</dt>
              <dd className="font-medium">{time(item.dueAt)}</dd>
            </div>
          </dl>
          {Number(item.refundsAfterClose) > 0 && (
            <p className="mt-3 border-t border-stone-200 pt-3 text-sm font-medium text-rose-800">
              Có khoản hoàn phát sinh sau khi chốt. Cần đối chiếu khoản studio
              chuyển bù của buổi này.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
