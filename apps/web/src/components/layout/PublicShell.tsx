import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { PageContainer } from './PageContainer';
import { Skeleton } from '../ui/skeleton';

export function PublicPageSkeleton() {
  return (
    <PageContainer
      as="main"
      className="min-h-[calc(100svh-5rem)] py-8"
      role="status"
      aria-label="Đang tải trang"
    >
      <Skeleton className="mb-6 h-8 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="aspect-4/3 w-full" />
        <div className="space-y-5">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
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
      className={`${classes} ${['/danh-cho-nghe-nhan', '/ve-open-slot'].includes(pathname) ? 'marketing-page' : ''} public-shell bg-paper text-ink`}
    >
      <SiteHeader />
      <Suspense fallback={<PublicPageSkeleton />}>
        <Outlet />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
