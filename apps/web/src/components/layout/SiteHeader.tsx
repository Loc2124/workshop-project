import { AuthLink } from '../ui/auth-link';
import { NotificationsMenu } from './NotificationsMenu';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { PageContainer } from './PageContainer';
import { Logo } from './Logo';
import { HeaderSearch } from './HeaderSearch';
import { useAuth } from '../../hooks/useAuth';
import { useMyStudios } from '../../hooks/useOwnedStudios';

const links = [
  { to: '/', label: 'Trang chủ' },
  { to: '/kham-pha', label: 'Khám phá workshop' },
  { to: '/ve-open-slot', label: 'Về Open Slot' },
  { to: '/danh-cho-nghe-nhan', label: 'Dành cho nghệ nhân' },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountNotice, setAccountNotice] = useState('');
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const studiosQuery = useMyStudios();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const { user, isLoading, authError, retryAuth, logout, isLoggingOut } =
    useAuth();
  const { pathname } = useLocation();
  const closeMenus = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };
  const changeSearch = useCallback((value: boolean) => {
    setSearchOpen(value);
    if (value) {
      setMenuOpen(false);
      setAccountOpen(false);
    }
  }, []);
  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountRef.current?.contains(event.target)
      )
        setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        accountTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [accountOpen]);
  function active(to: string) {
    const current = pathname.replace(/\/+$/, '') || '/';
    return current === to || (to === '/kham-pha' && current === '/explore');
  }
  const navigation = (mobile = false) =>
    links.map(({ to, label }) => (
      <Link
        key={to}
        to={to}
        onClick={closeMenus}
        aria-current={active(to) ? 'page' : undefined}
        className={`inline-flex min-h-11 items-center underline-offset-8 transition-colors hover:text-primary ${mobile ? 'py-2 text-base' : 'text-sm'} ${active(to) ? 'font-semibold text-primary underline' : 'font-normal text-ink'}`}
      >
        {label}
      </Link>
    ));
  async function handleLogout() {
    setLogoutError(null);
    try {
      await logout();
      closeMenus();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Không thể đăng xuất. Vui lòng thử lại.',
      );
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-paper">
      <PageContainer className="flex h-20 items-center justify-between gap-2 lg:gap-6">
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
          className="hidden items-center gap-5 whitespace-nowrap xl:flex 2xl:gap-8"
        >
          {navigation()}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <HeaderSearch open={searchOpen} onOpenChange={changeSearch} />
          {isLoading && (
            <span role="status" className="px-2 text-sm text-muted">
              Đang tải…
            </span>
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
          {user && <NotificationsMenu userId={user.id} />}
          {user && (
            <div className="relative" ref={accountRef}>
              <button
                ref={accountTriggerRef}
                type="button"
                aria-label="Tài khoản"
                aria-expanded={accountOpen}
                aria-controls="account-menu"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-soft"
                onClick={() => {
                  setAccountOpen(!accountOpen);
                  setAccountNotice('');
                  setMenuOpen(false);
                }}
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full bg-soft font-semibold text-primary"
                  aria-hidden="true"
                >
                  {user.fullName.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-32 truncate sm:inline">
                  {user.fullName}
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div
                  id="account-menu"
                  aria-label="Tài khoản của bạn"
                  className="absolute right-0 top-full z-60 mt-2 w-72 max-w-[calc(100vw-5rem)] rounded-xl bg-surface p-3 shadow-overlay"
                >
                  <div className="rounded-lg bg-soft px-3 py-4">
                    <p className="truncate font-semibold">{user.fullName}</p>
                    <p className="mt-1 break-all text-sm text-muted">
                      {user.email}
                    </p>
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-soft"
                      onClick={() =>
                        setAccountNotice(
                          'Lịch đặt của tôi chưa được hỗ trợ trong phiên bản này.',
                        )
                      }
                    >
                      Lịch đặt của tôi
                    </button>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-soft"
                      onClick={() =>
                        setAccountNotice(
                          'Trang tài khoản chưa được hỗ trợ trong phiên bản này.',
                        )
                      }
                    >
                      Tài khoản
                    </button>
                    {studiosQuery.isPending ? (
                      <p role="status" className="px-3 py-3 text-sm text-muted">
                        Đang kiểm tra studio…
                      </p>
                    ) : studiosQuery.error ? (
                      <button
                        type="button"
                        onClick={() => void studiosQuery.refetch()}
                        className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-brick hover:bg-soft"
                      >
                        Thử tải lại thông tin studio
                      </button>
                    ) : (
                      <Link
                        to={
                          studiosQuery.data?.some(
                            (studio) => studio.role === 'owner',
                          )
                            ? '/studio'
                            : '/dang-ky-studio'
                        }
                        onClick={closeMenus}
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-soft"
                      >
                        {studiosQuery.data?.some(
                          (studio) => studio.role === 'owner',
                        )
                          ? 'Quản lý studio'
                          : 'Mở studio trên Open Slot'}
                      </Link>
                    )}
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={closeMenus}
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-soft"
                      >
                        Duyệt nội dung
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={isLoggingOut}
                      onClick={() => void handleLogout()}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-brick hover:bg-paper disabled:opacity-50"
                    >
                      <LogOut size={17} aria-hidden="true" />
                      {isLoggingOut ? 'Đang thoát…' : 'Đăng xuất'}
                    </button>
                  </div>
                  {accountNotice && (
                    <p
                      role="status"
                      className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm text-muted"
                    >
                      {accountNotice}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {authError && (
            <button
              type="button"
              onClick={() => void retryAuth()}
              className="min-h-11 px-2 text-sm text-brick"
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
            onClick={() => {
              setMenuOpen(!menuOpen);
              setAccountOpen(false);
            }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </PageContainer>
      {menuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Điều hướng trên điện thoại"
          className="bg-surface px-4 py-4 shadow-overlay md:px-6 xl:hidden"
        >
          <div className="flex flex-col items-start">{navigation(true)}</div>
          {!isLoading && !authError && !user && (
            <div className="mt-4 flex items-center gap-6 sm:hidden">
              {pathname !== '/dang-nhap' && (
                <AuthLink
                  to="/dang-nhap"
                  onClick={closeMenus}
                  className="inline-flex min-h-11 items-center"
                >
                  Đăng nhập
                </AuthLink>
              )}
              {pathname !== '/dang-ky' && (
                <AuthLink
                  to="/dang-ky"
                  onClick={closeMenus}
                  className="inline-flex min-h-11 items-center bg-primary px-5 text-white hover:bg-primary-hover"
                >
                  Tạo tài khoản
                </AuthLink>
              )}
            </div>
          )}
        </nav>
      )}
      {(authError || logoutError) && (
        <p
          className="bg-soft px-4 py-2 text-center text-sm text-brick"
          role="alert"
        >
          {authError
            ? `Không thể kiểm tra phiên đăng nhập: ${authError.message}`
            : logoutError}
        </p>
      )}
    </header>
  );
}
