import { LoadingState } from '../ui/LoadingState';
import { Img } from '../ui/Img';
import { queryKeys } from '@/lib/query-keys';
import { useEffect, useRef, useState } from 'react';
import { defaultSiteSettings } from '@workshop/shared';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { Trash2, Star, UploadCloud } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { imageService, type UploadedImage } from '@/services/imageService';
import { AuthField } from '../ui/auth-field';
import { toast } from 'sonner';

export type EvidenceValues = {
  contactPhone: string;
  contactEmail: string;
  photoIds: string[];
  facebookUrl: string;
  instagramUrl: string;
  googleMapsUrl: string;
};
type Props = {
  values: EvidenceValues;
  errors: Record<string, string>;
  onChange: (field: keyof EvidenceValues, value: string | string[]) => void;
  studioId?: string;
  ensureStudio: () => Promise<string>;
  prepareAuth?: () => void;
  attachedIds?: string[];
  onBusyChange?: (busy: boolean) => void;
};

export function StudioEvidenceFields({
  values,
  errors,
  onChange,
  studioId,
  ensureStudio,
  prepareAuth,
  attachedIds = [],
  onBusyChange,
}: Props) {
  const settingsQuery = useSiteSettings();
  const policy = (settingsQuery.data ?? defaultSiteSettings).studio;
  const { user } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const previewUrls = useRef(new Set<string>());
  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    },
    [],
  );
  const images = useQuery({
    queryKey: queryKeys.studios.images(user?.id, studioId),
    queryFn: ({ signal }) => imageService.list(studioId!, signal),
    enabled: !!(user && studioId),
  });
  async function upload(files: File[]) {
    if (busy || !files.length || !settingsQuery.isSuccess) return;
    if (values.photoIds.length + files.length > policy.maxPhotos) {
      setError(`Chọn tối đa ${policy.maxPhotos} ảnh.`);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      const id = studioId || (await ensureStudio());
      const next = [...values.photoIds];
      for (const [index, file] of files.entries()) {
        const localUrl = URL.createObjectURL(file);
        previewUrls.current.add(localUrl);
        setPreview(localUrl);
        setProgress(0);
        setUploadLabel(`Ảnh ${index + 1}/${files.length}`);
        let image: UploadedImage;
        try {
          image = await imageService.upload(id, file, setProgress);
        } finally {
          if (previewUrls.current.delete(localUrl))
            URL.revokeObjectURL(localUrl);
          setPreview('');
        }
        client.setQueryData<UploadedImage[]>(
          queryKeys.studios.images(user?.id, id),
          (current) => [...(current ?? []), image],
        );
        next.push(image.id);
        onChange('photoIds', [...next]);
      }
      await client.invalidateQueries({
        queryKey: queryKeys.studios.images(user?.id, id),
      });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'Chưa tải được ảnh.',
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      if (!attachedIds.includes(id)) await imageService.remove(id);
      onChange(
        'photoIds',
        values.photoIds.filter((item) => item !== id),
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'Chưa xóa được ảnh.',
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  const coverId = values.photoIds[0];
  const coverImage = images.data?.find((item) => item.id === coverId);
  const galleryIds = values.photoIds.slice(1);
  return (
    <section className="space-y-5" aria-label="Liên hệ và ảnh thật của studio">
      <h2 className="font-heading text-xl font-semibold">Liên hệ</h2>
      <p className="text-sm leading-6 text-muted">
        Thông tin này giúp Open Slot xác nhận studio của bạn.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <AuthField
          id="studio-contactPhone"
          label="Số điện thoại studio"
          type="tel"
          autoComplete="tel"
          required
          maxLength={24}
          value={values.contactPhone}
          error={errors.contactPhone}
          onChange={(event) => onChange('contactPhone', event.target.value)}
        />
        <AuthField
          id="studio-contactEmail"
          label="Email liên hệ studio"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={values.contactEmail}
          error={errors.contactEmail}
          onChange={(event) => onChange('contactEmail', event.target.value)}
        />
      </div>
      <h2 className="pt-3 font-heading text-xl font-semibold">Hình ảnh</h2>
      <div
        id="studio-photoIds"
        tabIndex={-1}
        aria-describedby="studio-photoIds-hint"
        className="space-y-3"
      >
        <h3 className="font-semibold">
          Ảnh thật của studio · {values.photoIds.length}/{policy.maxPhotos}
        </h3>
        <p id="studio-photoIds-hint" className="text-sm leading-6 text-muted">
          Tối thiểu {policy.minPhotos} ảnh: mặt tiền/biển hiệu, không gian tổ
          chức và khu vực làm workshop. Chọn JPG, PNG hoặc WebP tối đa{' '}
          {policy.maxImageMb} MB; ảnh được nén trước khi tải lên. Không dùng ảnh
          minh họa hoặc ảnh giấy tờ định danh.
        </p>
        {!user && (
          <p className="text-sm">
            <Link
              to="/dang-nhap?redirect=%2Fdang-ky-studio"
              onClick={prepareAuth}
              className="inline-flex min-h-11 items-center font-semibold text-primary underline"
            >
              Đăng nhập để tải ảnh studio
            </Link>
            . Thông tin đang nhập được giữ trong bản nháp.
          </p>
        )}
        {busy && (
          <div role="status" className="space-y-2 text-sm text-muted">
            <p>
              {uploadLabel || 'Đang xử lý ảnh'} · {progress}%
            </p>
            <progress
              aria-label="Tiến độ tải ảnh"
              max={100}
              value={progress}
              className="h-2 w-full accent-primary"
            />
          </div>
        )}
        {(error || images.error) && (
          <p role="alert" className="text-sm text-brick">
            {error || images.error?.message}
          </p>
        )}
        {errors.photoIds && (
          <p
            id="studio-photoIds-error"
            role="alert"
            className="text-sm text-brick"
          >
            {errors.photoIds}
          </p>
        )}
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void upload(Array.from(event.dataTransfer.files));
          }}
          className={`space-y-4 rounded-studio-card border p-3 transition-colors duration-studio motion-reduce:transition-none sm:p-4 ${dragging ? 'border-studio-primary bg-studio-selected ring-2 ring-studio-primary/20' : 'border-studio-border bg-studio-subtle'}`}
        >
          {coverId && (
            <figure className="group relative aspect-[16/7] overflow-hidden rounded-studio-card bg-studio-neutral-soft">
              {coverImage ? (
                <Img
                  variant="medium"
                  src={coverImage.url}
                  mediumUrl={coverImage.mediumUrl}
                  alt="Ảnh bìa studio"
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              ) : (
                <LoadingState
                  label="Đang tải ảnh bìa…"
                  className="flex size-full items-center justify-center text-sm text-studio-muted"
                />
              )}
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-studio-surface/95 px-3 py-2 text-xs font-semibold text-studio-ink shadow-studio-card">
                <Star
                  aria-hidden="true"
                  className="size-3.5 text-studio-accent"
                />
                Ảnh bìa hiện tại
              </span>
              <button
                type="button"
                aria-label="Xóa ảnh bìa"
                disabled={busy}
                onClick={() => void remove(coverId)}
                className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-studio-surface/95 text-studio-ink opacity-100 shadow-studio-card transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </figure>
          )}
          {galleryIds.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {galleryIds.map((id) => {
                const index = values.photoIds.indexOf(id);
                const image = images.data?.find((item) => item.id === id);
                return (
                  <figure
                    key={id}
                    className="group relative aspect-[4/3] min-w-0 overflow-hidden rounded-studio-card bg-studio-neutral-soft"
                  >
                    {image ? (
                      <Img
                        variant="thumbnail"
                        src={image.url}
                        thumbnailUrl={image.thumbnailUrl}
                        alt={`Ảnh studio ${index + 1}`}
                        className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    ) : (
                      <LoadingState
                        label="Đang tải ảnh…"
                        className="flex size-full items-center justify-center text-sm text-studio-muted"
                      />
                    )}
                    <button
                      type="button"
                      aria-label={`Xóa ảnh ${index + 1}`}
                      disabled={busy}
                      onClick={() => void remove(id)}
                      className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-studio-surface/95 text-studio-ink opacity-100 shadow-studio-card transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onChange('photoIds', [
                          id,
                          ...values.photoIds.filter((item) => item !== id),
                        ])
                      }
                      className="absolute bottom-2 left-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-studio-surface/95 px-3 text-xs font-semibold text-studio-ink opacity-100 shadow-studio-card transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    >
                      <Star aria-hidden="true" className="size-3.5" />
                      Đặt làm ảnh bìa
                    </button>
                  </figure>
                );
              })}
            </div>
          )}
          {preview && (
            <figure className="relative aspect-[16/7] overflow-hidden rounded-studio-card">
              <Img
                variant="thumbnail"
                src={preview}
                alt="Ảnh đang tải lên"
                className="size-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-studio-surface/95 p-2 text-center text-sm text-studio-ink">
                {uploadLabel} · {progress}%
              </span>
            </figure>
          )}
          {user &&
            settingsQuery.isSuccess &&
            values.photoIds.length < policy.maxPhotos && (
              <label
                className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-studio-card border border-dashed px-4 py-5 text-center transition-colors duration-studio focus-within:ring-2 focus-within:ring-studio-primary motion-reduce:transition-none ${dragging ? 'border-studio-primary bg-studio-selected' : 'border-studio-border bg-studio-surface hover:border-studio-primary/60'} ${busy ? 'cursor-wait opacity-60' : ''}`}
              >
                <UploadCloud
                  aria-hidden="true"
                  className="size-7 text-studio-primary"
                />
                <span className="text-sm font-semibold text-studio-ink">
                  {dragging
                    ? 'Thả ảnh để tải lên'
                    : 'Kéo ảnh vào đây để tải lên'}
                </span>
                <span className="text-sm text-studio-muted">
                  hoặc chọn từ thiết bị · JPG, PNG, WebP
                </span>
                <input
                  type="file"
                  aria-label="Chọn ảnh thật của studio"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={busy}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = '';
                    void upload(files);
                  }}
                  className="sr-only"
                />
              </label>
            )}
        </div>
      </div>
      <h3 className="font-semibold">
        Liên kết của studio{' '}
        <span className="font-normal text-muted">(không bắt buộc)</span>
      </h3>
      {(['facebookUrl', 'instagramUrl', 'googleMapsUrl'] as const).map(
        (field) => (
          <AuthField
            key={field}
            id={`studio-${field}`}
            type="url"
            label={
              {
                facebookUrl: 'Facebook',
                instagramUrl: 'Instagram',
                googleMapsUrl: 'Google Maps',
              }[field]
            }
            placeholder="https://…"
            maxLength={1000}
            value={values[field]}
            error={errors[field]}
            onChange={(event) => onChange(field, event.target.value)}
          />
        ),
      )}
    </section>
  );
}
