import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CalendarDays,
  LayoutDashboard,
  PanelsTopLeft,
  Store,
  Ticket,
} from 'lucide-react';
import { DashboardLayout } from '../src/components/layout/DashboardLayout';
import { StudioOverviewPage } from '../src/pages/StudioOverviewPage';
import { StudioSwitcher } from '../src/components/layout/StudioSwitcher';
import {
  StudioCard,
  StudioSkeleton,
} from '../src/components/management/StudioPrimitives';
import { authQueryKey } from '../src/lib/session-cache';
import { queryKeys } from '../src/lib/query-keys';
import type {
  MemberStudio,
  StudioWorkshop,
  StudioSession,
} from '../src/types/management';
import '../src/styles.css';

// Isolated visual fixture: no production routes, account or API data are changed.
const overview = new URLSearchParams(location.search).get('overview');
const reviewStatus = ['pending', 'rejected', 'needs_changes', 'suspended'].find(
  (value) => value === overview,
);
const studio: MemberStudio = {
  id: '10000000-0000-4000-8000-000000000001',
  slug: 'studio-xem-truoc',
  name: 'Studio xem trước',
  description: null,
  categoryId: 'ceramics',
  provinceId: null,
  province: null,
  areaId: null,
  area: null,
  address: '',
  status: (reviewStatus ?? 'approved') as MemberStudio['status'],
  isDraft: overview === 'draft',
  role: 'owner',
  createdAt: '2026-11-05T00:00:00Z',
};
const user = {
  id: 'preview-owner',
  fullName: 'Nghệ nhân',
  email: 'preview@example.test',
  role: 'customer' as const,
};
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: false, refetchInterval: false },
  },
});
client.setQueryData(authQueryKey, user);
client.setQueryData(queryKeys.notifications.lists(user.id), []);
client.setQueryData(queryKeys.studios.mine(user.id), [studio]);
const workshop: StudioWorkshop = {
  id: '20000000-0000-4000-8000-000000000001',
  studioId: studio.id,
  slug: 'workshop-xem-truoc',
  title: 'Workshop xem trước',
  description: '',
  categoryId: 'ceramics',
  level: 'beginner',
  audience: [],
  takeaway: null,
  durationMinutes: 120,
  basePrice: 250000,
  requirements: null,
  cancellationPolicy: null,
  paymentPolicy: null,
  provinceId: 'ho-chi-minh',
  areaId: null,
  address: '',
  status: 'approved',
  createdAt: studio.createdAt,
};
const session: StudioSession = {
  id: '30000000-0000-4000-8000-000000000001',
  workshopId: workshop.id,
  workshopTitle: workshop.title,
  startsAt: new Date(Date.now() + 86400000).toISOString(),
  endsAt: new Date(Date.now() + 93600000).toISOString(),
  price: 250000,
  capacity: 8,
  seatsHeld: 0,
  seatsSold: 2,
  status: 'scheduled',
  createdAt: studio.createdAt,
};
if (overview !== 'loading' && overview !== 'error') {
  client.setQueryData(
    queryKeys.workshops.forStudio(user.id, studio.id),
    overview === 'populated' ? [workshop] : [],
  );
  client.setQueryData(
    queryKeys.bookings.slots(user.id, studio.id),
    overview === 'populated' ? [session] : [],
  );
} else {
  for (const queryKey of [
    queryKeys.workshops.forStudio(user.id, studio.id),
    queryKeys.bookings.slots(user.id, studio.id),
  ]) {
    client.setQueryDefaults(queryKey, {
      queryFn: () =>
        overview === 'loading'
          ? new Promise(() => {})
          : Promise.reject(new Error('Lỗi xem trước')),
    });
  }
}
const sections = [
  { label: 'Tổng quan', path: '', icon: LayoutDashboard },
  { label: 'Workshop', path: 'workshops', icon: PanelsTopLeft },
  { label: 'Lịch và slot', path: 'sessions', icon: CalendarDays },
  { label: 'Đặt chỗ', path: 'bookings', icon: Ticket },
  { label: 'Hồ sơ studio', path: 'profile', icon: Store },
];
const root = `/studio/${studio.id}`;
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[root]}>
      <Routes>
        <Route
          path="/studio/:studioId"
          element={
            <DashboardLayout
              roleLabel="Quản lý studio"
              user={user}
              menuItems={sections.map((s) => ({
                label: s.label,
                icon: s.icon,
                to: `${root}${s.path ? `/${s.path}` : ''}`,
              }))}
              workspace={{ name: studio.name, to: root }}
              studioSwitcher={
                <StudioSwitcher studios={[studio]} studio={studio} />
              }
            />
          }
        >
          {sections.map((section) => (
            <Route
              key={section.path}
              index={!section.path}
              path={section.path || undefined}
              element={
                overview && !section.path ? (
                  <StudioOverviewPage />
                ) : (
                  <div className="space-y-studio-card">
                    <header className="space-y-2">
                      <h1 className="font-heading text-3xl font-bold">
                        {section.label}
                      </h1>
                      <p className="text-sm text-studio-muted">{studio.name}</p>
                    </header>
                    <StudioCard className="space-y-3">
                      <h2 className="font-heading text-xl font-bold">
                        Bản xem trước bố cục
                      </h2>
                      <p className="text-sm leading-6 text-studio-muted">
                        Dùng menu để xem trạng thái trang đang chọn, thu gọn
                        sidebar và mở menu trên điện thoại. Nội dung từng trang
                        sẽ được thiết kế ở bước tiếp theo.
                      </p>
                    </StudioCard>
                    <StudioSkeleton label="Minh họa trạng thái tải nội dung" />
                  </div>
                )
              }
            />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);
