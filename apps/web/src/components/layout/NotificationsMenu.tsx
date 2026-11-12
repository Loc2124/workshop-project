import { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { z } from 'zod';
import {
  Bell,
  CalendarCheck2,
  CircleCheck,
  Clock3,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDeferredStartup } from '@/hooks/useDeferredStartup';
import { Button } from '../ui/button';

const schema = z.object({
  notifications: z.array(
    z.object({
      id: z.string(),
      studioId: z.string().nullable(),
      workshopId: z.string().nullable(),
      bookingId: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      title: z.string(),
      body: z.string().nullable().optional(),
      reason: z.string().nullable(),
      orderCode: z.string().nullable().optional(),
      workshopTitle: z.string().nullable().optional(),
      studioName: z.string().nullable().optional(),
      startsAt: z.string().nullable().optional(),
      holdExpiresAt: z.string().nullable().optional(),
      createdAt: z.string(),
      readAt: z.string().nullable(),
    }),
  ),
});
type Notification = z.infer<typeof schema>['notifications'][number];

function notificationCopy(item: Notification) {
  const code = item.orderCode ? ` #${item.orderCode}` : '';
  const title =
    item.type === 'studio_payout_succeeded'
      ? item.title || 'Đã chuyển tiền quyết toán'
      : item.type === 'studio_payout_pending'
        ? item.title || 'Khoản tiền quyết toán sẵn sàng'
        : item.type === 'booking_created'
          ? item.title.toLowerCase().includes('thanh toán')
            ? `Đặt chỗ${code} chờ thanh toán cọc`
            : `Đặt chỗ${code} đã nhận`
          : item.type === 'deposit_paid'
            ? `Đã xác nhận tiền cọc cho đặt chỗ${code}`
            : item.type?.includes('cancel') ||
                item.type?.includes('expired') ||
                item.title.toLowerCase().includes('hủy')
              ? `Đặt chỗ${code} đã bị hủy`
              : item.type === 'booking_success'
                ? `Đặt chỗ${code} thành công`
                : item.title;
  const date = item.startsAt
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(item.startsAt))
    : '';
  const defaultBody = [item.workshopTitle, item.studioName, date]
    .filter(Boolean)
    .join(' · ');
  const body = item.type?.startsWith('studio_payout')
    ? item.body || defaultBody
    : defaultBody;
  const cancelled =
    item.type?.includes('cancel') ||
    item.type?.includes('expired') ||
    item.title.toLowerCase().includes('hủy') ||
    item.reason?.toLowerCase().includes('hết thời gian');
  const Icon = cancelled
    ? XCircle
    : item.type === 'deposit_paid' ||
        item.type === 'booking_success' ||
        item.type === 'studio_payout_succeeded'
      ? CircleCheck
      : item.type === 'booking_created' &&
          item.title.toLowerCase().includes('thanh toán')
        ? Clock3
        : item.type === 'booking_created' ||
            item.type === 'studio_payout_pending'
          ? CalendarCheck2
          : Clock3;
  const iconColor = cancelled
    ? 'text-red-700 bg-red-100'
    : item.type === 'deposit_paid' ||
        item.type === 'booking_success' ||
        item.type === 'studio_payout_succeeded'
      ? 'text-primary bg-[#dce3c7]'
      : item.type === 'booking_created' &&
          item.title.toLowerCase().includes('thanh toán')
        ? 'text-amber-800 bg-amber-100'
        : 'text-muted bg-surface';
  return { title: code ? title : item.title, body, Icon, iconColor };
}

function relativeTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : formatDistanceToNow(date, { addSuffix: true, locale: vi });
}

export function NotificationsMenu({ userId }: { userId: string }) {
  const location = useLocation();
  const client = useQueryClient();
  const foregroundReady = useDeferredStartup(!!userId);
  const queryKey = queryKeys.notifications.lists(userId);
  const notifications = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      schema.parse(await apiFetch('/me/notifications', { signal }))
        .notifications,
    enabled: foregroundReady,
    refetchInterval: foregroundReady ? 300000 : false,
    refetchIntervalInBackground: false,
  });
  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.readAt).length;
  const markAllRead = useMutation({
    mutationFn: () =>
      apiFetch('/me/notifications/read-all', { method: 'PATCH' }),
    onMutate: async () => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Notification[]>(queryKey);
      client.setQueryData<Notification[]>(queryKey, (current) =>
        current?.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      return { previous };
    },
    onError: (_error, _variables, context) =>
      client.setQueryData(queryKey, context?.previous),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/notifications/${id}/read`, { method: 'PATCH' }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Notification[]>(queryKey);
      client.setQueryData<Notification[]>(queryKey, (current) =>
        current?.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _id, context) =>
      client.setQueryData(queryKey, context?.previous),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  useEffect(() => {
    void client.invalidateQueries({ queryKey });
  }, [location.pathname, client, userId]);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          className="relative size-11 p-0 hover:bg-soft"
          aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-brick px-1 text-[10px] text-white">
              {unread > 99 ? '99+' : unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Thông báo"
          className="z-60 flex max-h-[min(65dvh,560px)] w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-overlay data-[state=open]:animate-in data-[state=closed]:animate-out"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-heading text-xl font-semibold">Thông báo</h2>
            {unread > 0 && (
              <button
                type="button"
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50"
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {notifications.isPending ? (
              <div
                role="status"
                aria-label="Đang tải thông báo"
                className="space-y-2 p-2"
              >
                {[0, 1, 2].map((key) => (
                  <div key={key} className="flex gap-3 rounded-lg p-3">
                    <span className="size-9 animate-pulse rounded-full bg-soft" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-4 w-4/5 animate-pulse rounded bg-soft" />
                      <span className="block h-3 w-2/3 animate-pulse rounded bg-soft" />
                    </span>
                  </div>
                ))}
              </div>
            ) : notifications.error ? (
              <div role="alert" className="p-5 text-center">
                <p className="text-sm text-muted">Chưa tải được thông báo.</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => void notifications.refetch()}
                >
                  Thử lại
                </Button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Bạn chưa có thông báo nào
              </p>
            ) : (
              <ul className="space-y-1">
                {items.map((item) => {
                  const copy = notificationCopy(item);
                  const target =
                    (item.type?.startsWith('studio_payout') ||
                      item.type === 'studio_payout_account_reviewed') &&
                    item.studioId
                      ? `/studio/${item.studioId}/finances`
                      : item.bookingId
                        ? `/me/bookings/${item.bookingId}`
                        : item.studioId
                          ? `/studio/${item.studioId}/${item.workshopId ? 'workshops' : 'profile'}`
                          : '/me/bookings';
                  return (
                    <li key={item.id}>
                      <Link
                        to={target}
                        onClick={() => {
                          if (!item.readAt) markRead.mutate(item.id);
                        }}
                        className={`flex items-start gap-3 rounded-lg p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${item.readAt ? 'text-ink hover:bg-surface' : 'bg-[#edf0e3] text-ink hover:bg-[#e5e9d6]'}`}
                      >
                        <span
                          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${copy.iconColor}`}
                        >
                          <copy.Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block line-clamp-2 text-sm leading-5 ${item.readAt ? 'font-medium text-muted' : 'font-semibold'}`}
                          >
                            {copy.title}
                          </span>
                          {copy.body && (
                            <span className="mt-1 block line-clamp-2 text-xs leading-4 text-muted">
                              {copy.body}
                            </span>
                          )}
                          <time
                            className="mt-1.5 block text-xs text-muted"
                            dateTime={item.createdAt}
                            title={new Intl.DateTimeFormat('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Ho_Chi_Minh',
                            }).format(new Date(item.createdAt))}
                          >
                            {relativeTime(item.createdAt)}
                          </time>
                        </span>
                        {!item.readAt && (
                          <span
                            className="mt-3 size-2 shrink-0 rounded-full bg-primary"
                            aria-label="Chưa đọc"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <footer className="shrink-0 border-t border-line px-4 py-3 text-center">
            <Link
              to="/me/notifications"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Xem tất cả thông báo
            </Link>
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
