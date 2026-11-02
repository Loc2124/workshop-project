import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  loginSchema,
} from '../../src/modules/auth/auth.schemas.js';

const input = {
  fullName: 'Nguyen Van Binh',
  email: 'binh@example.test',
  password: 'WillowFern72!',
};
describe('password rules at the API boundary', () => {
  it.each([
    'Oldpass1',
    'lowercaseonly12',
    'UPPERCASEONLY12',
    'WithoutAnyDigits',
    'Password123456!',
    'BinhIsMyName72',
    'NguyenVanBinh72',
  ])('rejects invalid new password %s', (password) => {
    expect(registerSchema.safeParse({ ...input, password }).success).toBe(
      false,
    );
  });
  it('requires special characters for new passwords', () => {
    expect(
      registerSchema.safeParse({ ...input, password: 'WillowFern72' }).success,
    ).toBe(false);
  });
  it('preserves legacy login without the new composition restrictions', () => {
    expect(
      loginSchema.safeParse({ email: input.email, password: 'oldpass1' })
        .success,
    ).toBe(true);
  });
});
