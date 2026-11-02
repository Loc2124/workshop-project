import { describe, expect, it } from 'vitest';
import {
  authFieldErrors,
  loginFormSchema,
  registrationFormSchema,
} from './auth-validation';

const registration = {
  fullName: 'Nguyen An',
  email: 'an@example.com',
  password: 'WillowFern72!',
  confirmPassword: 'WillowFern72!',
  acceptedTerms: true,
};

describe('auth form validation', () => {
  it('reports errors for every invalid login field together', () => {
    const result = loginFormSchema.safeParse({
      email: 'invalid',
      password: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(Object.keys(authFieldErrors(result.error))).toEqual([
        'email',
        'password',
      ]);
  });
  it.each([8, 128])('accepts a password with %i characters', (length) => {
    expect(
      loginFormSchema.safeParse({
        email: 'an@example.com',
        password: 'a'.repeat(length),
      }).success,
    ).toBe(true);
  });
  it.each([0, 7, 129])('rejects a password with %i characters', (length) => {
    expect(
      loginFormSchema.safeParse({
        email: 'an@example.com',
        password: 'a'.repeat(length),
      }).success,
    ).toBe(false);
  });
  it('requires agreement and reports confirmation mismatch under its field', () => {
    const result = registrationFormSchema.safeParse({
      ...registration,
      confirmPassword: 'different',
      acceptedTerms: false,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(authFieldErrors(result.error)).toMatchObject({
        acceptedTerms: expect.any(String),
        confirmPassword: 'Mật khẩu nhập lại không khớp',
      });
  });
  it('trims the name and email while preserving the password', () => {
    const result = registrationFormSchema.parse({
      ...registration,
      fullName: '  Nguyen An  ',
      email: '  an@example.com  ',
      password: ' WillowFern72! ',
      confirmPassword: ' WillowFern72! ',
    });
    expect(result).toMatchObject({
      fullName: 'Nguyen An',
      email: 'an@example.com',
      password: ' WillowFern72! ',
    });
  });
  it.each([
    'ShortAbc12',
    'a'.repeat(127) + 'A1',
    'lowercaseonly12',
    'UPPERCASEONLY12',
    'WithoutAnyDigits',
    'WillowFern72',
    'WillowFern72 ',
    'Password123456!',
  ])('rejects an unsuitable new password: %s', (password) => {
    const result = registrationFormSchema.safeParse({
      ...registration,
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(authFieldErrors(result.error)).toHaveProperty('password');
  });
  it.each([
    'Aa1!' + 'b'.repeat(8),
    'Aa1!' + 'b'.repeat(124),
    'CâyThôngXanh72!',
  ])('accepts valid new passwords including Unicode letters', (password) => {
    expect(
      registrationFormSchema.safeParse({
        ...registration,
        password,
        confirmPassword: password,
      }).success,
    ).toBe(true);
  });
  it.each(['an@example.comZ9', 'NguyenAnSafe72', 'nguyen.an@example.com'])(
    'blocks account information',
    (password) => {
      expect(
        registrationFormSchema.safeParse({
          ...registration,
          password,
          confirmPassword: password,
        }).success,
      ).toBe(false);
    },
  );
});
