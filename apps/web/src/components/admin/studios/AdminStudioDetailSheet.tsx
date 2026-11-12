import { ExternalLink } from 'lucide-react';
import { getCategoryMeta } from '../../../constants/categories';
import { formatReviewDate } from '../../../lib/studio-review';
import type { AdminStudio } from '../../../types/management';
import { Button } from '../../ui/button';
import { Img } from '../../ui/Img';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../ui/sheet';
import { Skeleton } from '../../ui/skeleton';
import { StatusBadge } from '../../ui/status-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { StudioStatusTimeline } from '../StudioStatusTimeline';
import { StudioVerificationPanel } from '../../management/StudioVerificationPanel';

export interface AdminStudioDetailSheetProps {
  selected: AdminStudio | null;
  detailLoading: boolean;
  detailError: unknown;
  onRetryDetail: () => void;
  pending: boolean;
  canAct: boolean;
  missing: string[];
  onClose: () => void;
  onImageClick: (index: number) => void;
  onRestoreVisibility: (id: string) => void;
  isRestoringVisibility: boolean;
  onApprove: () => void;
  onDecision: (status: 'needs_changes' | 'rejected' | 'suspended') => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export function AdminStudioDetailSheet({
  selected,
  detailLoading,
  detailError,
  onRetryDetail,
  pending,
  canAct,
  missing,
  onClose,
  onImageClick,
  onRestoreVisibility,
  isRestoringVisibility,
  onApprove,
  onDecision,
  listRef,
}: AdminStudioDetailSheetProps) {
  return (
    <Sheet
      open={Boolean(selected)}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
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
              {detailLoading && <Skeleton className="h-20 w-full" />}
              {Boolean(detailError) && (
                <div role="alert" className="text-sm text-brick">
                  Chưa tải được chi tiết.{' '}
                  <Button variant="outline" onClick={onRetryDetail}>
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
                    className="mt-3 min-h-11"
                    disabled={isRestoringVisibility || !canAct}
                    onClick={() => onRestoreVisibility(selected.id)}
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
                      onClick={() => onImageClick(index)}
                      aria-label={`Xem lớn ảnh ${index + 1}`}
                      className="relative overflow-hidden rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Img
                        variant="thumbnail"
                        src={image.url}
                        thumbnailUrl={image.thumbnailUrl}
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

              {!detailLoading && !detailError && (
                <StudioStatusTimeline
                  entries={selected.statusHistory ?? []}
                />
              )}
            </div>

            <footer className="shrink-0 border-t border-line p-5">
              <div className="flex flex-wrap gap-2">
                {(selected.status === 'pending' || selected.status === 'suspended') &&
                  (missing.length ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              disabled={pending || !canAct || missing.length > 0}
                              onClick={onApprove}
                              className="min-h-11"
                            >
                              {selected.status === 'suspended' ? 'Khôi phục' : 'Duyệt'}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Thiếu: {missing.join(', ')}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button
                      disabled={pending || !canAct || missing.length > 0}
                      onClick={onApprove}
                      className="min-h-11"
                    >
                      {selected.status === 'suspended' ? 'Khôi phục' : 'Duyệt'}
                    </Button>
                  ))}
                {selected.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={pending || !canAct}
                      onClick={() => onDecision('needs_changes')}
                    >
                      Yêu cầu bổ sung
                    </Button>
                    <Button
                      variant="destructive"
                      className="min-h-11"
                      disabled={pending || !canAct}
                      onClick={() => onDecision('rejected')}
                    >
                      Từ chối
                    </Button>
                  </>
                )}
                {selected.status === 'approved' && (
                  <Button
                    variant="destructive"
                    className="min-h-11"
                    disabled={pending || !canAct}
                    onClick={() => onDecision('suspended')}
                  >
                    Tạm ngưng
                  </Button>
                )}
                {['needs_changes', 'rejected'].includes(selected.status) && (
                  <p className="text-sm text-muted">Hồ sơ đang ở chế độ chỉ xem.</p>
                )}
              </div>
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
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
