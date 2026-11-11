import { z } from 'zod';
import type { AuthUser } from '../services/authService';

const internalRedirectSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    if (
      !value.startsWith('/') ||
      value.startsWith('//') ||
      value.includes('\\') ||
      [...value].some((character) => character.charCodeAt(0) <= 32)
    )
      return false;
    try {
      const url = new URL(value, 'https://open-slot.invalid');
      let pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '');
      pathname = pathname.toLowerCase();
      return (
        url.origin === 'https://open-slot.invalid' &&
        !pathname.startsWith('//') &&
        !pathname.includes('\\') &&
        pathname !== '/dang-nhap' &&
        pathname !== '/dang-ky' &&
        pathname !== '/quen-mat-khau' &&
        pathname !== '/dat-lai-mat-khau'
      );
    } catch {
      return false;
    }
  });

export function safeAuthRedirect(value: unknown): string {
  const result = internalRedirectSchema.safeParse(value);
  return result.success ? result.data : '/';
}

export function authHref(
  route: '/dang-nhap' | '/dang-ky' | '/quen-mat-khau',
  destination: string,
): string {
  const redirect = safeAuthRedirect(destination);
  return redirect === '/'
    ? route
    : `${route}?${new URLSearchParams({ redirect })}`;
}

export function authRedirectFromSearch(search: string): string {
  return safeAuthRedirect(new URLSearchParams(search).get('redirect'));
}

export function postLoginDestination(
  user: Pick<AuthUser, 'role'>,
  destination: unknown = '/',
): string {
  const redirect = safeAuthRedirect(destination);
  const pathname = new URL(
    redirect,
    'https://open-slot.invalid',
  ).pathname.toLowerCase();
  const within = (root: string) =>
    pathname === root || pathname.startsWith(root + '/');
  if (user.role === 'admin') return within('/admin') ? redirect : '/admin';
  if (user.role === 'studio_owner')
    return within('/studio') ? redirect : '/studio';
  return within('/admin') || within('/studio') ? '/' : redirect;
}
