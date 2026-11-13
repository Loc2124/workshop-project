import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { customerBookingService } from '@/services/customerBookingService';

export function PaymentReturnPage({
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('bookingId');
  const [isCancelling, setIsCancelling] = useState(cancelled);
  const cancelAttempted = useRef(false);

  useEffect(() => {
    if (!cancelled || !bookingId || cancelAttempted.current) return;
    cancelAttempted.current = true;

    let active = true;
    void customerBookingService
      .cancel(bookingId)
      .catch((err) => {
        console.warn('Auto cancel booking on payOS cancel redirect:', err);
      })
      .finally(() => {
        if (active) {
          setIsCancelling(false);
          navigate(
            `/me/bookings/${encodeURIComponent(bookingId)}?payment=cancel`,
            {
              replace: true,
            },
          );
        }
      });

    return () => {
      active = false;
    };
  }, [cancelled, bookingId, navigate]);

  if (!bookingId) return <Navigate to="/me/bookings" replace />;

  if (isCancelling) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-studio-muted">
          Đang hủy thanh toán và đặt chỗ…
        </p>
      </div>
    );
  }

  return (
    <Navigate
      to={`/me/bookings/${encodeURIComponent(bookingId)}?payment=${cancelled ? 'cancel' : 'return'}`}
      replace
    />
  );
}
