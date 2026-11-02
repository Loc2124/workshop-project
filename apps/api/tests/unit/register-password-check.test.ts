import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/config.js', () => ({
  loadConfig: () => ({
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '14d',
  }),
}));
vi.mock('../../src/modules/auth/auth.repository.js', () => ({
  findUserByEmail: vi.fn().mockResolvedValue(null),
  createUser: vi.fn(),
}));
vi.mock('../../src/modules/auth/password-check.js', () => ({
  assertPasswordNotCompromised: vi.fn(),
}));
import { createUser } from '../../src/modules/auth/auth.repository.js';
import { assertPasswordNotCompromised } from '../../src/modules/auth/password-check.js';
import { registerCustomer } from '../../src/modules/auth/auth.service.js';
import { AppError } from '../../src/errors/app-error.js';

describe('registration breach enforcement', () => {
  it('does not create an account when the password is compromised', async () => {
    vi.mocked(assertPasswordNotCompromised).mockRejectedValue(
      new AppError(422, 'PASSWORD_COMPROMISED', 'Choose another password'),
    );
    await expect(
      registerCustomer({
        fullName: 'Nguyen An',
        email: 'an@example.test',
        password: 'WillowFern72!',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_COMPROMISED' });
    expect(createUser).not.toHaveBeenCalled();
  });
});
