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
import { imageService } from '../../services/imageService';

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const client = useQueryClient();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || photosBusy || !settings.isSuccess) return;
    const parsed = createStudioEvidenceSchema(policy).safeParse({
      ...values,
      facebookUrl: values.facebookUrl.trim() || null,
      instagramUrl: values.instagramUrl.trim() || null,
      googleMapsUrl: values.googleMapsUrl.trim() || null,
    });
    if (!parsed.success) {
      setErrors(authFieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    setError('');
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa gửi được hồ sơ.');
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
            ? 'Đã có thông tin liên hệ và ảnh studio. Cập nhật sẽ gửi hồ sơ về chờ duyệt và thu hồi xác minh hiện tại.'
            : `Cần bổ sung đủ số điện thoại, email và ít nhất ${policy.minPhotos} ảnh thật trước khi xét duyệt.`}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValues({
              contactPhone: studio.contactPhone ?? '',
              contactEmail: studio.contactEmail ?? '',
              photoIds: studio.photoIds ?? [],
              facebookUrl: studio.facebookUrl ?? '',
              instagramUrl: studio.instagramUrl ?? '',
              googleMapsUrl: studio.googleMapsUrl ?? '',
            });
            setErrors({});
            setError('');
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
      <p className="text-sm text-muted">
        Gửi thay đổi sẽ đưa studio về chờ duyệt. Bậc 2 cần được xác minh lại
        trước khi nhận cọc cho đơn mới.
      </p>
      {error && (
        <p role="alert" className="text-sm text-brick">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={saving || photosBusy || !settings.isSuccess}
        >
          {saving ? 'Đang gửi…' : 'Gửi hồ sơ xét duyệt lại'}
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
