import { describe, expect, it } from 'vitest';
import {
  adminStudioListQuerySchema,
  adminWorkshopListQuerySchema,
} from '../../src/modules/admin/admin.schemas.js';
import {
  adminListSql,
  adminStatusCounts,
} from '../../src/modules/admin/admin-list-sql.js';
describe('server admin table queries', () => {
  it('validates pagination aliases, sorting and query lengths', () => {
    expect(
      adminStudioListQuerySchema.parse({
        page: '2',
        pageSize: '50',
        status: 'needs_changes',
        sort: 'name:asc',
      }),
    ).toMatchObject({ page: 2, pageSize: 50 });
    for (const input of [
      { page: '0' },
      { pageSize: '101' },
      { page: '1.1' },
      { pageSize: '20', page_size: '10' },
      { sort: 'password_hash:desc' },
      { sort: 'name:asc;drop table users' },
      { q: 'x'.repeat(201) },
      { private: 'yes' },
    ])
      expect(adminStudioListQuerySchema.safeParse(input).success).toBe(false);
    expect(
      adminWorkshopListQuerySchema.safeParse({ status: 'needs_changes' })
        .success,
    ).toBe(false);
    expect(
      adminWorkshopListQuerySchema.parse({
        pageSize: '10',
        status: 'all',
        sort: 'basePrice:desc',
      }).pageSize,
    ).toBe(10);
  });
  it('uses bound literal search patterns and allowlisted SQL order expressions', () => {
    const q = "%' OR 1=1;--";
    const sql = adminListSql('studio', {
      status: 'pending',
      q,
      sort: 'name:asc',
      provinceId: 'ha-noi',
      categoryId: 'ceramics',
    });
    expect(sql.where).not.toContain(q);
    expect(sql.values).toEqual([
      'pending',
      `%\\%' OR 1=1;--%`,
      'ha-noi',
      'ceramics',
    ]);
    expect(sql.orderBy).toBe('st.name ASC NULLS LAST, st.id ASC');
    expect(
      adminListSql('studio', { status: 'pending', q }, false).values,
    ).toEqual([`%\\%' OR 1=1;--%`]);
  });
  it('counts every filtered status independently of the active tab', () => {
    expect(
      adminStatusCounts([
        { status: 'pending', count: 3 },
        { status: 'approved', count: 2 },
      ]),
    ).toEqual({
      pending: 3,
      needs_changes: 0,
      approved: 2,
      rejected: 0,
      suspended: 0,
      all: 5,
    });
  });
});
