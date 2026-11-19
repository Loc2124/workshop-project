import { Clock3 } from 'lucide-react';
import { formatPrice, formatSessionDate } from '@/lib/format';
import { StudioBadge } from '../StudioPrimitives';
import { getRelativeDateTag } from './SessionCardItem';
import type { StudioSession } from '@/types/management';

export interface SessionTableViewProps {
  sessions: StudioSession[];
  onEdit: (session: StudioSession) => void;
  onRequestCancel: (session: StudioSession) => void;
}

export function SessionTableView({
  sessions,
  onEdit,
  onRequestCancel,
}: SessionTableViewProps) {
  return (
    <div className="overflow-hidden rounded-studio-card border border-studio-border bg-studio-surface shadow-studio-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[28%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="bg-studio-subtle text-xs font-semibold uppercase tracking-wide text-studio-muted">
            <tr>
              <th className="px-4 py-3.5">Thời gian buổi học</th>
              <th className="px-3 py-3.5">Workshop</th>
              <th className="px-3 py-3.5">Giá vé</th>
              <th className="px-3 py-3.5">Tình trạng chỗ</th>
              <th className="px-4 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-studio-border text-sm">
            {sessions.map((session) => {
              const starts = formatSessionDate(session.startsAt, {
                parts: true,
              });
              const ends = formatSessionDate(session.endsAt, {
                parts: true,
              });
              const booked = session.seatsHeld + session.seatsSold;
              const remaining = Math.max(0, session.capacity - booked);
              const progress =
                session.capacity > 0
                  ? Math.min(100, (booked / session.capacity) * 100)
                  : 0;
              const isCancelled = session.status === 'cancelled';
              const isPast = Date.parse(session.endsAt) < Date.now();
              const isFull = !isCancelled && remaining === 0;

              const relativeTag = getRelativeDateTag(
                session.startsAt,
                session.endsAt,
                session.status,
              );

              return (
                <tr
                  key={session.id}
                  className={`hover:bg-studio-selected/50 transition-colors ${
                    isCancelled ? 'opacity-60 bg-studio-subtle/30' : ''
                  }`}
                >
                  {/* Cột thời gian */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-studio-ink">
                        {starts.date}
                      </span>
                      {relativeTag && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                            relativeTag.tone === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {relativeTag.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-studio-muted flex items-center gap-1">
                      <Clock3 className="size-3.5" />
                      {starts.time} – {ends.time}
                    </p>
                  </td>

                  {/* Cột Workshop */}
                  <td className="px-3 py-4">
                    <p
                      className="font-semibold text-studio-ink truncate"
                      title={session.workshopTitle}
                    >
                      {session.workshopTitle}
                    </p>
                    <div className="mt-1">
                      {isCancelled ? (
                        <StudioBadge tone="danger">Đã hủy</StudioBadge>
                      ) : isPast ? (
                        <StudioBadge tone="neutral">Đã diễn ra</StudioBadge>
                      ) : isFull ? (
                        <StudioBadge tone="warning">Kín chỗ</StudioBadge>
                      ) : (
                        <StudioBadge tone="success">Đang mở</StudioBadge>
                      )}
                    </div>
                  </td>

                  {/* Cột Giá */}
                  <td className="px-3 py-4">
                    <span className="font-medium tabular-nums text-studio-ink">
                      {formatPrice(session.price)}đ
                    </span>
                  </td>

                  {/* Cột Sức chứa */}
                  <td className="px-3 py-4">
                    {!isCancelled ? (
                      <div className="space-y-1">
                        <span className="text-xs text-studio-ink font-medium">
                          Còn {remaining}/{session.capacity} chỗ
                        </span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-studio-subtle">
                          <div
                            className={`h-full rounded-full ${isFull ? 'bg-amber-500' : 'bg-studio-primary'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-studio-muted">—</span>
                    )}
                  </td>

                  {/* Cột Thao tác */}
                  <td className="px-4 py-4 text-right">
                    {session.status === 'scheduled' && !isPast ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(session)}
                          className="rounded px-2.5 py-1 text-xs font-semibold text-studio-primary hover:bg-studio-selected transition-colors"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestCancel(session)}
                          className="rounded px-2.5 py-1 text-xs font-semibold text-studio-danger hover:bg-studio-danger/10 transition-colors"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-studio-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
