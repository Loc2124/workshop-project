import { useState, type FormEvent } from 'react';
import { studioVerificationDecisionSchema } from '@workshop/shared';
import { useSetStudioVerification } from '../../hooks/useManagement';
import type { AdminStudio } from '../../types/management';
import { formatDate } from '../../lib/format';
import { Button } from '../ui/button';

const methods = {
  identity_address: 'Danh tính người đại diện và địa chỉ studio',
  business_registration: 'Giấy đăng ký hộ kinh doanh / doanh nghiệp',
};

export function StudioVerificationPanel({ studio }: { studio: AdminStudio }) {
  const mutation = useSetStudioVerification();
  const [method, setMethod] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const verified =
    studio.verificationActive ?? studio.trustLevel === 'verified';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const parsed = studioVerificationDecisionSchema.safeParse(
      verified
        ? { verified: false, reason }
        : { verified: true, method, confirmed },
    );
    if (!parsed.success) {
      setError(
        verified
          ? 'Nhập lý do thu hồi (tối đa 500 ký tự).'
          : 'Chọn căn cứ và xác nhận đã hoàn tất đối chiếu.',
      );
      return;
    }
    setError('');
    try {
      await mutation.mutateAsync({
        studioId: studio.id,
        decision: parsed.data,
      });
    } catch {
      /* Render mutation error below. */
    }
  }
  return (
    <section
      className="mt-5 max-w-2xl border-t border-line pt-4"
      aria-label={`Xác minh ${studio.name}`}
    >
      {studio.status === 'approved' && (
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <h4 className="font-semibold">
            {verified ? 'Thu hồi xác minh' : 'Nâng lên bậc 2 — Đã xác minh'}
          </h4>
          {verified ? (
            <label className="block text-sm font-semibold">
              Lý do thu hồi
              <textarea
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-line bg-surface p-3 text-base font-normal"
                placeholder="Ghi lý do xử lý; không nhập số giấy tờ định danh."
              />
            </label>
          ) : (
            <>
              <label className="block text-sm font-semibold">
                Căn cứ đối chiếu
                <select
                  required
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-lg border border-line bg-surface px-3 text-base font-normal"
                >
                  <option value="">Chọn căn cứ đã kiểm tra</option>
                  {Object.entries(methods).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-start gap-3 py-2 text-sm leading-6">
                <input
                  required
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-primary"
                />
                Tôi đã đối chiếu căn cứ nêu trên và xác nhận hồ sơ thuộc studio
                này.
              </label>
              <p className="text-sm text-muted">
                Chỉ ghi nhận kết quả đối chiếu. Không nhập hoặc tải lên CCCD, số
                giấy tờ hay bản chụp tại đây.
              </p>
            </>
          )}
          {(error || mutation.error) && (
            <p role="alert" className="text-sm text-brick">
              {error || mutation.error?.message}
            </p>
          )}
          <Button
            type="submit"
            variant="outline"
            disabled={
              mutation.isPending ||
              (!verified && studio.profileComplete === false)
            }
          >
            {mutation.isPending
              ? 'Đang lưu…'
              : verified
                ? 'Thu hồi huy hiệu xác minh'
                : 'Cấp xác minh bậc 2'}
          </Button>
        </form>
      )}
      {!!studio.verificationHistory?.length && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
            Lịch sử xác minh ({studio.verificationHistory.length})
          </summary>
          <ul className="space-y-3 text-sm">
            {studio.verificationHistory.map((entry, index) => (
              <li
                key={`${entry.createdAt}-${index}`}
                className="break-words leading-6"
              >
                <p>
                  {entry.action === 'verified'
                    ? 'Cấp xác minh'
                    : 'Thu hồi xác minh'}{' '}
                  · {entry.reviewerName} · {formatDate(entry.createdAt)}
                </p>
                {entry.method && (
                  <p className="text-muted">{methods[entry.method]}</p>
                )}
                {entry.reason && <p className="text-muted">{entry.reason}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
