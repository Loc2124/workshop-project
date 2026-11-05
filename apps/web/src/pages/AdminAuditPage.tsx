import type { QueryClient } from '@tanstack/react-query';
import { prefetchDefaultTable } from '../lib/prefetch-table';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import {
  DataTable,
  type DataTableFetcher,
  type DataTableFilter,
} from '../components/admin/DataTable';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api-client';
import { createAdminTableFetcher } from '../services/adminTableService';
import { formatReviewDate } from '../lib/studio-review';
import { auditActionLabel } from '../lib/audit-actions';

const rowSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().nullable(),
  actorName: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  targetName: z.string(),
  targetHref: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});
const detailSchema = rowSchema.extend({
  before: z.json().nullable(),
  after: z.json().nullable(),
});
const optionsSchema = z.object({
  actors: z.array(z.object({ value: z.string(), label: z.string() })),
  actions: z.array(z.object({ value: z.string() })),
});
type AuditRow = z.infer<typeof rowSchema>;
const fetcher: DataTableFetcher<AuditRow> = createAdminTableFetcher(
  '/admin/nhat-ky',
  rowSchema,
  false,
);
function Target({ row }: { row: AuditRow }) {
  return row.targetHref ? (
    <Link
      to={row.targetHref}
      onClick={(e) => e.stopPropagation()}
      className="text-primary underline underline-offset-4"
    >
      {row.targetName}
    </Link>
  ) : (
    <span>{row.targetName}</span>
  );
}
export function AdminAuditPage() {
  const userId = useAuth().user?.id;
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const options = useQuery({
    queryKey: queryKeys.audit.config(userId),
    queryFn: async ({ signal }) =>
      optionsSchema.parse(await apiFetch('/admin/nhat-ky/filters', { signal })),
  });
  const detail = useQuery({
    queryKey: queryKeys.audit.detail(userId, selected?.id),
    enabled: !!selected,
    queryFn: async ({ signal }) =>
      z
        .object({ log: detailSchema })
        .parse(await apiFetch(`/admin/nhat-ky/${selected!.id}`, { signal }))
        .log,
  });
  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'actorId',
        label: 'Người thực hiện',
        options: options.data?.actors ?? [],
        loadOptions: async (q, signal) =>
          optionsSchema.parse(
            await apiFetch(
              `/admin/nhat-ky/filters?q=${encodeURIComponent(q)}`,
              { signal },
            ),
          ).actors,
      },
      {
        id: 'action',
        label: 'Hành động',
        options: (options.data?.actions ?? []).map((a) => ({
          value: a.value,
          label: auditActionLabel(a.value),
        })),
      },
      { id: 'dateFrom', label: 'Từ ngày', inputType: 'date', options: [] },
      { id: 'dateTo', label: 'Đến ngày', inputType: 'date', options: [] },
    ],
    [options.data],
  );
  const columns = useMemo<ColumnDef<AuditRow>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Thời gian',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatReviewDate(row.original.createdAt)}
          </span>
        ),
      },
      { accessorKey: 'actorName', header: 'Người thực hiện' },
      {
        accessorKey: 'action',
        header: 'Hành động',
        cell: ({ row }) => auditActionLabel(row.original.action),
      },
      {
        accessorKey: 'targetName',
        header: 'Đối tượng',
        cell: ({ row }) => <Target row={row.original} />,
      },
      {
        accessorKey: 'reason',
        header: 'Lý do',
        enableSorting: false,
        cell: ({ row }) => (
          <p
            className="max-w-72 truncate"
            title={row.original.reason ?? undefined}
          >
            {row.original.reason ?? '—'}
          </p>
        ),
      },
    ],
    [],
  );
  const log = detail.data ?? selected;
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">Nhật ký</h1>
        <p className="text-sm text-muted">
          Tra cứu ai đã thay đổi dữ liệu, khi nào và vì sao. Nhật ký chỉ đọc.
        </p>
      </header>
      {options.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-brick"
        >
          Chưa tải được bộ lọc.
          <Button variant="outline" onClick={() => void options.refetch()}>
            Thử lại bộ lọc
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        fetcher={fetcher}
        queryKey={queryKeys.audit.lists(userId)}
        filters={filters}
        defaultSort="createdAt:desc"
        getRowId={(r) => r.id}
        onRowClick={setSelected}
        searchPlaceholder="Tìm người, đối tượng hoặc lý do…"
        emptyMessage="Chưa có nhật ký phù hợp với bộ lọc."
      />
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="right"
          closeLabel="Đóng chi tiết nhật ký"
          className="w-full max-w-[640px] overflow-y-auto p-5 sm:p-6"
        >
          <SheetTitle className="pr-10 font-heading text-xl font-semibold">
            Chi tiết nhật ký
          </SheetTitle>
          <SheetDescription className="mt-2 text-sm text-muted">
            Bản ghi tại thời điểm thay đổi, không thể chỉnh sửa hoặc xóa.
          </SheetDescription>
          {log && (
            <dl className="my-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 border-y border-line py-4 text-sm">
              <dt className="text-muted">Thời gian</dt>
              <dd>{formatReviewDate(log.createdAt)}</dd>
              <dt className="text-muted">Người thực hiện</dt>
              <dd className="break-words">{log.actorName}</dd>
              <dt className="text-muted">Hành động</dt>
              <dd>
                {auditActionLabel(log.action)}
                <span className="block break-all text-xs text-muted">
                  {log.action}
                </span>
              </dd>
              <dt className="text-muted">Đối tượng</dt>
              <dd className="break-words">
                <Target row={log} />
                <span className="block break-all text-xs text-muted">
                  {log.targetType} · {log.targetId}
                </span>
              </dd>
              <dt className="text-muted">Lý do</dt>
              <dd className="whitespace-pre-wrap break-words">
                {log.reason ?? '—'}
              </dd>
            </dl>
          )}
          {detail.isPending ? (
            <div
              aria-label="Đang tải dữ liệu trước và sau"
              className="space-y-3"
            >
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : detail.isError ? (
            <div role="alert" className="space-y-3 text-sm text-brick">
              <p>Chưa tải được dữ liệu trước/sau.</p>
              <Button variant="outline" onClick={() => void detail.refetch()}>
                Thử lại
              </Button>
            </div>
          ) : (
            detail.data && (
              <div className="space-y-5">
                {(['before', 'after'] as const).map((key) => (
                  <section key={key} className="space-y-2">
                    <h2 className="text-sm font-semibold">
                      {key === 'before' ? 'Trước thay đổi' : 'Sau thay đổi'}
                    </h2>
                    {detail.data[key] === null ? (
                      <p className="rounded-sm border border-line p-3 text-sm text-muted">
                        Không có dữ liệu được ghi nhận.
                      </p>
                    ) : (
                      <pre
                        tabIndex={0}
                        aria-label={
                          key === 'before'
                            ? 'JSON trước thay đổi'
                            : 'JSON sau thay đổi'
                        }
                        className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-sm border border-line bg-soft/40 p-3 font-mono text-xs leading-5"
                      >
                        {JSON.stringify(detail.data[key], null, 2)}
                      </pre>
                    )}
                  </section>
                ))}
                <p className="text-xs text-muted">
                  Bản ghi lịch sử cũ chỉ có những trường đã được lưu từ trước.
                </p>
              </div>
            )
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const prefetchData = (client: QueryClient, userId: string) =>
  prefetchDefaultTable(client, userId, 'audit', fetcher, [
    'actorId',
    'action',
    'dateFrom',
    'dateTo',
  ]);
