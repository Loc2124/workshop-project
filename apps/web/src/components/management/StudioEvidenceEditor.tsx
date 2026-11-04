import { useAuth } from '../../hooks/useAuth';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '../../lib/query-invalidation';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createStudioEvidenceSchema,
  defaultSiteSettings,
} from '@workshop/shared';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { authFieldErrors } from '../../lib/auth-validation';
import type { MemberStudio } from '../../types/management';
import {
  StudioEvidenceFields,
  type EvidenceValues,
} from './StudioEvidenceFields';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { imageService } from '../../services/imageService';
import { toast } from 'sonner';

export function StudioEvidenceEditor({ studio }: { studio: MemberStudio }) {
  const userId = useAuth().user?.id;
  const settings = useSiteSettings();
  const policy = (settings.data ?? defaultSiteSettings).studio;
  const [search, setSearch] = useSearchParams();
  const [open, setOpen] = useState(() => search.get('edit') === '1');
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
  const [paymentQrImageId, setPaymentQrImageId] = useState(
    studio.paymentQrImageId ?? null,
  );
  const [qrUrl, setQrUrl] = useState(studio.paymentQrImageUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const client = useQueryClient();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || photosBusy || !settings.isSuccess) return;
    const parsed = createStudioEvidenceSchema(policy).safeParse({
      ...values,
      name,
      address,
      paymentQrImageId,
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
  if (!open)
    return (
      <section className="space-y-3 border-y border-line py-5">
        <h2 className="font-heading text-2xl font-semibold">Hồ sơ bậc 1</h2>
        <p className="text-sm leading-6 text-muted">
          {studio.profileComplete
            ? 'Đổi tên, địa chỉ, ảnh bìa hoặc QR nhận tiền cần duyệt lại. Thông tin liên hệ và ảnh bổ sung được cập nhật ngay.'
            : `Cần bổ sung đủ số điện thoại, email và ít nhất ${policy.minPhotos} ảnh thật trước khi xét duyệt.`}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setName(studio.name);
            setAddress(studio.address);
            setPaymentQrImageId(studio.paymentQrImageId ?? null);
            setQrUrl(studio.paymentQrImageUrl ?? null);
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
        </Button>
      </section>
    );
  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="space-y-5 border-y border-line py-6"
    >
      <label className="block space-y-2 text-sm font-semibold">
        <span>Tên studio</span>
        <Input
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
        {errors.name && <span role="alert">{errors.name}</span>}
      </label>
      <label className="block space-y-2 text-sm font-semibold">
        <span>Địa chỉ studio</span>
        <Input
          value={address}
          maxLength={500}
          onChange={(event) => setAddress(event.target.value)}
        />
        {errors.address && <span role="alert">{errors.address}</span>}
      </label>
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
      <div className="space-y-3">
        <label className="block space-y-2 text-sm font-semibold">
          <span>Ảnh QR nhận tiền (cần admin kiểm tra)</span>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={saving || photosBusy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setPhotosBusy(true);
              try {
                const image = await imageService.upload(studio.id, file);
                setPaymentQrImageId(image.id);
                setQrUrl(image.url);
              } catch (cause) {
                toast.error(
                  cause instanceof Error ? cause.message : 'Chưa tải được QR.',
                );
              } finally {
                setPhotosBusy(false);
              }
            }}
          />
        </label>
        {qrUrl && (
          <>
            <a
              className="text-sm underline"
              href={qrUrl}
              target="_blank"
              rel="noreferrer"
            >
              Xem QR nhận tiền
            </a>
            <Button
              type="button"
              variant="ghost"
              disabled={saving || photosBusy}
              onClick={() => {
                setPaymentQrImageId(null);
                setQrUrl(null);
              }}
            >
              Bỏ mã QR
            </Button>
          </>
        )}
      </div>
      <p className="text-sm text-muted">
        Thay đổi thông tin nhạy cảm sẽ đưa studio về chờ duyệt và thu hồi xác
        minh hiện tại. QR mới chỉ được dùng sau khi duyệt.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={saving || photosBusy || !settings.isSuccess}
        >
          {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={saving || photosBusy}
          onClick={() => setOpen(false)}
        >
          Đóng
        </Button>
      </div>
    </form>
  );
}
