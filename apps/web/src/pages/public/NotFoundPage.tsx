import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';

export function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '404 - Không tìm thấy trang | Open Slot';
  }, []);

  return (
    <main className="flex min-h-[60vh] items-center justify-center py-20">
      <PageContainer className="max-w-md text-center">
        <p className="font-heading text-6xl font-bold text-primary sm:text-7xl">
          404
        </p>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-ink sm:text-3xl">
          Không tìm thấy trang
        </h1>
        <p className="mt-3 text-base text-muted">
          Trang bạn đang tìm kiếm không tồn tại, đã bị xóa hoặc đường dẫn bị
          thay đổi.
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
        </div>
      </PageContainer>
    </main>
  );
}
