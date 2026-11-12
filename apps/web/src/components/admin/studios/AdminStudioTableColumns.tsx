import type { ColumnDef } from '@tanstack/react-table';
import { Store } from 'lucide-react';
import { studioProvinces, type SiteSettings } from '@workshop/shared';
import { Img } from '../../ui/Img';
import { StatusBadge } from '../../ui/status-badge';
import { formatReviewDate, studioReviewMissing } from '../../../lib/studio-review';
import { type AdminStudio, type StudioApprovalStatus } from '../../../types/management';

export const studioFilters = [
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

export const studioTabs: { value: StudioApprovalStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'needs_changes', label: 'Cần bổ sung' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'suspended', label: 'Tạm ngưng' },
  { value: 'rejected', label: 'Từ chối' },
];

export function StudioCover({ studio }: { studio: AdminStudio }) {
  const image =
    studio.images?.find((img) => img.id === studio.photoIds?.[0]) ??
    studio.images?.[0];
  return image ? (
    <Img
      variant="thumbnail"
      src={image.url}
      thumbnailUrl={image.thumbnailUrl}
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

export function buildStudioColumns(
  open: (studio: AdminStudio) => void,
  policy: SiteSettings['studio'],
): ColumnDef<AdminStudio>[] {
  return [
    {
      id: 'cover',
      header: 'Ảnh bìa',
      enableSorting: false,
      cell: ({ row }) => <StudioCover studio={row.original} />,
    },
    {
      accessorKey: 'name',
      header: 'Tên studio',
      cell: ({ row }) => (
        <button
          className="min-w-36 text-left font-medium hover:underline min-h-11 flex items-center"
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
