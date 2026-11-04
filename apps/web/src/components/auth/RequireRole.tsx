import { LoadingState } from '../ui/LoadingState';
import { Fragment, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMyStudios } from '../../hooks/useOwnedStudios';
import {
  hasDashboardRole,
  type DashboardRole,
} from '../../lib/dashboard-access';
import { Button } from '../ui/button';

function StudioOwnerGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const studios = useMyStudios();
  if (studios.isPending)
    return (
      <LoadingState
        label="Đang kiểm tra quyền quản lý studio…"
        variant="page"
      />
    );
  if (studios.error)
    return (
      <div className="space-y-3 p-6 text-sm flex items-center justify-center gap-2">
        <p role="alert">Chưa kiểm tra được quyền sở hữu studio.</p>
        <Button variant="outline" onClick={() => void studios.refetch()}>
          Thử lại
        </Button>
      </div>
    );
  return hasDashboardRole(user, studios.data, 'studio_owner') ? (
    children
  ) : (
    <Navigate to="/" replace />
  );
}
export function RequireRole({
  role,
  children,
}: {
  role: DashboardRole;
  children?: ReactNode;
}) {
  const { user, isLoading, authError, retryAuth } = useAuth();
  if (isLoading)
    return <LoadingState label="Đang kiểm tra tài khoản…" variant="page" />;
  if (authError)
    return (
      <div className="space-y-3 p-6 text-sm">
        <p role="alert">Chưa kiểm tra được phiên đăng nhập.</p>
        <Button variant="outline" onClick={() => void retryAuth()}>
          Thử lại
        </Button>
      </div>
    );
  if (!user) return <Navigate to="/" replace />;
  if (role === 'admin')
    return hasDashboardRole(user, undefined, role) ? (
      <Fragment key={user.id}>{children ?? <Outlet />}</Fragment>
    ) : (
      <Navigate to="/" replace />
    );
  return (
    <StudioOwnerGate key={user.id}>{children ?? <Outlet />}</StudioOwnerGate>
  );
}
