import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api-client';
import { useRef, useState, useCallback, useMemo } from 'react';
import { Store, ExternalLink } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import {
  type StudioReviewDecision,
  defaultSiteSettings,
  type SiteSettings,
} from '@workshop/shared';
import { useSiteSettings } from '../hooks/useSiteSettings';
import {
  useSetStudioStatus,
  useAdminStudioDetail,
} from '../hooks/useManagement';
import type { AdminStudio, StudioApprovalStatus } from '../types/management';
import { formatReviewDate, studioReviewMissing } from '../lib/studio-review';
import { getCategoryMeta } from '../constants/categories';
import { Button } from '../components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import { StudioVerificationPanel } from '../components/management/StudioVerificationPanel';
import type { ColumnDef } from '@tanstack/react-table';
import { studioProvinces } from '@workshop/shared';
import { DataTable } from '../components/admin/DataTable';
import { ConfirmReasonDialog } from '../components/admin/ConfirmReasonDialog';
import { StatusBadge } from '../components/ui/status-badge';
import { ImageGalleryDialog } from '../components/admin/ImageGalleryDialog';
import { StudioStatusTimeline } from '../components/admin/StudioStatusTimeline';
import { Skeleton } from '../components/ui/skeleton';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../components/ui/tooltip';
import { fetchAdminStudios } from '../services/adminTableService';
const studioFilters = [
  {
    id: 'reviewQueue',
    label: 'Hàng đợi',
    options: [
      { value: 'overdue', label: 'Chờ quá 48 giờ' },
      { value: 'resubmitted', label: 'Đã gửi lại bổ sung' },
    ],
  },
  {
    id: 'provinceId',
    label: 'Tỉnh/thành',
    options: studioProvinces.map((province) => ({
      value: province.id,
      label: province.name,
    })),
  },
];
function STUDIO_COLUMNS(
  open: (studio: AdminStudio) => void,
  policy: SiteSettings['studio'],
): ColumnDef<AdminStudio>[] {
  return [
    {
      id: 'cover',
      header: 'Ảnh bìa',
      enableSorting: false,
      cell: ({ row }) => <Cover studio={row.original} />,
    },
    {
      accessorKey: 'name',
      header: 'Tên studio',
      cell: ({ row }) => (
        <button
          className="min-w-36 text-left font-medium hover:underline"
          onClick={() => open(row.original)}
        >
          {row.original.name}
        </button>
      ),
    },
    { accessorKey: 'ownerFullName', header: 'Chủ studio' },
    {
      accessorKey: 'province',
      header: 'Tỉnh/thành',
      cell: ({ row }) => row.original.province || 'Chưa bổ sung',
    },
    {
      accessorKey: 'submittedAt',
      header: 'Ngày gửi',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted">
          {formatReviewDate(row.original.submittedAt ?? row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'completeness',
      header: 'Hồ sơ',
      enableSorting: false,
      cell: ({ row }) => {
        const missing = studioReviewMissing(row.original, policy);
        return missing.length ? (
          <StatusBadge
            status="needs_changes"
            tone="yellow"
            label={`Thiếu ${missing.length} mục`}
          />
        ) : (
          <span className="text-xs text-muted">Đầy đủ</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];
}

const tabs: { value: StudioApprovalStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'needs_changes', label: 'Cần bổ sung' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'suspended', label: 'Tạm ngưng' },
  { value: 'rejected', label: 'Từ chối' },
];
function Cover({ studio }: { studio: AdminStudio }) {
  const image =
    studio.images?.find((image) => image.id === studio.photoIds?.[0]) ??
    studio.images?.[0];
  return image ? (
    <img
      src={image.url}
      alt=""
      className="size-12 rounded-sm object-cover"
      loading="lazy"
    />
  ) : (
    <span className="flex size-12 items-center justify-center rounded-sm bg-soft text-muted">
      <Store size={20} aria-label="Chưa có ảnh bìa" />
    </span>
  );
}
export function AdminStudioProfilesPage({
  showAllTab = false,
}: {
  showAllTab?: boolean;
}) {
  const settingsQuery = useSiteSettings();
  const photoPolicy = (settingsQuery.data ?? defaultSiteSettings).studio;
  const mutation = useSetStudioStatus();
  const queryClient = useQueryClient();
  const restoreVisibility = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/studios/${id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({
          hidden: false,
          reason: 'Hiển thị lại studio sau khi kiểm tra nội dung',
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['management'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      toast.success('Đã hiển thị lại nội dung studio.');
    },
    onError: (e) => toast.error(e.message),
  });
  const [selectedRow, setSelected] = useState<AdminStudio | null>(null);
  const detail = useAdminStudioDetail(selectedRow?.id ?? '');
  const selected = detail.data ?? selectedRow;
  const [decision, setDecision] = useState<
    'needs_changes' | 'rejected' | 'suspended' | null
  >(null);
  const [actionError, setActionError] = useState('');
  const [imageIndex, setImageIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const missing = selected ? studioReviewMissing(selected, photoPolicy) : [];
  const pending = mutation.isPending;
  const canAct = settingsQuery.isSuccess && !detail.isPending && !detail.error;
  const updateSelected = useCallback(
    (rows: AdminStudio[]) =>
      setSelected((current) =>
        current ? (rows.find((row) => row.id === current.id) ?? current) : null,
      ),
    [],
  );
  const columns = useMemo<ColumnDef<AdminStudio>[]>(
    () => STUDIO_COLUMNS(setSelected, photoPolicy),
    [photoPolicy],
  );
  async function submit(input: StudioReviewDecision) {
    if (!selected || pending) return;
    setActionError('');
    const restoring =
      selected.status === 'suspended' && input.status === 'approved';
    try {
      await mutation.mutateAsync({ studioId: selected.id, ...input });
      toast.success(
        restoring
          ? 'Đã khôi phục studio.'
          : input.status === 'suspended'
            ? 'Đã tạm ngưng studio.'
            : input.status === 'approved'
              ? 'Đã duyệt hồ sơ studio.'
              : input.status === 'needs_changes'
                ? 'Đã gửi yêu cầu bổ sung cho chủ studio.'
                : 'Đã từ chối hồ sơ và gửi lý do cho chủ studio.',
      );
      setDecision(null);
      setSelected(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Chưa cập nhật được hồ sơ. Vui lòng thử lại.';
      setActionError(message);
      toast.error(message);
      throw error;
    }
  }
  function openReason(value: 'needs_changes' | 'rejected' | 'suspended') {
    setDecision(value);
    setActionError('');
  }

  return (
    <div className="space-y-5">
      <Toaster richColors position="top-right" closeButton />
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-semibold">
          {showAllTab ? 'Tất cả studio' : 'Hồ sơ studio'}
        </h1>
      </header>
      <div ref={listRef}>
        <DataTable
          columns={columns}
          fetcher={fetchAdminStudios}
          queryKey={['management', 'admin-studios', 'table']}
          tabs={
            showAllTab ? [{ value: 'all', label: 'Tất cả' }, ...tabs] : tabs
          }
          defaultTab={showAllTab ? 'all' : 'pending'}
          defaultSort="submittedAt:desc"
          filters={studioFilters}
          searchPlaceholder="Tên studio, chủ studio, địa chỉ…"
          getRowId={(row) => row.id}
          onRowClick={(row) => {
            setSelected(row);
            setActionError('');
          }}
          onRowsChange={updateSelected}
        />
      </div>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setSelected(null);
            setDecision(null);
            setImageIndex(null);
          }
        }}
      >
        <SheetContent
          side="right"
          closeLabel="Đóng chi tiết hồ sơ"
          closeDisabled={pending}
          className="max-w-[640px]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            listRef.current
              ?.querySelector<HTMLButtonElement>('[data-state="active"]')
              ?.focus();
          }}
        >
          {selected && (
            <>
              <header className="shrink-0 border-b border-line px-5 py-5 pr-16">
                <SheetTitle className="font-heading text-xl font-semibold">
                  {selected.name}
                </SheetTitle>
                <SheetDescription className="mt-1 text-sm text-muted">
                  Chủ studio: {selected.ownerFullName} · Gửi{' '}
                  {formatReviewDate(selected.submittedAt ?? selected.createdAt)}
                </SheetDescription>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  {missing.length > 0 && (
                    <span className="text-xs text-amber-800">
                      Thiếu: {missing.join(', ')}
                    </span>
                  )}
                </div>
              </header>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {detail.isPending && <Skeleton className="h-20 w-full" />}
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
                {selected.isHidden && (
                  <section className="rounded-sm bg-amber-50 p-3 text-sm">
                    <p className="font-medium">
                      Studio đang bị ẩn khỏi trang công khai.
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {selected.hiddenReason}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      disabled={restoreVisibility.isPending || !canAct}
                      onClick={() => restoreVisibility.mutate(selected.id)}
                    >
                      Hiện nội dung studio
                    </Button>
                  </section>
                )}
                <section aria-label="Ảnh studio">
                  <div className="grid grid-cols-3 gap-2">
                    {selected.images?.map((image, index) => (
                      <button
                        key={image.id}
                        onClick={() => setImageIndex(index)}
                        aria-label={`Xem lớn ảnh ${index + 1}`}
                        className="relative overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <img
                          src={image.url}
                          alt={`Ảnh studio ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        {image.id === selected.photoIds?.[0] && (
                          <span className="absolute inset-x-0 bottom-0 bg-surface/90 py-1 text-xs">
                            Ảnh bìa
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {!selected.images?.length && (
                    <p className="rounded-sm border border-dashed border-line p-5 text-center text-sm text-muted">
                      Chưa có ảnh studio.
                    </p>
                  )}
                </section>
                <dl className="space-y-4 text-sm">
                  <Detail
                    label="Loại workshop"
                    value={
                      selected.categoryIds
                        ?.map((id) => getCategoryMeta(id).name)
                        .join(', ') || 'Chưa bổ sung'
                    }
                  />
                  {selected.proposedCategoryName && (
                    <Detail
                      label="Loại workshop đề xuất"
                      value={`${selected.proposedCategoryName} — Duyệt hồ sơ sẽ đồng thời duyệt danh mục đề xuất.`}
                    />
                  )}
                  <Detail label="Giới thiệu" value={selected.description} />
                  <Detail
                    label="Địa chỉ"
                    value={[selected.address, selected.province]
                      .filter(Boolean)
                      .join(', ')}
                  />
                  <Detail label="Số điện thoại" value={selected.contactPhone} />
                  <Detail label="Email" value={selected.contactEmail} />
                </dl>
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">Liên kết studio</h3>
                  <div className="flex flex-wrap gap-4">
                    {(
                      [
                        ['Facebook', selected.facebookUrl],
                        ['Instagram', selected.instagramUrl],
                        ['Google Maps', selected.googleMapsUrl],
                      ] as const
                    ).map(
                      ([label, url]) =>
                        url && (
                          <a
                            key={label}
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex min-h-11 items-center gap-1.5 text-sm underline"
                          >
                            {label}
                            <ExternalLink size={14} />
                          </a>
                        ),
                    )}
                    {!selected.facebookUrl &&
                      !selected.instagramUrl &&
                      !selected.googleMapsUrl && (
                        <p className="text-sm text-muted">
                          Chưa cung cấp liên kết.
                        </p>
                      )}
                  </div>
                </section>
                {selected.rejectionReason && (
                  <section className="rounded-sm bg-amber-50 p-3 text-sm text-amber-900">
                    <h3 className="font-medium">
                      Phản hồi đã gửi cho chủ studio
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap">
                      {selected.rejectionReason}
                    </p>
                    <p className="mt-2 text-xs">
                      Xét duyệt lúc {formatReviewDate(selected.reviewedAt)}
                    </p>
                  </section>
                )}
                {(selected.status === 'approved' ||
                  Boolean(selected.verificationHistory?.length)) && (
                  <StudioVerificationPanel
                    key={`${selected.id}-${selected.trustLevel}`}
                    studio={selected}
                  />
                )}
                {!detail.isPending && !detail.error && (
                  <StudioStatusTimeline
                    entries={selected.statusHistory ?? []}
                  />
                )}
                {actionError && !decision && (
                  <p role="alert" className="text-sm text-brick">
                    {actionError}
                  </p>
                )}
              </div>
              <StudioDecisionFooter
                studio={selected}
                missing={missing}
                busy={pending}
                ready={!!canAct}
                onApprove={() =>
                  void submit({ status: 'approved' }).catch(() => undefined)
                }
                onDecision={openReason}
              />
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
          decision === 'suspended'
            ? 'Tạm ngưng studio'
            : decision === 'needs_changes'
              ? 'Yêu cầu bổ sung hồ sơ'
              : 'Từ chối hồ sơ'
        }
        description="Lý do sẽ hiển thị trên trang quản lý của chủ studio."
        requireReason
        destructive={decision === 'rejected' || decision === 'suspended'}
        onConfirm={async (reason) => {
          if (decision) await submit({ status: decision, reason });
        }}
      />
      <ImageGalleryDialog
        images={selected?.images ?? []}
        index={imageIndex}
        onIndexChange={setImageIndex}
        title={selected?.name ?? ''}
      />
    </div>
  );
}
function StudioDecisionFooter({
  studio,
  missing,
  busy,
  ready,
  onApprove,
  onDecision,
}: {
  studio: AdminStudio;
  missing: string[];
  busy: boolean;
  ready: boolean;
  onApprove: () => void;
  onDecision: (status: 'needs_changes' | 'rejected' | 'suspended') => void;
}) {
  const approve = (
    <Button disabled={busy || !ready || missing.length > 0} onClick={onApprove}>
      {studio.status === 'suspended' ? 'Khôi phục' : 'Duyệt'}
    </Button>
  );
  return (
    <footer className="shrink-0 border-t border-line p-5">
      <div className="flex flex-wrap gap-2">
        {(studio.status === 'pending' || studio.status === 'suspended') &&
          (missing.length ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{approve}</span>
                </TooltipTrigger>
                <TooltipContent>Thiếu: {missing.join(', ')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            approve
          ))}
        {studio.status === 'pending' && (
          <>
            <Button
              variant="outline"
              disabled={busy || !ready}
              onClick={() => onDecision('needs_changes')}
            >
              Yêu cầu bổ sung
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !ready}
              onClick={() => onDecision('rejected')}
            >
              Từ chối
            </Button>
          </>
        )}
        {studio.status === 'approved' && (
          <Button
            variant="destructive"
            disabled={busy || !ready}
            onClick={() => onDecision('suspended')}
          >
            Tạm ngưng
          </Button>
        )}
        {['needs_changes', 'rejected'].includes(studio.status) && (
          <p className="text-sm text-muted">Hồ sơ đang ở chế độ chỉ xem.</p>
        )}
      </div>
    </footer>
  );
}
function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words">
        {value || 'Chưa bổ sung'}
      </dd>
    </div>
  );
}
