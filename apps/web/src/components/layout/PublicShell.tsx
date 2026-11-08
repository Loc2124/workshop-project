import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { PageContainer } from './PageContainer';
import { LoadingState } from '../ui/LoadingState';

export function PublicPageSkeleton() {
  return (
    <PageContainer as="main">
      <LoadingState label="Đang tải trang…" variant="page" />
    </PageContainer>
  );
}
export function PublicShell() {
  const { pathname } = useLocation();
  const classes =
    pathname === '/'
      ? 'home-page min-h-screen'
      : pathname.startsWith('/kham-pha') || pathname.startsWith('/explore')
        ? 'explore-page min-h-screen'
        : pathname.startsWith('/studios/')
          ? 'min-h-screen pb-28 md:pb-0'
          : pathname.startsWith('/workshop')
            ? 'min-h-screen pb-28 lg:pb-0'
            : pathname === '/dang-ky-studio'
              ? 'flex min-h-svh flex-col'
              : 'min-h-svh';
  return (
    <div
      className={`${classes} ${['/danh-cho-nghe-nhan', '/ve-open-slot'].includes(pathname) ? 'marketing-page' : ''} public-shell flex min-h-svh flex-col bg-paper text-ink [--loading-height:calc(100svh-5rem)]`}
    >
      <SiteHeader />
      <div className="flex-1">
        <Suspense fallback={<PublicPageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}
