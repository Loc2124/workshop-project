import { describe, expect, it } from 'vitest';
import {
  authHref,
  authRedirectFromSearch,
  safeAuthRedirect,
  postLoginDestination,
} from './auth-navigation';

describe('authentication navigation', () => {
  it.each([
    undefined,
    null,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/%5cevil.test',
    'javascript:alert(1)',
    '/dang-nhap',
    '/dang-ky?redirect=/',
    '/DANG-NHAP/',
    '/dang-ky/',
    '/%64ang-nhap',
    '/a/../dang-nhap',
    '/\n/evil.test',
  ])('rejects external, malformed or looping redirects: %s', (value) => {
    expect(safeAuthRedirect(value)).toBe('/');
  });
  it('preserves a local path, query and anchor', () => {
    const destination = '/kham-pha?q=gom&date=2026-12-01#ket-qua';
    const href = authHref('/dang-nhap', destination);
    expect(authRedirectFromSearch(href.slice(href.indexOf('?')))).toBe(
      destination,
    );
    expect(
      authHref(
        '/dang-ky',
        authRedirectFromSearch(href.slice(href.indexOf('?'))),
      ),
    ).toBe(authHref('/dang-ky', destination));
  });
  it('uses the homepage by default', () => {
    expect(authRedirectFromSearch('')).toBe('/');
    expect(authHref('/dang-nhap', '/')).toBe('/dang-nhap');
  });
  it('sends admin and studio owners straight to their dashboards, including public return links', () => {
    expect(postLoginDestination({ role: 'admin' })).toBe('/admin');
    expect(postLoginDestination({ role: 'studio_owner' })).toBe('/studio');
    expect(postLoginDestination({ role: 'admin' }, '/kham-pha?q=gom')).toBe(
      '/admin',
    );
    expect(
      postLoginDestination({ role: 'studio_owner' }, '/workshops/example'),
    ).toBe('/studio');
    expect(postLoginDestination({ role: 'customer' })).toBe('/');
  });
  it('keeps authorized dashboard deep links and customer return flows', () => {
    expect(
      postLoginDestination(
        { role: 'admin' },
        '/admin/ho-so-studio?tab=pending',
      ),
    ).toBe('/admin/ho-so-studio?tab=pending');
    expect(
      postLoginDestination({ role: 'studio_owner' }, '/studio/123/workshops'),
    ).toBe('/studio/123/workshops');
    expect(postLoginDestination({ role: 'customer' }, '/dang-ky-studio')).toBe(
      '/dang-ky-studio',
    );
    expect(
      postLoginDestination({ role: 'customer' }, '/studios/example#workshops'),
    ).toBe('/studios/example#workshops');
    expect(postLoginDestination({ role: 'customer' }, '/admin')).toBe('/');
    expect(postLoginDestination({ role: 'studio_owner' }, '/admin')).toBe(
      '/studio',
    );
    expect(postLoginDestination({ role: 'admin' }, '//evil.test')).toBe(
      '/admin',
    );
  });
});
