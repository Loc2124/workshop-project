import { Img } from '../components/ui/Img';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '../lib/query-invalidation';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { toast, Toaster } from 'sonner';
import { ImageIcon } from 'lucide-react';
import {
  DataTable,
  type DataTableFetcher,
} from '../components/admin/DataTable';
import { ConfirmReasonDialog } from '../components/admin/ConfirmReasonDialog';
import { ImageGalleryDialog } from '../components/admin/ImageGalleryDialog';
import { StatusBadge } from '../components/ui/status-badge';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { apiFetch } from '../lib/api-client';
import { createAdminTableFetcher } from '../services/adminTableService';
import { formatPrice } from '../lib/format';
import { formatReviewDate } from '../lib/studio-review';

const workshopSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  studioId: z.string().uuid(),
  studioName: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  basePrice: z.number(),
  reviewStatus: z.string(),
  studioStatus: z.string(),
  status: z.enum(['active', 'hidden', 'removed']),
  hiddenReason: z.string().nullable(),
  createdAt: z.string(),
  upcomingSlots: z.number(),
  bookingCount: z.number(),
  images: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      thumbnailUrl: z.string().optional(),
    }),
  ),
});
type Workshop = z.infer<typeof workshopSchema>;
const detailSchema = workshopSchema.extend({
  slots: z.array(
    z.object({
      id: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      capacity: z.number(),
      seatsSold: z.number(),
      price: z.number(),
      status: z.string(),
    }),
  ),
});
const tabs = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang mở' },
  { value: 'hidden', label: 'Đã ẩn' },
  { value: 'removed', label: 'Bị gỡ' },
];
const fetcher: DataTableFetcher<Workshop> = createAdminTableFetcher(
  '/admin/workshop',
  workshopSchema,
);
const loadStudios = async (q: string, signal: AbortSignal) =>
  z
    .object({
      items: z.array(z.object({ id: z.string(), name: z.string() })),
    })
    .parse(
      await apiFetch(`/admin/workshop-studios?q=${encodeURIComponent(q)}`, {
        signal,
      }),
    )
    .items.map((s) => ({ value: s.id, label: s.name }));
export function AdminWorkshopPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const categories = useQuery({
    queryKey: [...queryKeys.public.categories, 'options'],
    queryFn: async ({ signal }) =>
      z
        .object({
          categories: z.array(z.object({ id: z.string(), name: z.string() })),
        })
        .parse(await apiFetch('/categories', { signal })).categories,
  });
  const [row, setRow] = useState<Workshop | null>(null);
  const [decision, setDecision] = useState<'hidden' | 'removed' | null>(null);
  const [imageIndex, setImageIndex] = useState<number | null>(null);
  const detail = useQuery({
    queryKey: queryKeys.workshops.detail(userId, row?.id),
    queryFn: async ({ signal }) =>
      z
        .object({ workshop: detailSchema })
        .parse(await apiFetch(`/admin/workshop/${row!.id}`, { signal }))
        .workshop,
    enabled: !!row,
  });
  const selected = detail.data ?? row;
  const mutation = useMutation({
    mutationFn: async (input: {
      status: 'active' | 'hidden' | 'removed';
      reason?: string;
    }) => {
      if (!row) throw new Error('Chưa chọn workshop.');
      return apiFetch(`/admin/workshop/${row.id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        row
          ? client.invalidateQueries({
              queryKey: queryKeys.workshops.detail(userId, row.id),
              exact: true,
            })
          : Promise.resolve(),
        invalidateResources(client, userId, ['workshops']),
        invalidatePublicCatalog(client),
      ]);
      toast.success('Đã cập nhật workshop và thông báo cho chủ studio.');
      setDecision(null);
      setRow(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const columns = useMemo<ColumnDef<Workshop>[]>(
    () => [
      {
        id: 'image',
        header: 'Ảnh',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.images[0] ? (
            <Img
              variant="thumbnail"
              src={row.original.images[0].url}
              thumbnailUrl={row.original.images[0].thumbnailUrl}
              alt=""
              className="size-12 min-w-12 rounded-sm object-cover"
            />
          ) : (
            <span className="flex size-12 min-w-12 items-center justify-center rounded-sm bg-soft text-muted">
              <ImageIcon size={18} />
            </span>
          ),
      },
      {
        accessorKey: 'title',
        header: 'Tên workshop',
        cell: ({ row }) => (
          <span className="block min-w-40 font-medium">
            {row.original.title}
          </span>
        ),
      },
      { accessorKey: 'studioName', header: 'Studio' },
      { accessorKey: 'categoryName', header: 'Loại' },
      {
        accessorKey: 'basePrice',
        header: 'Giá',
        cell: ({ getValue }) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {formatPrice(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'upcomingSlots',
        header: 'Slot sắp tới',
        cell: ({ getValue }) => (
          <span className="block text-right tabular-nums">
            {getValue<number>()}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={tabs.find((t) => t.value === row.original.status)?.label}
          />
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Ngày tạo',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted">
            {formatReviewDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );
  const filters = useMemo(
    () => [
      {
        id: 'studioId',
        label: 'Studio',
        options: [],
        loadOptions: loadStudios,
      },
      {
        id: 'categoryId',
        label: 'Loại',
        options: (categories.data ?? []).map((c) => ({
          value: c.id,
          label: c.name,
        })),
      },
      {
        id: 'period',
        label: 'Ngày tạo',
        options: [{ value: '7d', label: '7 ngày qua' }],
      },
    ],
    [categories.data],
  );
  return (
    <div className="space-y-5">
      <Toaster richColors position="top-right" />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-semibold">Workshop</h1>
        <Button variant="outline" asChild>
          <Link to="/admin/workshop-review">Hồ sơ workshop chờ duyệt</Link>
        </Button>
      </header>
      {categories.error && (
        <p role="alert" className="text-sm text-brick">
          Chưa tải được loại workshop.{' '}
          <Button variant="outline" onClick={() => void categories.refetch()}>
            Thử lại
          </Button>
        </p>
      )}
      <DataTable
        columns={columns}
        fetcher={fetcher}
        queryKey={queryKeys.workshops.lists(userId)}
        tabs={tabs}
        defaultTab="all"
        defaultSort="createdAt:desc"
        filters={filters}
        getRowId={(r) => r.id}
        onRowClick={setRow}
        searchPlaceholder="Tên workshop, studio…"
      />
      <Sheet
        open={!!row}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setRow(null);
            setImageIndex(null);
            setDecision(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="max-w-[640px]"
          closeLabel="Đóng chi tiết workshop"
          closeDisabled={mutation.isPending}
        >
          {selected && (
            <>
              <header className="shrink-0 border-b border-line px-5 py-5 pr-16">
                <SheetTitle className="font-heading text-xl font-semibold">
                  {selected.title}
                </SheetTitle>
                <SheetDescription className="mt-1">
                  {selected.studioName} · {selected.categoryName}
                </SheetDescription>
                <div className="mt-3">
                  <StatusBadge
                    status={selected.status}
                    label={tabs.find((t) => t.value === selected.status)?.label}
                  />
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                {detail.isPending && <Skeleton className="h-24 w-full" />}
                {detail.error && (
                  <div role="alert">
                    Chưa tải được chi tiết.{' '}
                    <Button
                      variant="outline"
                      onClick={() => void detail.refetch()}
                    >
                      Thử lại
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {selected.images.map((image, i) => (
                    <button
                      key={image.id}
                      aria-label={`Xem lớn ảnh ${i + 1}`}
                      onClick={() => setImageIndex(i)}
                    >
                      <Img
                        variant="thumbnail"
                        src={image.url}
                        thumbnailUrl={image.thumbnailUrl}
                        alt={`Ảnh workshop ${i + 1}`}
                        className="aspect-square w-full rounded-sm object-cover"
                      />
                    </button>
                  ))}
                </div>
                {!selected.images.length && (
                  <p className="rounded-sm border border-dashed border-line p-5 text-center text-sm text-muted">
                    Chưa có ảnh workshop.
                  </p>
                )}
                <section>
                  <h2 className="text-xs text-muted">Mô tả</h2>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {selected.description}
                  </p>
                </section>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Giá</dt>
                    <dd className="mt-1">{formatPrice(selected.basePrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Số đặt chỗ hiện tại</dt>
                    <dd className="mt-1">{selected.bookingCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Ngày tạo</dt>
                    <dd className="mt-1">
                      {formatReviewDate(selected.createdAt)}
                    </dd>
                  </div>
                </dl>
                {(selected.reviewStatus !== 'approved' ||
                  selected.studioStatus !== 'approved') && (
                  <p className="rounded-sm bg-amber-50 p-3 text-sm text-amber-900">
                    Workshop chỉ hiển thị công khai khi cả workshop và studio
                    được duyệt.
                  </p>
                )}
                {selected.hiddenReason && (
                  <section className="rounded-sm bg-amber-50 p-3 text-sm text-amber-900">
                    <h2 className="font-medium">
                      Lý do {selected.status === 'removed' ? 'gỡ' : 'ẩn'}
                    </h2>
                    <p className="mt-1 whitespace-pre-wrap break-words">
                      {selected.hiddenReason}
                    </p>
                  </section>
                )}
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Lịch slot
                  </h2>
                  {detail.data?.slots.length ? (
                    <ul className="mt-3 divide-y divide-line">
                      {detail.data.slots.map((s) => (
                        <li key={s.id} className="space-y-1 py-3 text-sm">
                          <p>
                            {formatReviewDate(s.startsAt)} →{' '}
                            {formatReviewDate(s.endsAt)}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                            <span>
                              {s.seatsSold}/{s.capacity} chỗ ·{' '}
                              {formatPrice(s.price)}
                            </span>
                            <StatusBadge status={s.status} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !detail.isPending &&
                    !detail.error && (
                      <p className="mt-3 text-sm text-muted">Chưa có slot.</p>
                    )
                  )}
                </section>
              </div>
              <footer className="flex shrink-0 flex-wrap gap-2 border-t border-line p-5">
                {selected.status === 'active' && (
                  <Button
                    variant="outline"
                    disabled={
                      mutation.isPending || !detail.data || !!detail.error
                    }
                    onClick={() => setDecision('hidden')}
                  >
                    Ẩn
                  </Button>
                )}
                {selected.status !== 'removed' && (
                  <Button
                    variant="destructive"
                    disabled={
                      mutation.isPending || !detail.data || !!detail.error
                    }
                    onClick={() => setDecision('removed')}
                  >
                    Gỡ
                  </Button>
                )}
                {selected.status !== 'active' && (
                  <Button
                    disabled={
                      mutation.isPending || !detail.data || !!detail.error
                    }
                    onClick={() => mutation.mutate({ status: 'active' })}
                  >
                    Khôi phục
                  </Button>
                )}
              </footer>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmReasonDialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={decision === 'removed' ? 'Gỡ workshop' : 'Ẩn workshop'}
        description="Lý do sẽ được gửi vào thông báo của chủ studio. Các đặt chỗ hiện có vẫn được giữ lại."
        requireReason
        destructive={decision === 'removed'}
        confirmLabel={decision === 'removed' ? 'Gỡ workshop' : 'Ẩn workshop'}
        onConfirm={async (reason) => {
          if (decision)
            await mutation.mutateAsync({ status: decision, reason });
        }}
      />
      <ImageGalleryDialog
        images={selected?.images ?? []}
        index={imageIndex}
        onIndexChange={setImageIndex}
        title={selected?.title ?? ''}
      />
    </div>
  );
}
