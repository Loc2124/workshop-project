import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { formatPrice } from '../../lib/format';
import { FinancialAccountForm } from './FinancialAccountForm';

type Refund = {
  refundId: string;
  amount: string | number;
  settledAmount: string | number;
  reason: string;
  status: string;
  accountStatus: string | null;
  accountLast4: string | null;
  transferStatus: string | null;
};

const refundStatus = (item: Refund) => {
  if (item.status === 'paid')
    return 'Đã chuyển khoản hoàn. Bạn có thể đối chiếu trong tài khoản ngân hàng.';
  if (item.transferStatus === 'manual_review')
    return 'Chưa rõ kết quả chuyển tiền. Open Slot đang đối chiếu với ngân hàng và sẽ cập nhật khi có kết quả.';
  if (item.transferStatus === 'failed')
    return 'Lần chuyển tiền trước chưa thành công. Open Slot sẽ kiểm tra và xử lý lại; bạn không cần nhập tài khoản mới nếu thông tin vẫn đúng.';
  if (
    item.transferStatus === 'approved' ||
    item.transferStatus === 'processing'
  )
    return 'Khoản hoàn đã được duyệt và đang chờ kết quả chuyển tiền.';
  if (item.accountStatus === 'verified')
    return 'Tài khoản nhận hoàn đã được đối chiếu. Khoản hoàn đang chờ xử lý.';
  if (item.accountStatus === 'pending')
    return 'Tài khoản nhận hoàn đang chờ đối chiếu.';
  return 'Vui lòng bổ sung tài khoản nhận hoàn để Open Slot xử lý khoản tiền này.';
};

export function CustomerRefundAccounts({ bookingId }: { bookingId: string }) {
  const query = useQuery({
    queryKey: ['refund-destinations', bookingId],
    queryFn: () =>
      apiFetch<{ items: Refund[] }>(
        `/bookings/${bookingId}/refund-destinations`,
      ).then((result) => result.items),
    refetchInterval: 60_000,
  });
  if (query.isPending)
    return <p className="mt-4 text-sm text-stone-700">Đang tải khoản hoàn…</p>;
  if (query.isError)
    return (
      <p role="alert" className="mt-4 text-sm text-rose-800">
        Chưa tải được thông tin nhận hoàn. Vui lòng thử lại.
      </p>
    );
  if (!query.data.length)
    return (
      <p className="mt-4 text-sm text-stone-700">
        Khoản hoàn đang được ghi nhận. Thông tin nhập tài khoản sẽ xuất hiện tại
        đây.
      </p>
    );
  return (
    <div className="mt-4 space-y-4">
      {query.data.map((refund) => (
        <div key={refund.refundId} className="space-y-2">
          <p
            role="status"
            className="rounded-lg bg-cream p-3 text-sm font-medium text-ink"
          >
            Hoàn {formatPrice(Number(refund.amount))} đ
            {Number(refund.settledAmount) > 0 && refund.status !== 'paid'
              ? ` · Đã chuyển ${formatPrice(Number(refund.settledAmount))} đ`
              : ''}{' '}
            · {refundStatus(refund)}
          </p>
          {refund.status !== 'paid' &&
            !['approved', 'processing', 'manual_review'].includes(
              refund.transferStatus ?? '',
            ) && (
              <FinancialAccountForm
                refund
                endpoint={`/refunds/${refund.refundId}/account`}
                title={`Tài khoản nhận hoàn ${formatPrice(Number(refund.amount))} đ`}
                description="Chỉ dùng tài khoản này cho khoản hoàn của đặt chỗ này. Open Slot đối chiếu trước khi chuyển tiền."
              />
            )}
        </div>
      ))}
    </div>
  );
}
