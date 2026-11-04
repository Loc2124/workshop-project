import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { studioProvinces } from '@workshop/shared';
import { toast } from 'sonner';
import { DataTable } from '../components/admin/DataTable';
import { ConfirmReasonDialog } from '../components/admin/ConfirmReasonDialog';
import { StatusBadge } from '../components/ui/status-badge';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import { Button } from '../components/ui/button';
import { fetchAdminWorkshops } from '../services/adminTableService';
import { useDecideWorkshop } from '../hooks/useManagement';
import { useCategories } from '../hooks/useCategories';
import { categories, getCategoryMeta } from '../constants/categories';
import { formatPrice } from '../lib/format';
import { formatReviewDate } from '../lib/studio-review';
import type { AdminWorkshop } from '../types/management';

const tabs = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'all', label: 'Tất cả' },
];
export function AdminApprovalPage() {
  const userId = useAuth().user?.id;
  const mutation = useDecideWorkshop();
  const remoteCategories = useCategories();
  const [selected, setSelected] = useState<AdminWorkshop | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(
    null,
  );
  const container = useRef<HTMLDivElement>(null);
  const updateSelected = useCallback(
    (rows: AdminWorkshop[]) =>
      setSelected((current) =>
        current ? (rows.find((row) => row.id === current.id) ?? current) : null,
      ),
    [],
  );
  const columns = useMemo<ColumnDef<AdminWorkshop>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Workshop',
        cell: ({ row }) => (
          <button
            className="min-w-44 text-left font-medium hover:underline"
            onClick={() => setSelected(row.original)}
          >
            {row.original.title}
            {row.original.proposedCategoryName && (
              <span className="mt-1 block text-xs font-normal text-muted">
                Đề xuất: {row.original.proposedCategoryName}
              </span>
            )}
          </button>
        ),
      },
      { accessorKey: 'studioName', header: 'Studio' },
      { accessorKey: 'province', header: 'Tỉnh/thành' },
      {
        accessorKey: 'basePrice',
        header: 'Giá cơ bản',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatPrice(row.original.basePrice)}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Ngày gửi',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted">
            {formatReviewDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );
  const filters = [
    {
      id: 'period',
      label: 'Thời gian',
      options: [{ value: '7d', label: '7 ngày qua' }],
    },
    {
      id: 'provinceId',
      label: 'Tỉnh/thành',
      options: studioProvinces.map((province) => ({
        value: province.id,
        label: province.name,
      })),
    },
    {
      id: 'categoryId',
      label: 'Loại workshop',
      options: (remoteCategories ?? categories).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    },
  ];
  async function confirm(reason: string) {
    if (!selected || !decision || mutation.isPending) return;
    await mutation.mutateAsync({
      workshopId: selected.id,
      decision:
        decision === 'approved'
          ? { status: 'approved' }
          : { status: 'rejected', reason },
    });
    toast.success(
      decision === 'approved'
        ? 'Đã duyệt workshop.'
        : 'Đã từ chối workshop và ghi nhận lý do.',
    );
    setSelected(null);
    setDecision(null);
  }
  return (
    <div className="space-y-5" ref={container}>
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-semibold">Workshop</h1>
      </header>
      <DataTable
        columns={columns}
        fetcher={fetchAdminWorkshops}
        queryKey={queryKeys.workshops.reviews.lists(userId)}
        tabs={tabs}
        defaultTab="pending"
        defaultSort="createdAt:desc"
        filters={filters}
        searchPlaceholder="Tên workshop hoặc studio…"
        getRowId={(row) => row.id}
        onRowClick={setSelected}
        onRowsChange={updateSelected}
      />
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setSelected(null);
            setDecision(null);
          }
        }}
      >
        <SheetContent
          side="right"
          closeLabel="Đóng chi tiết workshop"
          closeDisabled={mutation.isPending}
          className="max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            container.current
              ?.querySelector<HTMLButtonElement>(
                '[role="tab"][data-state="active"]',
              )
              ?.focus();
          }}
        >
          {selected && (
            <>
              <header className="shrink-0 border-b border-line p-5 pr-16">
                <SheetTitle className="font-heading text-xl font-semibold">
                  {selected.title}
                </SheetTitle>
                <SheetDescription className="mt-1 text-sm text-muted">
                  {selected.studioName} · Gửi{' '}
                  {formatReviewDate(selected.createdAt)}
                </SheetDescription>
                <div className="mt-3">
                  <StatusBadge status={selected.status} />
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-sm">
                {selected.proposedCategoryName && (
                  <section className="rounded-sm bg-amber-50 p-3 text-amber-900">
                    <h3 className="font-medium">
                      Danh mục đề xuất: {selected.proposedCategoryName}
                    </h3>
                    <p className="mt-1">
                      Duyệt workshop sẽ đồng thời duyệt danh mục đề xuất.
                    </p>
                  </section>
                )}
                <dl className="space-y-4">
                  {[
                    [
                      'Loại workshop',
                      getCategoryMeta(selected.categoryId).name,
                    ],
                    ['Giới thiệu', selected.description],
                    [
                      'Địa chỉ',
                      [selected.address, selected.province]
                        .filter(Boolean)
                        .join(', '),
                    ],
                    ['Thời lượng', `${selected.durationMinutes} phút`],
                    ['Giá cơ bản', formatPrice(selected.basePrice)],
                    ['Đối tượng', selected.audience.join(', ')],
                    ['Sản phẩm mang về', selected.takeaway],
                    ['Điều kiện tham gia', selected.requirements],
                    ['Chính sách hủy', selected.cancellationPolicy],
                    ['Chính sách thanh toán', selected.paymentPolicy],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words">
                        {value || 'Chưa bổ sung'}
                      </dd>
                    </div>
                  ))}
                </dl>
                <section>
                  <h3 className="font-medium">Trạng thái studio</h3>
                  <StatusBadge
                    status={selected.studioStatus}
                    className="mt-2"
                  />
                </section>
                <section className="space-y-3 border-t border-line pt-4">
                  <h3 className="font-heading text-lg font-semibold">
                    Lịch sử xét duyệt
                  </h3>
                  {selected.reviewHistory.length ? (
                    selected.reviewHistory.map((entry, index) => (
                      <div
                        key={`${entry.reviewedAt}-${index}`}
                        className="space-y-1"
                      >
                        <p>
                          {entry.reviewerName} ·{' '}
                          {formatReviewDate(entry.reviewedAt)}
                        </p>
                        <StatusBadge status={entry.decision} />
                        {entry.categoryName && (
                          <p>Danh mục: {entry.categoryName}</p>
                        )}
                        {entry.reason && (
                          <p className="whitespace-pre-wrap">{entry.reason}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">Chưa có quyết định xét duyệt.</p>
                  )}
                </section>
              </div>
              <footer className="flex shrink-0 flex-wrap gap-2 border-t border-line p-5">
                <Button
                  disabled={mutation.isPending || selected.status !== 'pending'}
                  onClick={() => setDecision('approved')}
                >
                  {selected.proposedCategoryName
                    ? 'Duyệt workshop và danh mục'
                    : 'Duyệt workshop'}
                </Button>
                <Button
                  variant="outline"
                  className="text-brick"
                  disabled={mutation.isPending || selected.status !== 'pending'}
                  onClick={() => setDecision('rejected')}
                >
                  Từ chối
                </Button>
              </footer>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmReasonDialog
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={
          decision === 'rejected'
            ? 'Từ chối workshop'
            : selected?.proposedCategoryName
              ? 'Duyệt workshop và danh mục'
              : 'Duyệt workshop'
        }
        description={
          decision === 'rejected'
            ? 'Ghi lý do cụ thể để chủ studio có thể chỉnh sửa workshop.'
            : 'Xác nhận nội dung workshop đã được kiểm tra. Danh mục đề xuất sẽ được duyệt cùng workshop nếu có.'
        }
        requireReason={decision === 'rejected'}
        confirmLabel={
          decision === 'rejected' ? 'Từ chối workshop' : 'Duyệt workshop'
        }
        destructive={decision === 'rejected'}
        onConfirm={confirm}
      />
    </div>
  );
}
