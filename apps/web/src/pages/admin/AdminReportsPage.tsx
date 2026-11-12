import type { QueryClient } from '@tanstack/react-query';
import { prefetchDefaultTable } from '../../lib/prefetch-table';
import { Img } from '../../components/ui/Img';
import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '../../lib/query-invalidation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  reportReasons,
  reportStatusSchema,
  reportTargetSchema,
} from '@workshop/shared';
import {
  DataTable,
  type DataTableFetcher,
} from '../../components/admin/DataTable';
import { ConfirmReasonDialog } from '../../components/admin/ConfirmReasonDialog';
import { ImageGalleryDialog } from '../../components/admin/ImageGalleryDialog';
import { StatusBadge } from '../../components/ui/status-badge';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { apiFetch } from '../../lib/api-client';
import { createAdminTableFetcher } from '../../services/adminTableService';
import { formatReviewDate } from '../../lib/studio-review';
const labels = {
  new: 'Mới',
  in_progress: 'Đang xử lý',
  resolved: 'Đã xử lý',
  dismissed: 'Bỏ qua',
};
const targets = { studio: 'Studio', workshop: 'Workshop', review: 'Đánh giá' };
const schema = z.object({
  id: z.string().uuid(),
  targetType: reportTargetSchema,
  targetId: z.string().uuid(),
  targetName: z.string(),
  studioId: z.string().nullable(),
  studioName: z.string().nullable(),
  targetHref: z.string().nullable(),
  reason: z.string(),
  detail: z.string(),
  status: reportStatusSchema,
  handledBy: z.string().nullable(),
  handledAt: z.string().nullable(),
  createdAt: z.string(),
  reporterName: z.string(),
  reporterEmail: z.string().nullable(),
  targetContent: z.string().nullable(),
  studioHidden: z.boolean(),
  studioStatus: z.string().nullable(),
  workshopVisibility: z.string().nullable(),
  reviewHidden: z.boolean().nullable(),
});
const detailSchema = schema.extend({
  images: z.array(z.object({ id: z.string(), url: z.string() })),
  notes: z.array(
    z.object({
      id: z.string(),
      authorName: z.string(),
      body: z.string(),
      createdAt: z.string(),
    }),
  ),
});
type Report = z.infer<typeof schema>;
type Action = 'start' | 'hide' | 'suspend' | 'dismiss' | 'resolve';
const reasonLabel = (value: string) =>
  reportReasons[value as keyof typeof reportReasons] ?? value;
const fetcher: DataTableFetcher<Report> = createAdminTableFetcher(
  '/admin/bao-cao',
  schema,
);
export function AdminReportsPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const [row, setRow] = useState<Report | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [imageIndex, setImageIndex] = useState<number | null>(null);
  const detail = useQuery({
    queryKey: queryKeys.reports.detail(userId, row?.id),
    enabled: !!row,
    refetchInterval: 240000,
    queryFn: async ({ signal }) =>
      z
        .object({ report: detailSchema })
        .parse(await apiFetch(`/admin/bao-cao/${row!.id}`, { signal })).report,
  });
  const selected = detail.data ?? row;
  const mutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!selected || !action) throw new Error('Chưa chọn báo cáo.');
      return apiFetch(`/admin/bao-cao/${selected.id}/action`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          expectedStatus: selected.status,
          reason,
        }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        row
          ? client.invalidateQueries({
              queryKey: queryKeys.reports.detail(userId, row.id),
              exact: true,
            })
          : Promise.resolve(),
        invalidateResources(client, userId, [
          'reports',
          'studios',
          'workshops',
        ]),
        invalidatePublicCatalog(client),
      ]);
      toast.success('Đã cập nhật báo cáo và ghi nhật ký.');
      setAction(null);
      setRow(null);
    },
    onError: () => {
      void detail.refetch();
    },
  });
  const addNote = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error('Chưa chọn báo cáo.');
      return apiFetch(`/admin/bao-cao/${row.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: note }),
      });
    },
    onSuccess: async () => {
      setNote('');
      await detail.refetch();
      toast.success('Đã lưu ghi chú nội bộ.');
    },
    onError: (error) => toast.error(error.message),
  });
  const columns = useMemo<ColumnDef<Report>[]>(
    () => [
      {
        accessorKey: 'targetType',
        header: 'Loại đối tượng',
        cell: ({ row }) => targets[row.original.targetType],
      },
      {
        accessorKey: 'targetName',
        header: 'Đối tượng',
        cell: ({ row }) =>
          row.original.targetHref ? (
            <Link
              to={row.original.targetHref}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block min-w-40 underline"
            >
              {row.original.targetName}
            </Link>
          ) : (
            row.original.targetName
          ),
      },
      {
        accessorKey: 'reason',
        header: 'Lý do',
        cell: ({ row }) => (
          <span className="block min-w-36">
            {reasonLabel(row.original.reason)}
          </span>
        ),
      },
      { accessorKey: 'reporterName', header: 'Người báo cáo' },
      {
        accessorKey: 'createdAt',
        header: 'Ngày',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted">
            {formatReviewDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={labels[row.original.status]}
          />
        ),
      },
    ],
    [],
  );
  const ready = !!detail.data && !detail.error && !mutation.isPending;
  const closed =
    selected && ['resolved', 'dismissed'].includes(selected.status);
  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Báo cáo vi phạm &amp; khiếu nại
        </h1>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          Tiếp nhận và xử lý các báo cáo vi phạm nội dung, workshop hoặc studio
          từ cộng đồng.
        </p>
      </header>
      <DataTable
        columns={columns}
        fetcher={fetcher}
        queryKey={queryKeys.reports.lists(userId)}
        tabs={[
          { value: 'all', label: 'Tất cả' },
          ...Object.entries(labels).map(([value, label]) => ({ value, label })),
        ]}
        defaultTab="new"
        defaultSort="createdAt:desc"
        filters={[
          {
            id: 'targetType',
            label: 'Loại đối tượng',
            options: Object.entries(targets).map(([value, label]) => ({
              value,
              label,
            })),
          },
        ]}
        getRowId={(r) => r.id}
        onRowClick={(r) => {
          setRow(r);
          setNote('');
          setImageIndex(null);
        }}
        searchPlaceholder="Đối tượng hoặc người báo cáo…"
      />
      <Sheet
        open={!!row}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending && !addNote.isPending) {
            setRow(null);
            setAction(null);
            setImageIndex(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="max-w-[640px]"
          closeLabel="Đóng báo cáo"
          closeDisabled={mutation.isPending || addNote.isPending}
        >
          {selected && (
            <>
              <header className="shrink-0 border-b border-line px-5 py-5 pr-16">
                <SheetTitle className="font-heading text-xl font-semibold">
                  {selected.targetName}
                </SheetTitle>
                <SheetDescription className="mt-1">
                  {targets[selected.targetType]} ·{' '}
                  {formatReviewDate(selected.createdAt)}
                </SheetDescription>
                <div className="mt-3">
                  <StatusBadge
                    status={selected.status}
                    label={labels[selected.status]}
                  />
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                {detail.isPending && <Skeleton className="h-24 w-full" />}
                {detail.error && (
                  <div role="alert" className="text-sm text-brick">
                    Chưa tải được chi tiết.{' '}
                    <Button
                      variant="outline"
                      onClick={() => void detail.refetch()}
                    >
                      Thử lại
                    </Button>
                  </div>
                )}
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Nội dung báo cáo
                  </h2>
                  <p className="mt-3 text-sm font-medium">
                    {reasonLabel(selected.reason)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {selected.detail || 'Không có mô tả bổ sung.'}
                  </p>
                  <p className="mt-3 text-xs text-muted">
                    Người báo cáo: {selected.reporterName} ·{' '}
                    {selected.reporterEmail ?? 'Không còn tài khoản'}
                  </p>
                </section>
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Ảnh đính kèm
                  </h2>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {detail.data?.images.map((image, i) => (
                      <button
                        key={image.id}
                        aria-label={`Xem ảnh bằng chứng ${i + 1}`}
                        onClick={() => setImageIndex(i)}
                      >
                        <Img
                          variant="thumbnail"
                          src={image.url}
                          alt={`Bằng chứng ${i + 1}`}
                          className="aspect-square w-full rounded-sm object-cover"
                        />
                      </button>
                    ))}
                  </div>
                  {detail.data && !detail.data.images.length && (
                    <p className="mt-2 text-sm text-muted">
                      Không có ảnh đính kèm.
                    </p>
                  )}
                </section>
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Đối tượng bị báo cáo
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                    {selected.targetContent ??
                      'Không có nội dung hoặc đối tượng đã bị xóa.'}
                  </p>
                  {selected.targetHref && (
                    <Button variant="outline" asChild className="mt-3">
                      <Link
                        to={selected.targetHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem đối tượng
                      </Link>
                    </Button>
                  )}
                  {selected.studioId && (
                    <Button variant="ghost" asChild className="mt-3">
                      <Link
                        to={`/admin/studios?tab=all&q=${encodeURIComponent(selected.studioName ?? '')}`}
                      >
                        Hồ sơ studio
                      </Link>
                    </Button>
                  )}
                </section>
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Ghi chú nội bộ
                  </h2>
                  <p className="mt-1 text-xs text-muted">Chỉ admin được xem.</p>
                  {detail.data?.notes.length ? (
                    <ol className="mt-3 divide-y divide-line">
                      {detail.data.notes.map((n) => (
                        <li key={n.id} className="space-y-1 py-3 text-sm">
                          <p className="font-medium">{n.authorName}</p>
                          <time
                            className="text-xs text-muted"
                            dateTime={n.createdAt}
                          >
                            {formatReviewDate(n.createdAt)}
                          </time>
                          <p className="whitespace-pre-wrap break-words">
                            {n.body}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    detail.data && (
                      <p className="mt-3 text-sm text-muted">
                        Chưa có ghi chú.
                      </p>
                    )
                  )}
                  <label className="mt-4 block text-sm">
                    <span>Thêm ghi chú</span>
                    <textarea
                      aria-label="Ghi chú nội bộ"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      minLength={2}
                      maxLength={3000}
                      className="mt-2 min-h-24 w-full rounded-sm border border-line p-3"
                    />
                  </label>
                  <Button
                    variant="outline"
                    disabled={
                      !ready || addNote.isPending || note.trim().length < 2
                    }
                    onClick={() => addNote.mutate()}
                  >
                    Lưu ghi chú
                  </Button>
                </section>
                {selected.handledAt && (
                  <p className="text-xs text-muted">
                    Cập nhật xử lý: {formatReviewDate(selected.handledAt)}
                  </p>
                )}
              </div>
              <footer className="flex shrink-0 flex-wrap gap-2 border-t border-line p-5">
                {!closed ? (
                  <>
                    {selected.status === 'new' && (
                      <Button
                        variant="outline"
                        disabled={!ready}
                        onClick={() => setAction('start')}
                      >
                        Bắt đầu xử lý
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={!ready}
                      onClick={() => setAction('hide')}
                    >
                      Ẩn nội dung
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={
                        !ready ||
                        !selected.studioId ||
                        !['approved', 'suspended'].includes(
                          selected.studioStatus ?? '',
                        )
                      }
                      onClick={() => setAction('suspend')}
                    >
                      Tạm ngưng studio
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!ready}
                      onClick={() => setAction('dismiss')}
                    >
                      Bỏ qua
                    </Button>
                    <Button
                      disabled={!ready}
                      onClick={() => setAction('resolve')}
                    >
                      Đánh dấu đã xử lý
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    Báo cáo đã kết thúc. Có thể bổ sung ghi chú nội bộ.
                  </p>
                )}
              </footer>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmReasonDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={
          action === 'hide'
            ? 'Ẩn nội dung'
            : action === 'suspend'
              ? 'Tạm ngưng studio'
              : action === 'dismiss'
                ? 'Bỏ qua báo cáo'
                : action === 'start'
                  ? 'Bắt đầu xử lý'
                  : 'Đánh dấu đã xử lý'
        }
        description={
          action === 'hide' || action === 'suspend'
            ? 'Thao tác thay đổi nội dung và đánh dấu báo cáo đã xử lý trong cùng lần lưu.'
            : 'Thay đổi và lý do sẽ được ghi vào nhật ký và ghi chú nội bộ.'
        }
        requireReason={['hide', 'suspend', 'dismiss'].includes(action ?? '')}
        destructive={action === 'hide' || action === 'suspend'}
        onConfirm={async (reason) => {
          await mutation.mutateAsync(
            reason ||
              (action === 'start'
                ? 'Bắt đầu xử lý báo cáo'
                : 'Đánh dấu báo cáo đã xử lý'),
          );
        }}
      />
      <ImageGalleryDialog
        images={detail.data?.images ?? []}
        index={imageIndex}
        onIndexChange={setImageIndex}
        title="Ảnh bằng chứng báo cáo"
      />
    </div>
  );
}

export const prefetchData = (client: QueryClient, userId: string) =>
  prefetchDefaultTable(client, userId, 'reports', fetcher, ['targetType'], {
    tab: 'new',
  });
