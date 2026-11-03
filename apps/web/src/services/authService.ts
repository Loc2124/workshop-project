import { ApiError, apiFetch } from '../lib/api-client';
export type { AuthUser, RegisterInput, LoginInput } from './authSchemas';
import type { AuthUser, RegisterInput, LoginInput } from './authSchemas';
async function requestCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const response = await apiFetch<unknown>('/me', { signal });
  return (await import('./authSchemas')).authResponseSchema.parse(response)
    .user;
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
    return (await import('./authSchemas')).authResponseSchema.parse(response)
      .user;
  },

  async register(input: RegisterInput): Promise<AuthUser> {
    const body = (await import('./authSchemas')).registerInputSchema.parse(
      input,
    );
    const response = await apiFetch<unknown>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return (await import('./authSchemas')).authResponseSchema.parse(response)
      .user;
  },

  logout(): Promise<void> {
    return apiFetch('/auth/logout', {
      method: 'POST',
      responseType: 'void',
    });
  },
};
