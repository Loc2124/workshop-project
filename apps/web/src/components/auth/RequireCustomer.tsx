import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '../ui/LoadingState';
import { Button } from '../ui/button';

export function RequireCustomer() {
  const { user, isLoading, authError, retryAuth } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState label="Đang kiểm tra tài khoản…" variant="page" />;
  }
  if (authError) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-5 py-16 text-center">
        <p role="alert">Chưa kiểm tra được phiên đăng nhập.</p>
        <Button variant="outline" onClick={() => void retryAuth()}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/dang-nhap?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }
  if (user.role !== 'customer') return <Navigate to="/" replace />;
  return <Outlet />;
}
