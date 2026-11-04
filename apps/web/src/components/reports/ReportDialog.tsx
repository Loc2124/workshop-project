import { Img } from '../ui/Img';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flag, X } from 'lucide-react';
import { z } from 'zod';
import { reportReasons, createReportSchema } from '@workshop/shared';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/api-client';
import { authHref } from '../../lib/auth-navigation';
import { compressStudioImage } from '../../lib/compress-studio-image';
import { uploadToSignedUrl } from '../../services/imageService';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { toast } from 'sonner';
export function ReportButton({
  targetType,
  targetId,
  initialOpen = false,
}: {
  targetType: 'studio' | 'workshop';
  targetId: string;
  initialOpen?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(initialOpen);
  const [reason, setReason] =
    useState<keyof typeof reportReasons>('misleading');
  const [detail, setDetail] = useState('');
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    if (location.hash === '#report' && user) setOpen(true);
  }, [location.hash, user]);
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const mutation = useMutation({
    mutationFn: async () => {
      const body = createReportSchema.parse({
        targetType,
        targetId,
        reason,
        detail,
        attachmentIds: images.map((i) => i.id),
      });
      return apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setSent(true);
      setDetail('');
      images.forEach((i) => {
        URL.revokeObjectURL(i.url);
        urls.current.delete(i.url);
      });
      setImages([]);
    },
    onError: (cause) =>
      toast.error(
        cause instanceof Error ? cause.message : 'Chưa gửi được báo cáo.',
      ),
  });
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setError('');
    if (images.length + files.length > 4) {
      setError('Tối đa 4 ảnh đính kèm.');
      return;
    }
    setProgress(0);
    try {
      for (const file of files) {
        const blob = await compressStudioImage(file);
        const upload = z
          .object({ id: z.string().uuid(), signedUploadUrl: z.string().url() })
          .parse(
            await apiFetch('/reports/attachments/upload-url', {
              method: 'POST',
              body: JSON.stringify({ byteSize: blob.size }),
            }),
          );
        try {
          await uploadToSignedUrl(
            upload.signedUploadUrl,
            blob,
            setProgress,
            '3600',
          );
          await apiFetch(`/reports/attachments/${upload.id}/confirm`, {
            method: 'POST',
          });
          const url = URL.createObjectURL(blob);
          urls.current.add(url);
          setImages((old) => [...old, { id: upload.id, url }]);
        } catch (error) {
          void apiFetch(`/reports/attachments/${upload.id}`, {
            method: 'DELETE',
          }).catch(() => undefined);
          throw error;
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Chưa tải được ảnh.',
      );
    } finally {
      setProgress(null);
    }
  }
  async function remove(id: string) {
    setError('');
    try {
      await apiFetch(`/reports/attachments/${id}`, { method: 'DELETE' });
      setImages((old) =>
        old.filter((i) => {
          if (i.id !== id) return true;
          URL.revokeObjectURL(i.url);
          urls.current.delete(i.url);
          return false;
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Chưa xóa được ảnh.',
      );
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await mutation.mutateAsync();
    } catch {
      // The mutation reports server errors through the global toast.
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        className="text-sm text-muted"
        disabled={isLoading}
        onClick={() => {
          if (!user) {
            navigate(
              authHref(
                '/dang-nhap',
                location.pathname + location.search + '#report',
              ),
            );
            return;
          }
          setOpen(true);
        }}
      >
        <Flag size={15} />
        Báo cáo
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending && progress === null) setOpen(value);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto rounded-md"
          closeDisabled={mutation.isPending || progress !== null}
        >
          <DialogTitle>
            Báo cáo {targetType === 'studio' ? 'studio' : 'workshop'}
          </DialogTitle>
          <DialogDescription className="mt-2">
            Mỗi tài khoản chỉ gửi một báo cáo cho mỗi đối tượng. Ảnh bằng chứng
            và thông tin người báo cáo chỉ dành cho admin.
          </DialogDescription>
          {sent ? (
            <div className="mt-5 space-y-4">
              <p role="status" className="text-sm">
                Đã gửi báo cáo. Open Slot sẽ xem xét nội dung của bạn.
              </p>
              <Button onClick={() => setOpen(false)}>Đóng</Button>
            </div>
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="mt-5 space-y-4"
            >
              <label className="block space-y-2 text-sm">
                <span>Lý do</span>
                <select
                  aria-label="Lý do báo cáo"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value as keyof typeof reportReasons)
                  }
                  className="min-h-11 w-full rounded-sm border border-line bg-surface px-3"
                >
                  {Object.entries(reportReasons).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span>Mô tả chi tiết</span>
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  className="min-h-28 w-full rounded-sm border border-line p-3"
                />
                <span className="block text-xs text-muted">
                  Từ 10 đến 2000 ký tự.
                </span>
              </label>
              <section>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">Ảnh đính kèm · {images.length}/4</p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      images.length >= 4 ||
                      progress !== null ||
                      mutation.isPending
                    }
                    onClick={() => fileRef.current?.click()}
                  >
                    Thêm ảnh
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    aria-label="Chọn ảnh bằng chứng"
                    onChange={(event) => void upload(event)}
                  />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {images.map((image, i) => (
                    <div key={image.id} className="relative">
                      <Img
                        src={image.url}
                        alt={`Bằng chứng ${i + 1}`}
                        className="aspect-square w-full rounded-sm object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Xóa ảnh ${i + 1}`}
                        className="absolute right-0 top-0 flex size-9 items-center justify-center bg-surface/90"
                        disabled={progress !== null || mutation.isPending}
                        onClick={() => void remove(image.id)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {progress !== null && (
                  <div className="mt-3 space-y-1">
                    <progress
                      aria-label="Tiến độ tải ảnh"
                      value={progress}
                      max={100}
                      className="w-full"
                    />
                    <p className="text-xs text-muted">
                      Đang tải ảnh… {progress}%
                    </p>
                  </div>
                )}
              </section>
              {error && (
                <p role="alert" className="text-sm text-brick">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  mutation.isPending ||
                  progress !== null ||
                  detail.trim().length < 10
                }
              >
                {mutation.isPending ? 'Đang gửi…' : 'Gửi báo cáo'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
