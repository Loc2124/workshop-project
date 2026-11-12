import { formatPrice } from '@/lib/core/format';

interface SchedulePriceBreakdownProps {
  price: number;
  seats: number;
  total: number;
  depositAmount: number;
  depositPercent: number;
  balanceAmount: number;
  paymentChoice: 'deposit' | 'in_studio';
  isWithin24Hours: boolean;
}

export function SchedulePriceBreakdown({
  price,
  seats,
  total,
  depositAmount,
  depositPercent,
  balanceAmount,
  paymentChoice,
  isWithin24Hours,
}: SchedulePriceBreakdownProps) {
  return (
    <>
      {paymentChoice === 'deposit' && isWithin24Hours && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Buổi học diễn ra trong vòng 24 giờ, khoản cọc sẽ không được hoàn nếu
          bạn hủy.
        </p>
      )}
      <div className="rounded-xl bg-soft p-4">
        <p className="text-sm text-stone-700">
          {formatPrice(price)} đ × {seats} người
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt>Tổng tiền</dt>
            <dd className="font-semibold tabular-nums">
              {formatPrice(total)} đ
            </dd>
          </div>
          {depositAmount > 0 ? (
            <>
              <div className="flex justify-between gap-3 text-primary">
                <dt className="font-semibold">Đặt cọc ({depositPercent}%)</dt>
                <dd className="font-bold tabular-nums">
                  {formatPrice(depositAmount)} đ
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-primary/15 pt-2">
                <dt>Còn lại trả tại studio</dt>
                <dd className="font-semibold tabular-nums">
                  {formatPrice(balanceAmount)} đ
                </dd>
              </div>
              <p className="pt-1 text-xs leading-5 text-stone-600">
                Sau khi đặt chỗ, bạn có 15 phút để quét mã QR đặt cọc. Chỗ được
                xác nhận ngay khi chúng tôi nhận được tiền cọc.
              </p>
            </>
          ) : (
            <div className="flex justify-between gap-3 border-t border-primary/15 pt-2">
              <dt>Trả tại studio</dt>
              <dd className="font-semibold tabular-nums">
                {formatPrice(total)} đ
              </dd>
            </div>
          )}
        </dl>
      </div>
      {paymentChoice === 'in_studio' && (
        <p className="text-sm text-stone-700">
          Chỗ của bạn được xác nhận ngay. Bạn thanh toán trực tiếp tại studio.
        </p>
      )}
    </>
  );
}
