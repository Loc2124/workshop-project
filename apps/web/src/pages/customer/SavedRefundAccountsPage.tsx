import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  CreditCard,
  Plus,
  Trash2,
  ShieldCheck,
  ArrowLeft,
  Calendar,
  Building2,
  AlertCircle,
  X,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  VIETNAM_BANKS,
  getBankByBin,
  formatBankDisplay,
} from '@workshop/shared';

type SavedAccount = {
  id: string;
  bankBin: string;
  accountHolder: string;
  last4: string;
  createdAt: string;
};

const POPULAR_BINS = new Set([
  '970436', // Vietcombank
  '970415', // VietinBank
  '970418', // BIDV
  '970405', // Agribank
  '970422', // MBBank
  '970407', // Techcombank
  '970416', // ACB
  '970432', // VPBank
  '970423', // TPBank
  '970403', // Sacombank
  '970437', // HDBank
  '970441', // VIB
  '970443', // SHB
  '970426', // MSB
  '970448', // OCB
  '970449', // LPBank
  '970440', // SeABank
  '970431', // Eximbank
  '970428', // NamABank
]);

const DIGITAL_BINS = new Set([
  '546034', // Timo
  '546035', // Cake by VPBank
  '963369', // Viettel Money
  '971005', // VNPT Money
  '801012', // VNPAY
]);

const popularBanks = VIETNAM_BANKS.filter((b) => POPULAR_BINS.has(b.bin));
const digitalBanks = VIETNAM_BANKS.filter((b) => DIGITAL_BINS.has(b.bin));
const otherBanks = VIETNAM_BANKS.filter(
  (b) => !POPULAR_BINS.has(b.bin) && !DIGITAL_BINS.has(b.bin),
);

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SavedRefundAccountsPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const [selectedBin, setSelectedBin] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: accounts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['saved-refund-accounts'],
    queryFn: () =>
      apiFetch<{ items: SavedAccount[] }>('/me/refund-accounts').then(
        (res) => res.items,
      ),
  });

  const addAccountMutation = useMutation({
    mutationFn: () => {
      return apiFetch<{ item: SavedAccount }>('/me/refund-accounts', {
        method: 'POST',
        body: JSON.stringify({
          bankBin: selectedBin,
          accountHolder: accountHolder.trim().toUpperCase(),
          accountNumber: accountNumber.trim(),
          password,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Đã lưu tài khoản nhận hoàn tiền thành công.');
      setSelectedBin('');
      setAccountNumber('');
      setAccountHolder('');
      setPassword('');
      setFormError(null);
      setShowAddForm(false);
      await queryClient.invalidateQueries({
        queryKey: ['saved-refund-accounts'],
      });
    },
    onError: (err) => {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể thêm tài khoản. Vui lòng kiểm tra lại thông tin.';
      setFormError(msg);
      toast.error(msg);
    },
  });

  const removeAccountMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/refund-accounts/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Đã xóa tài khoản đã lưu.');
      setConfirmDeleteId(null);
      await queryClient.invalidateQueries({
        queryKey: ['saved-refund-accounts'],
      });
    },
    onError: (err) => {
      const msg =
        err instanceof Error
          ? err.message
          : 'Chưa xóa được tài khoản. Vui lòng thử lại.';
      toast.error(msg);
    },
  });

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedBin) {
      setFormError('Vui lòng chọn ngân hàng thụ hưởng.');
      return;
    }
    if (!accountNumber.trim() || accountNumber.trim().length < 4) {
      setFormError('Số tài khoản phải có từ 4 đến 30 chữ số.');
      return;
    }
    if (!accountHolder.trim() || accountHolder.trim().length < 2) {
      setFormError('Tên chủ tài khoản phải có ít nhất 2 ký tự.');
      return;
    }
    if (!password) {
      setFormError('Vui lòng nhập mật khẩu tài khoản Open Slot để xác nhận.');
      return;
    }

    addAccountMutation.mutate();
  };

  return (
    <PageContainer as="main" className="py-8 pb-20">
      {/* Navigation Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          to="/tai-khoan"
          className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Về trang tài khoản</span>
        </Link>
        <Link
          to="/me/bookings"
          className="text-primary hover:underline font-medium"
        >
          Xem lịch đặt của tôi
        </Link>
      </div>

      {/* Header & Title */}
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-porcelain/15 text-primary">
              <Wallet size={22} aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-ink sm:text-3xl">
              Tài khoản nhận hoàn tiền
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Lưu trước thông tin tài khoản ngân hàng để ban quản trị Open Slot
            trực tiếp đối soát và chuyển khoản hoàn tiền khi bạn hoặc studio hủy
            lịch theo chính sách.
          </p>
        </div>

        {!showAddForm && accounts.length < 10 && (
          <Button
            type="button"
            onClick={() => {
              setShowAddForm(true);
              setFormError(null);
            }}
            className="self-start sm:self-auto gap-2 shadow-sm"
          >
            <Plus size={18} aria-hidden="true" />
            <span>Thêm tài khoản mới</span>
          </Button>
        )}
      </div>

      {/* Security notice */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-900">
        <ShieldCheck
          size={20}
          className="mt-0.5 shrink-0 text-sky-600"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="font-semibold">Bảo mật thông tin tài chính cá nhân</p>
          <p className="text-xs sm:text-sm leading-relaxed text-sky-800">
            Số tài khoản của bạn được mã hóa an toàn theo tiêu chuẩn AES-256-GCM.
            Ban quản trị Open Slot chỉ sử dụng thông tin này để kiểm tra đối soát
            và thực hiện chuyển khoản hoàn tiền trực tiếp cho bạn khi có lịch hủy
            hợp lệ. Hệ thống chỉ hiển thị 4 số cuối để bảo vệ quyền riêng tư.
          </p>
        </div>
      </div>

      {/* Add Account Card / Form */}
      {showAddForm && (
        <section
          aria-labelledby="add-account-heading"
          className="mt-6 rounded-2xl border border-primary/20 bg-surface p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-lg bg-soft text-primary">
                <CreditCard size={18} aria-hidden="true" />
              </div>
              <h2
                id="add-account-heading"
                className="font-heading text-lg font-semibold text-ink"
              >
                Thêm tài khoản ngân hàng nhận hoàn tiền
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg p-1 text-muted hover:bg-soft hover:text-ink transition-colors"
              aria-label="Đóng biểu mẫu"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg bg-brick/10 p-3.5 text-sm text-brick"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Ngân hàng thụ hưởng */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="bank-select"
                  className="block text-sm font-medium text-ink"
                >
                  Ngân hàng thụ hưởng <span className="text-brick">*</span>
                </label>
                <select
                  id="bank-select"
                  required
                  value={selectedBin}
                  onChange={(e) => setSelectedBin(e.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">-- Chọn ngân hàng thụ hưởng --</option>
                  <optgroup label="Ngân hàng phổ biến">
                    {popularBanks.map((b) => (
                      <option key={b.bin} value={b.bin}>
                        {b.shortName} ({b.code}) — {b.name}
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
                        {b.shortName} ({b.code}) — {b.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Số tài khoản */}
              <div>
                <label
                  htmlFor="account-number"
                  className="block text-sm font-medium text-ink"
                >
                  Số tài khoản ngân hàng <span className="text-brick">*</span>
                </label>
                <Input
                  id="account-number"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{4,30}"
                  placeholder="Nhập số tài khoản"
                  value={accountNumber}
                  onChange={(e) =>
                    setAccountNumber(e.target.value.replace(/\s+/g, ''))
                  }
                  autoComplete="off"
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted">
                  Từ 4 đến 30 chữ số, không chứa ký tự đặc biệt.
                </p>
              </div>

              {/* Tên chủ tài khoản */}
              <div>
                <label
                  htmlFor="account-holder"
                  className="block text-sm font-medium text-ink"
                >
                  Tên chủ tài khoản <span className="text-brick">*</span>
                </label>
                <Input
                  id="account-holder"
                  required
                  maxLength={160}
                  placeholder="Ví dụ: NGUYEN VAN A"
                  value={accountHolder}
                  onChange={(e) =>
                    setAccountHolder(e.target.value.toUpperCase())
                  }
                  className="mt-1.5 uppercase tracking-wide"
                />
                <p className="mt-1 text-xs text-muted">
                  Viết hoa, đúng tên đăng ký tại ngân hàng.
                </p>
              </div>

              {/* Mật khẩu xác nhận */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-ink"
                >
                  Mật khẩu tài khoản Open Slot{' '}
                  <span className="text-brick">*</span>
                </label>
                <PasswordInput
                  id="confirm-password"
                  required
                  placeholder="Nhập mật khẩu hiện tại của bạn để bảo mật"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted">
                  Yêu cầu nhập mật khẩu tài khoản Open Slot để đảm bảo chỉ chính
                  bạn mới có thể thêm thông tin thanh toán.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={addAccountMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>
                  {addAccountMutation.isPending
                    ? 'Đang lưu tài khoản…'
                    : 'Lưu tài khoản'}
                </span>
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Account List Area */}
      <div className="mt-8">
        <div className="flex items-center justify-between pb-3">
          <h2 className="font-heading text-lg font-semibold text-ink">
            Danh sách tài khoản đã lưu
          </h2>
          <span className="text-xs font-medium text-muted">
            {accounts.length}/10 tài khoản
          </span>
        </div>

        {isLoading ? (
          <div className="py-12">
            <LoadingState label="Đang tải danh sách tài khoản…" variant="section" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-brick/30 bg-brick/5 p-6 text-center">
            <AlertCircle
              size={28}
              className="mx-auto text-brick"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-medium text-brick">
              Chưa tải được danh sách tài khoản.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="mt-4"
            >
              Thử lại
            </Button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center sm:p-12">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-soft text-muted">
              <CreditCard size={28} aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold text-ink">
              Bạn chưa lưu tài khoản nhận hoàn nào
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Lưu sẵn tài khoản ngân hàng giúp ban quản trị nhanh chóng đối
              chiếu và trực tiếp chuyển khoản hoàn tiền đến bạn khi có phát sinh
              hoàn hủy đơn đặt chỗ.
            </p>
            {!showAddForm && (
              <Button
                type="button"
                onClick={() => {
                  setShowAddForm(true);
                  setFormError(null);
                }}
                className="mt-5 gap-2"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Thêm tài khoản đầu tiên</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => {
              const bank = getBankByBin(account.bankBin);
              const isConfirming = confirmDeleteId === account.id;

              return (
                <article
                  key={account.id}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  {/* Card Header: Bank & Code */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-porcelain/15 text-primary font-bold">
                          <Building2 size={22} aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-ink">
                            {bank?.shortName || formatBankDisplay(account.bankBin)}
                          </h3>
                          <span className="inline-block rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                            {bank?.code || account.bankBin}
                          </span>
                        </div>
                      </div>

                      {/* Delete Trigger */}
                      {!isConfirming && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(account.id)}
                          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-brick/10 hover:text-brick transition-colors"
                          title="Xóa tài khoản này"
                          aria-label={`Xóa tài khoản đuôi ${account.last4}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {bank?.name && (
                      <p className="mt-2.5 line-clamp-1 text-xs text-muted" title={bank.name}>
                        {bank.name}
                      </p>
                    )}

                    {/* Account Details */}
                    <div className="mt-4 rounded-xl bg-soft/70 p-3.5 space-y-2">
                      <div>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
                          Số tài khoản
                        </span>
                        <p className="font-mono text-base font-bold tracking-wider text-ink">
                          •••• •••• •••• {account.last4}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
                          Chủ tài khoản
                        </span>
                        <p className="font-semibold uppercase tracking-wide text-ink text-sm">
                          {account.accountHolder}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Date & Delete confirmation */}
                  <div className="mt-4 pt-3 border-t border-line/60">
                    {isConfirming ? (
                      <div className="space-y-2 animate-in fade-in-50">
                        <p className="text-xs font-medium text-brick">
                          Xác nhận xóa tài khoản này?
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={removeAccountMutation.isPending}
                            onClick={() =>
                              removeAccountMutation.mutate(account.id)
                            }
                            className="flex-1 h-8 min-h-8 text-xs font-semibold"
                          >
                            {removeAccountMutation.isPending
                              ? 'Đang xóa…'
                              : 'Xác nhận xóa'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-8 min-h-8 px-3 text-xs"
                          >
                            Hủy
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <Calendar size={13} aria-hidden="true" />
                        <span>Đã lưu {formatDate(account.createdAt)}</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
