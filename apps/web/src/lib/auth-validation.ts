import { z } from 'zod';
import { newPasswordSchema, registrationInputSchema } from '@workshop/shared';

export const forgotPasswordFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập email.')
    .max(254, 'Email không được quá 254 ký tự.')
    .email('Nhập địa chỉ email hợp lệ.'),
});

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập email.')
    .max(254, 'Email không được quá 254 ký tự.')
    .email('Nhập địa chỉ email hợp lệ.'),
  password: z
    .string()
    .min(8, 'Mật khẩu cần có từ 8 đến 128 ký tự.')
    .max(128, 'Mật khẩu cần có từ 8 đến 128 ký tự.'),
});

export const resetPasswordFormSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  });

export const registrationFormSchema = registrationInputSchema
  .safeExtend({
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu.'),
    acceptedTerms: z
      .boolean()
      .refine(Boolean, 'Bạn cần đồng ý với Điều khoản và Chính sách bảo mật.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  });

export function authFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    errors[field] ??= issue.message;
  }
  return errors;
}
