export type DataTableQuery = {
  page: number;
  pageSize: number;
  sort: string;
  q: string;
  tab: string;
  filters: Record<string, string>;
};
export type DataTableResult<T> = {
  rows: T[];
  total: number;
  statusCounts?: Record<string, number>;
};
export type DataTableFetcher<T> = ((
  query: DataTableQuery,
  signal: AbortSignal,
) => Promise<DataTableResult<T>>) & {
  counts?: (
    query: DataTableQuery,
    signal: AbortSignal,
  ) => Promise<Record<string, number>>;
};
export type DataTableFilter = {
  inputType?: 'date';
  loadOptions?: (
    q: string,
    signal: AbortSignal,
  ) => Promise<{ value: string; label: string }[]>;
  id: string;
  label: string;
  options: { value: string; label: string }[];
};
export function readDataTableQuery(
  params: URLSearchParams,
  options: {
    defaultTab: string;
    tabs: string[];
    defaultSort: string;
    sortIds: string[];
    defaultPageSize: number;
    filters: DataTableFilter[];
  },
): DataTableQuery {
  const integer = (value: string | null, fallback: number, max: number) =>
    value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max
      ? Number(value)
      : fallback;
  const requestedTab = params.get('tab') ?? options.defaultTab;
  const requestedSort = params.get('sort') ?? options.defaultSort;
  const [column, direction, extra] = requestedSort.split(':');
  return {
    page: integer(params.get('page'), 1, 1_000_000),
    pageSize: integer(params.get('pageSize'), options.defaultPageSize, 100),
    q: (params.get('q') ?? '').trim().slice(0, 200),
    tab: options.tabs.includes(requestedTab)
      ? requestedTab
      : options.defaultTab,
    sort:
      options.sortIds.includes(column) &&
      ['asc', 'desc'].includes(direction) &&
      !extra
        ? requestedSort
        : options.defaultSort,
    filters: Object.fromEntries(
      options.filters.map((filter) => {
        const value = params.get(`filter.${filter.id}`) ?? '';
        return [
          filter.id,
          filter.inputType === 'date'
            ? /^\d{4}-\d{2}-\d{2}$/.test(value)
              ? value
              : ''
            : filter.loadOptions ||
                filter.options.some((option) => option.value === value)
              ? value
              : '',
        ];
      }),
    ),
  };
}
