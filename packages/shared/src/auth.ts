import { z } from 'zod';

export const registerInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export const loginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
