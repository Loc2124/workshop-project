import { beforeEach, expect, it, vi } from 'vitest';
const { client } = vi.hoisted(() => ({ client: { query: vi.fn() } }));
vi.mock('../../src/db/pool.js', () => ({
  query: vi.fn(),
  withTransaction: (fn: (value: typeof client) => unknown) => fn(client),
}));
import { moderateUser } from '../../src/modules/admin/admin-users.js';
beforeEach(() => client.query.mockReset());
it.each(['block', 'change_role'] as const)(
  'protects the last active administrator against %s with HTTP 400',
  async (action) => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ role: 'admin', is_blocked: false }] })
      .mockResolvedValueOnce({
        rows: [{ role: 'admin', is_blocked: false, full_name: 'Last admin' }],
      })
      .mockResolvedValueOnce({ rows: [{ n: 1 }] });
    await expect(
      moderateUser(
        'target',
        'actor',
        action === 'block'
          ? {
              action,
              expectedRole: 'admin',
              expectedBlocked: false,
              reason: 'Administrator action reason',
            }
          : {
              action,
              role: 'customer',
              expectedRole: 'admin',
              expectedBlocked: false,
              reason: 'Administrator action reason',
            },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: expect.stringContaining('admin cuối cùng'),
    });
    expect(client.query).toHaveBeenCalledTimes(4);
  },
);
