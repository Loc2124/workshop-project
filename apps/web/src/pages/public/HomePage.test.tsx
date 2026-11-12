import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ categories: vi.fn() }));
vi.mock('../../hooks/useCategories', () => ({
  useCategoriesQuery: mocks.categories,
}));
vi.mock('../../hooks/useHomeCatalog', () => ({
  useHomeCatalog: () => ({ featuredWorkshops: [], featuredStudios: [] }),
}));
vi.mock('../../components/home/HomeSearchHero', () => ({
  HomeSearchHero: () => null,
}));
vi.mock('../../components/home/HomeWorkshopSection', () => ({
  HomeWorkshopSection: () => null,
}));
vi.mock('../../components/home/HomeFeaturedStudios', () => ({
  HomeFeaturedStudios: () => null,
}));
vi.mock('../../components/home/HomeProcessSection', () => ({
  HomeProcessSection: () => null,
}));
vi.mock('../../components/home/HomeArtisanSection', () => ({
  HomeArtisanSection: () => null,
}));
import { HomePage } from './HomePage';
const category = {
  id: 'ceramics',
  slug: 'gom',
  name: 'Làm gốm',
  status: 'active' as const,
  sortOrder: 1,
  keywords: [],
  description: '',
};
const renderPage = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
beforeEach(() =>
  mocks.categories.mockReturnValue({
    data: [category],
    isPending: false,
    isError: false,
  }),
);
describe('home categories', () => {
  it('shows configured categories even without any public workshops', () => {
    const html = renderPage();
    expect(html).toContain('Làm gốm');
    expect(html).toContain('href="/kham-pha?mon=gom"');
  });
  it('does not expose hidden or pending categories', () => {
    mocks.categories.mockReturnValue({
      data: [
        category,
        { ...category, id: 'hidden', name: 'Ẩn', isVisible: false },
        {
          ...category,
          id: 'pending',
          name: 'Đang xét duyệt',
          status: 'pending',
        },
      ],
      isPending: false,
      isError: false,
    });
    const html = renderPage();
    expect(html).toContain('Làm gốm');
    expect(html).not.toContain('>Ẩn<');
    expect(html).not.toContain('Đang xét duyệt');
  });
  it('shows a loading state while the category request is pending', () => {
    mocks.categories.mockReturnValue({ isPending: true, isError: false });
    expect(renderPage()).toContain('Đang tải danh mục');
  });
  it('shows a retry action when category loading fails', () => {
    mocks.categories.mockReturnValue({ isPending: false, isError: true });
    const html = renderPage();
    expect(html).toContain('Chưa tải được danh mục');
    expect(html).toContain('Thử lại');
  });
});
