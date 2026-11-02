import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config.js', () => ({
  loadConfig: () => ({
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '14d',
  }),
}));
vi.mock('../../src/modules/auth/auth.repository.js', () => ({
  rotateAuthSession: vi.fn(),
}));

import { rotateAuthSession } from '../../src/modules/auth/auth.repository.js';
import { refreshCustomerSession } from '../../src/modules/auth/auth.service.js';

describe('refresh response', () => {
  it('returns the account ID instead of the session ID', async () => {
    vi.mocked(rotateAuthSession).mockResolvedValueOnce({
      id: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      email: 'customer@example.test',
      fullName: 'Customer',
      role: 'customer',
    });
    const result = await refreshCustomerSession('old-refresh-token');
    expect(result?.user.id).toBe('00000000-0000-4000-8000-000000000002');
    expect(result?.refreshToken).not.toBe('old-refresh-token');
  });
});
