import { LoadingState } from '../ui/LoadingState';
import { AuthLink } from '../ui/auth-link';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, LogOut, Menu, UserRound, X } from 'lucide-react';
import { PageContainer } from './PageContainer';
import { Logo } from './Logo';
import { HeaderSearch } from './HeaderSearch';
import { useAuth } from '../../hooks/useAuth';
import { useMyStudios } from '../../hooks/useOwnedStudios';
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const studiosQuery = useMyStudios();
  const { user, isLoading, authError, retryAuth, logout, isLoggingOut } =
    useAuth();
  const { pathname } = useLocation();
  const closeMenus = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };
  const changeSearch = useCallback((value: boolean) => {
    setSearchOpen(value);
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
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);
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
  const navigation = (mobile = false) =>
    links.map(({ to, label }) => (
      <Link
        key={to}
        to={to}
        onClick={closeMenus}
        aria-current={currentPage(to) ? 'page' : undefined}
        className={`inline-flex items-center underline-offset-8 transition-colors hover:text-primary ${mobile ? 'min-h-12 w-full rounded-lg px-3 py-2 text-base' : 'min-h-11 text-sm'} ${active(to) ? mobile ? 'bg-[#DCEFC8] font-semibold text-[#2A4710]' : 'font-semibold text-primary underline' : 'font-normal text-ink'}`}
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
          {navigation()}
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
            <div className="relative max-[480px]:hidden" ref={accountRef}>
              <button
                ref={accountTriggerRef}
                type="button"
                aria-label="Tài khoản"
                aria-expanded={accountOpen}
                aria-controls="account-menu"
                className="inline-grid size-11 place-items-center rounded-lg text-sm hover:bg-soft"
                onClick={() => {
                  setAccountOpen(!accountOpen);
                  setMenuOpen(false);
                }}
              >
                <UserRound size={18} aria-hidden="true" />
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
                    {user.role === 'customer' ? (
                      <Link
                        to="/me/bookings"
                        onClick={closeMenus}
                        className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm hover:bg-soft"
                      >
                        Lịch đặt của tôi
                      </Link>
                    ) : studiosQuery.isPending ? (
                      <LoadingState
                        label="Đang kiểm tra studio…"
                        className="px-3 py-3 text-sm text-muted"
                      />
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
                    {user.role === 'customer' && (
                      <button
                        type="button"
                        onClick={() => toast.info('Trang tài khoản sẽ được bổ sung sau.')}
                        className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-soft"
                      >
                        Tài khoản
                      </button>
                    )}
                    {studiosQuery.data?.some(
                      (studio) =>
                        studio.status === 'approved' && !studio.isDraft,
                    ) && (
                      <Link
                        to="/check-in"
                        onClick={closeMenus}
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-soft"
                      >
                        Check-in vé
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
                </div>
              )}
            </div>
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
        <div
          className="fixed inset-x-0 bottom-0 top-20 z-40 xl:hidden"
          onClick={closeMenus}
        >
          <div aria-hidden="true" className="absolute inset-0 bg-ink/25 backdrop-blur-sm" />
        <nav
          id="mobile-navigation"
          aria-label="Điều hướng trên điện thoại"
          className="relative mx-auto max-h-[calc(100dvh-5rem)] max-w-page overflow-y-auto bg-surface px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-overlay md:px-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col items-start gap-1">{navigation(true)}</div>
          {user && (
            <section className="mt-3 border-t border-line pt-3">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-ink">{user.fullName}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted">{user.email}</p>
              </div>
              <div className="flex flex-col">
                {user.role === 'customer' ? (
                  <>
                    <Link to="/me/bookings" onClick={closeMenus} className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft">Lịch đặt của tôi</Link>
                    <button type="button" onClick={() => toast.info('Trang tài khoản sẽ được bổ sung sau.')} className="flex min-h-12 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-soft">Tài khoản</button>
                  </>
                ) : (
                  <Link to={studiosQuery.data?.some((studio) => studio.role === 'owner') ? '/studio' : '/dang-ky-studio'} onClick={closeMenus} className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft">{studiosQuery.data?.some((studio) => studio.role === 'owner') ? 'Quản lý studio' : 'Mở studio trên Open Slot'}</Link>
                )}
                {studiosQuery.data?.some((studio) => studio.status === 'approved' && !studio.isDraft) && <Link to="/check-in" onClick={closeMenus} className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft">Check-in vé</Link>}
                {user.role === 'admin' && <Link to="/admin" onClick={closeMenus} className="flex min-h-12 items-center rounded-lg px-3 text-sm hover:bg-soft">Duyệt nội dung</Link>}
                <button type="button" disabled={isLoggingOut} onClick={() => void handleLogout()} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-brick hover:bg-soft disabled:opacity-50"><LogOut size={17} aria-hidden="true" />{isLoggingOut ? 'Đang thoát…' : 'Đăng xuất'}</button>
              </div>
            </section>
          )}
          {!isLoading && !authError && !user && (
            <div className="mt-4 flex items-center gap-6 sm:hidden">
              {pathname !== '/dang-nhap' && (
                <AuthLink
                  to="/dang-nhap"
                  onClick={closeMenus}
                  className="inline-flex min-h-12 items-center"
                >
                  Đăng nhập
                </AuthLink>
              )}
              {pathname !== '/dang-ky' && (
                <AuthLink
                  to="/dang-ky"
                  onClick={closeMenus}
                  className="inline-flex min-h-12 items-center bg-primary px-5 text-white hover:bg-primary-hover"
                >
                  Tạo tài khoản
                </AuthLink>
              )}
            </div>
          )}
        </nav>
        </div>
      )}
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
