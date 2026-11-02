import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../services/authService';
import type {
  MemberStudio,
  StudioSession,
  StudioWorkshop,
} from '../../types/management';
import { StudioManagementContent } from './StudioManagementContent';

const user: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'owner@example.test',
  fullName: 'Nguyen Thi An',
  role: 'customer',
};

const studio: MemberStudio = {
  id: '00000000-0000-4000-8000-000000000002',
  slug: 'studio-gom-an',
  name: 'Studio gốm An',
  description: null,
  categoryId: 'ceramics',
  provinceId: 'ho-chi-minh',
  province: 'TP. Hồ Chí Minh',
  areaId: null,
  area: null,
  address: 'Địa chỉ studio',
  status: 'approved',
  role: 'owner',
  createdAt: '2026-11-02T00:00:00.000Z',
};

const workshop: StudioWorkshop = {
  id: '00000000-0000-4000-8000-000000000003',
  slug: 'buoi-lam-gom',
  studioId: studio.id,
  title: 'Buổi làm gốm',
  description: 'Thực hành tạo hình gốm.',
  categoryId: 'ceramics',
  level: 'beginner',
  audience: ['người mới'],
  takeaway: null,
  durationMinutes: 90,
  basePrice: 120000,
  requirements: null,
  cancellationPolicy: null,
  paymentPolicy: null,
  provinceId: 'ho-chi-minh',
  areaId: null,
  address: studio.address,
  status: 'pending',
  createdAt: '2026-11-02T00:00:00.000Z',
};

const session: StudioSession = {
  id: '00000000-0000-4000-8000-000000000004',
  workshopId: workshop.id,
  workshopTitle: workshop.title,
  startsAt: '2026-12-01T02:00:00.000Z',
  endsAt: '2026-12-01T03:30:00.000Z',
  price: 120000,
  capacity: 10,
  seatsHeld: 2,
  seatsSold: 1,
  status: 'scheduled',
  createdAt: '2026-11-02T00:00:00.000Z',
};

function renderContent(
  overrides: Partial<ComponentProps<typeof StudioManagementContent>> = {},
) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <StudioManagementContent
          user={user}
          authLoading={false}
          authError={null}
          studiosLoading={false}
          studiosError={null}
          studio={studio}
          retryAuth={vi.fn()}
          retryStudios={vi.fn()}
          workshops={[workshop]}
          workshopsLoading={false}
          workshopsError={null}
          retryWorkshops={vi.fn()}
          sessions={[session]}
          sessionsLoading={false}
          sessionsError={null}
          retrySessions={vi.fn()}
          {...overrides}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StudioManagementContent', () => {
  it.each(['pending', 'rejected'] as const)(
    'keeps an %s studio private and shows its application status',
    (status) => {
      const html = renderContent({ studio: { ...studio, status } });
      expect(html).toContain(
        status === 'pending' ? 'Hồ sơ đang chờ duyệt' : 'Hồ sơ chưa được duyệt',
      );
      expect(html).not.toContain('href="/studios/studio-gom-an"');
      if (status === 'rejected') expect(html).toContain('Liên hệ hỗ trợ');
    },
  );
  it('does not render studio data when the user has no matching membership', () => {
    const html = renderContent({ studio: undefined });

    expect(html).toContain('Bạn không có quyền quản lý studio này');
    expect(html).toContain('href="/studio"');
    expect(html).not.toContain('Buổi làm gốm');
    expect(html).not.toContain('Lịch workshop');
  });

  it('shows workshop approval and session availability from the API data', () => {
    const html = renderContent();

    expect(html).toContain('Studio gốm An');
    expect(html).toContain('Chủ studio');
    expect(html).toContain('Buổi làm gốm');
    expect(html).toContain('Chờ duyệt');
    expect(html).toContain('Còn 7 / 10 chỗ');
    expect(html).toContain('href="/studios/studio-gom-an"');
    expect(html).toContain('Tạo workshop');
  });

  it('lets staff edit workshop content without offering owner-only creation', () => {
    const html = renderContent({
      studio: { ...studio, role: 'staff' },
    });

    expect(html).toContain('Sửa');
    expect(html).not.toContain('Tạo workshop');
    expect(html).toContain('Tạo buổi');
  });

  it('offers retries for independent workshop and session failures', () => {
    const html = renderContent({
      workshopsError: new Error('Lỗi workshop'),
      sessionsError: new Error('Lỗi lịch'),
    });

    expect(html).toContain('Không thể tải workshop');
    expect(html).toContain('Tải lại workshop');
    expect(html).toContain('Không thể tải lịch');
    expect(html).toContain('Tải lại lịch');
  });

  it('shows empty states independently for workshops and sessions', () => {
    const html = renderContent({ workshops: [], sessions: [] });

    expect(html).toContain('Studio chưa có workshop');
    expect(html).toContain('Tạo workshop trước khi thêm buổi vào lịch.');
  });

  it('asks signed-out users to log in before loading management content', () => {
    const html = renderContent({ user: null, studio: undefined });

    expect(html).toContain('Đăng nhập để quản lý studio');
    expect(html).toContain('href="/dang-nhap"');
  });
});
