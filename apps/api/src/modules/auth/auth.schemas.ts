import { z } from 'zod';
import { registrationInputSchema } from '@workshop/shared';

export const registerSchema = registrationInputSchema;

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
