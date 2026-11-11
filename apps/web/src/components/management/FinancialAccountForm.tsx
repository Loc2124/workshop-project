import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { Link } from 'react-router-dom';
import {
  VIETNAM_BANKS,
  formatBankDisplay,
  getBankByBin,
} from '@workshop/shared';

type Account = {
  id: string;
  bankName?: string;
  bankBin?: string;
  accountHolder: string;
  last4: string;
  status: 'pending' | 'verified' | 'rejected';
  isCurrent: boolean;
  createdAt: string;
};
type Response = { enabled: boolean; items: Account[] };
type SavedAccount = {
  id: string;
  bankBin: string;
  accountHolder: string;
  last4: string;
};

const POPULAR_BINS = new Set([
  '970436', '970415', '970418', '970405', '970422', '970407',
  '970416', '970432', '970423', '970403', '970437', '970441',
  '970443', '970426', '970448', '970449', '970440', '970431', '970428',
]);
const DIGITAL_BINS = new Set(['546034', '546035', '963369', '971005', '801012']);

const popularBanks = VIETNAM_BANKS.filter((b) => POPULAR_BINS.has(b.bin));
const digitalBanks = VIETNAM_BANKS.filter((b) => DIGITAL_BINS.has(b.bin));
const otherBanks = VIETNAM_BANKS.filter(
  (b) => !POPULAR_BINS.has(b.bin) && !DIGITAL_BINS.has(b.bin),
);

export function FinancialAccountForm({
  endpoint,
  title,
  description,
  refund = false,
}: {
  endpoint: string;
  title: string;
  description: string;
  refund?: boolean;
}) {
  const client = useQueryClient();
  const [selectedBin, setSelectedBin] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [saveForLater, setSaveForLater] = useState(false);
  const [savedSelected, setSavedSelected] = useState('');
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['financial-account', endpoint],
    queryFn: () => apiFetch<Response>(endpoint),
  });
  const savedAccounts = useQuery({
    queryKey: ['saved-refund-accounts'],
    queryFn: () =>
      apiFetch<{ items: SavedAccount[] }>('/me/refund-accounts').then(
        (result) => result.items,
      ),
    enabled: refund,
  });
  const save = useMutation({
    mutationFn: () => {
      const bank = getBankByBin(selectedBin);
      const bankDisplayName = bank
        ? `${bank.shortName} (${bank.code})`
        : selectedBin;
      return apiFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
          ...(refund
            ? { bankBin: selectedBin }
            : { bankName: bankDisplayName, bankBin: selectedBin }),
          accountHolder: accountHolder.trim(),
          accountNumber,
          password,
          ...(refund ? { saveForLater } : {}),
        }),
      });
    },
    onSuccess: async () => {
      setMessage(
        'Đã gửi tài khoản. Quản trị sẽ đối chiếu trước khi chuyển tiền.',
      );
      setAccountNumber('');
      setPassword('');
      setSaveForLater(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['financial-account', endpoint] }),
        client.invalidateQueries({ queryKey: ['saved-refund-accounts'] }),
      ]);
    },
    onError: (error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : 'Chưa lưu được tài khoản. Vui lòng thử lại.',
      ),
  });
  const reuse = useMutation({
    mutationFn: () =>
      apiFetch(`${endpoint}/from-saved`, {
        method: 'POST',
        body: JSON.stringify({ savedAccountId: savedSelected, password }),
      }),
    onSuccess: async () => {
      setMessage(
        'Đã chọn tài khoản đã lưu cho khoản hoàn này. Quản trị sẽ đối chiếu trước khi chuyển tiền.',
      );
      setPassword('');
      setSavedSelected('');
      await client.invalidateQueries({
        queryKey: ['financial-account', endpoint],
      });
    },
    onError: (error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : 'Chưa dùng được tài khoản đã lưu.',
      ),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  const current = query.data?.items.find((item) => item.isCurrent);
  return (
    <section
      className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5"
      aria-label={title}
    >
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-stone-700">{description}</p>
      {refund && (
        <p className="mt-1 text-sm leading-6 text-stone-700">
          Số tài khoản ngân hàng là thông tin tài chính cá nhân. Open Slot chỉ
          dùng để hoàn tiền. Bản gắn với khoản hoàn này sẽ được xóa số đầy đủ
          sau khi hoàn thành và qua 7 ngày; chúng tôi chỉ giữ 4 số cuối để đối
          chiếu.
        </p>
      )}
      {query.isPending ? (
        <p className="mt-3 text-sm">Đang tải tài khoản…</p>
      ) : query.isError ? (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          Chưa tải được tài khoản.
        </p>
      ) : (
        <>
          {current && (
            <p className="mt-3 rounded-lg bg-soft px-3 py-2 text-sm text-ink">
              {formatBankDisplay(current.bankBin, current.bankName)} · ****
              {current.last4} ·{' '}
              {current.status === 'verified'
                ? 'Đã đối chiếu'
                : current.status === 'rejected'
                  ? 'Cần nhập lại'
                  : 'Đang chờ đối chiếu'}
            </p>
          )}
          {!query.data?.enabled ? (
            <p role="status" className="mt-3 text-sm text-rose-800">
              Chức năng lưu tài khoản chưa sẵn sàng. Vui lòng liên hệ Open Slot.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">
                Ngân hàng thụ hưởng
                <select
                  required
                  value={selectedBin}
                  onChange={(event) => setSelectedBin(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
                >
                  <option value="">-- Chọn ngân hàng --</option>
                  <optgroup label="Ngân hàng phổ biến">
                    {popularBanks.map((b) => (
                      <option key={b.bin} value={b.bin}>
                        {b.shortName} ({b.code}) - {b.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ngân hàng số & Ví điện tử">
                    {digitalBanks.map((b) => (
                      <option key={b.bin} value={b.bin}>
                        {b.shortName} ({b.code})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Các ngân hàng khác">
                    {otherBanks.map((b) => (
                      <option key={b.bin} value={b.bin}>
                        {b.shortName} ({b.code}) - {b.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label className="text-sm font-medium">
                Số tài khoản
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{4,30}"
                  placeholder="Nhập số tài khoản ngân hàng"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  autoComplete="off"
                  className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3"
                />
              </label>

              <label className="text-sm font-medium">
                Tên chủ tài khoản
                <input
                  required
                  maxLength={160}
                  placeholder="Ví dụ: NGUYEN VAN A"
                  value={accountHolder}
                  onChange={(event) =>
                    setAccountHolder(event.target.value.toUpperCase())
                  }
                  className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3 uppercase"
                />
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Mật khẩu tài khoản Open Slot
                <input
                  required
                  type="password"
                  placeholder="Xác nhận mật khẩu đăng nhập để lưu"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="mt-1 min-h-11 w-full rounded-lg border border-stone-300 px-3"
                />
              </label>

              {refund && (
                <label className="flex items-start gap-3 text-sm text-stone-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={saveForLater}
                    onChange={(event) => setSaveForLater(event.target.checked)}
                    className="mt-1 size-4"
                  />
                  <span>
                    Lưu tài khoản này cho các lần hoàn sau. Mặc định không lưu;
                    nếu chọn, chúng tôi giữ tài khoản đến khi bạn xóa trong mục
                    Tài khoản nhận hoàn.
                  </span>
                </label>
              )}

              <button
                disabled={save.isPending || !selectedBin}
                className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-50 sm:col-span-2"
              >
                {save.isPending
                  ? 'Đang lưu…'
                  : current
                    ? 'Đổi tài khoản nhận tiền'
                    : 'Lưu tài khoản nhận tiền'}
              </button>
            </form>
          )}
          {refund &&
            query.data?.enabled &&
            Boolean(savedAccounts.data?.length) && (
              <div className="mt-4 border-t border-stone-200 pt-4">
                <p className="text-sm font-semibold">Dùng tài khoản đã lưu</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    aria-label="Chọn tài khoản đã lưu"
                    value={savedSelected}
                    onChange={(event) => setSavedSelected(event.target.value)}
                    className="min-h-11 min-w-52 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm"
                  >
                    <option value="">Chọn tài khoản</option>
                    {savedAccounts.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatBankDisplay(item.bankBin)} · ****{item.last4}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!savedSelected || !password || reuse.isPending}
                    onClick={() => reuse.mutate()}
                    className="min-h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft disabled:opacity-50"
                  >
                    Dùng cho khoản hoàn này
                  </button>
                </div>
                <p className="mt-2 text-xs text-stone-600">
                  Nhập mật khẩu ở trên trước khi chọn tài khoản đã lưu.
                </p>
              </div>
            )}
          {refund && (
            <Link
              to="/me/refund-accounts"
              className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline"
            >
              Quản lý tài khoản đã lưu
            </Link>
          )}
          {message && (
            <p role="status" className="mt-3 text-sm text-ink">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
