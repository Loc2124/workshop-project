import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  onSessionCacheChange,
  sessionCacheVersion,
} from './lib/session-events';
import { prefetchPublicHome } from './lib/prefetch-public-home';
import { useCategories } from './hooks/useCategories';
import { DashboardSkeleton } from './components/layout/DashboardSkeleton';
import { AppRouter } from './app/router';

function App() {
  // A session reset rebinds account observers while public queries keep their
  // data and in-flight requests independently from the auth bootstrap.
  useSyncExternalStore(onSessionCacheChange, sessionCacheVersion, () => 0);
  const { pathname, search } = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (pathname !== '/' || new URLSearchParams(search).has('featuredPreview'))
      return;
    void prefetchPublicHome(queryClient);
  }, [pathname, queryClient, search]);

  useCategories();

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AppRouter />
    </Suspense>
  );
}

export default App;
