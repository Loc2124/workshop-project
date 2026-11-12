import { describe, expect, it } from 'vitest';
import { readDataTableQuery } from './data-table';
import { adminTableSearch } from '@/services/adminTableService';
const options = {
  defaultTab: 'pending',
  tabs: ['pending', 'approved', 'all'],
  defaultSort: 'createdAt:desc',
  sortIds: ['name', 'createdAt'],
  defaultPageSize: 20,
  filters: [
    {
      id: 'provinceId',
      label: 'Tỉnh/thành',
      options: [{ value: 'ha-noi', label: 'Hà Nội' }],
    },
  ],
};
describe('server data table query', () => {
  it('restores pagination, search, tab, sort and allowlisted filters from the URL', () => {
    const result = readDataTableQuery(
      new URLSearchParams(
        'page=3&pageSize=50&q=%20Gốm%20&tab=approved&sort=name:asc&filter.provinceId=ha-noi',
      ),
      options,
    );
    expect(result).toEqual({
      page: 3,
      pageSize: 50,
      q: 'Gốm',
      tab: 'approved',
      sort: 'name:asc',
      filters: { provinceId: 'ha-noi' },
    });
    expect(adminTableSearch(result)).toBe(
      'page=3&pageSize=50&status=approved&q=G%E1%BB%91m&sort=name%3Aasc&provinceId=ha-noi',
    );
  });
  it('ignores unsupported filters, bounds pagination and rejects invalid sort fields', () => {
    expect(
      readDataTableQuery(
        new URLSearchParams(
          'page=-2&pageSize=999&tab=bad&sort=private:desc&filter.provinceId=unknown',
        ),
        options,
      ),
    ).toEqual({
      page: 1,
      pageSize: 20,
      q: '',
      tab: 'pending',
      sort: 'createdAt:desc',
      filters: { provinceId: '' },
    });
  });
});
