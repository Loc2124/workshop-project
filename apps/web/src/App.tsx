import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AdminReportsPage } from './pages/AdminReportsPage';
const AdminSettingsPage = lazy(() =>
  import('./pages/AdminSettingsPage').then((module) => ({
    default: module.AdminSettingsPage,
  })),
);
const AdminAuditPage = lazy(() =>
  import('./pages/AdminAuditPage').then((module) => ({
    default: module.AdminAuditPage,
  })),
);
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage'));
import { RequireRole } from './components/auth/RequireRole';
import {
  StudioDashboard,
  AdminDashboard,
} from './components/layout/DashboardShell';
import { StudioWorkspacePage } from './pages/StudioWorkspacePage';
const AdminMessageTemplatesPage = lazy(() =>
  import('./pages/AdminMessageTemplatesPage').then((module) => ({
    default: module.AdminMessageTemplatesPage,
  })),
);
const AdminContentPage = lazy(() =>
  import('./pages/AdminContentPage').then((module) => ({
    default: module.AdminContentPage,
  })),
);
const AdminCategoriesPage = lazy(() =>
  import('./pages/AdminCategoriesPage').then((module) => ({
    default: module.AdminCategoriesPage,
  })),
);
import { AdminUsersPage } from './pages/AdminUsersPage';
import { useCategories } from './hooks/useCategories';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { ArtisanPage } from './pages/ArtisanPage';
import { AboutPage } from './pages/AboutPage';
import { StudioPage } from './pages/StudioPage';
import { WorkshopPage } from './pages/WorkshopPage';
import { TicketDemoPage } from './pages/TicketDemoPage';
import { LoginPage } from './pages/LoginPage';
import { StudioOverviewPage } from './pages/StudioOverviewPage';
import { StudioRegistrationPage } from './pages/StudioRegistrationPage';
import { AdminApprovalPage } from './pages/AdminApprovalPage';
import { AdminBookingsPage } from './pages/AdminBookingsPage';
import { AdminWorkshopPage } from './pages/AdminWorkshopPage';
import { AdminStudioProfilesPage } from './pages/AdminStudioProfilesPage';
import { RegisterPage } from './pages/RegisterPage';

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
  useCategories();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/kham-pha" element={<ExplorePage />} />
      <Route path="/demo/ve" element={<TicketDemoPage />} />
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/dang-ky" element={<RegisterPage />} />
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
              <Suspense
                fallback={
                  <p role="status" className="p-5 text-sm text-muted">
                    Đang tải Tổng quan…
                  </p>
                }
              >
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
              <Suspense fallback={<p role="status">Đang tải nội dung…</p>}>
                <AdminContentPage />
              </Suspense>
            }
          />
          <Route
            path="mau-thong-bao"
            element={
              <Suspense fallback={<p role="status">Đang tải…</p>}>
                <AdminMessageTemplatesPage />
              </Suspense>
            }
          />
          <Route path="bao-cao" element={<AdminReportsPage />} />
          <Route
            path="cai-dat"
            element={
              <Suspense fallback={<p role="status">Đang tải cài đặt…</p>}>
                <AdminSettingsPage />
              </Suspense>
            }
          />
          <Route
            path="nhat-ky"
            element={
              <Suspense fallback={<p role="status">Đang tải nhật ký…</p>}>
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
          <Route path="workshop-review" element={<AdminApprovalPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route
            path="danh-muc"
            element={
              <Suspense
                fallback={
                  <p role="status" className="text-sm text-muted">
                    Đang tải danh mục…
                  </p>
                }
              >
                <AdminCategoriesPage />
              </Suspense>
            }
          />
          <Route path="nguoi-dung" element={<AdminUsersPage />} />
          <Route
            path="*"
            element={<Navigate to="/admin/ho-so-studio" replace />}
          />
        </Route>
      </Route>
      <Route path="/quan-ly" element={<Navigate to="/studio" replace />} />
      <Route path="/dang-ky-studio" element={<StudioRegistrationPage />} />
      <Route path="/quan-ly/xuong/:studioId" element={<LegacyStudioDetail />} />
      <Route path="/quan-ly/tao-xuong" element={<LegacyStudioRegistration />} />
      <Route
        path="/quan-tri/duyet"
        element={<Navigate to="/admin/ho-so-studio" replace />}
      />
      <Route path="/danh-cho-nghe-nhan" element={<ArtisanPage />} />
      <Route path="/ve-open-slot" element={<AboutPage />} />
      <Route path="/studios/:slug" element={<StudioPage />} />
      <Route path="/xuong/:slug" element={<LegacyPublicStudio />} />
      <Route path="/workshop/:slug" element={<WorkshopPage />} />
      <Route path="/workshops/:id" element={<WorkshopPage />} />
      <Route
        path="*"
        element={
          <main className="mx-auto max-w-3xl px-6 py-20 text-center text-lg text-muted">
            Không tìm thấy trang.
          </main>
        }
      />
    </Routes>
  );
}

export default App;
