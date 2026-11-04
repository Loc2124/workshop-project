import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { customerBookingService } from '../services/customerBookingService';
import { PageContainer } from '../components/layout/PageContainer';

export function MockPaymentPage() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get('orderCode') ?? '';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [paid, setPaid] = useState(false);
  const payment = useMutation({
    mutationFn: () => customerBookingService.confirmMockPayment(orderCode),
    onSuccess: async () => {
      setPaid(true);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.all(user?.id),
      });
    },
  });

  return (
    <PageContainer as="main" className="py-12">
      <section className="mx-auto max-w-xl bg-surface p-6 sm:p-8">
        <h1 className="font-heading text-3xl font-semibold">
          Thanh toán mô phỏng
        </h1>
        <p className="mt-3 text-sm text-stone-700">
          Đây là chế độ thử nghiệm. Không có khoản tiền thật được chuyển.
        </p>
        <p className="mt-5 font-semibold">
          Mã đơn <span className="tabular-nums">{orderCode || '—'}</span>
        </p>
        {paid ? (
          <div className="mt-6">
            <p role="status">Đã ghi nhận xác nhận thanh toán thử nghiệm.</p>
            <Link
              to="/me/bookings"
              className="mt-4 inline-flex min-h-12 items-center bg-primary px-5 font-semibold text-white hover:bg-primary-hover"
            >
              Xem lịch đặt
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              disabled={!orderCode || payment.isPending}
              onClick={() => payment.mutate()}
              className="min-h-12 w-full bg-primary px-5 font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {payment.isPending
                ? 'Đang xác nhận…'
                : 'Xác nhận thanh toán mô phỏng'}
            </button>
            <Link
              to="/me/bookings"
              className="flex min-h-11 items-center justify-center font-semibold text-primary underline"
            >
              Quay lại lịch đặt
            </Link>
            {payment.isError && (
              <p role="alert" className="text-sm text-brick">
                {payment.error.message}
              </p>
            )}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
