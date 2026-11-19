import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
type Row = { id: string; name: string };
const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Tên' }];
function render(state: 'loading' | 'empty' | 'error' | 'ready') {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retryOnMount: false } },
  });
  const queryKey = [
    'private',
    'anonymous',
    'test-table',
    { page: 1, pageSize: 20, q: '', tab: 'all', sort: 'name:asc', filters: {} },
  ];
  if (state === 'error')
    client
      .getQueryCache()
      .build(client, { queryKey })
      .setState({
        status: 'error',
        error: new Error('Mất kết nối.'),
        fetchStatus: 'idle',
      });
  if (state === 'empty' || state === 'ready')
    client.setQueryData(queryKey, {
      rows: state === 'ready' ? [{ id: 'one', name: 'Studio An' }] : [],
      total: state === 'ready' ? 1 : 0,
    });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DataTable
          columns={columns}
          queryKey={['test-table']}
          fetcher={vi.fn(async () => ({ rows: [] as Row[], total: 0 }))}
          defaultSort="name:asc"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('shared server DataTable', () => {
  it('renders a flat skeleton rather than claiming pending data is empty', () => {
    const html = render('loading');
    expect(html).toContain('Đang tải danh sách');
    expect(html).toContain('animate-pulse');
    expect(html).not.toContain('Chưa có dữ liệu phù hợp');
  });
  it('distinguishes an empty result from a recoverable load error', () => {
    expect(render('empty')).toContain('Chưa có dữ liệu phù hợp');
    const error = render('error');
    expect(error).toContain('Mất kết nối.');
    expect(error).toContain('Thử lại');
    expect(error).not.toContain('Chưa có dữ liệu phù hợp');
  });
  it('renders cached rows, server sort state and page controls', () => {
    const html = render('ready');
    expect(html).toContain('Studio An');
    expect(html).toContain('aria-sort="ascending"');
    expect(html).toContain('Số dòng mỗi trang');
    expect(html).toContain('1 kết quả');
  });
});
