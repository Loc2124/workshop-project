import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/layout/PageContainer';
import { useAuth } from '../hooks/useAuth';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.title = '403 - Không có quyền truy cập | Open Slot';
  }, []);

  return (
    <main className="flex min-h-[60vh] items-center justify-center py-20">
      <PageContainer className="max-w-md text-center">
        <p className="font-heading text-6xl font-bold text-brick sm:text-7xl">
          403
        </p>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-ink sm:text-3xl">
          Không có quyền truy cập
        </h1>
        <p className="mt-3 text-base text-muted">
          {user
            ? 'Tài khoản của bạn không có đặc quyền để truy cập vào khu vực này.'
            : 'Vui lòng đăng nhập bằng tài khoản có quyền để tiếp tục.'}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
          >
            Quay lại
          </Button>
          <Button asChild>
            <Link to="/">Về trang chủ</Link>
          </Button>
          {!user && (
            <Button asChild variant="secondary">
              <Link to="/dang-nhap">Đăng nhập</Link>
            </Button>
          )}
        </div>
      </PageContainer>
    </main>
  );
}
