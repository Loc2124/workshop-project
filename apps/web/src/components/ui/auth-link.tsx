import type { ComponentProps } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authHref, authRedirectFromSearch } from '../../lib/auth-navigation';

export function AuthLink({
  to,
  ...props
}: Omit<ComponentProps<typeof Link>, 'to'> & {
  to: '/dang-nhap' | '/dang-ky';
}) {
  const location = useLocation();
  const destination =
    location.pathname === '/dang-nhap' || location.pathname === '/dang-ky'
      ? authRedirectFromSearch(location.search)
      : `${location.pathname}${location.search}${location.hash}`;
  return <Link {...props} to={authHref(to, destination)} />;
}
