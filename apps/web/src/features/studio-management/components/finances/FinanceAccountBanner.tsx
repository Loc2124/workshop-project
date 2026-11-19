import { Building2, AlertCircle, CreditCard, Info } from 'lucide-react';
import { formatBankDisplay } from '@workshop/shared';
import { StudioBadge, StudioButton } from '../StudioPrimitives';

export type CurrentAccount = {
  id: string;
  bankName: string | null;
  bankBin: string | null;
  accountHolder: string;
  last4: string;
  status: 'pending' | 'verified' | 'rejected';
} | null;

interface FinanceAccountBannerProps {
  currentAccount: CurrentAccount;
  onSelectAccountTab: () => void;
}

export function FinanceAccountBanner({
  currentAccount,
  onSelectAccountTab,
}: FinanceAccountBannerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="rounded-studio-card border border-studio-border bg-studio-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-studio-subtle p-2.5 text-studio-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
                Tài khoản nhận tiền quyết toán
              </p>
              {currentAccount ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-studio-ink text-sm">
                    {formatBankDisplay(
                      currentAccount.bankBin,
                      currentAccount.bankName,
                    )}{' '}
                    · ****{currentAccount.last4}
                  </span>
                  <span className="text-xs text-studio-muted">
                    ({currentAccount.accountHolder})
                  </span>
                  <StudioBadge
                    tone={
                      currentAccount.status === 'verified'
                        ? 'success'
                        : currentAccount.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                    }
                    className="text-xs py-0.2"
                  >
                    {currentAccount.status === 'verified'
                      ? 'Đã xác minh'
                      : currentAccount.status === 'rejected'
                        ? 'Cần nhập lại'
                        : 'Chờ đối chiếu'}
                  </StudioBadge>
                </div>
              ) : (
                <p className="mt-0.5 text-xs font-medium text-amber-700 flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  Chưa cài đặt tài khoản nhận tiền.
                </p>
              )}
            </div>
          </div>
          <StudioButton
            variant="secondary"
            size="sm"
            onClick={onSelectAccountTab}
            className="shrink-0 min-h-11 sm:min-h-9"
          >
            <CreditCard className="size-3.5 mr-1" />
            {currentAccount ? 'Đổi tài khoản' : 'Thêm tài khoản'}
          </StudioButton>
        </div>
      </div>

      {/* Hướng dẫn cơ chế thanh toán sàn */}
      <details className="group rounded-studio-card border border-studio-border bg-studio-surface p-4 text-xs transition-colors hover:border-studio-primary/40 open:bg-studio-selected/30">
        <summary className="flex cursor-pointer items-center justify-between gap-2 font-semibold text-studio-primary outline-none">
          <span className="flex items-center gap-1.5">
            <Info className="size-3.5" />
            Cơ chế thanh toán sàn
          </span>
        </summary>
        <div className="mt-3 space-y-1.5 border-t border-studio-border pt-2 text-studio-muted leading-relaxed max-w-sm">
          <p>
            1. <strong>Cọc PayOS:</strong> Khách quét QR sàn giữ chỗ chắc chắn.
          </p>
          <p>
            2. <strong>Quyết toán tự động:</strong> Sàn đối soát &amp; chuyển
            khoản sau khi buổi học xong (1-3 ngày làm việc).
          </p>
          <p>
            3. <strong>Thu tại studio:</strong> Phần tiền còn lại khách trả trực
            tiếp cho studio tại buổi.
          </p>
        </div>
      </details>
    </div>
  );
}
