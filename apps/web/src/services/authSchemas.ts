import { z } from 'zod';
import { registrationInputSchema } from '@workshop/shared';
export const authUserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['customer', 'studio_owner', 'admin']),
  })
  .strict();

export const authResponseSchema = z.object({ user: authUserSchema }).strict();

export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};
export const registerInputSchema = registrationInputSchema.strict();
export type RegisterInput = z.infer<typeof registerInputSchema>;
