import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { shouldRetryApiQuery } from '../../lib/api-client';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { scopePrivateKey } from '../../lib/query-keys';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
import { SearchableFilterSelect } from './SearchableFilterSelect';
import { Button } from '../ui/button';
import {
  readDataTableQuery,
  type DataTableFetcher,
  type DataTableFilter,
} from '../../lib/data-table';

export type {
  DataTableFetcher,
  DataTableQuery,
  DataTableResult,
  DataTableFilter,
} from '../../lib/data-table';
export type DataTableProps<T, V = unknown> = {
  columns: ColumnDef<T, V>[];
  fetcher: DataTableFetcher<T>;
  queryKey?: readonly unknown[];
  tabs?: { value: string; label: string }[];
  defaultTab?: string;
  defaultSort?: string;
  defaultPageSize?: number;
  filters?: DataTableFilter[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  getRowId?: (row: T) => string;
  onRowClick?: (row: T) => void;
  onRowsChange?: (rows: T[]) => void;
};
const EMPTY: never[] = [];
const NO_FILTERS: DataTableFilter[] = [];
const NO_TABS: { value: string; label: string }[] = [];
function sortableIds<T, V>(columns: ColumnDef<T, V>[]): string[] {
  return columns.flatMap((column) =>
    'columns' in column
      ? sortableIds(column.columns ?? [])
      : column.enableSorting !== false &&
          ('accessorKey' in column || 'accessorFn' in column)
        ? [
            column.id ??
              String('accessorKey' in column ? column.accessorKey : ''),
          ]
        : [],
  );
}
export function DataTable<T, V = unknown>({
  columns,
  fetcher,
  queryKey,
  tabs = NO_TABS,
  defaultTab = tabs[0]?.value ?? 'all',
  defaultSort = '',
  defaultPageSize = 20,
  filters = NO_FILTERS,
  searchPlaceholder = 'Tìm kiếm…',
  emptyMessage = 'Chưa có dữ liệu phù hợp.',
  getRowId,
  onRowClick,
  onRowsChange,
}: DataTableProps<T, V>) {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const serializedKey = JSON.stringify(
    queryKey ?? ['admin-data-table', pathname, 'lists'],
  );
  const listKey = useMemo(
    () => scopePrivateKey(userId, JSON.parse(serializedKey)),
    [userId, serializedKey],
  );
  const countsKey = [
    ...(listKey.at(-1) === 'lists' ? listKey.slice(0, -1) : listKey),
    'counts',
  ];
  const id = useId();
  const query = useMemo(
    () =>
      readDataTableQuery(params, {
        defaultTab,
        tabs: tabs.length ? tabs.map((tab) => tab.value) : ['all'],
        defaultSort,
        sortIds: sortableIds(columns),
        defaultPageSize,
        filters,
      }),
    [params, defaultTab, tabs, defaultSort, columns, defaultPageSize, filters],
  );
  const [search, setSearch] = useState(query.q);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  useEffect(() => setSearch(query.q), [query.q]);
  useEffect(() => {
    if (search.trim() === query.q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current);
      if (search.trim()) next.set('q', search.trim());
      else next.delete('q');
      next.set('page', '1');
      setParams(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, query.q, setParams]);
  const result = useQuery({
    queryKey: [...listKey, query],
    queryFn: ({ signal }) => fetcher(query, signal),
    retry: shouldRetryApiQuery,
    placeholderData: (previous, previousQuery) =>
      previousQuery &&
      JSON.stringify(previousQuery.queryKey.slice(0, listKey.length)) ===
        JSON.stringify(listKey)
        ? keepPreviousData(previous)
        : undefined,
  });
  const rows = result.data?.rows ?? EMPTY;
  const counts = useQuery({
    queryKey: [...countsKey, query.q, query.filters],
    queryFn: ({ signal }) => fetcher.counts!(query, signal),
    enabled: tabs.length > 0 && !!fetcher.counts,
    retry: shouldRetryApiQuery,
  });
  useEffect(() => {
    if (
      !userId ||
      result.isPlaceholderData ||
      !result.data ||
      query.page * query.pageSize >= result.data.total
    )
      return;
    const next = { ...query, page: query.page + 1 };
    void client.prefetchQuery({
      queryKey: [...listKey, next],
      queryFn: ({ signal }) => fetcher(next, signal),
      staleTime: 30000,
    });
  }, [
    client,
    userId,
    fetcher,
    result.data,
    result.isPlaceholderData,
    query,
    listKey,
  ]);
  useEffect(() => onRowsChange?.(rows), [rows, onRowsChange]);
  const pageCount = result.data
    ? Math.max(1, Math.ceil(result.data.total / query.pageSize))
    : undefined;
  useEffect(() => {
    if (!result.isPlaceholderData && pageCount && query.page > pageCount) {
      const next = new URLSearchParams(paramsRef.current);
      next.set('page', String(pageCount));
      setParams(next, { replace: true });
    }
  }, [pageCount, query.page, setParams, result.isPlaceholderData]);
  function change(key: string, value: string, resetPage = true) {
    const next = new URLSearchParams(paramsRef.current);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage) next.set('page', '1');
    setParams(next);
  }
  const sorting: SortingState = useMemo(() => {
    const [column, direction] = query.sort.split(':');
    return column ? [{ id: column, desc: direction === 'desc' }] : [];
  }, [query.sort]);
  const onSortingChange: OnChangeFn<SortingState> = (value) => {
    const next = typeof value === 'function' ? value(sorting) : value;
    change(
      'sort',
      next[0] ? `${next[0].id}:${next[0].desc ? 'desc' : 'asc'}` : defaultSort,
    );
  };
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    pageCount,
    getRowId,
    state: {
      sorting,
      pagination: { pageIndex: query.page - 1, pageSize: query.pageSize },
    },
    onSortingChange,
    enableSortingRemoval: false,
  });
  const loading = result.isPending || (!!pageCount && query.page > pageCount);
  const tableBody = (
    <>
      <div className="flex flex-wrap items-end gap-3 border-b border-line py-3">
        <div className="w-full min-w-0 sm:max-w-sm">
          <label
            htmlFor={`${id}-search`}
            className="mb-1.5 block text-xs font-medium text-muted"
          >
            Tìm kiếm
          </label>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              id={`${id}-search`}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={200}
              placeholder={searchPlaceholder}
              className="min-h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>
        {filters.map((filter) => (
          <label
            key={filter.id}
            className="flex min-w-36 flex-col gap-1.5 text-xs font-medium text-muted"
          >
            {filter.label}
            {filter.inputType === 'date' ? (
              <input
                type="date"
                aria-label={filter.label}
                value={query.filters[filter.id] ?? ''}
                onChange={(event) =>
                  change(`filter.${filter.id}`, event.target.value)
                }
                className="min-h-11 max-w-full rounded-md border border-line bg-surface px-3 text-base text-ink"
              />
            ) : filter.loadOptions ? (
              <SearchableFilterSelect
                label={filter.label}
                value={query.filters[filter.id] ?? ''}
                onChange={(value) => change(`filter.${filter.id}`, value)}
                loadOptions={filter.loadOptions}
              />
            ) : (
              <select
                value={query.filters[filter.id] ?? ''}
                onChange={(event) =>
                  change(`filter.${filter.id}`, event.target.value)
                }
                className="min-h-11 max-w-full rounded-md border border-line bg-surface px-3 text-base text-ink"
              >
                <option value="">Tất cả</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
      </div>
      {result.isError ? (
        <div className="space-y-3 border-b border-line py-8">
          <p role="alert" className="text-sm text-brick">
            {result.error instanceof Error
              ? result.error.message
              : 'Chưa tải được danh sách.'}
          </p>
          <Button
            variant="outline"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          {loading && (
            <p role="status" className="sr-only">
              Đang tải danh sách…
            </p>
          )}
          <Table aria-busy={result.isFetching || loading}>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      scope="col"
                      aria-sort={
                        header.column.getCanSort()
                          ? header.column.getIsSorted() === 'asc'
                            ? 'ascending'
                            : header.column.getIsSorted() === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                      className="whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="inline-flex min-h-11 items-center gap-1.5 text-left"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp size={13} />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown size={13} />
                          ) : (
                            <ArrowUpDown size={13} className="text-muted" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from(
                  { length: Math.min(query.pageSize, 5) },
                  (_, index) => (
                    <TableRow key={index} aria-hidden="true">
                      {table.getVisibleLeafColumns().map((column) => (
                        <TableCell key={column.id}>
                          <Skeleton className="my-2 h-5 min-w-16 w-3/4" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ),
                )
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={
                      onRowClick
                        ? 'cursor-pointer outline-none focus-visible:bg-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
                        : undefined
                    }
                    onClick={
                      onRowClick
                        ? (event) => {
                            if (
                              (event.target as HTMLElement).closest(
                                'button,a,input,select,textarea',
                              )
                            )
                              return;
                            event.currentTarget.focus();
                            onRowClick(row.original);
                          }
                        : undefined
                    }
                    onKeyDown={(event) => {
                      if (
                        onRowClick &&
                        event.currentTarget === event.target &&
                        ['Enter', ' '].includes(event.key)
                      ) {
                        event.preventDefault();
                        onRowClick(row.original);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length || 1}
                    className="py-10 text-center text-muted"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-muted">
        <label className="flex items-center gap-2">
          Số dòng mỗi trang
          <select
            aria-label="Số dòng mỗi trang"
            className="min-h-11 rounded-md border border-line bg-surface px-2 text-sm text-ink"
            value={query.pageSize}
            onChange={(event) => change('pageSize', event.target.value)}
          >
            {[...new Set([10, 20, 50, 100, query.pageSize])]
              .sort((a, b) => a - b)
              .map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
          </select>
        </label>
        <p aria-live="polite">
          Trang {query.page} / {result.isError ? '—' : (pageCount ?? '—')} ·{' '}
          {result.isError ? '—' : (result.data?.total ?? '—')} kết quả
          {result.isFetching && !loading ? ' · Đang cập nhật…' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={query.page <= 1 || result.isFetching}
            onClick={() => change('page', String(query.page - 1), false)}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !pageCount ||
              query.page >= pageCount ||
              result.isFetching ||
              result.isError
            }
            onClick={() => change('page', String(query.page + 1), false)}
          >
            Sau
          </Button>
        </div>
      </div>
    </>
  );
  return (
    <div className="min-w-0">
      {tabs.length ? (
        <Tabs value={query.tab} onValueChange={(value) => change('tab', value)}>
          <div className="overflow-x-auto border-b border-line pb-3">
            <TabsList aria-label="Trạng thái danh sách" className="min-w-max">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                  <span className="rounded-sm bg-black/5 px-1.5 py-0.5 text-xs tabular-nums">
                    {counts.data?.[tab.value] ?? '—'}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {counts.isError && (
              <div
                role="alert"
                className="mt-2 flex items-center gap-3 text-xs text-brick"
              >
                Chưa tải được số đếm.
                <Button
                  size="sm"
                  variant="outline"
                  disabled={counts.isFetching}
                  onClick={() => void counts.refetch()}
                >
                  Thử lại số đếm
                </Button>
              </div>
            )}
          </div>
          <TabsContent value={query.tab} className="mt-0">
            {tableBody}
          </TabsContent>
        </Tabs>
      ) : (
        tableBody
      )}
    </div>
  );
}
