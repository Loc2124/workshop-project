import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { formatBankDisplay } from '@workshop/shared';

type Account = {
  id: string;
  status: 'pending' | 'verified';
  bankName?: string;
  bankBin?: string;
  accountHolder: string;
  last4: string;
  studioName?: string;
  orderCode?: string;
  refundId?: string;
  isCurrent?: boolean;
  source?: 'customer_input' | 'payment_source';
};
type Scope = 'studio' | 'refund';
const route = (scope: Scope) =>
  scope === 'studio'
    ? '/admin/tai-chinh/tai-khoan-studio'
    : '/admin/tai-chinh/tai-khoan-hoan';

export function AdminAccountVerificationPanel({ userId }: { userId?: string }) {
  const client = useQueryClient();
  const [reference, setReference] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const studio = useQuery({
    queryKey: ['private', userId, 'studio-bank-accounts'],
    queryFn: () =>
      apiFetch<{ items: Account[] }>(route('studio')).then(
        (result) => result.items,
      ),
  });
  const refund = useQuery({
    queryKey: ['private', userId, 'refund-bank-accounts'],
    queryFn: () =>
      apiFetch<{ items: Account[] }>(route('refund')).then(
        (result) => result.items,
      ),
  });
  const review = useMutation({
    mutationFn: ({
      scope,
      account,
      decision,
    }: {
      scope: Scope;
      account: Account;
      decision: 'verified' | 'rejected';
    }) =>
      apiFetch(`${route(scope)}/${account.id}/duyet`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          verificationReference: reference[account.id],
          reason: reason[account.id],
        }),
      }),
    onSuccess: async () => {
      setFeedback('Đã lưu kết quả đối chiếu tài khoản.');
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['private', userId, 'studio-bank-accounts'],
        }),
        client.invalidateQueries({
          queryKey: ['private', userId, 'refund-bank-accounts'],
        }),
      ]);
    },
    onError: (error) =>
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Chưa lưu được kết quả. Vui lòng thử lại.',
      ),
  });
  const reveal = useMutation({
    mutationFn: ({ scope, account }: { scope: Scope; account: Account }) =>
      apiFetch<{ accountNumber: string }>(
        `${route(scope)}/${account.id}/so-day-du`,
      ),
    onSuccess: (result, variables) =>
      setRevealed((state) => ({
        ...state,
        [variables.account.id]: result.accountNumber,
      })),
    onError: (error) =>
      setFeedback(
        error instanceof Error ? error.message : 'Chưa xem được số tài khoản.',
      ),
  });
  const render = (scope: Scope, accounts: Account[] | undefined) => (
    <section
      className="space-y-3"
      aria-label={
        scope === 'studio'
          ? 'Tài khoản nhận tiền studio'
          : 'Tài khoản nhận hoàn của khách'
      }
    >
      <h2 className="font-heading text-xl font-semibold text-ink">
        {scope === 'studio' ? 'Tài khoản studio' : 'Tài khoản hoàn cho khách'}
      </h2>
      {!accounts?.length ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Chưa có tài khoản cần xem.
        </p>
      ) : (
        accounts.map((account) => (
          <article
            key={account.id}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">
                  {scope === 'studio'
                    ? account.studioName
                    : `Đặt chỗ #${account.orderCode} · Khoản hoàn ${account.refundId?.slice(0, 8)}`}
                </h3>
                <p className="text-sm text-stone-700">
                  {formatBankDisplay(account.bankBin, account.bankName)} ·{' '}
                  {account.accountHolder} · ****{account.last4}
                </p>
                {scope === 'refund' && (
                  <p className="text-xs text-stone-600">
                    Nguồn:{' '}
                    {account.source === 'payment_source'
                      ? 'Từ giao dịch thanh toán'
                      : 'Khách tự nhập'}
                  </p>
                )}
              </div>
              <span
                className={`rounded-sm px-2.5 py-1 text-xs font-medium ${account.status === 'verified' ? 'bg-[#DCEFC8] text-[#2A4710]' : 'bg-[#FBE8B5] text-[#7A4B00]'}`}
              >
                {account.isCurrent === false
                  ? 'Đã thay đổi'
                  : account.status === 'verified'
                    ? 'Đã đối chiếu'
                    : 'Chờ đối chiếu'}
              </span>
            </div>
            <button
              type="button"
              disabled={reveal.isPending}
              onClick={() => {
                if (revealed[account.id])
                  setRevealed((state) => {
                    const next = { ...state };
                    delete next[account.id];
                    return next;
                  });
                else reveal.mutate({ scope, account });
              }}
              className="min-h-10 text-sm font-semibold text-primary underline disabled:opacity-50"
            >
              {revealed[account.id]
                ? 'Ẩn số tài khoản'
                : 'Xem số tài khoản để đối chiếu'}
            </button>
            {revealed[account.id] && (
              <p className="rounded-lg bg-soft p-3 font-semibold tabular-nums text-ink">
                {revealed[account.id]}
              </p>
            )}
            {account.status === 'pending' && account.isCurrent !== false && (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <label className="text-xs font-medium">
                  Mã chứng từ đối chiếu
                  <input
                    minLength={5}
                    maxLength={300}
                    placeholder="Tối thiểu 5 ký tự"
                    value={reference[account.id] ?? ''}
                    onChange={(event) =>
                      setReference((state) => ({
                        ...state,
                        [account.id]: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  Lý do / kết quả kiểm tra
                  <input
                    minLength={10}
                    maxLength={500}
                    placeholder="Tối thiểu 10 ký tự"
                    value={reason[account.id] ?? ''}
                    onChange={(event) =>
                      setReason((state) => ({
                        ...state,
                        [account.id]: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 px-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    review.isPending ||
                    (reference[account.id]?.trim().length ?? 0) < 5 ||
                    (reason[account.id]?.trim().length ?? 0) < 10
                  }
                  onClick={() =>
                    review.mutate({ scope, account, decision: 'verified' })
                  }
                  className="min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  Đã đối chiếu
                </button>
                <button
                  type="button"
                  disabled={
                    review.isPending ||
                    (reference[account.id]?.trim().length ?? 0) < 5 ||
                    (reason[account.id]?.trim().length ?? 0) < 10
                  }
                  onClick={() =>
                    review.mutate({ scope, account, decision: 'rejected' })
                  }
                  className="min-h-10 rounded-lg border border-stone-400 px-3 text-sm font-semibold hover:bg-soft disabled:opacity-50"
                >
                  Yêu cầu nhập lại
                </button>
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-stone-700">
        Kiểm tra tài khoản với chứng từ bên ngoài trước khi duyệt. Nếu khách
        hoặc studio đổi tài khoản, lệnh chi cũ phải được xử lý lại.
      </p>
      {feedback && (
        <p role="status" className="rounded-lg bg-soft p-3 text-sm">
          {feedback}
        </p>
      )}
      {studio.isPending || refund.isPending ? (
        <p>Đang tải tài khoản…</p>
      ) : studio.isError || refund.isError ? (
        <p role="alert" className="text-rose-800">
          Chưa tải được tài khoản. Vui lòng thử lại.
        </p>
      ) : (
        <>
          {render('studio', studio.data)}
          {render('refund', refund.data)}
        </>
      )}
    </div>
  );
}
