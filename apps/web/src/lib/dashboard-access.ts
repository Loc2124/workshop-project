import type { AuthUser } from '../services/authService';
import type { MemberStudio } from '../types/management';
export type DashboardRole = 'studio_owner' | 'admin';
export function hasDashboardRole(
  user: Pick<AuthUser, 'role'> | null,
  studios: Pick<MemberStudio, 'role'>[] | undefined,
  role: DashboardRole,
) {
  if (!user) return false;
  return role === 'admin'
    ? user.role === 'admin'
    : Boolean(studios?.some((studio) => studio.role === 'owner'));
}
