import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { formatPrice } from '../../lib/format';
import { StudioButton, StudioCard } from './StudioPrimitives';

type Repayment = {
  id: string;
  bookingId: string;
  orderCode: string;
  customerName: string;
  workshopTitle: string;
  ticketNumber: number | null;
  amount: number | string;
  receivedAmount: number | string;
  dueAt: string | null;
  status: string;
  reason: string;
};
export function StudioRefundPanel({
  studioId,
  updated,
}: {
  studioId: string;
  bookings: unknown[];
  updated: () => Promise<unknown>;
}) {
  const client = useQueryClient();
  const [provider, setProvider] = useState<Record<string, string>>({});
  const [reference, setReference] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ['studio-refund-obligations', studioId],
    queryFn: () =>
      apiFetch<{ items: Repayment[] }>(
        `/studios/${studioId}/refund-obligations`,
      ).then((x) => x.items),
    refetchInterval: 60_000,
  });
  const mutation = useMutation({
    mutationFn: (r: Repayment) =>
      apiFetch(`/studios/${studioId}/refund-obligations/${r.id}/repayment`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(
            amount[r.id] ||
              Math.max(0, Number(r.amount) - Number(r.receivedAmount)),
          ),
          provider: provider[r.id] ?? '',
          reference: reference[r.id] ?? '',
          idempotencyKey: crypto.randomUUID(),
          reason:
            'Studio gửi thông tin chuyển khoản hoàn tiền về Open Slot để đối soát.',
        }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['studio-refund-obligations', studioId],
      });
      await updated();
    },
  });
  const rows = query.data ?? [];
  if (query.isLoading)
    return (
      <p className="text-sm text-stone-600">Đang tải các khoản cần chuyển…</p>
    );
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-brick">
        {query.error.message}
      </p>
    );
  if (!rows.length) return null;
  return (
    <StudioCard className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">
          Khoản cần chuyển về Open Slot
        </h2>
        <p className="mt-1 text-sm leading-6 text-stone-700">
          Studio chuyển khoản theo từng khoản dưới đây rồi gửi mã đối chiếu.
          Quản trị sẽ xác nhận đã nhận tiền trước khi Open Slot hoàn cho khách.
          Gửi thông tin ở đây chưa có nghĩa là tiền đã được xác nhận.
        </p>
      </div>
      {rows.map((r) => {
        const left = Math.max(0, Number(r.amount) - Number(r.receivedAmount));
        return (
          <div
            key={r.id}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>
                #{r.orderCode}
                {r.ticketNumber ? ` · Vé ${r.ticketNumber}` : ''} ·{' '}
                {r.workshopTitle}
              </strong>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
                {r.status === 'awaiting_approval'
                  ? 'Đang chờ đối soát'
                  : 'Cần chuyển'}
              </span>
            </div>
            <p>
              {r.customerName} · Còn cần chuyển{' '}
              <strong>{formatPrice(left)} đ</strong>
              {r.dueAt
                ? ` · Hạn ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' }).format(new Date(r.dueAt))}`
                : ''}
            </p>
            <p className="rounded-lg bg-cream px-3 py-2 text-stone-700">
              Lý do: {r.reason} · Khoản gốc {formatPrice(Number(r.amount))} đ ·
              Đã nhận {formatPrice(Number(r.receivedAmount))} đ
            </p>
            {r.status !== 'awaiting_approval' && left > 0 && (
              <>
                <label className="block">
                  Số tiền
                  <input
                    type="number"
                    min="1"
                    max={left}
                    value={amount[r.id] ?? left}
                    onChange={(e) =>
                      setAmount((x) => ({ ...x, [r.id]: e.target.value }))
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3"
                  />
                </label>
                <label className="block">
                  Ngân hàng hoặc nhà cung cấp
                  <input
                    value={provider[r.id] ?? ''}
                    onChange={(e) =>
                      setProvider((x) => ({ ...x, [r.id]: e.target.value }))
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3"
                    placeholder="Ví dụ: ngân hàng chuyển khoản"
                  />
                </label>
                <label className="block">
                  Mã đối chiếu giao dịch
                  <input
                    value={reference[r.id] ?? ''}
                    onChange={(e) =>
                      setReference((x) => ({ ...x, [r.id]: e.target.value }))
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3"
                  />
                </label>
                <StudioButton
                  disabled={
                    mutation.isPending ||
                    left <= 0 ||
                    (reference[r.id]?.trim().length ?? 0) < 3 ||
                    (provider[r.id]?.trim().length ?? 0) < 2
                  }
                  onClick={() => mutation.mutate(r)}
                >
                  {mutation.isPending
                    ? 'Đang gửi…'
                    : 'Gửi để Open Slot đối soát'}
                </StudioButton>
              </>
            )}
            {r.status === 'awaiting_approval' && (
              <p className="rounded-lg bg-cream px-3 py-2 text-stone-700">
                Đã nhận thông tin chuyển khoản. Chờ Open Slot đối soát.
              </p>
            )}
          </div>
        );
      })}
      {mutation.isError && (
        <p role="alert" className="text-sm text-brick">
          {mutation.error.message}
        </p>
      )}
    </StudioCard>
  );
}
