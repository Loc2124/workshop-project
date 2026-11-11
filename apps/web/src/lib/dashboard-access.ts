import type { AuthUser } from '../services/authService';
import type { MemberStudio } from '../types/management';
export type DashboardRole = 'studio_owner' | 'admin' | 'studio_member';
export function hasDashboardRole(
  user: Pick<AuthUser, 'role'> | null,
  studios: Pick<MemberStudio, 'role'>[] | undefined,
  role: DashboardRole,
) {
  if (!user) return false;
  if (role === 'admin') return user.role === 'admin';
  if (role === 'studio_owner')
    return Boolean(studios?.some((studio) => studio.role === 'owner'));
  if (role === 'studio_member')
    return Boolean(
      studios?.some((studio) => studio.role === 'owner' || studio.role === 'staff'),
    );
  return false;
}
