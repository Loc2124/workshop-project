vi.mock('../../hooks/useSiteSettings', async () => {
  const { defaultSiteSettings } = await import('@workshop/shared');
  return {
    useSiteSettings: () => ({ data: defaultSiteSettings, isSuccess: true }),
  };
});
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  useAdminStudios: vi.fn(),
  useAdminStudioDetail: vi.fn(() => ({
    data: undefined,
    isPending: false,
    error: null,
  })),
  useSetStudioStatus: vi.fn(),
}));
vi.mock('../../hooks/useManagement', () => ({
  ...mocks,
  useSetStudioVerification: vi.fn(),
}));
import { AdminStudioProfilesPage } from './AdminStudioProfilesPage';

const studio = {
  id: 'one',
  name: 'Studio An',
  ownerFullName: 'Nguyễn An',
  status: 'pending',
  createdAt: '2026-11-02T04:05:00Z',
  province: 'TP. Hồ Chí Minh',
};
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retryOnMount: false } },
  });
  const queryKey = [
    'private',
    'anonymous',
    'studios',
    'lists',
    {
      page: 1,
      pageSize: 20,
      q: '',
      tab: 'pending',
      sort: 'submittedAt:desc',
      filters: { reviewQueue: '', provinceId: '' },
    },
  ];
  const state = mocks.useAdminStudios();
  if (state.error)
    client
      .getQueryCache()
      .build(client, { queryKey })
      .setState({ status: 'error', error: state.error, fetchStatus: 'idle' });
  else
    client.setQueryData(queryKey, {
      rows: state.data.filter(
        (row: { status: string }) => row.status === 'pending',
      ),
      total: 1,
      statusCounts: { pending: 1, needs_changes: 1, approved: 1, rejected: 0 },
    });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminStudioProfilesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('studio review queue', () => {
  beforeEach(() => {
    mocks.useAdminStudios.mockReturnValue({
      data: [
        studio,
        {
          ...studio,
          id: 'two',
          name: 'Studio cần bổ sung',
          status: 'needs_changes',
        },
        { ...studio, id: 'three', name: 'Studio đã duyệt', status: 'approved' },
      ],
      isPending: false,
      error: null,
    });
    mocks.useSetStudioStatus.mockReturnValue({ isPending: false });
  });
  it('renders counted status tabs and the submitted profile table', () => {
    const html = renderPage();
    expect(html).toContain('Hồ sơ studio');
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    expect(html).toContain('<table');
    expect(html).toContain('Nguyễn An');
    expect(html).toContain('02/11/2026 11:05');
    expect(html).toContain('Thiếu 3 mục');
    expect(html).not.toContain('Studio đã duyệt');
    expect(html).not.toContain('Quản trị Open Slot');
    expect(html).not.toContain('hồ sơ bậc 1');
  });
  it('shows load failures instead of claiming the queue is empty', () => {
    mocks.useAdminStudios.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error('Unavailable'),
    });
    const html = renderPage();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Thử lại');
    expect(html).not.toContain('Chưa có hồ sơ trong trạng thái này');
  });
});
