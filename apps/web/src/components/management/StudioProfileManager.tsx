import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Facebook,
  Globe,
  Images,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Star,
} from 'lucide-react';
import type { MemberStudio } from '@/types/management';
import { Img } from '../ui/Img';
import { StudioBadge, StudioButton, StudioCard } from './StudioPrimitives';
import { StudioTrustBadge } from '../ui/StudioTrustBadge';
import { studioApplicationStatus } from '@/lib/studio-application-status';
import { StudioPaymentSettings } from './StudioPaymentSettings';
import { StudioEvidenceEditor } from './StudioEvidenceEditor';

interface StudioProfileManagerProps {
  studio: MemberStudio;
}

export function StudioProfileManager({ studio }: StudioProfileManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const coverImage =
    studio.images?.find((image) => image.id === studio.photoIds?.[0]) ??
    studio.images?.[0];

  const publicUrl = `${window.location.origin}/studios/${studio.slug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Đã sao chép liên kết trang studio công khai!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Không thể sao chép liên kết.');
    }
  };

  const hasRejectionAlert =
    studio.rejectionReason &&
    ['needs_changes', 'rejected', 'suspended'].includes(studio.status);

  return (
    <div className="space-y-studio-section">
      {/* Rejection / Warning Notice */}
      {hasRejectionAlert && (
        <section
          role="alert"
          className="flex items-start gap-3.5 rounded-studio-card border border-amber-300/80 bg-amber-50/90 p-4 shadow-sm"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold text-amber-900">
              {studio.status === 'suspended'
                ? 'Lý do tạm ngưng hoạt động'
                : studio.status === 'needs_changes'
                  ? 'Nội dung cần điều chỉnh hoặc bổ sung'
                  : 'Lý do chưa được duyệt'}
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-800">
              {studio.rejectionReason}
            </p>
            {!isEditing && (
              <div className="mt-3">
                <StudioButton
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-amber-800 text-white hover:bg-amber-900"
                >
                  <Edit3 className="size-4" />
                  Điều chỉnh hồ sơ ngay
                </StudioButton>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Hero Banner Card */}
      <StudioCard className="overflow-hidden p-0 shadow-studio-card">
        <div className="group relative aspect-[21/9] min-h-52 overflow-hidden bg-studio-subtle sm:min-h-72">
          {coverImage ? (
            <Img
              src={coverImage.url}
              mediumUrl={coverImage.mediumUrl}
              thumbnailUrl={coverImage.thumbnailUrl}
              variant="medium"
              alt={`Ảnh bìa ${studio.name}`}
              priority
              sizes="(max-width: 768px) 100vw, 1200px"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-studio-subtle to-studio-border/30 text-studio-muted">
              <Images aria-hidden="true" className="size-10" />
              <span className="text-sm font-medium">
                Chưa có ảnh bìa không gian
              </span>
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 bg-gradient-to-t from-studio-ink/90 via-studio-ink/50 to-transparent px-5 pb-5 pt-20 sm:px-7 sm:pb-6">
            <div className="text-white">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white/95 backdrop-blur-xs">
                <Sparkles className="size-3" />
                Không gian nghệ thuật &amp; thủ công
              </div>
              <h1 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {studio.name}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80 sm:text-sm">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{studio.address}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StudioBadge
                tone={studio.status === 'approved' ? 'success' : 'warning'}
                className="bg-studio-surface/95 text-xs font-semibold shadow-xs"
              >
                {studioApplicationStatus[studio.status].label}
              </StudioBadge>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-studio-border/60 bg-studio-surface px-5 py-3.5 sm:px-7">
          <div className="flex items-center gap-3">
            <StudioTrustBadge level={studio.trustLevel} explain />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {studio.status === 'approved' && studio.profileComplete && (
              <>
                <StudioButton
                  type="button"
                  variant="secondary"
                  onClick={handleCopyLink}
                  className="h-9 gap-1.5 text-xs"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? 'Đã chép link' : 'Sao chép link'}
                </StudioButton>

                <StudioButton
                  asChild
                  variant="secondary"
                  className="h-9 gap-1.5 text-xs"
                >
                  <Link
                    to={`/studios/${studio.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3.5" />
                    Xem trang công khai
                  </Link>
                </StudioButton>
              </>
            )}

            {!isEditing ? (
              <StudioButton
                type="button"
                onClick={() => setIsEditing(true)}
                className="h-9 gap-1.5 text-xs"
              >
                <Edit3 className="size-3.5" />
                Chỉnh sửa hồ sơ
              </StudioButton>
            ) : (
              <StudioButton
                type="button"
                variant="secondary"
                onClick={() => setIsEditing(false)}
                className="h-9 text-xs"
              >
                Đóng chỉnh sửa
              </StudioButton>
            )}
          </div>
        </div>
      </StudioCard>

      {/* Edit Mode vs View Mode */}
      {isEditing ? (
        <div className="rounded-studio-card border border-studio-border bg-studio-surface p-6 shadow-studio-card">
          <div className="mb-6 flex items-center justify-between border-b border-studio-border pb-4">
            <div>
              <h2 className="font-heading text-xl font-bold text-studio-ink">
                Chỉnh sửa thông tin hồ sơ
              </h2>
              <p className="mt-1 text-xs text-studio-muted">
                Cập nhật thông tin liên hệ, hình ảnh không gian và các kênh mạng
                xã hội.
              </p>
            </div>
            <StudioButton
              type="button"
              variant="secondary"
              onClick={() => setIsEditing(false)}
              className="text-xs"
            >
              Quay lại xem hồ sơ
            </StudioButton>
          </div>

          <StudioEvidenceEditor
            key={studio.id}
            studio={studio}
            isOpen={isEditing}
            onOpenChange={setIsEditing}
          />
        </div>
      ) : (
        <div className="grid gap-studio-section lg:grid-cols-12">
          {/* Left Column: Contact, Location & Gallery (7 cols) */}
          <div className="space-y-studio-section lg:col-span-7">
            {/* Contact & Location Card */}
            <StudioCard className="space-y-5">
              <div className="flex items-center justify-between border-b border-studio-border/60 pb-3">
                <h2 className="font-heading text-base font-bold text-studio-ink">
                  Thông tin liên hệ &amp; Địa điểm
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
                >
                  <Edit3 className="size-3" />
                  Sửa
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-studio-muted">
                    <MapPin className="size-3.5 text-studio-muted" />
                    Địa chỉ xưởng
                  </span>
                  <p className="text-sm font-medium text-studio-ink">
                    {studio.address}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-studio-muted">
                    <Building2 className="size-3.5 text-studio-muted" />
                    Khu vực / Tỉnh thành
                  </span>
                  <p className="text-sm font-medium text-studio-ink">
                    {studio.province ?? 'Chưa bổ sung'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-studio-muted">
                    <Phone className="size-3.5 text-studio-muted" />
                    Số điện thoại
                  </span>
                  {studio.contactPhone ? (
                    <a
                      href={`tel:${studio.contactPhone}`}
                      className="text-sm font-medium text-studio-primary hover:underline"
                    >
                      {studio.contactPhone}
                    </a>
                  ) : (
                    <p className="text-sm text-studio-muted">Chưa bổ sung</p>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-studio-muted">
                    <Mail className="size-3.5 text-studio-muted" />
                    Email liên hệ
                  </span>
                  {studio.contactEmail ? (
                    <a
                      href={`mailto:${studio.contactEmail}`}
                      className="text-sm font-medium text-studio-primary hover:underline"
                    >
                      {studio.contactEmail}
                    </a>
                  ) : (
                    <p className="text-sm text-studio-muted">Chưa bổ sung</p>
                  )}
                </div>
              </div>

              {/* Social & Maps Links */}
              <div className="border-t border-studio-border/60 pt-4">
                <span className="text-xs font-medium uppercase tracking-wide text-studio-muted">
                  Kênh kết nối &amp; Bản đồ
                </span>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {studio.facebookUrl ? (
                    <a
                      href={studio.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-studio-border bg-studio-subtle/50 px-3 py-1.5 text-xs font-medium text-studio-ink hover:border-studio-primary/40 hover:bg-studio-surface"
                    >
                      <Facebook className="size-3.5 text-blue-600" />
                      Facebook
                    </a>
                  ) : null}

                  {studio.instagramUrl ? (
                    <a
                      href={studio.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-studio-border bg-studio-subtle/50 px-3 py-1.5 text-xs font-medium text-studio-ink hover:border-studio-primary/40 hover:bg-studio-surface"
                    >
                      <Instagram className="size-3.5 text-pink-600" />
                      Instagram
                    </a>
                  ) : null}

                  {studio.googleMapsUrl ? (
                    <a
                      href={studio.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-studio-border bg-studio-subtle/50 px-3 py-1.5 text-xs font-medium text-studio-ink hover:border-studio-primary/40 hover:bg-studio-surface"
                    >
                      <Globe className="size-3.5 text-emerald-600" />
                      Google Maps
                    </a>
                  ) : null}

                  {!studio.facebookUrl &&
                    !studio.instagramUrl &&
                    !studio.googleMapsUrl && (
                      <p className="text-xs text-studio-muted">
                        Chưa có liên kết mạng xã hội hay Google Maps. Hãy bổ
                        sung để khách dễ tìm đến xưởng.
                      </p>
                    )}
                </div>
              </div>
            </StudioCard>

            {/* Studio Photo Gallery Card */}
            <StudioCard className="space-y-4">
              <div className="flex items-center justify-between border-b border-studio-border/60 pb-3">
                <div>
                  <h2 className="font-heading text-base font-bold text-studio-ink">
                    Hình ảnh không gian &amp; trải nghiệm
                  </h2>
                  <p className="mt-0.5 text-xs text-studio-muted">
                    {studio.images?.length ?? 0} hình ảnh đã đăng tải
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
                >
                  <Edit3 className="size-3" />
                  Quản lý ảnh
                </button>
              </div>

              {studio.images && studio.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {studio.images.map((image, index) => {
                    const isCover =
                      studio.photoIds?.[0] === image.id || index === 0;
                    return (
                      <div
                        key={image.id}
                        className="group relative aspect-4/3 overflow-hidden rounded-md border border-studio-border/70 bg-studio-subtle"
                      >
                        <Img
                          src={image.url}
                          mediumUrl={image.mediumUrl}
                          thumbnailUrl={image.thumbnailUrl}
                          variant="thumbnail"
                          alt={`Không gian studio ${index + 1}`}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {isCover && (
                          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-studio-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-xs backdrop-blur-xs">
                            <Star className="size-2.5 fill-amber-400 text-amber-400" />
                            Ảnh bìa
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-studio-border py-8 text-center text-studio-muted">
                  <Images className="size-8" />
                  <p className="mt-2 text-sm font-medium">
                    Chưa có ảnh không gian
                  </p>
                  <p className="text-xs">
                    Tải ảnh thật về bàn làm việc, dụng cụ và không gian xưởng để
                    thu hút học viên.
                  </p>
                  <StudioButton
                    type="button"
                    variant="secondary"
                    onClick={() => setIsEditing(true)}
                    className="mt-3 text-xs"
                  >
                    Tải ảnh lên
                  </StudioButton>
                </div>
              )}
            </StudioCard>
          </div>

          {/* Right Column: Payment & Deposit Settings (5 cols) */}
          <div className="space-y-studio-section lg:col-span-5">
            {studio.status !== 'suspended' && (
              <StudioPaymentSettings studioId={studio.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
