import { Clock3, Pencil, UsersRound } from 'lucide-react';
import { DEFAULT_CATEGORY, getCategoryMeta } from '../../../constants/categories';
import { formatPrice } from '../../../lib/format';
import type { StudioWorkshop } from '../../../types/management';
import { StudioBadge, StudioButton, StudioCard } from '../StudioPrimitives';

const statusLabels = {
  pending: 'Cần lưu lại workshop',
  approved: 'Công khai',
  rejected: 'Cần cập nhật',
} as const;

export function workshopStatus(workshop: StudioWorkshop) {
  if (workshop.publicationStatus === 'hidden') return 'Đã bị admin ẩn';
  if (workshop.publicationStatus === 'draft') return 'Bản nháp';
  return statusLabels[workshop.status];
}

export interface WorkshopCardItemProps {
  workshop: StudioWorkshop;
  canManage: boolean;
  studioApproved: boolean;
  onEdit: (workshop: StudioWorkshop) => void;
}

export function WorkshopCardItem({
  workshop,
  studioApproved,
  onEdit,
}: WorkshopCardItemProps) {
  const category = getCategoryMeta(workshop.categoryId);
  const depositPercent =
    workshop.effectiveDepositPercent ?? workshop.depositPercent ?? 0;
  const depositPerPerson =
    depositPercent > 0
      ? Math.round((workshop.basePrice * depositPercent) / 100)
      : 0;
  const tone =
    workshop.publicationStatus === 'hidden' ||
    workshop.status === 'rejected'
      ? 'danger'
      : workshop.publicationStatus === 'draft' ||
          workshop.status === 'pending'
        ? 'warning'
        : 'success';

  return (
    <li className="min-w-0">
      <StudioCard className="group overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-studio-card-hover">
        <div className="relative aspect-16/9 overflow-hidden bg-studio-neutral-soft">
          <img
            alt=""
            className="size-full object-cover transition duration-200 group-hover:scale-[1.02]"
            decoding="async"
            height={540}
            loading="lazy"
            src={
              category.placeholderImage ??
              DEFAULT_CATEGORY.placeholderImage ??
              undefined
            }
            style={{
              objectPosition: category.imagePosition ?? 'center',
            }}
            width={960}
          />
          <StudioBadge tone={tone} className="absolute left-3 top-3 shadow-sm">
            {workshopStatus(workshop)}
          </StudioBadge>
        </div>
        <div className="flex flex-col gap-4 p-studio-card">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-studio-muted">
              {category.name}
            </p>
            <h3 className="mt-1 line-clamp-2 font-heading text-xl font-semibold leading-snug text-studio-ink">
              {workshop.title}
            </h3>
            {workshop.proposedCategoryName && (
              <p className="mt-2 text-sm text-studio-muted">
                Danh mục đề xuất: {workshop.proposedCategoryName} · Chưa được duyệt
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-studio-muted">
            <span className="font-semibold text-studio-ink">
              {formatPrice(workshop.basePrice)}đ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 aria-hidden="true" className="size-4" />
              {workshop.durationMinutes} phút
            </span>
            {workshop.audience.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <UsersRound aria-hidden="true" className="size-4" />
                {workshop.audience.length} nhóm
              </span>
            )}
          </div>
          <div className="rounded-xl bg-studio-selected p-3 text-sm">
            {depositPercent > 0 ? (
              <>
                <p className="font-semibold text-studio-primary">
                  Đặt cọc ({depositPercent}%)
                </p>
                <p className="mt-1 text-studio-muted">
                  Theo giá cơ sở, mỗi khách cọc {formatPrice(depositPerPerson)} đ,
                  còn lại {formatPrice(workshop.basePrice - depositPerPerson)} đ trả
                  tại studio.
                </p>
                <p className="mt-1 text-xs text-studio-muted">
                  Số chính xác tính theo giá buổi và số người trong đặt chỗ.
                </p>
              </>
            ) : (
              <p className="font-medium text-studio-muted">
                Khách thanh toán toàn bộ tại studio.
              </p>
            )}
          </div>
          <div className="border-t border-studio-border pt-3">
            <StudioButton
              className="w-full min-h-11"
              disabled={!studioApproved}
              onClick={() => onEdit(workshop)}
              type="button"
              variant="secondary"
            >
              <Pencil aria-hidden="true" className="size-4" /> Sửa workshop
            </StudioButton>
          </div>
        </div>
      </StudioCard>
    </li>
  );
}
