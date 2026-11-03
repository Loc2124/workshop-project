import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useAdminStudios: vi.fn(),
  useAdminWorkshops: vi.fn(),
  useSetStudioStatus: vi.fn(),
  useDecideWorkshop: vi.fn(),
  useSetStudioVerification: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: mocks.useAuth }));
vi.mock('../hooks/useManagement', () => ({
  useAdminStudios: mocks.useAdminStudios,
  useAdminWorkshops: mocks.useAdminWorkshops,
  useSetStudioStatus: mocks.useSetStudioStatus,
  useDecideWorkshop: mocks.useDecideWorkshop,
  useSetStudioVerification: mocks.useSetStudioVerification,
}));
vi.mock('../components/layout/SiteHeader', () => ({
  SiteHeader: () => null,
}));

import { AdminApprovalPage } from './AdminApprovalPage';
import { StudioVerificationPanel } from '../components/management/StudioVerificationPanel';
import { StudioTrustBadge } from '../components/ui/StudioTrustBadge';

const admin = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.test',
  fullName: 'Quản trị viên',
  role: 'admin' as const,
};

const studio = {
  id: '00000000-0000-4000-8000-000000000002',
  ownerUserId: '00000000-0000-4000-8000-000000000003',
  ownerFullName: 'Nguyễn An',
  name: 'Studio gốm An',
  description: 'Studio gốm thủ công.',
  address: 'Địa chỉ studio',
  provinceId: 'ho-chi-minh',
  province: 'TP. Hồ Chí Minh',
  areaId: null,
  status: 'pending',
  createdAt: '2026-11-02T00:00:00.000Z',
};

const workshop = {
  id: '00000000-0000-4000-8000-000000000004',
  slug: 'buoi-lam-gom',
  studioId: studio.id,
  studioName: studio.name,
  studioStatus: 'approved',
  title: 'Buổi làm gốm',
  description: 'Tạo hình một chiếc cốc bằng tay.',
  categoryId: 'ceramics',
  level: 'beginner',
  audience: ['người mới'],
  takeaway: null,
  durationMinutes: 90,
  basePrice: 120000,
  requirements: null,
  cancellationPolicy: null,
  paymentPolicy: null,
  province: 'TP. Hồ Chí Minh',
  areaId: null,
  address: studio.address,
  status: 'pending',
  createdAt: '2026-11-02T00:00:00.000Z',
  reviewHistory: [],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retryOnMount: false } },
  });
  const data = mocks.useAdminWorkshops().data;
  client.setQueryData(
    [
      'private',
      admin.id,
      'workshopReviews',
      'lists',
      {
        page: 1,
        pageSize: 20,
        q: '',
        tab: 'pending',
        sort: 'createdAt:desc',
        filters: { period: '', provinceId: '', categoryId: '' },
      },
    ],
    {
      rows: data.workshops,
      total: data.pagination.total,
      statusCounts: {
        pending: data.workshops.length,
        approved: 0,
        rejected: 0,
        all: data.workshops.length,
      },
    },
  );
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminApprovalPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminApprovalPage', () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({
      user: admin,
      isLoading: false,
      authError: null,
      retryAuth: vi.fn(),
      logout: vi.fn(),
      isLoggingOut: false,
    });
    mocks.useAdminStudios.mockReturnValue({
      isPending: false,
      error: null,
      data: [studio],
      refetch: vi.fn(),
    });
    mocks.useAdminWorkshops.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        workshops: [workshop],
        pagination: { page: 1, pageSize: 10, total: 1 },
      },
      refetch: vi.fn(),
    });
    mocks.useSetStudioStatus.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    });
    mocks.useDecideWorkshop.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    });
  });

  it('shows the verification form and the correct tier for approved studios', () => {
    mocks.useSetStudioVerification.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    });
    mocks.useAdminStudios.mockReturnValue({
      isPending: false,
      error: null,
      data: [{ ...studio, status: 'approved', trustLevel: 'approved' }],
      refetch: vi.fn(),
    });
    const current = mocks.useAdminStudios().data[0];
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <StudioTrustBadge level={current.trustLevel} />
        <StudioVerificationPanel studio={current} />
      </MemoryRouter>,
    );
    expect(html).toContain('Bậc 1 · Đã duyệt');
    expect(html).toContain('Căn cứ đối chiếu');
    expect(html).toContain('Cấp xác minh bậc 2');
    expect(html).not.toContain('Thu hồi huy hiệu xác minh');
  });
  it('shows revocation and history for verified studios', () => {
    mocks.useSetStudioVerification.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    });
    mocks.useAdminStudios.mockReturnValue({
      isPending: false,
      error: null,
      data: [
        {
          ...studio,
          status: 'approved',
          trustLevel: 'verified',
          verificationHistory: [
            {
              action: 'verified',
              method: 'identity_address',
              reason: null,
              reviewerName: 'Nguyễn Admin',
              createdAt: '2026-11-02T00:00:00Z',
            },
          ],
        },
      ],
      refetch: vi.fn(),
    });
    const current = mocks.useAdminStudios().data[0];
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <StudioTrustBadge level={current.trustLevel} />
        <StudioVerificationPanel studio={current} />
      </MemoryRouter>,
    );
    expect(html).toContain('Bậc 2 · Đã xác minh');
    expect(html).toContain('Thu hồi huy hiệu xác minh');
    expect(html).toContain('Nguyễn Admin');
    expect(html).not.toContain('Cấp xác minh bậc 2');
  });

  it('renders workshops through the shared server table', () => {
    const html = renderPage();

    expect(html).toContain('Buổi làm gốm');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('<table');
  });
  it('makes category approval explicit when a workshop has a proposal', () => {
    mocks.useAdminWorkshops.mockReturnValue({
      isPending: false,
      error: null,
      data: {
        workshops: [
          {
            ...workshop,
            categoryId: 'other',
            proposedCategoryName: 'Thêu tay',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1 },
      },
      refetch: vi.fn(),
    });
    const html = renderPage();
    expect(html).toContain('Đề xuất: Thêu tay');
    expect(html).toContain('Buổi làm gốm');
  });
});
