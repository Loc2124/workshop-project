import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { PageContainer } from '@/components/layout/PageContainer';
import { formatBankDisplay } from '@workshop/shared';

type SavedAccount = {
  id: string;
  bankBin: string;
  accountHolder: string;
  last4: string;
  createdAt: string;
};

export function SavedRefundAccountsPage() {
  const client = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const query = useQuery({
    queryKey: ['saved-refund-accounts'],
    queryFn: () =>
      apiFetch<{ items: SavedAccount[] }>('/me/refund-accounts').then(
        (result) => result.items,
      ),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/refund-accounts/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setConfirmId(null);
      setFeedback('Đã xóa tài khoản đã lưu.');
      await client.invalidateQueries({ queryKey: ['saved-refund-accounts'] });
    },
    onError: (error) =>
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Chưa xóa được tài khoản. Vui lòng thử lại.',
      ),
  });
  return (
    <PageContainer as="main" className="py-8 pb-16">
      <Link
        to="/me/bookings"
        className="text-sm font-semibold text-primary underline"
      >
        Về lịch đặt của tôi
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-semibold text-ink">
        Tài khoản nhận hoàn đã lưu
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">
        Đây là thông tin tài chính cá nhân. Open Slot chỉ dùng tài khoản đã lưu
        khi bạn chọn cho một khoản hoàn. Bạn có thể xóa bất cứ lúc nào; khoản
        hoàn đang xử lý vẫn giữ bản ghi riêng để đối soát.
      </p>
      {feedback && (
        <p role="status" className="mt-4 rounded-lg bg-soft p-3 text-sm">
          {feedback}
        </p>
      )}
      {query.isPending ? (
        <p className="mt-6">Đang tải tài khoản…</p>
      ) : query.isError ? (
        <p role="alert" className="mt-6 text-rose-800">
          Chưa tải được tài khoản. Vui lòng thử lại.
        </p>
      ) : !query.data.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          Bạn chưa lưu tài khoản nhận hoàn nào.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {query.data.map((account) => (
            <article
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4"
            >
              <div>
                <h2 className="font-semibold text-ink">
                  {formatBankDisplay(account.bankBin)} · ****{account.last4}
                </h2>
                <p className="text-sm text-stone-700">
                  {account.accountHolder}
                </p>
              </div>
              {confirmId === account.id ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="min-h-10 rounded-lg border border-stone-300 px-4 text-sm font-semibold"
                  >
                    Giữ lại
                  </button>
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(account.id)}
                    className="min-h-10 rounded-lg bg-rose-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Xác nhận xóa
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(account.id)}
                  className="min-h-10 rounded-lg border border-stone-400 px-4 text-sm font-semibold"
                >
                  Xóa tài khoản
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
