import { AuthLink } from '../ui/auth-link';
import { lazy, Suspense, useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu, UserRound, X } from 'lucide-react';
import { PageContainer } from './PageContainer';
import { Logo } from './Logo';
import { HeaderSearch } from './HeaderSearch';
import { HeaderUserMenu } from './HeaderUserMenu';
import { HeaderMobileDrawer } from './HeaderMobileDrawer';
import { useAuth } from '@/hooks/useAuth';
import { useMyStudios } from '@/hooks/useOwnedStudios';
import { toast } from 'sonner';

const NotificationsMenu = lazy(() =>
  import('./NotificationsMenu').then((module) => ({
    default: module.NotificationsMenu,
  })),
);

const links = [
  { to: '/', label: 'Trang chủ' },
  { to: '/kham-pha', label: 'Khám phá workshop' },
  { to: '/ve-open-slot', label: 'Về Open Slot' },
  { to: '/danh-cho-nghe-nhan', label: 'Dành cho nghệ nhân' },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const studiosQuery = useMyStudios();
  const { user, isLoading, authError, retryAuth, logout, isLoggingOut } =
    useAuth();
  const { pathname } = useLocation();

  const closeMenus = () => {
    setMenuOpen(false);
  };

  const changeSearch = useCallback((value: boolean) => {
    setSearchOpen(value);
  }, []);

  function active(to: string) {
    const current = pathname.replace(/\/+$/, '') || '/';
    return (
      current === to ||
      (to === '/kham-pha' &&
        (current === '/explore' ||
          current.startsWith('/studios/') ||
          current.startsWith('/workshop/') ||
          current.startsWith('/workshops/')))
    );
  }

  function currentPage(to: string) {
    const current = pathname.replace(/\/+$/, '') || '/';
    return current === to || (to === '/kham-pha' && current === '/explore');
  }

  const renderNavLinks = (mobile = false) =>
    links.map(({ to, label }) => (
      <Link
        key={to}
        to={to}
        onClick={closeMenus}
        aria-current={currentPage(to) ? 'page' : undefined}
        className={`inline-flex items-center underline-offset-8 transition-colors hover:text-primary ${
          mobile
            ? 'min-h-12 w-full rounded-lg px-3 py-2 text-base'
            : 'min-h-11 text-sm'
        } ${
          active(to)
            ? mobile
              ? 'bg-[#DCEFC8] font-semibold text-[#2A4710]'
              : 'font-semibold text-primary underline'
            : 'font-normal text-ink'
        }`}
      >
        {label}
      </Link>
    ));

  async function handleLogout() {
    try {
      await logout();
      toast.success('Đã đăng xuất.');
      closeMenus();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Không thể đăng xuất. Vui lòng thử lại.',
      );
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-paper">
      <PageContainer className="flex h-20 items-center justify-start gap-2 lg:gap-6">
        <Link
          to="/"
          aria-label="Open Slot, trang chủ"
          onClick={closeMenus}
          className="inline-flex min-h-11 shrink-0 items-center"
        >
          <Logo className="w-28 min-[360px]:w-36 sm:w-40" />
        </Link>
        <nav
          aria-label="Điều hướng chính"
          className="hidden w-[450px] flex-none items-center justify-start gap-3 whitespace-nowrap xl:flex 2xl:w-[500px] 2xl:gap-6"
        >
          {renderNavLinks()}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <HeaderSearch open={searchOpen} onOpenChange={changeSearch} />
          {isLoading && (
            <>
              <button
                type="button"
                aria-label="Đang tải thông báo"
                aria-busy="true"
                disabled
                className="inline-grid size-11 place-items-center rounded-lg text-muted"
              >
                <Bell size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Đang tải tài khoản"
                aria-busy="true"
                disabled
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted max-[480px]:hidden"
              >
                <span
                  className="grid size-8 place-items-center rounded-full bg-soft"
                  aria-hidden="true"
                >
                  <UserRound size={16} />
                </span>
              </button>
            </>
          )}
          {!isLoading && !authError && !user && (
            <>
              {pathname !== '/dang-nhap' && (
                <AuthLink
                  to="/dang-nhap"
                  onClick={closeMenus}
                  className="hidden min-h-11 items-center px-2 text-sm hover:text-primary sm:inline-flex"
                >
                  Đăng nhập
                </AuthLink>
              )}
              {pathname !== '/dang-ky' && (
                <AuthLink
                  to="/dang-ky"
                  onClick={closeMenus}
                  className="hidden min-h-11 items-center bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover sm:inline-flex"
                >
                  Tạo tài khoản
                </AuthLink>
              )}
            </>
          )}
          {user && (
            <div className="shrink-0">
              <Suspense
                fallback={<span aria-hidden="true" className="block size-11" />}
              >
                <NotificationsMenu userId={user.id} />
              </Suspense>
            </div>
          )}
          {user && (
            <HeaderUserMenu
              user={user}
              studiosQuery={studiosQuery}
              isLoggingOut={isLoggingOut}
              onLogout={handleLogout}
              onCloseAll={closeMenus}
            />
          )}
          {authError && (
            <button
              type="button"
              onClick={() => void retryAuth()}
              className="min-h-11 px-2 text-sm text-brick max-[480px]:hidden"
            >
              Thử lại phiên
            </button>
          )}
          <button
            type="button"
            aria-controls="mobile-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            className="grid size-11 place-items-center hover:bg-soft xl:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </PageContainer>
      <HeaderMobileDrawer
        open={menuOpen}
        user={user}
        isLoading={isLoading}
        authError={authError}
        pathname={pathname}
        studiosQuery={studiosQuery}
        isLoggingOut={isLoggingOut}
        renderNavLinks={renderNavLinks}
        onLogout={handleLogout}
        onClose={closeMenus}
      />
      {authError && (
        <p
          className="bg-soft px-4 py-2 text-center text-sm text-brick"
          role="alert"
        >
          {`Không thể kiểm tra phiên đăng nhập: ${authError.message}`}
        </p>
      )}
    </header>
  );
}
