import { Navigate, useSearchParams } from 'react-router-dom';

export function PaymentReturnPage({
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  if (!bookingId) return <Navigate to="/me/bookings" replace />;
  return (
    <Navigate
      to={`/me/bookings/${encodeURIComponent(bookingId)}?payment=${cancelled ? 'cancel' : 'return'}`}
      replace
    />
  );
}
