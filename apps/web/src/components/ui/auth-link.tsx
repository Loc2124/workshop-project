import type { ComponentProps } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authHref, authRedirectFromSearch } from '../../lib/auth-navigation';

const authPaths = new Set([
  '/dang-nhap',
  '/dang-ky',
  '/quen-mat-khau',
  '/dat-lai-mat-khau',
]);

export function AuthLink({
  to,
  ...props
}: Omit<ComponentProps<typeof Link>, 'to'> & {
  to: '/dang-nhap' | '/dang-ky' | '/quen-mat-khau';
}) {
  const location = useLocation();
  const destination = authPaths.has(location.pathname)
    ? authRedirectFromSearch(location.search)
    : `${location.pathname}${location.search}${location.hash}`;
  return <Link {...props} to={authHref(to, destination)} />;
}
