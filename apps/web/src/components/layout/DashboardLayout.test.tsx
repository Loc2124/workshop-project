import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, CalendarDays } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), isLoggingOut: false }),
}));
import {
  DashboardLayout,
  activeDashboardItem,
  type DashboardMenuItem,
} from './DashboardLayout';
const menuItems: DashboardMenuItem[] = [
  { label: 'Tổng quan', to: '/studio', icon: LayoutDashboard },
  {
    label: 'Lịch và slot',
    to: '/studio/sessions?studioId=selected',
    icon: CalendarDays,
  },
];
describe('shared dashboard layout', () => {
  it('renders route breadcrumbs, active navigation and nested content', () => {
    const client = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/studio/sessions?studioId=selected']}>
          <Routes>
            <Route
              path="/studio"
              element={
                <DashboardLayout
                  roleLabel="Quản lý studio"
                  menuItems={menuItems}
                  user={{
                    id: 'owner',
                    fullName: 'Nguyễn An',
                    email: 'owner@example.test',
                    role: 'customer',
                  }}
                />
              }
            >
              <Route path="sessions" element={<h1>Lịch của studio</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(html).toContain('Lịch của studio');
    expect(html).toContain('Menu tài khoản');
    expect(html).not.toContain('Về trang khách');
    expect(html).toContain('max-w-5xl');
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('dashboard-content');
  });
  it('matches route boundaries and ignores workspace query parameters', () => {
    expect(activeDashboardItem(menuItems, '/studio/sessions')?.label).toBe(
      'Lịch và slot',
    );
    expect(activeDashboardItem(menuItems, '/studio/sessions/123')?.label).toBe(
      'Lịch và slot',
    );
    expect(
      activeDashboardItem(menuItems, '/studio/sessions-extra'),
    ).toBeUndefined();
    expect(activeDashboardItem(menuItems, '/studio/studios/id')?.label).toBe(
      'Tổng quan',
    );
    expect(activeDashboardItem(menuItems, '/studio/')?.label).toBe('Tổng quan');
  });
});
