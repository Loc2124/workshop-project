import { useDeferredStartup } from '../../hooks/useDeferredStartup';
import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api-client';
import { formatReviewDate } from '../../lib/studio-review';
import { Button } from '../ui/button';
import { toast } from 'sonner';
const schema = z.object({
  notifications: z.array(
    z.object({
      id: z.string(),
      studioId: z.string(),
      workshopId: z.string().nullable(),
      title: z.string(),
      reason: z.string().nullable(),
      body: z.string().nullable().optional(),
      bookingId: z.string().nullable().optional(),
      createdAt: z.string(),
      readAt: z.string().nullable(),
    }),
  ),
});
export function StudioNotifications({ studioId }: { studioId: string }) {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const foregroundReady = useDeferredStartup(!!userId);
  const notifications = useQuery({
    queryKey: queryKeys.notifications.lists(userId),
    queryFn: async ({ signal }) =>
      schema.parse(await apiFetch('/me/notifications', { signal }))
        .notifications,
    enabled: foregroundReady,
    refetchInterval: foregroundReady ? 300000 : false,
    refetchIntervalInBackground: false,
  });
  const mark = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: queryKeys.notifications.lists(userId),
      });
      toast.success('Đã đánh dấu thông báo đã đọc.');
    },
    onError: (error) => toast.error(error.message),
  });
  const unread =
    notifications.data?.filter((n) => n.studioId === studioId && !n.readAt) ??
    [];
  if (notifications.error)
    return (
      <p role="alert" className="text-sm text-brick">
        Chưa tải được thông báo.{' '}
        <Button variant="outline" onClick={() => void notifications.refetch()}>
          Thử lại
        </Button>
      </p>
    );
  if (!unread.length) return null;
  return (
    <section className="rounded-sm border border-amber-200 bg-amber-50 p-4">
      <h2 className="font-heading text-lg font-semibold">Thông báo workshop</h2>
      <ul className="mt-3 divide-y divide-amber-200">
        {unread.map((n) => (
          <li key={n.id} className="space-y-2 py-3 text-sm">
            <Link
              to={
                n.bookingId
                  ? `/workshops/${n.workshopId}`
                  : `/studio/${studioId}/${n.workshopId ? 'workshops' : 'profile'}`
              }
              className="font-medium underline"
            >
              {n.title}
            </Link>
            {(n.body ?? n.reason) && (
              <p className="whitespace-pre-wrap break-words">
                {n.body ?? n.reason}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <time className="text-xs text-muted" dateTime={n.createdAt}>
                {formatReviewDate(n.createdAt)}
              </time>
              <Button
                variant="outline"
                disabled={mark.isPending}
                onClick={() => mark.mutate(n.id)}
              >
                Đã đọc
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
