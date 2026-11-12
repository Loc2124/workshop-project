import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomeFeaturedStudios } from './HomeFeaturedStudios';
import { HomeWorkshopSection } from './HomeWorkshopSection';
import type { FeaturedStudio } from '@/services/featuredService';
import { mockWorkshops } from '../../test-fixtures/mockWorkshops';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const bookableWorkshops = mockWorkshops.slice(0, 8).map((workshop) => ({
  ...workshop,
  sessions: workshop.sessions.map((session) => ({
    ...session,
    startsAt: '2099-11-07T01:00:00Z',
    endsAt: '2099-11-07T03:00:00Z',
    availableSeats: 8,
  })),
}));

const studio: FeaturedStudio = {
  id: 'studio',
  slug: 'studio-an',
  name: 'Studio An',
  description: 'Không gian sáng tạo',
  province: 'TP. Hồ Chí Minh',
  provinceId: 'ho-chi-minh',
  areaId: null,
  areaName: null,
  address: '12 Nguyễn Trãi',
  categoryId: 'ceramics',
  categoryIds: ['ceramics'],
  workshopCount: 3,
  availableSessions: 4,
  startingPrice: 250000,
  trustLevel: 'verified',
};
const render = (component: React.ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>,
  );
describe('homepage ticket consistency', () => {
  it('uses the shared studio ticket with API metrics, verification and a detail link', () => {
    const html = render(
      <HomeFeaturedStudios
        studios={[studio]}
        loading={false}
        error={false}
        refetch={() => {}}
      />,
    );
    expect(html).toContain('studio-card horizontal-ticket');
    expect(html).toContain('href="/studios/studio-an"');
    expect(html).toContain('4 buổi còn chỗ');
    expect(html).toContain('Đã xác minh');
  });
  it('shows an honest unavailable price for a studio without upcoming sessions', () => {
    const html = render(
      <HomeFeaturedStudios
        studios={[
          {
            ...studio,
            startingPrice: null,
            workshopCount: 0,
            availableSessions: 0,
          },
        ]}
        loading={false}
        error={false}
        refetch={() => {}}
      />,
    );
    expect(html).toContain('Chưa có lịch tổ chức');
    expect(html).not.toContain('ticket-price');
  });
  it('uses featured and normal workshop tickets without dropping admin selections', () => {
    const html = render(
      <HomeWorkshopSection
        featuredWorkshops={bookableWorkshops}
        browseUrl="/kham-pha"
        loading={false}
        error={false}
        refetch={() => {}}
      />,
    );
    expect(html.match(/aria-label="Xem workshop /g)).toHaveLength(8);
    expect(html.match(/horizontal-ticket-featured/g)).toHaveLength(1);
    expect(html).toContain('lg:col-span-2');
  });
  it('prioritizes the first workshop image and leaves later ticket images lazy', () => {
    const html = render(
      <HomeWorkshopSection
        featuredWorkshops={bookableWorkshops.slice(0, 2)}
        browseUrl="/kham-pha"
        loading={false}
        error={false}
        refetch={() => {}}
      />,
    );
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('loading="lazy"');
  });
  it('keeps loading, empty and error states separate from tickets', () => {
    expect(
      render(
        <HomeWorkshopSection
          featuredWorkshops={[]}
          browseUrl="/kham-pha"
          loading
          error={false}
          refetch={() => {}}
        />,
      ),
    ).toContain('Đang tải vé workshop');
    expect(
      render(
        <HomeFeaturedStudios
          studios={[]}
          loading={false}
          error={false}
          refetch={() => {}}
        />,
      ),
    ).toContain('Chưa có studio công khai');
    expect(
      render(
        <HomeFeaturedStudios
          studios={[]}
          loading={false}
          error
          refetch={() => {}}
        />,
      ),
    ).toContain('Thử lại');
  });
});
