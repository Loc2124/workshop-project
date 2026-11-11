import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api-client';
import { formatPrice } from '../lib/format';
import { AdminSettlementPanel } from '../components/management/AdminSettlementPanel';
import { AdminAccountVerificationPanel } from '../components/management/AdminAccountVerificationPanel';

type Obligation = {
  id: string;
  bookingId: string;
  orderCode: string;
  studioId: string;
  studioName: string;
  ticketId: string | null;
  kind: 'customer_refund' | 'studio_payout' | 'studio_recovery';
  sourceKey: string;
  amount: number | string;
  settledAmount: number | string;
  reservedAmount: number | string;
  dueAt: string | null;
  status: string;
  reason: string;
  createdAt: string;
  dueState: 'overdue' | 'due_soon' | null;
};
type Transfer = {
  id: string;
  obligationId: string;
  kind: string;
  bookingId: string;
  orderCode: string;
  direction: 'inbound' | 'outbound';
  purpose: string;
  amount: number | string;
  providerFee: number | string | null;
  provider: string | null;
  reference: string | null;
  status: string;
  approvedAt: string | null;
  destinationBank: string | null;
  destinationName: string | null;
  destinationLast4: string | null;
  destinationValid: boolean | null;
  settledAt: string | null;
  failureReason: string | null;
  createdAt: string;
  dueAt: string | null;
  dueState: 'overdue' | 'due_soon' | null;
};
type TransferEvent = {
  id: number;
  event: string;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
};
type CalendarDay = {
  date: string;
  type: 'working' | 'non_working';
  label: string;
  officialReference: string;
  active: boolean;
  updatedAt: string;
};
type PaymentFee = {
  paymentId: string;
  bookingId: string;
  orderCode: string;
  studioId: string;
  studioName: string;
  workshopTitle: string;
  amount: number | string;
  provider: string;
  providerReference: string | null;
  paidAt: string | null;
};
const money = (value: number | string) =>
  `${formatPrice(Number(value) || 0)} đ`;
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Chưa đặt hạn';
const obligationName = (kind: string) =>
  kind === 'customer_refund'
    ? 'Hoàn cho khách'
    : kind === 'studio_recovery'
      ? 'Studio hoàn về Open Slot'
      : 'Chi studio';
const statusName = (value: string) =>
  ({
    awaiting_funds: 'Chờ tiền về',
    awaiting_approval: 'Chờ duyệt',
    approved: 'Đã duyệt',
    processing: 'Đang xử lý',
    partially_paid: 'Đã xử lý một phần',
    paid: 'Đã xử lý',
    failed: 'Thất bại',
    manual_review: 'Cần đối soát',
    cancelled: 'Đã dừng',
    pending_approval: 'Chờ duyệt',
    created: 'Đã lập giao dịch',
    submitted: 'Đã gửi giao dịch',
    recorded: 'Đã ghi nhận',
    succeeded: 'Thành công',
  })[value] ?? value;
const stateColor = (value: string) =>
  value === 'paid' || value === 'succeeded' || value === 'approved'
    ? 'bg-[#DCEFC8] text-[#2A4710]'
    : value === 'manual_review' || value === 'failed'
      ? 'bg-[#FCE0DB] text-[#9B2C1A]'
      : value === 'cancelled'
        ? 'bg-[#E8E4D8] text-[#4A453C]'
        : 'bg-[#FBE8B5] text-[#7A4B00]';
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-sm px-2.5 py-1 text-xs font-medium ${stateColor(value)}`}
    >
      {statusName(value)}
    </span>
  );
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

function TransferHistory({ id, userId }: { id: string; userId?: string }) {
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: ['private', userId, 'financial-transfer-history', id],
    queryFn: () =>
      apiFetch<{ items: TransferEvent[] }>(
        `/admin/tai-chinh/chuyen-tien/${id}/lich-su`,
      ).then((r) => r.items),
    enabled: open,
  });
  return (
    <details
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="border-t border-line pt-3 text-sm"
    >
      <summary className="min-h-9 cursor-pointer font-semibold text-primary">
        Lịch sử xử lý và mã đối chiếu
      </summary>
      {open &&
        (history.isPending ? (
          <p className="mt-2 text-stone-600">Đang tải lịch sử…</p>
        ) : history.isError ? (
          <p role="alert" className="mt-2 text-rose-800">
            Chưa tải được lịch sử. Vui lòng thử lại.
          </p>
        ) : (
          <ol className="mt-3 space-y-3 border-l-2 border-stone-200 pl-4">
            {history.data.map((item) => (
              <li key={item.id} className="space-y-1">
                <p className="font-semibold text-ink">
                  {statusName(item.event)} · {dateTime(item.createdAt)}
                </p>
                <p className="text-stone-700">
                  {item.actorName ?? 'Hệ thống'}
                  {typeof item.details.reason === 'string'
                    ? ` · ${item.details.reason}`
                    : ''}
                </p>
                {typeof item.details.reference === 'string' &&
                  item.details.reference && (
                    <p className="text-stone-700">
                      Mã đối chiếu: {item.details.reference}
                      {typeof item.details.provider === 'string'
                        ? ` · ${item.details.provider}`
                        : ''}
                    </p>
                  )}
                {typeof item.details.providerFee === 'number' && (
                  <p className="text-stone-700">
                    Phí thực tế: {money(item.details.providerFee)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ))}
    </details>
  );
}

export function AdminFinancialPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const [tab, setTab] = useState<
    | 'queue'
    | 'obligations'
    | 'transfers'
    | 'settlements'
    | 'accounts'
    | 'fees'
    | 'calendar'
  >('queue');
  const [selectedPurpose, setSelectedPurpose] = useState<
    Record<string, 'customer_refund' | 'platform_advance'>
  >({});
  const [transferAmounts, setTransferAmounts] = useState<
    Record<string, string>
  >({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [transferReason, setTransferReason] = useState<Record<string, string>>(
    {},
  );
  const [calendar, setCalendar] = useState({
    date: '',
    type: 'non_working' as CalendarDay['type'],
    label: '',
    officialReference: '',
  });
  const [transferDetails, setTransferDetails] = useState<
    Record<string, { provider: string; reference: string; fee: string }>
  >({});
  const [collectionFees, setCollectionFees] = useState<
    Record<string, { provider: string; reference: string; fee: string }>
  >({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<
    'all' | 'uncertain' | 'overdue' | 'due_soon' | 'failed'
  >('all');
  const obligations = useQuery({
    queryKey: ['private', userId, 'financial-obligations'],
    queryFn: () =>
      apiFetch<{ items: Obligation[] }>('/admin/tai-chinh/nghia-vu').then(
        (r) => r.items,
      ),
    refetchInterval: 60_000,
  });
  const transfers = useQuery({
    queryKey: ['private', userId, 'financial-transfers'],
    queryFn: () =>
      apiFetch<{ items: Transfer[] }>('/admin/tai-chinh/chuyen-tien').then(
        (r) => r.items,
      ),
    refetchInterval: 60_000,
  });
  const queue = useQuery({
    queryKey: ['private', userId, 'financial-transfer-queue'],
    queryFn: () =>
      apiFetch<{ items: Transfer[] }>(
        '/admin/tai-chinh/chuyen-tien?view=queue',
      ).then((r) => r.items),
    refetchInterval: 60_000,
  });
  const days = useQuery({
    queryKey: ['private', userId, 'financial-calendar'],
    queryFn: () =>
      apiFetch<{ items: CalendarDay[] }>('/admin/tai-chinh/lich-nghi').then(
        (r) => r.items,
      ),
  });
  const fees = useQuery({
    queryKey: ['private', userId, 'financial-collection-fees'],
    queryFn: () =>
      apiFetch<{ items: PaymentFee[] }>('/admin/tai-chinh/phi-thu').then(
        (r) => r.items,
      ),
    refetchInterval: 60_000,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-obligations'],
      }),
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-transfers'],
      }),
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-transfer-queue'],
      }),
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-calendar'],
      }),
    ]);
  };
  const createTransfer = useMutation({
    mutationFn: ({ o, purpose }: { o: Obligation; purpose: string }) =>
      apiFetch(`/admin/tai-chinh/nghia-vu/${o.id}/chuyen-tien`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(
            transferAmounts[o.id] ||
              Math.max(
                0,
                Number(o.amount) -
                  Number(o.settledAmount) -
                  Number(o.reservedAmount),
              ),
          ),
          purpose,
          idempotencyKey: crypto.randomUUID(),
          reason:
            reason[o.id]?.trim() ||
            'Quản trị lập giao dịch theo nghĩa vụ đã ghi nhận.',
        }),
      }),
    onSuccess: async () => {
      setFeedback('Đã lập giao dịch và chuyển vào hàng chờ duyệt.');
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });
  const approve = useMutation({
    mutationFn: (t: Transfer) =>
      apiFetch(`/admin/tai-chinh/chuyen-tien/${t.id}/duyet`, {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Đã đối chiếu nghĩa vụ và phê duyệt giao dịch.',
        }),
      }),
    onSuccess: async () => {
      setFeedback('Đã duyệt. Giao dịch chưa được xem là đã chuyển.');
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });
  const result = useMutation({
    mutationFn: ({
      t,
      outcome,
    }: {
      t: Transfer;
      outcome: 'succeeded' | 'failed' | 'manual_review';
    }) => {
      const d = transferDetails[t.id] ?? {
        provider: t.provider ?? '',
        reference: t.reference ?? '',
        fee: '',
      };
      return apiFetch(`/admin/tai-chinh/chuyen-tien/${t.id}/ghi-nhan-ket-qua`, {
        method: 'POST',
        body: JSON.stringify({
          result: outcome,
          reason:
            outcome === 'succeeded'
              ? 'Đã đối chiếu kết quả và phí thực tế với chứng từ.'
              : transferReason[t.id]?.trim() || '',
          ...(outcome === 'succeeded'
            ? {
                provider: d.provider,
                reference: d.reference,
                providerFee: Number(d.fee),
              }
            : {}),
        }),
      });
    },
    onSuccess: async (_r, v) => {
      setFeedback(
        v.outcome === 'succeeded'
          ? 'Đã ghi nhận giao dịch thành công.'
          : 'Đã cập nhật kết quả giao dịch.',
      );
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });
  const saveDay = useMutation({
    mutationFn: () =>
      apiFetch('/admin/tai-chinh/lich-nghi', {
        method: 'POST',
        body: JSON.stringify(calendar),
      }),
    onSuccess: async () => {
      setFeedback('Đã lưu ngoại lệ lịch nhà nước.');
      setCalendar({
        date: '',
        type: 'non_working',
        label: '',
        officialReference: '',
      });
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });
  const disableDay = useMutation({
    mutationFn: (date: string) =>
      apiFetch(`/admin/tai-chinh/lich-nghi/${date}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setFeedback('Đã ngừng áp dụng ngày này.');
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });
  const recordCollectionFee = useMutation({
    mutationFn: (p: PaymentFee) => {
      const v = collectionFees[p.paymentId] ?? {
        provider: p.provider,
        reference: p.providerReference ?? '',
        fee: '',
      };
      return apiFetch(`/admin/tai-chinh/payments/${p.paymentId}/phi-thu`, {
        method: 'POST',
        body: JSON.stringify({
          providerFee: Number(v.fee),
          provider: v.provider,
          providerReference: v.reference,
          reason:
            'Đối chiếu phí thực tế với báo cáo giao dịch của nhà cung cấp.',
        }),
      });
    },
    onSuccess: async () => {
      setFeedback(
        'Đã ghi nhận phí thật. Phí được tính vào khoản chi của đúng buổi học; nếu khoản chi đã hoàn tất, studio cần chuyển bù riêng cho buổi đó.',
      );
      await refresh();
      await client.invalidateQueries({
        queryKey: ['private', userId, 'financial-collection-fees'],
      });
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const activeTransfers = tab === 'queue' ? queue : transfers;
  const displayedTransfers = activeTransfers.data?.filter(
    (t) =>
      tab !== 'queue' ||
      queueFilter === 'all' ||
      (queueFilter === 'uncertain' && t.status === 'manual_review') ||
      (queueFilter === 'failed' && t.status === 'failed') ||
      (queueFilter === 'overdue' && t.dueState === 'overdue') ||
      (queueFilter === 'due_soon' && t.dueState === 'due_soon'),
  );

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
          Vận hành
        </p>
        <h1 className="font-heading text-2xl font-semibold text-ink">
          Tài chính & quyết toán
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          Theo dõi hạn hoàn, khoản studio cần chuyển về Open Slot và từng lần
          chuyển. Mọi khoản chuyển cần duyệt; ghi nhận thành công phải có mã đối
          chiếu, nhà cung cấp và phí thực tế.
        </p>
      </header>
      <nav
        aria-label="Các mục tài chính"
        className="flex gap-2 overflow-x-auto border-b border-line"
      >
        {(
          [
            ['queue', 'Cần đối soát'],
            ['obligations', 'Nghĩa vụ'],
            ['transfers', 'Giao dịch'],
            ['settlements', 'Đối soát chi'],
            ['accounts', 'Tài khoản nhận'],
            ['fees', 'Phí thu'],
            ['calendar', 'Lịch nhà nước'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {feedback && (
        <p
          role="status"
          className="rounded-lg bg-soft px-4 py-3 text-sm text-ink"
        >
          {feedback}
        </p>
      )}
      {tab === 'settlements' && <AdminSettlementPanel userId={userId} />}
      {tab === 'accounts' && <AdminAccountVerificationPanel userId={userId} />}
      {tab === 'obligations' && (
        <section className="space-y-4" aria-label="Nghĩa vụ tài chính">
          {obligations.isLoading ? (
            <p>Đang tải nghĩa vụ…</p>
          ) : obligations.isError ? (
            <p role="alert" className="text-brick">
              {errorMessage(obligations.error)}
            </p>
          ) : !obligations.data?.length ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
              Chưa có khoản nào cần xử lý.
            </div>
          ) : (
            obligations.data.map((o) => {
              const remaining = Math.max(
                0,
                Number(o.amount) -
                  Number(o.settledAmount) -
                  Number(o.reservedAmount),
              );
              return (
                <article
                  key={o.id}
                  className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:p-5"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-lg font-semibold text-ink">
                        {obligationName(o.kind)}
                      </h2>
                      <Badge value={o.status} />
                      {o.dueState && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${o.dueState === 'overdue' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-950'}`}
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
                  </div>
                  {remaining > 0 &&
                    o.status !== 'manual_review' &&
                    o.status !== 'cancelled' &&
                    o.status !== 'paid' && (
                      <div className="w-full space-y-2 md:max-w-xs">
                        {o.kind === 'customer_refund' && (
                          <label className="block text-xs font-medium">
                            Loại chi
                            <select
                              value={selectedPurpose[o.id] ?? 'customer_refund'}
                              onChange={(e) =>
                                setSelectedPurpose((x) => ({
                                  ...x,
                                  [o.id]: e.target.value as
                                    'customer_refund' | 'platform_advance',
                                }))
                              }
                              className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                            >
                              <option value="customer_refund">
                                Hoàn từ tiền studio đã gửi
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
                              setTransferAmounts((x) => ({
                                ...x,
                                [o.id]: e.target.value,
                              }))
                            }
                            className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                          />
                        </label>
                        <label className="block text-xs font-medium">
                          Lý do
                          <textarea
                            value={reason[o.id] ?? ''}
                            onChange={(e) =>
                              setReason((x) => ({
                                ...x,
                                [o.id]: e.target.value,
                              }))
                            }
                            className="mt-1 min-h-16 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                            placeholder="Ghi căn cứ lập giao dịch (tối thiểu 10 ký tự nếu nhập)"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            createTransfer.mutate({
                              o,
                              purpose:
                                o.kind === 'customer_refund'
                                  ? (selectedPurpose[o.id] ?? 'customer_refund')
                                  : o.kind === 'studio_recovery'
                                    ? 'studio_repayment'
                                    : 'studio_payout',
                            })
                          }
                          disabled={
                            createTransfer.isPending ||
                            remaining <= 0 ||
                            (Boolean(reason[o.id]?.trim()) &&
                              (reason[o.id]?.trim().length ?? 0) < 10)
                          }
                          className="min-h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                        >
                          Lập giao dịch chờ duyệt
                        </button>
                      </div>
                    )}
                </article>
              );
            })
          )}
        </section>
      )}
      {(tab === 'queue' || tab === 'transfers') && (
        <section
          className="space-y-4"
          aria-label={
            tab === 'queue' ? 'Hàng chờ đối soát' : 'Lịch sử giao dịch'
          }
        >
          {tab === 'queue' && (
            <div className="rounded-xl border border-line bg-soft p-4">
              <h2 className="font-heading text-lg font-semibold text-ink">
                Khoản cần xử lý
              </h2>
              <p className="mt-1 text-sm text-stone-700">
                Ưu tiên khoản quá hạn, chưa rõ kết quả và sắp đến hạn. Giao dịch
                chưa rõ kết quả vẫn giữ tiền để tránh chi trùng.
              </p>
              {Boolean(
                obligations.data?.some(
                  (o) => o.dueState && o.status !== 'manual_review',
                ),
              ) && (
                <button
                  type="button"
                  onClick={() => setTab('obligations')}
                  className="mt-2 min-h-10 rounded-lg border border-primary bg-surface px-3 text-sm font-semibold text-primary hover:bg-paper"
                >
                  Xem nghĩa vụ sắp hoặc đã quá hạn
                </button>
              )}
              {Boolean(obligations.data?.some((o) => o.dueState)) && (
                <ul className="mt-3 space-y-2">
                  {obligations.data
                    ?.filter((o) => o.dueState)
                    .slice(0, 5)
                    .map((o) => (
                      <li
                        key={o.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        <span>
                          <strong>#{o.orderCode}</strong> ·{' '}
                          {obligationName(o.kind)} ·{' '}
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
                              : 'font-semibold text-amber-900'
                          }
                        >
                          {o.dueState === 'overdue' ? 'Quá hạn' : 'Sắp đến hạn'}{' '}
                          · {dateTime(o.dueAt)}
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
                    onClick={() => setQueueFilter(key)}
                    className={`min-h-10 rounded-full border px-3 text-sm font-medium ${queueFilter === key ? 'border-primary bg-primary text-white' : 'border-stone-300 bg-white text-ink hover:bg-paper'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeTransfers.isLoading ? (
            <p>Đang tải giao dịch…</p>
          ) : activeTransfers.isError ? (
            <p role="alert" className="text-brick">
              {errorMessage(activeTransfers.error)}
            </p>
          ) : !displayedTransfers?.length ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
              {tab === 'queue'
                ? 'Không có giao dịch cần xử lý theo bộ lọc này.'
                : 'Chưa có giao dịch nào.'}
            </div>
          ) : (
            displayedTransfers.map((t) => (
              <article
                key={t.id}
                className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg font-semibold">
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
                  <Badge value={t.status} />
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
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${t.dueState === 'overdue' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-950'}`}
                    >
                      {t.dueState === 'overdue' ? 'Quá hạn' : 'Sắp đến hạn'}
                    </span>
                  )}
                </div>
                {t.destinationLast4 && (
                  <p
                    className={`text-sm ${t.destinationValid === false && t.status !== 'succeeded' ? 'font-semibold text-rose-800' : 'text-stone-700'}`}
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
                    Chưa rõ tiền đã chuyển hay chưa. Đối chiếu với ngân hàng
                    trước khi ghi nhận kết quả; không lập giao dịch khác cho
                    khoản này.
                  </p>
                )}
                {t.status === 'failed' && (
                  <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
                    <p>
                      Đã xác nhận chuyển thất bại. Có thể lập giao dịch mới từ
                      khoản còn phải xử lý.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('obligations')}
                      className="min-h-9 font-semibold text-primary underline"
                    >
                      Xem khoản cần xử lý
                    </button>
                  </div>
                )}
                {t.status === 'pending_approval' && (
                  <button
                    type="button"
                    onClick={() => approve.mutate(t)}
                    disabled={approve.isPending}
                    className="min-h-10 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft disabled:opacity-50"
                  >
                    Duyệt giao dịch
                  </button>
                )}
                {['approved', 'manual_review'].includes(t.status) && (
                  <div className="grid gap-2 rounded-lg bg-soft p-3 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
                    <label className="text-xs font-medium">
                      Nhà cung cấp
                      <input
                        value={
                          transferDetails[t.id]?.provider ?? t.provider ?? ''
                        }
                        onChange={(e) =>
                          setTransferDetails((x) => ({
                            ...x,
                            [t.id]: {
                              provider: e.target.value,
                              reference:
                                x[t.id]?.reference ?? t.reference ?? '',
                              fee: x[t.id]?.fee ?? '',
                            },
                          }))
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
                          setTransferDetails((x) => ({
                            ...x,
                            [t.id]: {
                              provider: x[t.id]?.provider ?? t.provider ?? '',
                              reference: e.target.value,
                              fee: x[t.id]?.fee ?? '',
                            },
                          }))
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
                          setTransferDetails((x) => ({
                            ...x,
                            [t.id]: {
                              provider: x[t.id]?.provider ?? t.provider ?? '',
                              reference:
                                x[t.id]?.reference ?? t.reference ?? '',
                              fee: e.target.value,
                            },
                          }))
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => result.mutate({ t, outcome: 'succeeded' })}
                      disabled={
                        result.isPending ||
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
                          setTransferReason((x) => ({
                            ...x,
                            [t.id]: e.target.value,
                          }))
                        }
                        minLength={10}
                        maxLength={500}
                        className="mt-1 min-h-16 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                        placeholder="Ghi căn cứ đối chiếu với ngân hàng"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => result.mutate({ t, outcome: 'failed' })}
                      disabled={
                        result.isPending ||
                        (transferReason[t.id]?.trim().length ?? 0) < 10
                      }
                      className="min-h-10 rounded-lg border border-stone-400 px-4 text-sm font-semibold disabled:opacity-50"
                    >
                      Chuyển thất bại
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        result.mutate({ t, outcome: 'manual_review' })
                      }
                      disabled={
                        result.isPending ||
                        (transferReason[t.id]?.trim().length ?? 0) < 10
                      }
                      className="min-h-10 rounded-lg border border-amber-600 px-4 text-sm font-semibold text-amber-950 disabled:opacity-50"
                    >
                      Chưa rõ kết quả
                    </button>
                  </div>
                )}
                <TransferHistory id={t.id} userId={userId} />
              </article>
            ))
          )}
        </section>
      )}
      {tab === 'fees' && (
        <section className="space-y-4" aria-label="Đối soát phí thu tiền cọc">
          <p className="max-w-3xl text-sm leading-6 text-stone-700">
            Nhập phí thật theo báo cáo từng giao dịch đã xác nhận. Phí được khấu
            trừ vào khoản chi của cùng buổi học. Nếu khoản chi đã hoàn tất, phần
            phí phát sinh được theo dõi riêng cho studio và buổi đó.
          </p>
          {fees.isLoading ? (
            <p>Đang tải khoản thu…</p>
          ) : fees.isError ? (
            <p role="alert" className="text-brick">
              {errorMessage(fees.error)}
            </p>
          ) : !fees.data?.length ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
              Đã đối soát phí cho tất cả khoản cọc đã nhận.
            </div>
          ) : (
            fees.data.map((p) => {
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
                    <h2 className="font-heading text-lg font-semibold">
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
                        setCollectionFees((x) => ({
                          ...x,
                          [p.paymentId]: { ...v, provider: e.target.value },
                        }))
                      }
                      className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium">
                    Mã giao dịch
                    <input
                      value={v.reference}
                      onChange={(e) =>
                        setCollectionFees((x) => ({
                          ...x,
                          [p.paymentId]: { ...v, reference: e.target.value },
                        }))
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
                        setCollectionFees((x) => ({
                          ...x,
                          [p.paymentId]: { ...v, fee: e.target.value },
                        }))
                      }
                      className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => recordCollectionFee.mutate(p)}
                    disabled={
                      recordCollectionFee.isPending ||
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
      )}
      {tab === 'calendar' && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveDay.mutate();
            }}
            className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <h2 className="font-heading text-xl font-semibold">
              Thêm lịch theo thông báo nhà nước
            </h2>
            <label className="block text-sm font-medium">
              Ngày
              <input
                required
                type="date"
                value={calendar.date}
                onChange={(e) =>
                  setCalendar((x) => ({ ...x, date: e.target.value }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Loại ngày
              <select
                value={calendar.type}
                onChange={(e) =>
                  setCalendar((x) => ({
                    ...x,
                    type: e.target.value as CalendarDay['type'],
                  }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
              >
                <option value="non_working">Ngày nghỉ/nghỉ bù</option>
                <option value="working">Ngày đi làm bù</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Tên ngày
              <input
                required
                minLength={2}
                value={calendar.label}
                onChange={(e) =>
                  setCalendar((x) => ({ ...x, label: e.target.value }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
                placeholder="Ví dụ: Nghỉ Tết Âm lịch"
              />
            </label>
            <label className="block text-sm font-medium">
              Căn cứ/văn bản chính thức
              <input
                required
                minLength={4}
                value={calendar.officialReference}
                onChange={(e) =>
                  setCalendar((x) => ({
                    ...x,
                    officialReference: e.target.value,
                  }))
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
                placeholder="Số thông báo hoặc liên kết nguồn chính thức"
              />
            </label>
            <button
              disabled={saveDay.isPending}
              className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {saveDay.isPending ? 'Đang lưu…' : 'Lưu ngày'}
            </button>
          </form>
          <div className="space-y-3">
            <h2 className="font-heading text-xl font-semibold">
              Các ngày đã khai báo
            </h2>
            {days.isLoading ? (
              <p>Đang tải lịch…</p>
            ) : days.isError ? (
              <p role="alert" className="text-brick">
                {errorMessage(days.error)}
              </p>
            ) : (
              days.data
                ?.filter((d) => d.active)
                .map((d) => (
                  <article
                    key={d.date}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-semibold">
                        {d.date.split('-').reverse().join('/')} · {d.label}
                      </p>
                      <p className="text-sm text-stone-600">
                        {d.type === 'working' ? 'Ngày làm bù' : 'Ngày nghỉ'} ·{' '}
                        {d.officialReference}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => disableDay.mutate(d.date)}
                      disabled={disableDay.isPending}
                      className="min-h-10 rounded-lg border border-stone-300 px-3 text-sm font-medium"
                    >
                      Ngừng áp dụng
                    </button>
                  </article>
                ))
            )}
            {!days.data?.some((d) => d.active) && (
              <p className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
                Chưa khai báo ngày ngoại lệ cho lịch nhà nước.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
