import { useAuth } from '@/hooks/useAuth';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '@/lib/query-invalidation';
import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createStudioEvidenceSchema,
  defaultSiteSettings,
} from '@workshop/shared';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { authFieldErrors } from '@/lib/auth-validation';
import type { MemberStudio } from '@/types/management';
import {
  StudioEvidenceFields,
  type EvidenceValues,
} from './StudioEvidenceFields';
import {
  StudioButton,
  StudioCard,
  StudioField,
  StudioFormSection,
} from './StudioPrimitives';
import { imageService } from '@/services/imageService';
import { toast } from 'sonner';

export function StudioEvidenceEditor({
  studio,
  isOpen,
  onOpenChange,
}: {
  studio: MemberStudio;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const userId = useAuth().user?.id;
  const settings = useSiteSettings();
  const policy = (settings.data ?? defaultSiteSettings).studio;
  const [search, setSearch] = useSearchParams();
  const [internalOpen, setInternalOpen] = useState(
    () => search.get('edit') === '1',
  );
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    setInternalOpen(val);
  };
  const [values, setValues] = useState<EvidenceValues>({
    contactPhone: studio.contactPhone ?? '',
    contactEmail: studio.contactEmail ?? '',
    photoIds: studio.photoIds ?? [],
    facebookUrl: studio.facebookUrl ?? '',
    instagramUrl: studio.instagramUrl ?? '',
    googleMapsUrl: studio.googleMapsUrl ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState(studio.name);
  const [address, setAddress] = useState(studio.address);
  const [saving, setSaving] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const client = useQueryClient();

  // Reset form fields when opening edit mode
  useEffect(() => {
    if (open) {
      setName(studio.name);
      setAddress(studio.address);
      setValues({
        contactPhone: studio.contactPhone ?? '',
        contactEmail: studio.contactEmail ?? '',
        photoIds: studio.photoIds ?? [],
        facebookUrl: studio.facebookUrl ?? '',
        instagramUrl: studio.instagramUrl ?? '',
        googleMapsUrl: studio.googleMapsUrl ?? '',
      });
      setErrors({});
    }
  }, [open, studio]);
  const hasChanges =
    name !== studio.name ||
    address !== studio.address ||
    values.contactPhone !== (studio.contactPhone ?? '') ||
    values.contactEmail !== (studio.contactEmail ?? '') ||
    JSON.stringify(values.photoIds) !== JSON.stringify(studio.photoIds ?? []) ||
    values.facebookUrl !== (studio.facebookUrl ?? '') ||
    values.instagramUrl !== (studio.instagramUrl ?? '') ||
    values.googleMapsUrl !== (studio.googleMapsUrl ?? '');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || photosBusy || !settings.isSuccess) return;
    const parsed = createStudioEvidenceSchema(policy).safeParse({
      ...values,
      name,
      address,
      facebookUrl: values.facebookUrl.trim() || null,
      instagramUrl: values.instagramUrl.trim() || null,
      googleMapsUrl: values.googleMapsUrl.trim() || null,
    });
    if (!parsed.success) {
      setErrors(authFieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await apiFetch(`/studios/${studio.id}/evidence`, {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
      });
      const removed = (studio.photoIds ?? []).filter(
        (id) => !values.photoIds.includes(id),
      );
      await Promise.allSettled(removed.map((id) => imageService.remove(id)));
      await Promise.all([
        invalidateResources(client, userId, ['studios', 'workshops']),
        invalidatePublicCatalog(client),
      ]);
      setOpen(false);
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('edit');
          return next;
        },
        { replace: true },
      );
      toast.success('Đã cập nhật hồ sơ studio.');
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'Chưa gửi được hồ sơ.',
      );
    } finally {
      setSaving(false);
    }
  }
  if (!open) {
    if (isOpen !== undefined) return null;
    return (
      <StudioCard className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-studio-primary">
            Hồ sơ bậc 1
          </p>
          <h2 className="mt-1 font-heading text-xl font-semibold text-studio-ink">
            Thông tin và hình ảnh studio
          </h2>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-studio-muted">
          {studio.profileComplete
            ? 'Đổi tên, địa chỉ hoặc ảnh bìa cần duyệt lại. Thông tin liên hệ và ảnh bổ sung được cập nhật ngay.'
            : `Cần bổ sung đủ số điện thoại, email và ít nhất ${policy.minPhotos} ảnh thật trước khi xét duyệt.`}
        </p>
        <StudioButton
          type="button"
          variant="secondary"
          onClick={() => {
            setName(studio.name);
            setAddress(studio.address);
            setValues({
              contactPhone: studio.contactPhone ?? '',
              contactEmail: studio.contactEmail ?? '',
              photoIds: studio.photoIds ?? [],
              facebookUrl: studio.facebookUrl ?? '',
              instagramUrl: studio.instagramUrl ?? '',
              googleMapsUrl: studio.googleMapsUrl ?? '',
            });
            setErrors({});
            setOpen(true);
          }}
        >
          Bổ sung / cập nhật hồ sơ
        </StudioButton>
      </StudioCard>
    );
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="space-y-studio-section pb-24"
    >
      <StudioFormSection
        title="Thông tin studio"
        description="Tên và địa chỉ được hiển thị trên trang studio công khai."
      >
        <div className="grid gap-studio-group md:grid-cols-2">
          <StudioField
            label="Tên studio"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
          <StudioField
            label="Địa chỉ studio"
            value={address}
            maxLength={500}
            onChange={(event) => setAddress(event.target.value)}
            error={errors.address}
          />
        </div>
      </StudioFormSection>
      <StudioEvidenceFields
        values={values}
        errors={errors}
        onChange={(field, value) => {
          setValues((current) => ({ ...current, [field]: value }));
          setErrors((current) => ({ ...current, [field]: '' }));
        }}
        studioId={studio.id}
        ensureStudio={async () => studio.id}
        attachedIds={studio.photoIds}
        onBusyChange={setPhotosBusy}
      />
      <p className="text-sm leading-6 text-studio-muted">
        Thay đổi thông tin nhạy cảm sẽ đưa studio về chờ duyệt và thu hồi xác
        minh hiện tại. Khách thanh toán tiền cọc bằng chuyển khoản khi đặt chỗ.
      </p>
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-t border-studio-border bg-studio-surface px-4 py-3 sm:px-6 ${hasChanges ? 'sticky bottom-0 z-30 -mx-5 shadow-studio-sticky sm:-mx-8' : ''}`}
      >
        <p className="text-sm text-studio-muted">
          {hasChanges ? 'Bạn có thay đổi chưa lưu.' : 'Hồ sơ đã được lưu.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <StudioButton
            type="submit"
            disabled={saving || photosBusy || !settings.isSuccess}
            loading={saving}
          >
            {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </StudioButton>
          <StudioButton
            type="button"
            variant="secondary"
            disabled={saving || photosBusy}
            onClick={() => setOpen(false)}
          >
            Đóng
          </StudioButton>
        </div>
      </div>
    </form>
  );
}
