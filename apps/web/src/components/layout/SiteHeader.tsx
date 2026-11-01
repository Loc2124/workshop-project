import { PageContainer } from './PageContainer';
import { Logo } from './Logo';
import { Menu, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeaderSearch } from './HeaderSearch';

const links = [
  { to: '/', label: 'Trang chủ' },
  { to: '/kham-pha', label: 'Khám phá workshop' },
  { to: '/ve-open-slot', label: 'Về Open Slot' },
  { to: '/danh-cho-nghe-nhan', label: 'Dành cho nghệ nhân' },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const changeSearch = useCallback((value: boolean) => {
    setSearchOpen(value);
    if (value) setMenuOpen(false);
  }, []);
  const { pathname } = useLocation();
  function active(to: string) {
    const current = pathname.replace(/\/+$/, '') || '/';
    return current === to || (to === '/kham-pha' && current === '/explore');
  }
  const navigation = (mobile = false) =>
    links.map(({ to, label }) => (
      <Link
        key={to}
        to={to}
        aria-current={active(to) ? 'page' : undefined}
        onClick={() => setMenuOpen(false)}
        className={`inline-flex min-h-11 items-center rounded-lg font-semibold underline-offset-8 focus-visible:ring-2 focus-visible:ring-primary ${mobile ? 'w-full py-2 text-base' : 'text-sm xl:text-base'} ${active(to) ? 'text-primary underline decoration-2' : 'text-ink hover:text-primary'}`}
      >
        {label}
      </Link>
    ));
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-paper">
        <PageContainer className="flex h-14 items-center justify-between">
          <Link
            aria-label="Open Slot, trang chủ"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            to="/"
          >
            <Logo />
          </Link>
          <nav
            aria-label="Điều hướng chính"
            className="hidden shrink-0 items-center gap-4 whitespace-nowrap lg:flex 2xl:gap-6"
          >
            {navigation()}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <HeaderSearch open={searchOpen} onOpenChange={changeSearch} />
            <a
              className="hidden min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-ink hover:bg-soft sm:inline-flex"
              href="#login"
            >
              Đăng nhập
            </a>
            <button
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              className="grid size-11 place-items-center rounded-lg text-ink hover:bg-soft lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </PageContainer>
        {menuOpen && (
          <nav
            aria-label="Điều hướng trên điện thoại"
            className="bg-surface px-6 py-3 shadow-overlay lg:hidden"
            id="mobile-navigation"
          >
            {navigation(true)}
          </nav>
        )}
      </header>
    </>
  );
}
