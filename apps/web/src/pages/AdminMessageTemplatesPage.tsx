import { invalidateResources } from '../lib/query-invalidation';
import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  messageTemplateKeySchema,
  messageTemplateSpecs,
  messageTemplateEditSchema,
  type MessageTemplateKey,
} from '@workshop/shared';
import { toast, Toaster } from 'sonner';
import { Eye, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { ConfirmReasonDialog } from '../components/admin/ConfirmReasonDialog';
import { apiFetch } from '../lib/api-client';
import { formatReviewDate } from '../lib/studio-review';
const schema = z.object({
  key: messageTemplateKeySchema,
  subject: z.string(),
  body: z.string(),
  updatedBy: z.string().nullable(),
  updatedByName: z.string().nullable(),
  updatedAt: z.string(),
  version: z.string(),
  label: z.string(),
  variables: z.array(z.string()),
});
const response = z.object({ templates: z.array(schema) });
type Draft = {
  subject: string;
  body: string;
  version: string;
  baseSubject: string;
  baseBody: string;
};
export function AdminMessageTemplatesPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const templates = useQuery({
    queryKey: queryKeys.templates.config(userId),
    queryFn: async ({ signal }) =>
      z
        .object({ items: z.array(schema), total: z.number() })
        .parse(await apiFetch('/admin/mau-thong-bao', { signal })).items,
  });
  const [selected, setSelected] =
    useState<MessageTemplateKey>('studio_approved');
  const [drafts, setDrafts] = useState<
    Partial<Record<MessageTemplateKey, Draft>>
  >({});
  const [preview, setPreview] = useState<{
    subject: string;
    body: string;
    sample: Record<string, string>;
  } | null>(null);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState('');
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const field = useRef<'subject' | 'body'>('body');
  const saved = templates.data?.find((t) => t.key === selected);
  const draft = drafts[selected];
  const current = {
    subject: draft?.subject ?? saved?.subject ?? '',
    body: draft?.body ?? saved?.body ?? '',
  };
  const dirty =
    !!draft &&
    (draft.subject !== draft.baseSubject || draft.body !== draft.baseBody);
  const valid = messageTemplateEditSchema.safeParse(current).success;
  function change(partial: Partial<{ subject: string; body: string }>) {
    if (!saved) return;
    setError('');
    setDrafts((old) => ({
      ...old,
      [selected]: {
        subject: saved.subject,
        body: saved.body,
        version: saved.version,
        baseSubject: saved.subject,
        baseBody: saved.body,
        ...old[selected],
        ...partial,
      },
    }));
  }
  function insert(variable: string) {
    const target = field.current;
    const element = target === 'subject' ? subjectRef.current : bodyRef.current;
    const text = current[target],
      start = element?.selectionStart ?? text.length,
      end = element?.selectionEnd ?? start,
      token = `{{${variable}}}`;
    change({ [target]: text.slice(0, start) + token + text.slice(end) });
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  }
  const mutation = useMutation({
    mutationFn: async (action: 'save' | 'reset') => {
      if (!saved) throw new Error('Chưa tải được mẫu thông báo.');
      return response.parse(
        await apiFetch(
          `/admin/mau-thong-bao/${selected}${action === 'reset' ? '/reset' : ''}`,
          {
            method: action === 'reset' ? 'POST' : 'PUT',
            body: JSON.stringify({
              ...(action === 'save' ? current : {}),
              expectedVersion: draft?.version ?? saved.version,
            }),
          },
        ),
      ).templates;
    },
    onSuccess: async (data, action) => {
      client.setQueryData(queryKeys.templates.config(userId), data);
      setDrafts((old) => {
        const next = { ...old };
        delete next[selected];
        return next;
      });
      setReset(false);
      setError('');
      await invalidateResources(client, userId, ['templates']);
      toast.success(
        action === 'reset'
          ? 'Đã khôi phục mẫu mặc định.'
          : 'Đã lưu mẫu thông báo.',
      );
    },
    onError: (e) => {
      setError(e.message);
      toast.error(e.message);
    },
  });
  const previewMutation = useMutation({
    mutationFn: async () =>
      z
        .object({
          preview: z.object({ subject: z.string(), body: z.string() }),
          sample: z.record(z.string(), z.string()),
        })
        .parse(
          await apiFetch(`/admin/mau-thong-bao/${selected}/preview`, {
            method: 'POST',
            body: JSON.stringify(current),
          }),
        ),
    onSuccess: (result) =>
      setPreview({ ...result.preview, sample: result.sample }),
    onError: (e) => {
      setError(e.message);
      toast.error(e.message);
    },
  });
  const busy = mutation.isPending || previewMutation.isPending;
  return (
    <div className="space-y-5">
      <Toaster richColors position="top-right" />
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-semibold">Mẫu thông báo</h1>
        <p className="mt-1 text-xs text-muted">
          Nội dung được dùng cho các thông báo mới. Thông báo đã gửi giữ nguyên.
        </p>
      </header>
      {templates.isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20 w-full" />
          ))}
        </div>
      ) : templates.error ? (
        <div role="alert" className="space-y-3 text-sm text-brick">
          <p>Chưa tải được mẫu thông báo.</p>
          <Button variant="outline" onClick={() => void templates.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Danh sách mẫu thông báo" className="space-y-1">
            {messageTemplateKeySchema.options.map((key) => {
              const d = drafts[key];
              const changed =
                d && (d.subject !== d.baseSubject || d.body !== d.baseBody);
              return (
                <button
                  key={key}
                  aria-current={selected === key ? 'true' : undefined}
                  disabled={busy}
                  onClick={() => {
                    setSelected(key);
                    setError('');
                  }}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm ${selected === key ? 'bg-soft font-semibold' : 'hover:bg-soft/60'}`}
                >
                  {messageTemplateSpecs[key].label}
                  {changed && (
                    <span className="text-xs font-normal text-amber-800">
                      Chưa lưu
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          {saved ? (
            <section className="space-y-4 rounded-sm border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-xl font-semibold">
                  {saved.label}
                </h2>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setReset(true)}
                >
                  <RotateCcw size={15} />
                  Khôi phục mặc định
                </Button>
              </div>
              <label className="block space-y-2 text-sm">
                <span>Tiêu đề</span>
                <input
                  ref={subjectRef}
                  required
                  maxLength={200}
                  value={current.subject}
                  disabled={busy}
                  onFocus={() => {
                    field.current = 'subject';
                  }}
                  onChange={(event) => change({ subject: event.target.value })}
                  className="min-h-11 w-full rounded-sm border border-line px-3"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span>Nội dung</span>
                <textarea
                  ref={bodyRef}
                  required
                  maxLength={5000}
                  value={current.body}
                  disabled={busy}
                  onFocus={() => {
                    field.current = 'body';
                  }}
                  onChange={(event) => change({ body: event.target.value })}
                  className="min-h-64 w-full rounded-sm border border-line p-3"
                />
                <span className="block text-xs text-muted">
                  {current.body.length}/5000 ký tự
                </span>
              </label>
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-muted">
                  Bấm biến để chèn tại con trỏ trong tiêu đề hoặc nội dung
                </h3>
                <div className="flex flex-wrap gap-2">
                  {saved.variables.map((variable) => (
                    <Button
                      key={variable}
                      variant="outline"
                      disabled={busy}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insert(variable)}
                      className="min-h-9 px-2.5 text-xs"
                    >{`{{${variable}}}`}</Button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  Biến ngoài danh sách sẽ bị bỏ khi hiển thị hoặc gửi thông báo.
                </p>
              </section>
              {error && (
                <div role="alert" className="space-y-2 text-sm text-brick">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      const result = await templates.refetch();
                      if (!result.error) {
                        setDrafts((old) => {
                          const next = { ...old };
                          delete next[selected];
                          return next;
                        });
                        setError('');
                      }
                    }}
                  >
                    Bỏ bản sửa và tải lại mẫu
                  </Button>
                </div>
              )}
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs text-muted">
                  Cập nhật: {formatReviewDate(saved.updatedAt)} ·{' '}
                  {saved.updatedByName ?? 'Mặc định hệ thống'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || !valid}
                    onClick={() => previewMutation.mutate()}
                  >
                    <Eye size={15} />
                    Xem trước
                  </Button>
                  <Button
                    disabled={busy || !dirty || !valid}
                    onClick={() => mutation.mutate('save')}
                  >
                    {mutation.isPending ? 'Đang lưu…' : 'Lưu mẫu'}
                  </Button>
                </div>
              </footer>
            </section>
          ) : (
            <p role="alert" className="text-sm text-brick">
              Không tìm thấy mẫu đã chọn. Vui lòng tải lại.
            </p>
          )}
        </div>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-md">
          <DialogTitle>Xem trước thông báo</DialogTitle>
          <DialogDescription className="mt-2">
            Dữ liệu mẫu minh họa, không gửi thông báo và không lưu thay đổi.
          </DialogDescription>
          {preview && (
            <>
              <section className="mt-5 space-y-3 rounded-sm border border-line p-4">
                <h3 className="break-words font-semibold">{preview.subject}</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {preview.body}
                </p>
              </section>
              <details className="mt-4 text-xs text-muted">
                <summary className="cursor-pointer py-2">Dữ liệu mẫu</summary>
                <dl className="space-y-2">
                  {Object.entries(preview.sample)
                    .filter(([key]) =>
                      messageTemplateSpecs[selected].variables.includes(key),
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="font-medium">{`{{${key}}}`}</dt>
                        <dd className="break-words">{value}</dd>
                      </div>
                    ))}
                </dl>
              </details>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmReasonDialog
        open={reset}
        onOpenChange={setReset}
        title="Khôi phục mẫu mặc định?"
        description="Thay nội dung mẫu đã lưu và bản đang sửa bằng mẫu mặc định. Thao tác được lưu ngay cho các thông báo gửi tiếp theo."
        requireReason={false}
        confirmLabel="Khôi phục mặc định"
        onConfirm={async () => {
          await mutation.mutateAsync('reset');
        }}
      />
    </div>
  );
}
