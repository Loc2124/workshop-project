import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowLeft,
  Home,
  UserCheck,
  Building2,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/layout/PageContainer';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoggingOut } = useAuth();

  useEffect(() => {
    document.title = '403 - Không có quyền truy cập | Open Slot';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSwitchAccount = async () => {
    try {
      await logout();
      toast.success('Đã đăng xuất. Vui lòng đăng nhập bằng tài khoản có quyền.');
      navigate('/dang-nhap?redirect=' + encodeURIComponent(location.pathname));
    } catch {
      navigate('/dang-nhap');
    }
  };

  return (
    <main className="min-h-[75vh] flex items-center py-12 md:py-20 bg-gradient-to-b from-paper via-surface to-soft/40">
      <PageContainer className="max-w-3xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-widest mb-6">
          <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <span>Lỗi 403 · Quyền truy cập bị từ chối</span>
        </div>

        {/* 403 Visual Lock Header */}
        <div className="relative mb-4 select-none">
          <span className="font-heading text-8xl sm:text-9xl font-black tracking-tight text-amber-600/10 block leading-none">
            403
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="font-heading text-2xl sm:text-4xl font-bold text-ink">
              Khu vực yêu cầu đặc quyền
            </h1>
          </div>
        </div>

        {/* Context description based on current login status */}
        <div className="mx-auto max-w-xl text-base leading-relaxed text-muted mb-8 space-y-2">
          <p>
            Bạn không có quyền hạn phù hợp để truy cập vào phân hệ này. Nội dung này chỉ dành riêng cho Ban quản trị nền tảng hoặc Chủ sở hữu studio đã được phê duyệt.
          </p>
          {user && (
            <p className="text-xs sm:text-sm text-ink/80 rounded-lg bg-soft/70 py-2 px-3 inline-block">
              Đang đăng nhập với: <strong>{user.email}</strong> (Vai trò: <span className="capitalize">{user.role || 'Học viên'}</span>)
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
          <Button
            type="button"
            variant="outline"
            className="gap-2 min-h-11 px-5"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Quay lại trang trước</span>
          </Button>

          <Button asChild className="gap-2 min-h-11 px-6 shadow-sm">
            <Link to="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              <span>Về trang chủ</span>
            </Link>
          </Button>

          {user ? (
            <Button
              type="button"
              variant="secondary"
              className="gap-2 min-h-11 px-5"
              onClick={handleSwitchAccount}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Đổi tài khoản khác</span>
            </Button>
          ) : (
            <Button asChild variant="secondary" className="gap-2 min-h-11 px-5">
              <Link to={`/dang-nhap?redirect=${encodeURIComponent(location.pathname)}`}>
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                <span>Đăng nhập quyền quản trị</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Suggestions cards */}
        <div className="grid gap-4 sm:grid-cols-2 text-left">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-2 text-primary">
              <Building2 className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Bạn là Nghệ nhân / Chủ studio?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted mb-4">
              Nếu bạn muốn mở không gian workshop hoặc quản lý các buổi dạy thủ công của mình trên Open Slot, hãy hoàn thiện hồ sơ đăng ký.
            </p>
            <Button size="sm" variant="outline" asChild className="w-full text-xs">
              <Link to="/dang-ky-studio">
                Đăng ký mở Studio của bạn →
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-2 text-primary">
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Nghĩ rằng đây là một sự nhầm lẫn?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted mb-4">
              Nếu tài khoản của bạn đã được phân quyền quản trị nhưng vẫn gặp thông báo này, vui lòng liên hệ đội ngũ kỹ thuật để kiểm tra.
            </p>
            <Button size="sm" variant="outline" asChild className="w-full text-xs">
              <Link to="/lien-he">
                Liên hệ hỗ trợ kỹ thuật →
              </Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
