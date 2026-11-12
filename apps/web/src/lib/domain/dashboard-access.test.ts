import { describe, expect, it } from 'vitest';
import { hasDashboardRole } from './dashboard-access';
describe('dashboard access', () => {
  it('allows studio owners using membership rather than a new JWT role', () => {
    expect(
      hasDashboardRole(
        { role: 'customer' },
        [{ role: 'owner' }],
        'studio_owner',
      ),
    ).toBe(true);
    expect(
      hasDashboardRole(
        { role: 'customer' },
        [{ role: 'staff' }],
        'studio_owner',
      ),
    ).toBe(false);
    expect(
      hasDashboardRole(
        { role: 'customer' },
        [{ role: 'staff' }],
        'studio_member',
      ),
    ).toBe(true);
    expect(hasDashboardRole({ role: 'customer' }, [], 'studio_owner')).toBe(
      false,
    );
    expect(hasDashboardRole({ role: 'customer' }, [], 'studio_member')).toBe(
      false,
    );
  });
  it('keeps admin access separate from studio ownership', () => {
    expect(hasDashboardRole({ role: 'admin' }, [], 'admin')).toBe(true);
    expect(hasDashboardRole({ role: 'admin' }, [], 'studio_owner')).toBe(false);
    expect(
      hasDashboardRole({ role: 'admin' }, [{ role: 'owner' }], 'studio_owner'),
    ).toBe(true);
    expect(
      hasDashboardRole({ role: 'customer' }, [{ role: 'owner' }], 'admin'),
    ).toBe(false);
    expect(hasDashboardRole(null, [{ role: 'owner' }], 'studio_owner')).toBe(
      false,
    );
  });
});
