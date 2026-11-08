import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import {
  onSessionCacheChange,
  sessionCacheVersion,
} from './lib/session-events';
import { prefetchPublicHome } from './lib/prefetch-public-home';
import { RequireRole } from './components/auth/RequireRole';
import { RequireCustomer } from './components/auth/RequireCustomer';
import { DashboardSkeleton } from './components/layout/DashboardSkeleton';
import {
  AdminSettingsPage,
  AdminAuditPage,
  AdminOverviewPage,
  AdminMessageTemplatesPage,
  AdminContentPage,
  AdminCategoriesPage,
  AdminUsersPage,
  AdminBookingsPage,
  AdminReportsPage,
  AdminWorkshopPage,
  AdminStudioProfilesPage,
  AdminFinancialPage,
  StudioOverviewPage,
  StudioWorkspacePage,
  StudioDashboard,
  AdminDashboard,
} from './lib/dashboard-routes';
import { useCategories } from './hooks/useCategories';

import { PublicShell } from './components/layout/PublicShell';
import { AuthLayout } from './components/layout/AuthLayout';
import { Skeleton } from './components/ui/skeleton';
const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({ default: module.HomePage })),
);
const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((module) => ({
    default: module.ExplorePage,
  })),
);
const StudioCheckInPage = lazy(() =>
  import('./pages/StudioCheckInPage').then((module) => ({
    default: module.StudioCheckInPage,
  })),
);
const ArtisanPage = lazy(() =>
  import('./pages/ArtisanPage').then((module) => ({
    default: module.ArtisanPage,
  })),
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })),
);
const StudioPage = lazy(() =>
  import('./pages/StudioPage').then((module) => ({
    default: module.StudioPage,
  })),
);
const WorkshopPage = lazy(() =>
  import('./pages/WorkshopPage').then((module) => ({
    default: module.WorkshopPage,
  })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((module) => ({
    default: module.RegisterPage,
  })),
);
const CustomerBookingsPage = lazy(() =>
  import('./pages/CustomerBookingsPage').then((module) => ({
    default: module.CustomerBookingsPage,
  })),
);
const CustomerBookingDetailPage = lazy(() =>
  import('./pages/CustomerBookingDetailPage').then((module) => ({
    default: module.CustomerBookingDetailPage,
  })),
);
const SavedRefundAccountsPage = lazy(() =>
  import('./pages/SavedRefundAccountsPage').then((module) => ({
    default: module.SavedRefundAccountsPage,
  })),
);
const MockPaymentPage = lazy(() =>
  import('./pages/MockPaymentPage').then((module) => ({
    default: module.MockPaymentPage,
  })),
);
const PaymentReturnPage = lazy(() =>
  import('./pages/PaymentReturnPage').then((module) => ({
    default: module.PaymentReturnPage,
  })),
);
const PaymentCancelPage = lazy(() =>
  import('./pages/PaymentReturnPage').then((module) => ({
    default: () => <module.PaymentReturnPage cancelled />,
  })),
);
const StudioRegistrationPage = lazy(() =>
  import('./pages/StudioRegistrationPage').then((module) => ({
    default: module.StudioRegistrationPage,
  })),
);
function LegacyStudioDetail() {
  const { studioId } = useParams();
  return (
    <Navigate to={`/studio/${encodeURIComponent(studioId ?? '')}`} replace />
  );
}
function LegacyPublicStudio() {
  const { slug = '' } = useParams();
  const { search, hash } = useLocation();
  return (
    <Navigate
      to={`/studios/${encodeURIComponent(slug)}${search}${hash.replace('workshop-tai-xuong', 'workshop-tai-studio')}`}
      replace
    />
  );
}
function LegacyStudioRegistration() {
  const { search, hash } = useLocation();
  return <Navigate to={`/dang-ky-studio${search}${hash}`} replace />;
}
function App() {
  // A session reset rebinds account observers while public queries keep their
  // data and in-flight requests independently from the auth bootstrap.
  useSyncExternalStore(onSessionCacheChange, sessionCacheVersion, () => 0);
  const { pathname, search } = useLocation();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (pathname !== '/' || new URLSearchParams(search).has('featuredPreview'))
      return;
    void prefetchPublicHome(queryClient);
  }, [pathname, queryClient, search]);
  useCategories();
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/check-in" element={<StudioCheckInPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/kham-pha" element={<ExplorePage />} />
          <Route path="/dang-ky-studio" element={<StudioRegistrationPage />} />
          <Route path="/danh-cho-nghe-nhan" element={<ArtisanPage />} />
          <Route path="/ve-open-slot" element={<AboutPage />} />
          <Route path="/studios/:slug" element={<StudioPage />} />
          <Route path="/workshop/:slug" element={<WorkshopPage />} />
          <Route path="/workshops/:id" element={<WorkshopPage />} />
          <Route element={<RequireCustomer />}>
            <Route path="/me/bookings" element={<CustomerBookingsPage />} />
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
        </Route>
        <Route
          path="/dang-nhap"
          element={
            <Suspense
              fallback={
                <AuthLayout>
                  <div className="min-h-[520px] space-y-5" role="status">
                    <Skeleton className="h-12 w-2/3" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </AuthLayout>
              }
            >
              <LoginPage />
            </Suspense>
          }
        />
        <Route
          path="/dang-ky"
          element={
            <Suspense
              fallback={
                <AuthLayout>
                  <div className="min-h-[520px] space-y-5" role="status">
                    <Skeleton className="h-12 w-2/3" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </AuthLayout>
              }
            >
              <RegisterPage />
            </Suspense>
          }
        />
        <Route element={<RequireRole role="studio_owner" />}>
          <Route path="/studio" element={<StudioDashboard />} />
          <Route
            path="/studio/studios/:studioId"
            element={<LegacyStudioDetail />}
          />
          {['workshops', 'sessions', 'bookings', 'profile'].map((section) => (
            <Route
              key={section}
              path={`/studio/${section}`}
              element={<StudioDashboard />}
            />
          ))}
          <Route path="/studio/:studioId" element={<StudioDashboard />}>
            <Route index element={<StudioOverviewPage />} />
            <Route
              path="workshops"
              element={<StudioWorkspacePage section="workshops" />}
            />
            <Route
              path="sessions"
              element={<StudioWorkspacePage section="sessions" />}
            />
            <Route
              path="bookings"
              element={<StudioWorkspacePage section="bookings" />}
            />
            <Route
              path="profile"
              element={<StudioWorkspacePage section="profile" />}
            />
            <Route path="*" element={<Navigate to="/studio" replace />} />
          </Route>
        </Route>
        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin" element={<AdminDashboard />}>
            <Route
              index
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <AdminOverviewPage />
                </Suspense>
              }
            />
            <Route path="bookings" element={<AdminBookingsPage />} />
            <Route path="dat-cho" element={<AdminBookingsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route
              path="noi-dung"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <AdminContentPage />
                </Suspense>
              }
            />
            <Route
              path="mau-thong-bao"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <AdminMessageTemplatesPage />
                </Suspense>
              }
            />
            <Route path="bao-cao" element={<AdminReportsPage />} />
            <Route
              path="cai-dat"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <AdminSettingsPage />
                </Suspense>
              }
            />
            <Route
              path="nhat-ky"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <AdminAuditPage />
                </Suspense>
              }
            />
            <Route path="ho-so-studio" element={<AdminStudioProfilesPage />} />
            <Route
              path="ho-so-xuong"
              element={<Navigate to="/admin/ho-so-studio" replace />}
            />
            <Route
              path="approvals"
              element={<Navigate to="/admin/ho-so-studio" replace />}
            />
            <Route
              path="studios"
              element={<AdminStudioProfilesPage showAllTab />}
            />
            <Route path="workshop" element={<AdminWorkshopPage />} />
            <Route path="workshops" element={<AdminWorkshopPage />} />
            <Route
              path="workshop-review"
              element={<Navigate to="/admin/workshop" replace />}
            />
            <Route path="users" element={<AdminUsersPage />} />
            <Route
              path="danh-muc"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <AdminCategoriesPage />
                </Suspense>
              }
            />
            <Route path="nguoi-dung" element={<AdminUsersPage />} />
            <Route path="tai-chinh" element={<AdminFinancialPage />} />
            <Route
              path="*"
              element={<Navigate to="/admin/ho-so-studio" replace />}
            />
          </Route>
        </Route>
        <Route path="/quan-ly" element={<Navigate to="/studio" replace />} />
        <Route
          path="/quan-ly/xuong/:studioId"
          element={<LegacyStudioDetail />}
        />
        <Route
          path="/quan-ly/tao-xuong"
          element={<LegacyStudioRegistration />}
        />
        <Route
          path="/quan-tri/duyet"
          element={<Navigate to="/admin/ho-so-studio" replace />}
        />
        <Route path="/xuong/:slug" element={<LegacyPublicStudio />} />
        <Route
          path="*"
          element={
            <main className="mx-auto max-w-3xl px-6 py-20 text-center text-lg text-muted">
              Không tìm thấy trang.
            </main>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
