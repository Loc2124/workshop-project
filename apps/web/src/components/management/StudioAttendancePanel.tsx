import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { StudioCard } from './StudioPrimitives';
import { TicketAttendanceEditor } from './TicketAttendanceEditor';
type Row = {
  id: string;
  workshopTitle: string;
  contactName: string;
  endsAt?: string;
  startsAt?: string;
  reschedulePending?: boolean;
  attendanceStatus?: string;
  reservationStatus: string;
};
export function StudioAttendancePanel({
  studioId,
  bookings,
  onUpdated,
}: {
  studioId: string;
  bookings: Row[];
  onUpdated: () => Promise<unknown>;
}) {
  const key = ['studio-attendance', studioId];
  const [openId, setOpenId] = useState<string | null>(null),
    [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const stats = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<{ stats: { attended: number; absent: number } }>(
        `/studios/${studioId}/attendance`,
      ),
  });
  const total =
      (stats.data?.stats.attended ?? 0) + (stats.data?.stats.absent ?? 0),
    rate = total ? Math.round((stats.data!.stats.absent / total) * 100) : null;
  const ended = bookings.filter(
    (b) =>
      b.startsAt &&
      Date.parse(b.startsAt) <= now &&
      !b.reschedulePending &&
      ['confirmed', 'completed'].includes(b.reservationStatus),
  );
  return (
    <StudioCard className="space-y-3">
      <h2 className="font-heading text-xl font-semibold">Tham dự buổi học</h2>
      <p className="text-sm">
        {rate === null
          ? 'Chưa có dữ liệu tham dự.'
          : `Tỷ lệ vắng mặt: ${rate}% · ${stats.data?.stats.absent} khách vắng / ${total} khách đã được ghi nhận.`}{' '}
        Chỉ tính các buổi studio đã đánh dấu.
      </p>
      <details
        onToggle={(event) => {
          if (!event.currentTarget.open) setOpenId(null);
        }}
      >
        <summary className="min-h-11 cursor-pointer font-semibold">
          Điểm danh từng vé ({ended.length} đặt chỗ)
        </summary>
        <ul className="space-y-3">
          {ended.map((b) => (
            <li key={b.id} className="rounded-lg bg-soft p-3 text-sm">
              <span>
                {b.workshopTitle} · {b.contactName}
                <span className="block">
                  {b.attendanceStatus === 'attended'
                    ? 'Đã đến'
                    : b.attendanceStatus === 'absent'
                      ? 'Vắng mặt'
                      : 'Chưa ghi nhận'}
                </span>
              </span>
              <button
                type="button"
                className="mt-2 min-h-11 font-semibold text-primary underline"
                aria-expanded={openId === b.id}
                onClick={() =>
                  setOpenId((current) => (current === b.id ? null : b.id))
                }
              >
                {openId === b.id ? 'Thu gọn' : 'Xem từng vé'}
              </button>
              {openId === b.id && (
                <TicketAttendanceEditor
                  bookingId={b.id}
                  studioId={studioId}
                  onUpdated={async () => {
                    await Promise.all([onUpdated(), stats.refetch()]);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </details>
    </StudioCard>
  );
}
