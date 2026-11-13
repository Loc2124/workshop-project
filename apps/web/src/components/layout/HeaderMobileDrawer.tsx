import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { AuthLink } from '../ui/auth-link';
import { toast } from 'sonner';
import type { AuthUser } from '@/services/authService';
import type { MemberStudio } from '@/types';

interface HeaderMobileDrawerProps {
  open: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  authError: Error | null;
  pathname: string;
  studiosQuery: {
    data?: MemberStudio[];
  };
  isLoggingOut: boolean;
  renderNavLinks: (mobile: boolean) => React.ReactNode;
  onLogout: () => Promise<void>;
  onClose: () => void;
}

export function HeaderMobileDrawer({
  open,
  user,
  isLoading,
  authError,
  pathname,
  studiosQuery,
  isLoggingOut,
  renderNavLinks,
  onLogout,
  onClose,
}: HeaderMobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-20 z-40 xl:hidden"
      onClick={onClose}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
      />
      <nav
        id="mobile-navigation"
        aria-label="Điều hướng trên điện thoại"
        className="relative mx-auto max-h-[calc(100dvh-5rem)] max-w-page overflow-y-auto bg-surface px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-overlay md:px-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col items-start gap-1">
          {renderNavLinks(true)}
        </div>
        {user && (
          <section className="mt-3 border-t border-line pt-3">
            <div className="px-3 py-2">
              <p className="text-sm font-semibold text-ink">{user.fullName}</p>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                {user.email}
              </p>
            </div>
            <div className="flex flex-col">
              <Link
                to="/me/bookings"
                onClick={onClose}
                className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft"
              >
                Lịch đặt của tôi
              </Link>

              {studiosQuery.data?.some(
                (studio) => studio.role === 'owner' || studio.role === 'staff',
              ) ? (
                <Link
                  to="/studio"
                  onClick={onClose}
                  className="flex min-h-12 items-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-soft"
                >
                  Quản lý studio
                </Link>
              ) : user.role !== 'admin' ? (
                <Link
                  to="/dang-ky-studio"
                  onClick={onClose}
                  className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft"
                >
                  Mở studio trên Open Slot
                </Link>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  toast.info('Trang tài khoản sẽ được bổ sung sau.')
                }
                className="flex min-h-12 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-soft"
              >
                Tài khoản
              </button>
              {studiosQuery.data?.some(
                (studio) => studio.status === 'approved' && !studio.isDraft,
              ) && (
                <Link
                  to="/studio/check-in"
                  onClick={onClose}
                  className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft"
                >
                  Check-in vé
                </Link>
              )}
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={onClose}
                  className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft"
                >
                  Duyệt nội dung
                </Link>
              )}
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void onLogout()}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-brick hover:bg-soft disabled:opacity-50"
              >
                <LogOut size={17} aria-hidden="true" />
                {isLoggingOut ? 'Đang thoát…' : 'Đăng xuất'}
              </button>
            </div>
          </section>
        )}
        {!isLoading && !authError && !user && (
          <div className="mt-4 flex items-center gap-6 sm:hidden">
            {pathname !== '/dang-nhap' && (
              <AuthLink
                to="/dang-nhap"
                onClick={onClose}
                className="inline-flex min-h-12 items-center"
              >
                Đăng nhập
              </AuthLink>
            )}
            {pathname !== '/dang-ky' && (
              <AuthLink
                to="/dang-ky"
                onClick={onClose}
                className="inline-flex min-h-12 items-center bg-primary px-5 text-white hover:bg-primary-hover"
              >
                Tạo tài khoản
              </AuthLink>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
