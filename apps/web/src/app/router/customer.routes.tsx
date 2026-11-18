import { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { RequireCustomer } from '../../components/auth/RequireCustomer';

const CustomerBookingsPage = lazy(() =>
  import('../../pages/customer/CustomerBookingsPage').then((m) => ({
    default: m.CustomerBookingsPage,
  })),
);
const CustomerBookingDetailPage = lazy(() =>
  import('../../pages/customer/CustomerBookingDetailPage').then((m) => ({
    default: m.CustomerBookingDetailPage,
  })),
);
const SavedRefundAccountsPage = lazy(() =>
  import('../../pages/customer/SavedRefundAccountsPage').then((m) => ({
    default: m.SavedRefundAccountsPage,
  })),
);
const MockPaymentPage = lazy(() =>
  import('../../pages/public/MockPaymentPage').then((m) => ({
    default: m.MockPaymentPage,
  })),
);
const PaymentReturnPage = lazy(() =>
  import('../../pages/public/PaymentReturnPage').then((m) => ({
    default: m.PaymentReturnPage,
  })),
);
const PaymentCancelPage = lazy(() =>
  import('../../pages/public/PaymentReturnPage').then((m) => ({
    default: () => <m.PaymentReturnPage cancelled />,
  })),
);

export function renderCustomerRoutes() {
  return (
    <Route key="customer-root" element={<RequireCustomer />}>
      <Route path="/me/bookings" element={<CustomerBookingsPage />} />
      <Route
        path="/lich-dat-cua-toi"
        element={<Navigate to="/me/bookings" replace />}
      />
      <Route
        path="/me/refund-accounts"
        element={<SavedRefundAccountsPage />}
      />
      <Route
        path="/me/bookings/:id"
        element={<CustomerBookingDetailPage />}
      />
      <Route
        path="/payment/mock"
        element={
          import.meta.env.MODE === 'production' ? (
            <Navigate to="/" replace />
          ) : (
            <MockPaymentPage />
          )
        }
      />
      <Route path="/payment/return" element={<PaymentReturnPage />} />
      <Route path="/payment/cancel" element={<PaymentCancelPage />} />
    </Route>
  );
}
