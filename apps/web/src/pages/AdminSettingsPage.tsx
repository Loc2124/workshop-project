import { useAuth } from '../hooks/useAuth';
import { queryKeys } from '../lib/query-keys';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '../lib/query-invalidation';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, type FieldPathByValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { siteSettingsSchema, type SiteSettings } from '@workshop/shared';
import { toast, Toaster } from 'sonner';
import { apiFetch } from '../lib/api-client';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '../components/ui/form';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { formatReviewDate } from '../lib/studio-review';

const response = z.object({
  settings: siteSettingsSchema,
  version: z.string(),
  updatedAt: z.string(),
});
type Snapshot = z.infer<typeof response>;
type Field = FieldPathByValue<SiteSettings, string | number>;
const groups: {
  title: string;
  description: string;
  fields: {
    name: Field;
    label: string;
    type: 'number' | 'text' | 'email';
    hint?: string;
    min?: number;
    max?: number;
  }[];
}[] = [
  {
    title: 'Hồ sơ studio',
    description: 'Áp dụng khi đăng ký, bổ sung hồ sơ và xét duyệt studio.',
    fields: [
      {
        name: 'studio.minPhotos',
        label: 'Số ảnh tối thiểu',
        type: 'number',
        min: 1,
        max: 20,
      },
      {
        name: 'studio.maxPhotos',
        label: 'Số ảnh tối đa',
        type: 'number',
        min: 1,
        max: 20,
      },
      {
        name: 'studio.maxImageMb',
        label: 'Dung lượng ảnh tối đa (MB)',
        type: 'number',
        min: 1,
        max: 20,
        hint: 'Ảnh gốc và ảnh tải lên không vượt mức này. Ảnh vẫn được nén WebP trước khi tải.',
      },
    ],
  },
  {
    title: 'Hỗ trợ',
    description: 'Hiển thị tại footer và các khu vực liên hệ hỗ trợ.',
    fields: [
      { name: 'support.hotline', label: 'Hotline', type: 'text' },
      {
        name: 'support.workingHours',
        label: 'Giờ làm việc',
        type: 'text',
        hint: 'Ví dụ: 8:30–21:00, thứ Hai đến Chủ nhật.',
      },
      { name: 'support.email', label: 'Email hỗ trợ', type: 'email' },
    ],
  },
  {
    title: 'Chính sách đặt lịch',
    description:
      'Giới hạn áp dụng cho khách. Admin vẫn có thể xử lý hủy theo nghiệp vụ.',
    fields: [
      {
        name: 'booking.cancellationHours',
        label: 'Hủy trước giờ học ít nhất (giờ)',
        type: 'number',
        min: 0,
        max: 720,
        hint: '0: cho phép hủy đến trước khi buổi học bắt đầu.',
      },
      {
        name: 'booking.maxActiveSlots',
        label: 'Số slot tối đa mỗi người đặt',
        type: 'number',
        min: 1,
        max: 100,
        hint: 'Số buổi sắp tới đang giữ chỗ hoặc đã xác nhận của mỗi tài khoản. Không tính buổi đã hủy, hoàn tất hay lượt giữ chỗ hết hạn.',
      },
    ],
  },
];
function SettingsEditor({ initial }: { initial: Snapshot }) {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState('');
  const form = useForm<SiteSettings>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: initial.settings,
    mode: 'onChange',
  });
  const [minPhotos, maxPhotos] = useWatch({
    control: form.control,
    name: ['studio.minPhotos', 'studio.maxPhotos'],
  });
  useEffect(() => {
    void form.trigger('studio.maxPhotos');
  }, [form, minPhotos, maxPhotos]);
  const mutation = useMutation({
    mutationFn: async (settings: SiteSettings) =>
      response.parse(
        await apiFetch('/admin/cai-dat', {
          method: 'PUT',
          body: JSON.stringify({ settings, expectedVersion: snapshot.version }),
        }),
      ),
    onSuccess: async (result) => {
      setSnapshot(result);
      form.reset(result.settings);
      setError('');
      client.setQueryData(queryKeys.settings.config(userId), result);
      client.setQueryData(['site-settings'], result.settings);
      await Promise.all([
        invalidateResources(client, userId, [
          'settings',
          'studios',
          'workshops',
        ]),
        invalidatePublicCatalog(client),
      ]);
      toast.success('Đã lưu cài đặt.');
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'Chưa lưu được cài đặt.'),
  });
  const reload = useMutation({
    mutationFn: async () => response.parse(await apiFetch('/admin/cai-dat')),
    onSuccess: (data) => {
      setSnapshot(data);
      form.reset(data.settings);
      setError('');
      client.setQueryData(queryKeys.settings.config(userId), data);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'Chưa tải lại được cài đặt.'),
  });
  const busy = mutation.isPending || reload.isPending;
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((value) => {
          setError('');
          mutation.mutate(value);
        })}
        className="space-y-5"
        noValidate
      >
        <fieldset disabled={busy} className="space-y-5">
          {groups.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                {group.fields.map((input) => (
                  <FormField
                    key={input.name}
                    control={form.control}
                    name={input.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{input.label}</FormLabel>
                        <FormControl>
                          <input
                            {...field}
                            type={input.type}
                            min={input.min}
                            max={input.max}
                            step={input.type === 'number' ? 1 : undefined}
                            value={
                              typeof field.value === 'number' &&
                              Number.isNaN(field.value)
                                ? ''
                                : field.value
                            }
                            onChange={(e) =>
                              field.onChange(
                                input.type === 'number'
                                  ? e.target.valueAsNumber
                                  : e.target.value,
                              )
                            }
                            className="min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm"
                          />
                        </FormControl>
                        {input.hint && (
                          <FormDescription>{input.hint}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </fieldset>
        {error && (
          <div role="alert" className="space-y-3 text-sm text-brick">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => reload.mutate()}
            >
              Bỏ bản sửa và tải lại
            </Button>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">
            Cập nhật: {formatReviewDate(snapshot.updatedAt)} · Mỗi lần lưu được
            ghi nhật ký.
          </p>
          <Button
            type="submit"
            disabled={
              busy || !form.formState.isDirty || !form.formState.isValid
            }
          >
            {mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </footer>
      </form>
    </Form>
  );
}
export function AdminSettingsPage() {
  const userId = useAuth().user?.id;
  const query = useQuery({
    queryKey: queryKeys.settings.config(userId),
    queryFn: async ({ signal }) =>
      response.parse(await apiFetch('/admin/cai-dat', { signal })),
    refetchOnWindowFocus: false,
  });
  return (
    <div className="space-y-5">
      <Toaster richColors />
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">Cài đặt</h1>
        <p className="text-sm text-muted">
          Quản lý yêu cầu hồ sơ studio, thông tin hỗ trợ và chính sách đặt lịch.
        </p>
      </header>
      {query.isPending ? (
        <div aria-label="Đang tải cài đặt" className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <div role="alert" className="space-y-3 text-sm text-brick">
          <p>Chưa tải được cài đặt.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <SettingsEditor initial={query.data} />
      )}
    </div>
  );
}
