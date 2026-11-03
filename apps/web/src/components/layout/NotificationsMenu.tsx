import { useDeferredStartup } from '../../hooks/useDeferredStartup';
import { queryKeys } from '../../lib/query-keys';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { apiFetch } from '../../lib/api-client';
import { formatReviewDate } from '../../lib/studio-review';
import { Button } from '../ui/button';
const schema = z.object({
  notifications: z.array(
    z.object({
      id: z.string(),
      studioId: z.string(),
      workshopId: z.string().nullable(),
      bookingId: z.string().nullable().optional(),
      title: z.string(),
      body: z.string().nullable().optional(),
      reason: z.string().nullable(),
      createdAt: z.string(),
      readAt: z.string().nullable(),
    }),
  ),
});
export function NotificationsMenu({ userId }: { userId: string }) {
  const client = useQueryClient();
  const foregroundReady = useDeferredStartup(!!userId);
  const notifications = useQuery({
    queryKey: queryKeys.notifications.lists(userId),
    queryFn: async ({ signal }) =>
      schema.parse(await apiFetch('/me/notifications', { signal }))
        .notifications,
    enabled: foregroundReady,
    refetchInterval: foregroundReady ? 60000 : false,
    refetchIntervalInBackground: false,
  });
  const unread = notifications.data?.filter((n) => !n.readAt).length ?? 0;
  const read = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: queryKeys.notifications.lists(userId),
      }),
  });
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          className="relative size-11 p-0"
          aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-brick px-1 text-[10px] text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-60 w-[26rem] max-w-[calc(100vw-2rem)] rounded-sm border border-line bg-surface p-4 shadow-sm"
        >
          <h2 className="font-heading text-lg font-semibold">Thông báo</h2>
          <div className="mt-3 max-h-[65dvh] overflow-y-auto">
            {notifications.isPending ? (
              <p className="py-4 text-sm text-muted">Đang tải thông báo…</p>
            ) : notifications.error ? (
              <div role="alert" className="space-y-2 text-sm text-brick">
                <p>Chưa tải được thông báo.</p>
                <Button
                  variant="outline"
                  onClick={() => void notifications.refetch()}
                >
                  Thử lại
                </Button>
              </div>
            ) : notifications.data?.length ? (
              <ul className="divide-y divide-line">
                {notifications.data.map((n) => (
                  <li
                    key={n.id}
                    className={`space-y-2 py-3 text-sm ${!n.readAt ? 'font-medium' : ''}`}
                  >
                    <Link
                      className="block hover:underline"
                      to={
                        n.bookingId
                          ? `/workshops/${n.workshopId}`
                          : `/studio/${n.studioId}/${n.workshopId ? 'workshops' : 'profile'}`
                      }
                    >
                      {n.title}
                    </Link>
                    {(n.body ?? n.reason) && (
                      <p className="whitespace-pre-wrap break-words text-xs font-normal leading-5 text-muted">
                        {n.body ?? n.reason}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <time
                        className="text-xs font-normal text-muted"
                        dateTime={n.createdAt}
                      >
                        {formatReviewDate(n.createdAt)}
                      </time>
                      {!n.readAt && (
                        <Button
                          variant="ghost"
                          className="min-h-9 px-2 text-xs"
                          disabled={read.isPending}
                          onClick={() => read.mutate(n.id)}
                        >
                          Đánh dấu đã đọc
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-muted">Chưa có thông báo.</p>
            )}
            {read.error && (
              <p role="alert" className="text-xs text-brick">
                Chưa đánh dấu được thông báo. Vui lòng thử lại.
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
