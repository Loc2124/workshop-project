import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../services/authService';
import type { MemberStudio } from '../../types/management';
import { StudioOverview } from './StudioOverview';

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
  description: 'Cùng làm quen với đất và men.',
  categoryId: 'ceramics',
  provinceId: 'ho-chi-minh',
  province: 'TP. Hồ Chí Minh',
  areaId: null,
  area: null,
  address: 'Địa chỉ studio',
  status: 'pending',
  role: 'owner',
  createdAt: '2026-11-02T00:00:00.000Z',
};

function renderOverview(
  overrides: Partial<ComponentProps<typeof StudioOverview>> = {},
) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <StudioOverview
        user={user}
        authLoading={false}
        authError={null}
        retryAuth={vi.fn()}
        studios={[]}
        studiosLoading={false}
        studiosError={null}
        retryStudios={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('StudioOverview', () => {
  it('shows loading and recoverable authentication or list errors', () => {
    expect(renderOverview({ authLoading: true })).toContain(
      'Đang kiểm tra phiên đăng nhập',
    );
    expect(
      renderOverview({ authError: new Error('máy chủ không phản hồi') }),
    ).toContain('Không thể kiểm tra phiên đăng nhập');
    expect(
      renderOverview({ studiosError: new Error('máy chủ không phản hồi') }),
    ).toContain('Không thể tải danh sách studio');
    expect(
      renderOverview({
        studiosError: new Error('máy chủ không phản hồi'),
      }),
    ).toContain('Tải lại danh sách');
  });

  it('directs signed-out users to login and members without studios to the artisan page', () => {
    const signedOut = renderOverview({ user: null });
    expect(signedOut).toContain('Đăng nhập để xem những studio bạn tham gia');
    expect(signedOut).toContain('href="/dang-nhap"');

    const emptyMembership = renderOverview({ studios: [] });
    expect(emptyMembership).toContain('Tài khoản này chưa tham gia studio nào');
    expect(emptyMembership).toContain('href="/dang-ky-studio"');
    expect(emptyMembership).toContain('Đăng ký mở studio');
    expect(emptyMembership).toContain('href="/danh-cho-nghe-nhan"');
  });

  it('shows only the supplied memberships with their role, approval and public page link', () => {
    const html = renderOverview({ studios: [studio] });

    expect(html).toContain('Studio gốm An');
    expect(html).toContain('Chủ studio');
    expect(html).toContain('Chờ duyệt');
    expect(html).toContain('TP. Hồ Chí Minh');
    expect(html).toContain(
      'href="/studio/studios/00000000-0000-4000-8000-000000000002"',
    );
    expect(html).toContain('Theo dõi hồ sơ đã gửi');
  });
});
