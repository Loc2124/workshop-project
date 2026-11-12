import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { PageContainer } from './PageContainer';
import { LoadingState } from '../ui/LoadingState';
import { getPublicShellClasses, isMarketingPage } from './publicShellUtils';
import { cn } from '../../lib/utils';

export function PublicPageSkeleton() {
  return (
    <PageContainer as="main">
      <LoadingState label="Đang tải trang…" variant="page" />
    </PageContainer>
  );
}

export function PublicShell() {
  const { pathname } = useLocation();
  const routeClasses = getPublicShellClasses(pathname);
  const marketingClass = isMarketingPage(pathname) ? 'marketing-page' : '';

  return (
    <div
      className={cn(
        'public-shell flex min-h-svh w-full min-w-0 flex-col bg-paper text-ink [--loading-height:calc(100svh-5rem)]',
        routeClasses,
        marketingClass,
      )}
    >
      <SiteHeader />
      <div className="flex-1 w-full min-w-0">
        <Suspense fallback={<PublicPageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}
