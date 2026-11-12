import type { QueryClient } from '@tanstack/react-query';
import { prefetchDefaultTable } from '../lib/prefetch-table';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '../lib/query-invalidation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  DataTable,
  type DataTableFetcher,
  type DataTableFilter,
} from '../components/admin/DataTable';
import { ConfirmReasonDialog } from '../components/admin/ConfirmReasonDialog';
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
import { formatReviewDate } from '../lib/studio-review';
import { formatPrice } from '../lib/format';
import { TicketAttendanceEditor } from '../components/management/TicketAttendanceEditor';

const status = z.enum(['pending', 'confirmed', 'cancelled', 'completed']);
type Status = z.infer<typeof status>;
const bookingSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string().nullable(),
  workshopId: z.string().uuid(),
  workshopTitle: z.string(),
  workshopDescription: z.string(),
  studioId: z.string().uuid(),
  studioName: z.string(),
  address: z.string(),
  sessionId: z.string().uuid(),
  startsAt: z.string(),
  endsAt: z.string(),
  slotStatus: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalAmount: z.number(),
  status,
  paymentStatus: z.string(),
  refundStatus: z.string().optional(),
  refundDueAmount: z.number().int().nonnegative().optional(),
  refundedAmount: z.number().nonnegative().optional(),
  originalQuantity: z.number().int().optional(),
  originalTotalAmount: z.number().optional(),
  receivedAmount: z.number().optional(),
  createdAt: z.string(),
  holdExpiresAt: z.string(),
});
type Booking = z.infer<typeof bookingSchema>;
const detailSchema = bookingSchema.extend({
  history: z.array(
    z.object({
      id: z.string(),
      fromStatus: status.nullable(),
      toStatus: status,
      paymentStatus: z.string(),
      previousPaymentStatus: z.string().nullable(),
      actorId: z.string().nullable(),
      actorName: z.string(),
      reason: z.string(),
      createdAt: z.string(),
    }),
  ),
});
const labels: Record<Status, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
  completed: 'Hoàn tất',
};
const paymentLabels: Record<string, string> = {
  pending: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn giữ chỗ',
  refund_needed: 'Cần hoàn tiền',
};
const transitions: Record<Status, Status[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  cancelled: [],
  completed: ['cancelled'],
};
const fetcher: DataTableFetcher<Booking> = createAdminTableFetcher(
  '/admin/dat-cho',
  bookingSchema,
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
const filters: DataTableFilter[] = [
  { id: 'dateFrom', label: 'Slot từ ngày', inputType: 'date', options: [] },
  { id: 'dateTo', label: 'Slot đến ngày', inputType: 'date', options: [] },
  { id: 'studioId', label: 'Studio', options: [], loadOptions: loadStudios },
  {
    id: 'period',
    label: 'Ngày tạo đơn',
    options: [
      { value: 'today', label: 'Hôm nay' },
      { value: '7d', label: '7 ngày qua' },
    ],
  },
];
export function AdminBookingsPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const [row, setRow] = useState<Booking | null>(null);
  const [action, setAction] = useState<'cancel' | 'change' | null>(null);
  const [target, setTarget] = useState<Status>('confirmed');
  const detail = useQuery({
    queryKey: queryKeys.bookings.detail(userId, row?.id),
    enabled: !!row,
    queryFn: async ({ signal }) =>
      z
        .object({ booking: detailSchema })
        .parse(await apiFetch(`/admin/dat-cho/${row!.id}`, { signal })).booking,
  });
  const selected = detail.data ?? row;
  const mutation = useMutation({
    mutationFn: async (input: {
      status: Status;
      expectedStatus: Status;
      reason: string;
    }) => {
      if (!row) throw new Error('Chưa chọn đặt chỗ.');
      return apiFetch(`/admin/dat-cho/${row.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        row
          ? client.invalidateQueries({
              queryKey: queryKeys.bookings.detail(userId, row.id),
              exact: true,
            })
          : Promise.resolve(),
        invalidateResources(client, userId, ['bookings']),
        invalidatePublicCatalog(client),
      ]);
      toast.success('Đã cập nhật đặt chỗ và lưu lịch sử.');
      setAction(null);
      setRow(null);
    },
    onError: () => {
      if (row)
        void client.invalidateQueries({
          queryKey: queryKeys.bookings.detail(userId, row.id),
        });
    },
  });
  const columns = useMemo<ColumnDef<Booking>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Mã đặt chỗ',
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium tabular-nums">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Khách',
        cell: ({ row }) => (
          <div className="min-w-36">
            <p className="font-medium">{row.original.customerName}</p>
            <p className="mt-1 text-xs text-muted">
              {row.original.customerPhone ?? row.original.customerEmail}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'workshopTitle',
        header: 'Workshop',
        cell: ({ getValue }) => (
          <span className="block min-w-40">{getValue<string>()}</span>
        ),
      },
      { accessorKey: 'studioName', header: 'Studio' },
      {
        accessorKey: 'startsAt',
        header: 'Ngày giờ slot',
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">
            {formatReviewDate(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Số người',
        cell: ({ getValue }) => (
          <span className="block text-right tabular-nums">
            {getValue<number>()}
          </span>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Tổng tiền',
        cell: ({ getValue }) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {formatPrice(getValue<number>())}
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
  function start(action: 'cancel' | 'change') {
    if (!selected) return;
    setTarget(
      action === 'cancel' ? 'cancelled' : transitions[selected.status][0],
    );
    setAction(action);
  }
  const available = selected ? transitions[selected.status] : [];
  const ready = !!detail.data && !detail.error && !mutation.isPending;
  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Quản lý Đặt chỗ
        </h1>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          Tra cứu, quản lý trạng thái giữ chỗ, thanh toán và đối soát vé toàn
          sàn.
        </p>
      </header>
      <DataTable
        columns={columns}
        fetcher={fetcher}
        queryKey={queryKeys.bookings.lists(userId)}
        tabs={[
          { value: 'all', label: 'Tất cả' },
          ...Object.entries(labels).map(([value, label]) => ({ value, label })),
        ]}
        defaultTab="all"
        defaultSort="createdAt:desc"
        filters={filters}
        getRowId={(row) => row.id}
        onRowClick={setRow}
        searchPlaceholder="Mã, tên, SĐT hoặc email khách…"
      />
      <Sheet
        open={!!row}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setRow(null);
            setAction(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="max-w-[640px]"
          closeLabel="Đóng chi tiết đặt chỗ"
          closeDisabled={mutation.isPending}
        >
          {selected && (
            <>
              <header className="shrink-0 border-b border-line px-5 py-5 pr-16">
                <SheetTitle className="font-heading text-xl font-semibold">
                  Đặt chỗ {selected.code}
                </SheetTitle>
                <SheetDescription className="mt-1">
                  Tạo lúc {formatReviewDate(selected.createdAt)}
                </SheetDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge
                    status={selected.status}
                    label={labels[selected.status]}
                  />
                  <StatusBadge
                    status={selected.paymentStatus}
                    label={paymentLabels[selected.paymentStatus]}
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
                    Khách hàng
                  </h2>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <Field label="Họ tên" value={selected.customerName} />
                    <Field
                      label="Số điện thoại"
                      value={selected.customerPhone}
                    />
                    <Field label="Email" value={selected.customerEmail} />
                  </dl>
                </section>
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Workshop và slot
                  </h2>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <Field label="Workshop" value={selected.workshopTitle} />
                    <Field label="Studio" value={selected.studioName} />
                    <Field
                      label="Bắt đầu"
                      value={formatReviewDate(selected.startsAt)}
                    />
                    <Field
                      label="Kết thúc"
                      value={formatReviewDate(selected.endsAt)}
                    />
                    <Field label="Địa chỉ" value={selected.address} />
                    <Field
                      label="Trạng thái slot"
                      value={<StatusBadge status={selected.slotStatus} />}
                    />
                    <Field label="Số người" value={String(selected.quantity)} />
                    {selected.originalQuantity !== undefined &&
                      selected.originalQuantity !== selected.quantity && (
                        <Field
                          label="Số chỗ ban đầu"
                          value={String(selected.originalQuantity)}
                        />
                      )}
                    {selected.receivedAmount !== undefined && (
                      <Field
                        label="Tổng tiền đã nhận"
                        value={formatPrice(selected.receivedAmount) + ' đ'}
                      />
                    )}
                    <Field
                      label="Đơn giá"
                      value={formatPrice(selected.unitPrice)}
                    />
                    <Field
                      label="Tổng tiền"
                      value={formatPrice(selected.totalAmount)}
                    />
                  </dl>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
                    {selected.workshopDescription}
                  </p>
                </section>
                {selected.paymentStatus === 'refund_needed' && (
                  <p className="rounded-sm bg-amber-50 p-3 text-sm text-amber-900">
                    Đặt chỗ đã hủy và trả chỗ. Khoản cần hoàn{' '}
                    {selected.refundDueAmount !== undefined
                      ? `${formatPrice(Math.max(0, selected.refundDueAmount - (selected.refundedAmount ?? 0)))} đ`
                      : 'đang được đối soát'}{' '}
                    chưa được chuyển cho khách.
                  </p>
                )}
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Điểm danh từng vé
                  </h2>
                  <TicketAttendanceEditor
                    bookingId={selected.id}
                    admin
                    onUpdated={async () => {
                      await Promise.all([
                        detail.refetch(),
                        invalidateResources(client, userId, ['bookings']),
                      ]);
                    }}
                  />
                </section>
                <section>
                  <h2 className="font-heading text-lg font-semibold">
                    Lịch sử trạng thái
                  </h2>
                  {detail.data?.history.length ? (
                    <ol className="ml-1 mt-4 space-y-5 border-l border-line">
                      {detail.data.history.map((h) => (
                        <li key={h.id} className="relative space-y-2 pl-5">
                          <span
                            aria-hidden="true"
                            className="absolute -left-1 top-2 size-2 rounded-full bg-muted"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              status={h.toStatus}
                              label={labels[h.toStatus]}
                            />
                            {h.fromStatus && (
                              <span className="text-xs text-muted">
                                Từ {labels[h.fromStatus]}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium">{h.actorName}</p>
                          <time
                            dateTime={h.createdAt}
                            className="block text-xs text-muted"
                          >
                            {formatReviewDate(h.createdAt)}
                          </time>
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {h.reason}
                          </p>
                          {h.previousPaymentStatus !== h.paymentStatus && (
                            <p className="text-xs text-muted">
                              Thanh toán:{' '}
                              {paymentLabels[h.paymentStatus] ??
                                h.paymentStatus}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    !detail.isPending &&
                    !detail.error && (
                      <p className="mt-3 text-sm text-muted">
                        Chưa có lịch sử được ghi nhận.
                      </p>
                    )
                  )}
                </section>
              </div>
              <footer className="flex shrink-0 flex-wrap gap-2 border-t border-line p-5">
                {available.includes('cancelled') && (
                  <Button
                    variant="destructive"
                    disabled={!ready}
                    onClick={() => start('cancel')}
                  >
                    Hủy đặt chỗ
                  </Button>
                )}
                {available.some((s) => s !== 'cancelled') && (
                  <Button
                    variant="outline"
                    disabled={!ready}
                    onClick={() => start('change')}
                  >
                    Đổi trạng thái
                  </Button>
                )}
                {!available.length && (
                  <p className="text-sm text-muted">
                    Đặt chỗ đã kết thúc, chỉ xem lịch sử.
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
        title={action === 'cancel' ? 'Hủy đặt chỗ' : 'Đổi trạng thái đặt chỗ'}
        description={
          action === 'cancel'
            ? 'Số chỗ sẽ được trả lại cho slot trong cùng thao tác. Đơn đã thanh toán được đánh dấu cần hoàn tiền.'
            : 'Xác nhận đặt chỗ không ghi nhận thanh toán. Chỉ hoàn tất sau khi slot kết thúc.'
        }
        requireReason
        destructive={target === 'cancelled'}
        confirmLabel={target === 'cancelled' ? 'Hủy đặt chỗ' : 'Lưu trạng thái'}
        onConfirm={async (reason) => {
          if (selected)
            await mutation.mutateAsync({
              status: target,
              expectedStatus: selected.status,
              reason,
            });
        }}
      >
        {action === 'change' && (
          <label className="mt-4 block space-y-2 text-sm">
            <span>Trạng thái mới</span>
            <select
              aria-label="Trạng thái mới"
              disabled={mutation.isPending}
              value={target}
              onChange={(e) => setTarget(e.target.value as Status)}
              className="min-h-11 w-full rounded-sm border border-line bg-surface px-3"
            >
              {available.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </label>
        )}
      </ConfirmReasonDialog>
    </div>
  );
}
function Field({
  label,
  value,
}: {
  label: string;
  value?: import('react').ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-words">{value || 'Chưa cung cấp'}</dd>
    </div>
  );
}

export const prefetchData = (client: QueryClient, userId: string) =>
  prefetchDefaultTable(client, userId, 'bookings', fetcher, [
    'dateFrom',
    'dateTo',
    'studioId',
    'period',
  ]);
