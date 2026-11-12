import { lazy } from 'react';
const loadAdminSettingsPage = () =>
  import('../../pages/admin/AdminSettingsPage').then((module) => ({
    default: module.AdminSettingsPage,
  }));
const loadAdminAuditPage = () =>
  import('../../pages/admin/AdminAuditPage').then((module) => ({
    default: module.AdminAuditPage,
  }));
const loadAdminOverviewPage = () =>
  import('../../pages/admin/AdminOverviewPage').then((module) => ({
    default: module.default,
  }));
const loadAdminMessageTemplatesPage = () =>
  import('../../pages/admin/AdminMessageTemplatesPage').then((module) => ({
    default: module.AdminMessageTemplatesPage,
  }));
const loadAdminContentPage = () =>
  import('../../pages/admin/AdminContentPage').then((module) => ({
    default: module.AdminContentPage,
  }));
const loadAdminCategoriesPage = () =>
  import('../../pages/admin/AdminCategoriesPage').then((module) => ({
    default: module.AdminCategoriesPage,
  }));
const loadAdminUsersPage = () =>
  import('../../pages/admin/AdminUsersPage').then((module) => ({
    default: module.AdminUsersPage,
  }));
const loadAdminBookingsPage = () =>
  import('../../pages/admin/AdminBookingsPage').then((module) => ({
    default: module.AdminBookingsPage,
  }));
const loadAdminReportsPage = () =>
  import('../../pages/admin/AdminReportsPage').then((module) => ({
    default: module.AdminReportsPage,
  }));
const loadAdminWorkshopPage = () =>
  import('../../pages/admin/AdminWorkshopPage').then((module) => ({
    default: module.AdminWorkshopPage,
  }));
const loadAdminStudioProfilesPage = () =>
  import('../../pages/admin/AdminStudioProfilesPage').then((module) => ({
    default: module.AdminStudioProfilesPage,
  }));
const loadAdminApprovalPage = () =>
  import('../../pages/admin/AdminApprovalPage').then((module) => ({
    default: module.AdminApprovalPage,
  }));
const loadAdminFinancialPage = () =>
  import('../../pages/admin/AdminFinancialPage').then((module) => ({
    default: module.AdminFinancialPage,
  }));
const loadStudioOverviewPage = () =>
  import('../../pages/studio/StudioOverviewPage').then((module) => ({
    default: module.StudioOverviewPage,
  }));
const loadStudioWorkspacePage = () =>
  import('../../pages/studio/StudioWorkspacePage').then((module) => ({
    default: module.StudioWorkspacePage,
  }));
const loadStudioCheckInPage = () =>
  import('../../pages/studio/StudioCheckInPage').then((module) => ({
    default: module.StudioCheckInPage,
  }));
const loadStudioDashboard = () =>
  import('../../components/layout/DashboardShell').then((module) => ({
    default: module.StudioDashboard,
  }));
const loadAdminDashboard = () =>
  import('../../components/layout/DashboardShell').then((module) => ({
    default: module.AdminDashboard,
  }));
export const AdminSettingsPage = lazy(loadAdminSettingsPage);
export const AdminAuditPage = lazy(loadAdminAuditPage);
export const AdminOverviewPage = lazy(loadAdminOverviewPage);
export const AdminMessageTemplatesPage = lazy(loadAdminMessageTemplatesPage);
export const AdminContentPage = lazy(loadAdminContentPage);
export const AdminCategoriesPage = lazy(loadAdminCategoriesPage);
export const AdminUsersPage = lazy(loadAdminUsersPage);
export const AdminBookingsPage = lazy(loadAdminBookingsPage);
export const AdminReportsPage = lazy(loadAdminReportsPage);
export const AdminWorkshopPage = lazy(loadAdminWorkshopPage);
export const AdminStudioProfilesPage = lazy(loadAdminStudioProfilesPage);
export const AdminApprovalPage = lazy(loadAdminApprovalPage);
export const AdminFinancialPage = lazy(loadAdminFinancialPage);
export const StudioOverviewPage = lazy(loadStudioOverviewPage);
export const StudioWorkspacePage = lazy(loadStudioWorkspacePage);
export const StudioCheckInPage = lazy(loadStudioCheckInPage);
export const StudioDashboard = lazy(loadStudioDashboard);
export const AdminDashboard = lazy(loadAdminDashboard);
const adminLoaders: Record<string, () => Promise<unknown>> = {
  '': loadAdminOverviewPage,
  'noi-dung': loadAdminContentPage,
  'cai-dat': loadAdminSettingsPage,
  'nhat-ky': loadAdminAuditPage,
  'mau-thong-bao': loadAdminMessageTemplatesPage,
  'danh-muc': loadAdminCategoriesPage,
  'nguoi-dung': loadAdminUsersPage,
  users: loadAdminUsersPage,
  'dat-cho': loadAdminBookingsPage,
  bookings: loadAdminBookingsPage,
  'bao-cao': loadAdminReportsPage,
  reports: loadAdminReportsPage,
  workshop: loadAdminWorkshopPage,
  workshops: loadAdminWorkshopPage,
  'workshop-review': loadAdminWorkshopPage,
  studios: loadAdminStudioProfilesPage,
  'ho-so-studio': loadAdminStudioProfilesPage,
  'tai-chinh': loadAdminFinancialPage,
};
const pending = new Map<string, Promise<unknown>>();
export function prefetchDashboardRoute(to: string) {
  const path = to.split('?')[0].split('/').filter(Boolean);
  if (path[0] !== 'admin' && path[0] !== 'studio') return;
  const key =
    path[0] === 'admin'
      ? `admin/${path[1] ?? ''}`
      : `studio/${path.at(-1) ?? ''}`;
  if (pending.has(key)) return;
  const loader =
    path[0] === 'admin'
      ? (adminLoaders[path[1] ?? ''] ?? loadAdminOverviewPage)
      : path.length <= 2
        ? loadStudioOverviewPage
        : path.at(-1) === 'check-in'
          ? loadStudioCheckInPage
          : loadStudioWorkspacePage;
  const promise = loader().catch(() => {
    pending.delete(key);
  });
  pending.set(key, promise);
}
