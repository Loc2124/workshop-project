import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuth = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useAuth', () => ({ useAuth }));
vi.mock('../../components/layout/SiteHeader', () => ({
  SiteHeader: () => null,
}));

import { RegisterPage } from './RegisterPage';

function renderPage() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: null,
      isLoading: false,
      authError: null,
      retryAuth: vi.fn(),
      register: vi.fn(),
      isRegistering: false,
    });
  });

  it('shows a customer registration form and login link', () => {
    const html = renderPage();

    expect(html).toContain('Tạo tài khoản');
    expect(html).toContain('name="fullName"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain('href="/dang-nhap"');
  });

  it('does not offer registration to a user who is already signed in', () => {
    useAuth.mockReturnValue({
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'khach@example.com',
        fullName: 'Nguyen Thi An',
        role: 'customer',
      },
      isLoading: false,
      authError: null,
      retryAuth: vi.fn(),
      register: vi.fn(),
      isRegistering: false,
    });

    const html = renderPage();

    expect(html).toContain('Bạn đã có tài khoản');
    expect(html).not.toContain('name="password"');
  });
});
