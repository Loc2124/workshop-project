import { z } from 'zod';
import { registrationInputSchema } from '@workshop/shared';
import { ApiError, apiFetch } from '../lib/api-client';

const authUserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    role: z.enum(['customer', 'studio_owner', 'admin']),
  })
  .strict();

const authResponseSchema = z.object({ user: authUserSchema }).strict();

export type AuthUser = z.infer<typeof authUserSchema>;
export type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};
export const registerInputSchema = registrationInputSchema.strict();
export type RegisterInput = z.infer<typeof registerInputSchema>;

async function requestCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const response = await apiFetch<unknown>('/me', { signal });
  return authResponseSchema.parse(response).user;
}

function isUnauthorized(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

export const authService = {
  async currentUser(signal?: AbortSignal): Promise<AuthUser | null> {
    try {
      return await requestCurrentUser(signal);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      return null;
    }
  },

  async login(input: LoginInput): Promise<AuthUser> {
    const response = await apiFetch<unknown>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return authResponseSchema.parse(response).user;
  },

  async register(input: RegisterInput): Promise<AuthUser> {
    const body = registerInputSchema.parse(input);
    const response = await apiFetch<unknown>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return authResponseSchema.parse(response).user;
  },

  logout(): Promise<void> {
    return apiFetch('/auth/logout', {
      method: 'POST',
      responseType: 'void',
    });
  },
};
