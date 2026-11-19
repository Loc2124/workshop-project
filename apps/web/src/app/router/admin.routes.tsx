import { Suspense } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { RequireRole } from './guards/RequireRole';
import { DashboardSkeleton } from '../../components/layout/DashboardSkeleton';
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
  AdminDashboard,
} from '../../lib/dashboard-routes';

export function renderAdminRoutes() {
  return (
    <Route key="admin-root" element={<RequireRole role="admin" />}>
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
  );
}
