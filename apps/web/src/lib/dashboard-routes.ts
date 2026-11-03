import { lazy } from 'react';
const loadAdminSettingsPage = () =>
  import('../pages/AdminSettingsPage').then((module) => ({
    default: module.AdminSettingsPage,
  }));
const loadAdminAuditPage = () =>
  import('../pages/AdminAuditPage').then((module) => ({
    default: module.AdminAuditPage,
  }));
const loadAdminOverviewPage = () =>
  import('../pages/AdminOverviewPage').then((module) => ({
    default: module.default,
  }));
const loadAdminMessageTemplatesPage = () =>
  import('../pages/AdminMessageTemplatesPage').then((module) => ({
    default: module.AdminMessageTemplatesPage,
  }));
const loadAdminContentPage = () =>
  import('../pages/AdminContentPage').then((module) => ({
    default: module.AdminContentPage,
  }));
const loadAdminCategoriesPage = () =>
  import('../pages/AdminCategoriesPage').then((module) => ({
    default: module.AdminCategoriesPage,
  }));
const loadAdminUsersPage = () =>
  import('../pages/AdminUsersPage').then((module) => ({
    default: module.AdminUsersPage,
  }));
const loadAdminBookingsPage = () =>
  import('../pages/AdminBookingsPage').then((module) => ({
    default: module.AdminBookingsPage,
  }));
const loadAdminReportsPage = () =>
  import('../pages/AdminReportsPage').then((module) => ({
    default: module.AdminReportsPage,
  }));
const loadAdminWorkshopPage = () =>
  import('../pages/AdminWorkshopPage').then((module) => ({
    default: module.AdminWorkshopPage,
  }));
const loadAdminStudioProfilesPage = () =>
  import('../pages/AdminStudioProfilesPage').then((module) => ({
    default: module.AdminStudioProfilesPage,
  }));
const loadAdminApprovalPage = () =>
  import('../pages/AdminApprovalPage').then((module) => ({
    default: module.AdminApprovalPage,
  }));
const loadStudioOverviewPage = () =>
  import('../pages/StudioOverviewPage').then((module) => ({
    default: module.StudioOverviewPage,
  }));
const loadStudioWorkspacePage = () =>
  import('../pages/StudioWorkspacePage').then((module) => ({
    default: module.StudioWorkspacePage,
  }));
const loadStudioDashboard = () =>
  import('../components/layout/DashboardShell').then((module) => ({
    default: module.StudioDashboard,
  }));
const loadAdminDashboard = () =>
  import('../components/layout/DashboardShell').then((module) => ({
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
export const StudioOverviewPage = lazy(loadStudioOverviewPage);
export const StudioWorkspacePage = lazy(loadStudioWorkspacePage);
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
  'workshop-review': loadAdminApprovalPage,
  studios: loadAdminStudioProfilesPage,
  'ho-so-studio': loadAdminStudioProfilesPage,
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
        : loadStudioWorkspacePage;
  const promise = loader().catch(() => {
    pending.delete(key);
  });
  pending.set(key, promise);
}
