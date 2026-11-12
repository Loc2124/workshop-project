import type { QueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import {
  invalidateResources,
  invalidatePublicCatalog,
} from '../../lib/query-invalidation';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, type FieldPathByValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { siteSettingsSchema, type SiteSettings } from '@workshop/shared';
import { toast } from 'sonner';
import {
  AlertCircle,
  CalendarCheck,
  Headphones,
  RotateCcw,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '../../lib/api-client';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '../../components/ui/form';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { LoadingState } from '../../components/ui/LoadingState';
import { formatReviewDate } from '../../lib/studio-review';

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
  icon: LucideIcon;
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
    icon: Store,
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
    icon: Headphones,
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
    title: 'Chính sách đặt chỗ',
    description:
      'Giới hạn áp dụng cho khách. Admin vẫn có thể xử lý hủy theo nghiệp vụ.',
    icon: CalendarCheck,
    fields: [
      {
        name: 'booking.cancellationHours',
        label: 'Mốc hoàn cọc miễn phí (giờ)',
        type: 'number',
        min: 24,
        max: 24,
        hint: 'Chưa cọc được hủy bất cứ lúc nào. Đã cọc được hoàn khi hủy trước 24 giờ.',
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
      toast.error(e instanceof Error ? e.message : 'Chưa lưu được cài đặt.'),
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
          {groups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <Card key={group.title} className="shadow-sm">
                <CardHeader className="border-b border-line/60 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-soft text-primary">
                      <GroupIcon size={18} />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-ink">
                        {group.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {group.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
                  {group.fields.map((input) => (
                    <FormField
                      key={input.name}
                      control={form.control}
                      name={input.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-ink">
                            {input.label}
                          </FormLabel>
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
                              className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </FormControl>
                          {input.hint && (
                            <FormDescription className="text-xs">
                              {input.hint}
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </fieldset>
        {error && (
          <div
            role="alert"
            className="space-y-3 rounded-md bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200"
          >
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => reload.mutate()}
            >
              <RotateCcw size={14} className="mr-1.5" />
              Bỏ bản sửa và tải lại
            </Button>
          </div>
        )}
        <footer
          className={`flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 transition-all ${
            form.formState.isDirty
              ? 'sticky bottom-0 z-20 -mx-3 rounded-t-lg border-line/80 bg-surface/95 p-4 shadow-lg backdrop-blur-xs md:-mx-5'
              : ''
          }`}
        >
          <div className="flex items-center gap-2">
            {form.formState.isDirty ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <AlertCircle size={15} /> Bạn có thay đổi chưa lưu.
              </span>
            ) : (
              <p className="text-xs text-muted">
                Cập nhật lần cuối: {formatReviewDate(snapshot.updatedAt)} · Mọi
                thay đổi đều được ghi nhật ký hệ thống.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {form.formState.isDirty && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.reset(snapshot.settings)}
                disabled={busy}
              >
                Hủy thay đổi
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                busy || !form.formState.isDirty || !form.formState.isValid
              }
            >
              {mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
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
  if (query.isPending)
    return <LoadingState label="Đang tải cài đặt…" variant="page" />;
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">Cài đặt</h1>
        <p className="text-sm text-muted">
          Quản lý yêu cầu hồ sơ studio, thông tin hỗ trợ và chính sách đặt lịch.
        </p>
      </header>
      {query.isError ? (
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

export const prefetchData = (client: QueryClient, userId: string) =>
  client.prefetchQuery({
    queryKey: queryKeys.settings.config(userId),
    queryFn: async ({ signal }) =>
      response.parse(await apiFetch('/admin/cai-dat', { signal })),
    staleTime: 30_000,
  });
