import type { QueryClient } from '@tanstack/react-query';
import type { AuthUser } from '../../services/authService';
import type { MemberStudio } from '../../types/management';
import { authQueryKey } from '../api/session-cache';
import { sessionEpoch } from '../domain/session-events';
import { queryKeys } from '../api/query-keys';
import { geographyQueries } from '../domain/geography-queries';
import { catalogKeys } from '../../hooks/useCatalog';
import { catalogService } from '../../services/catalogService';
import { readActiveStudioId } from '../domain/studio-dashboard';

export async function prefetchNavigation(client: QueryClient, url: URL) {
  const path = url.pathname.split('/').filter(Boolean);
  const id = path[1] ? decodeURIComponent(path[1]) : '';
  if (!path.length) {
    if (url.searchParams.has('featuredPreview')) return;
    const { prefetchPublicHome } = await import('./prefetch-public-home');
    await Promise.all([
      import('../../pages/public/HomePage'),
      prefetchPublicHome(client),
      client.prefetchQuery(geographyQueries.provinces()),
    ]);
    return;
  }
  if (path[0] === 'workshop' || path[0] === 'workshops') {
    if (!id) return;
    await Promise.all([
      import('../../pages/public/WorkshopPage'),
      client.prefetchQuery({
        queryKey: catalogKeys.detail(id),
        queryFn: ({ signal }) => catalogService.getById(id, signal),
        staleTime: 60_000,
      }),
      client.prefetchQuery({
        queryKey: catalogKeys.reviews(id),
        queryFn: ({ signal }) => catalogService.reviews(id, signal),
        staleTime: 30_000,
      }),
    ]);
    return;
  }
  if (path[0] === 'studios') {
    if (!id) return;
    await Promise.all([
      import('../../pages/studio/StudioPage'),
      client.prefetchQuery({
        queryKey: catalogKeys.studioDetail(id),
        queryFn: ({ signal }) => catalogService.getStudioById(id, signal),
        staleTime: 30_000,
      }),
    ]);
    return;
  }
  if (path[0] === 'kham-pha' || path[0] === 'explore') {
    const [, provinces] = await Promise.all([
      import('../../pages/public/ExplorePage'),
      client.fetchQuery(geographyQueries.provinces()),
    ]);
    if (!client.getQueryData(queryKeys.public.categories)) return;
    const { parseExploreUrl } = await import('../domain/explore-url');
    const parsed = parseExploreUrl(url.searchParams, provinces.provinces, true);
    const filters = {
      ...parsed.filters,
      query: parsed.query,
      sort: parsed.sort,
    };
    // Match the existing saved-province selection without changing the URL.
    if (
      !filters.provinceId &&
      !url.searchParams.has('province') &&
      !url.searchParams.has('province_id')
    ) {
      try {
        const saved = localStorage.getItem('open-slot.province');
        if (
          saved &&
          provinces.provinces.some((province) => province.id === saved)
        )
          filters.provinceId = saved;
      } catch {
        /* Storage may be disabled. */
      }
    }
    if (parsed.view === 'studios')
      await client.prefetchQuery({
        queryKey: catalogKeys.studios(filters),
        queryFn: ({ signal }) => catalogService.listStudios(filters, signal),
        staleTime: 30_000,
      });
    else
      await client.prefetchQuery({
        queryKey: catalogKeys.list(filters),
        queryFn: ({ signal }) => catalogService.list(filters, signal),
        staleTime: 30_000,
      });
    return;
  }

  const user = client.getQueryData<AuthUser | null>(authQueryKey);
  if (!user) return;
  const epoch = sessionEpoch();
  const current = () =>
    sessionEpoch() === epoch &&
    client.getQueryData<AuthUser | null>(authQueryKey)?.id === user.id;
  if (path[0] === 'admin') {
    if (user.role !== 'admin' || url.search) return;
    const { prefetchDashboardRoute } = await import('../domain/dashboard-routes');
    prefetchDashboardRoute(url.pathname);
    if (!id) {
      const { getAdminOverview } =
        await import('../../services/adminOverviewService');
      if (current())
        await client.prefetchQuery({
          queryKey: queryKeys.overview.config(user.id),
          queryFn: ({ signal }) => getAdminOverview(signal),
          staleTime: 30_000,
        });
    } else if (id === 'ho-so-studio' || id === 'studios') {
      const module = await import('../../pages/admin/AdminStudioProfilesPage');
      if (current())
        await module.prefetchData(client, user.id, id === 'studios');
    } else {
      const loaders = {
        'nguoi-dung': () => import('../../pages/admin/AdminUsersPage'),
        users: () => import('../../pages/admin/AdminUsersPage'),
        'dat-cho': () => import('../../pages/admin/AdminBookingsPage'),
        bookings: () => import('../../pages/admin/AdminBookingsPage'),
        workshop: () => import('../../pages/admin/AdminWorkshopPage'),
        workshops: () => import('../../pages/admin/AdminWorkshopPage'),
        'bao-cao': () => import('../../pages/admin/AdminReportsPage'),
        reports: () => import('../../pages/admin/AdminReportsPage'),
        'nhat-ky': () => import('../../pages/admin/AdminAuditPage'),
        'cai-dat': () => import('../../pages/admin/AdminSettingsPage'),
        'noi-dung': () => import('../../pages/admin/AdminContentPage'),
        'danh-muc': () => import('../../pages/admin/AdminCategoriesPage'),
        'mau-thong-bao': () => import('../../pages/admin/AdminMessageTemplatesPage'),
      };
      const loader = loaders[id as keyof typeof loaders];
      if (loader) {
        const module = await loader();
        if (current()) await module.prefetchData(client, user.id);
      }
    }
    return;
  }
  if (path[0] === 'studio') {
    const { managementService } = await import('../../services/managementService');
    if (!current()) return;
    const studios = await client.fetchQuery({
      queryKey: queryKeys.studios.mine(user.id),
      queryFn: ({ signal }) => managementService.listMyStudios(signal),
      staleTime: 30_000,
    });
    const isSectionOnly = [
      'workshops',
      'sessions',
      'bookings',
      'check-in',
      'members',
      'profile',
    ].includes(id);
    const targetId = isSectionOnly ? '' : id;
    const owned = (studios as MemberStudio[]).filter(
      (item) => item.role === 'owner' && (!targetId || item.id === targetId),
    );
    const section = isSectionOnly ? id : (path[2] ?? '');
    const rememberedId = readActiveStudioId(user.id);
    const studio =
      (rememberedId
        ? owned.find(
            (item) =>
              item.id === rememberedId &&
              !item.isDraft &&
              (!['sessions', 'bookings', 'check-in', 'members'].includes(
                section,
              ) ||
                item.status === 'approved'),
          )
        : undefined) ??
      owned.find((item) => item.status === 'approved' && !item.isDraft) ??
      owned.find((item) => !item.isDraft) ??
      owned[0];
    if (!current() || !studio || studio.isDraft) return;
    if (
      ['sessions', 'bookings'].includes(section) &&
      studio.status !== 'approved'
    )
      return;
    const { prefetchDashboardRoute } = await import('../domain/dashboard-routes');
    prefetchDashboardRoute(url.pathname);
    const tasks: Promise<unknown>[] = [];
    if (section === 'workshops')
      tasks.push(import('../../components/management/StudioWorkshopManager'));
    if (section === 'sessions')
      tasks.push(import('../../components/management/StudioSessionManager'));
    if (section === 'profile')
      tasks.push(import('../../components/management/StudioEvidenceEditor'));
    if (!section || section === 'workshops' || section === 'sessions')
      tasks.push(
        client.prefetchQuery({
          queryKey: queryKeys.workshops.forStudio(user.id, studio.id),
          queryFn: ({ signal }) =>
            managementService.listStudioWorkshops(studio.id, signal),
          staleTime: 30_000,
        }),
      );
    if (!section || section === 'sessions')
      tasks.push(
        client.prefetchQuery({
          queryKey: queryKeys.bookings.slots(user.id, studio.id),
          queryFn: ({ signal }) =>
            managementService.listStudioSessions(studio.id, signal),
          staleTime: 30_000,
        }),
      );
    if (section === 'bookings') {
      const module =
        await import('../../components/management/StudioBookingManager');
      if (current())
        tasks.push(module.prefetchData(client, user.id, studio.id));
    }
    if (section === 'profile') {
      const { fetchSiteSettings } = await import('../../hooks/useSiteSettings');
      if (current())
        tasks.push(
          client.prefetchQuery({
            queryKey: queryKeys.public.settings,
            queryFn: ({ signal }) => fetchSiteSettings(signal),
            staleTime: 60_000,
          }),
        );
    }
    await Promise.all(tasks);
    return;
  }
  if (
    path[0] === 'me' &&
    path[1] === 'bookings' &&
    !path[2] &&
    user.role === 'customer'
  ) {
    const { customerBookingService } =
      await import('../../services/customerBookingService');
    if (current())
      await client.prefetchQuery({
        queryKey: queryKeys.bookings.list(user.id, { view: 'customer' }),
        queryFn: ({ signal }) => customerBookingService.list(signal),
        staleTime: 30_000,
      });
  }
}
