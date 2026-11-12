vi.mock('@/hooks/useSiteSettings', async () => {
  const { defaultSiteSettings } = await import('@workshop/shared');
  return {
    useSiteSettings: () => ({ data: defaultSiteSettings, isSuccess: true }),
  };
});
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const useMyStudios = vi.hoisted(() => vi.fn());
const useAuth = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAuth', () => ({ useAuth }));
vi.mock('@/hooks/useOwnedStudios', () => ({ useMyStudios }));
vi.mock('@/components/layout/SiteHeader', () => ({
  SiteHeader: () => null,
}));
vi.mock('@/components/layout/SiteFooter', () => ({
  SiteFooter: () => null,
}));
import { ArtisanPage } from './ArtisanPage';

describe('artisan onboarding entry', () => {
  beforeEach(() => useAuth.mockReturnValue({ user: null }));
  it('lets a new artisan begin a studio profile', () => {
    useMyStudios.mockReturnValue({ data: [] });
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ArtisanPage />
      </MemoryRouter>,
    );
    expect(html).toContain('Bắt đầu tạo hồ sơ studio');
    expect(html).toContain('href="/dang-nhap?redirect=%2Fdang-ky-studio"');
    expect(html).toContain('Số điện thoại và email liên hệ của studio');
    expect(html).toContain('Ít nhất 3 ảnh thật');
  });
  it('prioritizes tracking for an owner with a pending profile without blocking another studio', () => {
    useAuth.mockReturnValue({ user: { id: 'owner' } });
    useMyStudios.mockReturnValue({
      data: [{ id: 'studio', role: 'owner', status: 'pending' }],
    });
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ArtisanPage />
      </MemoryRouter>,
    );
    expect(html).toContain('Theo dõi hồ sơ');
    expect(html).toContain('href="/studio"');
    expect(html).toContain('Đăng ký studio khác');
    expect(html).toContain('hồ sơ đang chờ duyệt');
  });
});
