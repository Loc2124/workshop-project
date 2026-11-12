import { useCallback, useMemo, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { defaultSiteSettings, type StudioReviewDecision } from '@workshop/shared';
import { apiFetch } from '../../lib/api-client';
import { prefetchDefaultTable } from '../../lib/prefetch-table';
import { queryKeys } from '../../lib/query-keys';
import {
  invalidatePublicCatalog,
  invalidateResources,
} from '../../lib/query-invalidation';
import { studioReviewMissing } from '../../lib/studio-review';
import { useAuth } from '../../hooks/useAuth';
import {
  useAdminStudioDetail,
  useSetStudioStatus,
} from '../../hooks/useManagement';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import type { AdminStudio } from '../../types/management';
import { DataTable } from '../../components/admin/DataTable';
import { ConfirmReasonDialog } from '../../components/admin/ConfirmReasonDialog';
import { ImageGalleryDialog } from '../../components/admin/ImageGalleryDialog';
import { fetchAdminStudios } from '../../services/adminTableService';
import {
  buildStudioColumns,
  studioFilters,
  studioTabs,
} from '../../components/admin/studios/AdminStudioTableColumns';
import { AdminStudioDetailSheet } from '../../components/admin/studios/AdminStudioDetailSheet';

export function AdminStudioProfilesPage({
  showAllTab = false,
}: {
  showAllTab?: boolean;
}) {
  const userId = useAuth().user?.id;
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
        invalidateResources(queryClient, userId, ['studios', 'workshops']),
        invalidatePublicCatalog(queryClient),
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

  const columns = useMemo(
    () => buildStudioColumns(setSelected, photoPolicy),
    [photoPolicy],
  );

  async function submit(input: StudioReviewDecision) {
    if (!selected || pending) return;
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
      if (!decision) toast.error(message);
      throw error;
    }
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {showAllTab ? 'Tất cả studio' : 'Hồ sơ studio'}
        </h1>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          {showAllTab
            ? 'Danh sách toàn bộ các studio đã đăng ký trên sàn Open Slot.'
            : 'Xem xét và phê duyệt hồ sơ đăng ký mở xưởng từ các nghệ nhân.'}
        </p>
      </header>

      <div ref={listRef}>
        <DataTable
          columns={columns}
          fetcher={fetchAdminStudios}
          queryKey={queryKeys.studios.lists(userId)}
          tabs={
            showAllTab
              ? [{ value: 'all', label: 'Tất cả' }, ...studioTabs]
              : studioTabs
          }
          defaultTab={showAllTab ? 'all' : 'pending'}
          defaultSort="submittedAt:desc"
          filters={studioFilters}
          searchPlaceholder="Tên studio, chủ studio, địa chỉ…"
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          onRowsChange={updateSelected}
        />
      </div>

      <AdminStudioDetailSheet
        selected={selected}
        detailLoading={detail.isPending}
        detailError={detail.error}
        onRetryDetail={() => void detail.refetch()}
        pending={pending}
        canAct={Boolean(canAct)}
        missing={missing}
        onClose={() => {
          setSelected(null);
          setDecision(null);
          setImageIndex(null);
        }}
        onImageClick={setImageIndex}
        onRestoreVisibility={(id) => restoreVisibility.mutate(id)}
        isRestoringVisibility={restoreVisibility.isPending}
        onApprove={() =>
          void submit({ status: 'approved' }).catch(() => undefined)
        }
        onDecision={setDecision}
        listRef={listRef}
      />

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

export const prefetchData = (
  client: QueryClient,
  userId: string,
  all = false,
) =>
  prefetchDefaultTable(
    client,
    userId,
    'studios',
    fetchAdminStudios,
    studioFilters.map((filter) => filter.id),
    { tab: all ? 'all' : 'pending', sort: 'submittedAt:desc' },
  );

export default AdminStudioProfilesPage;
