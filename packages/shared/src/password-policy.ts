import { z } from 'zod';

export function passwordRequirements(password: string) {
  return {
    length: password.length >= 12 && password.length <= 128,
    letters: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password),
    digit: /[0-9]/.test(password),
    special: /[\p{P}\p{S}]/u.test(password),
  };
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isCommonPassword(password: string): boolean {
  return /^(?:password|qwerty|admin|welcome|letmein|iloveyou|matkhau|openslot)[0-9]*$/.test(
    normalize(password),
  );
}

export function containsAccountInformation(
  password: string,
  email: string,
  fullName: string,
): boolean {
  const normalizedPassword = normalize(password);
  const values = [email, email.split('@')[0] ?? '', fullName]
    .map(normalize)
    .filter((value) => value.length >= 3);
  return values.some((value) => normalizedPassword.includes(value));
}

export const newPasswordSchema = z
  .string()
  .min(12, 'Mật khẩu cần có từ 12 đến 128 ký tự.')
  .max(128, 'Mật khẩu cần có từ 12 đến 128 ký tự.')
  .regex(/\p{Lu}/u, 'Mật khẩu cần có chữ hoa và chữ thường.')
  .regex(/\p{Ll}/u, 'Mật khẩu cần có chữ hoa và chữ thường.')
  .regex(/[0-9]/, 'Mật khẩu cần có ít nhất một chữ số.')
  .regex(/[\p{P}\p{S}]/u, 'Mật khẩu cần có ít nhất một ký tự đặc biệt.')
  .refine(
    (password) => !isCommonPassword(password),
    'Mật khẩu này quá phổ biến. Hãy chọn mật khẩu khác.',
  );

export const registrationInputSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Họ tên cần có từ 2 đến 120 ký tự.')
      .max(120, 'Họ tên cần có từ 2 đến 120 ký tự.'),
    email: z
      .string()
      .trim()
      .max(254, 'Email không được quá 254 ký tự.')
      .email('Nhập địa chỉ email hợp lệ.'),
    password: newPasswordSchema,
  })
  .refine(
    (input) =>
      !containsAccountInformation(input.password, input.email, input.fullName),
    {
      path: ['password'],
      message:
        'Mật khẩu không được chứa email, tên đăng nhập hoặc họ tên của bạn.',
    },
  );
