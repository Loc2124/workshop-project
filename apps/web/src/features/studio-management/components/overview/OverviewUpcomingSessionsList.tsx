import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatSessionDate } from '@/lib/format';
import { studioPage } from '@/lib/studio-dashboard';
import type { StudioSession } from '@/types/management';
import { StudioBadge, StudioCard } from '../StudioPrimitives';

export interface OverviewUpcomingSessionsListProps {
  studioId: string;
  sessions: StudioSession[];
  totalUpcomingCount: number;
}

export function OverviewUpcomingSessionsList({
  studioId,
  sessions,
  totalUpcomingCount,
}: OverviewUpcomingSessionsListProps) {
  if (sessions.length === 0) return null;

  return (
    <StudioCard aria-labelledby="other-sessions-title" className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-studio-border pb-3">
        <h2
          id="other-sessions-title"
          className="font-heading text-base font-semibold text-studio-ink"
        >
          Lịch các buổi tiếp theo
        </h2>
        <Link
          to={studioPage(studioId, 'sessions')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-studio-primary hover:underline"
        >
          Xem tất cả ({totalUpcomingCount})
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <ul className="divide-y divide-studio-border text-sm">
        {sessions.map((item) => {
          const itemBooked = item.seatsSold + item.seatsHeld;
          const itemRemaining = Math.max(0, item.capacity - itemBooked);
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-2.5 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-studio-ink">
                  {item.workshopTitle}
                </p>
                <p className="mt-0.5 text-xs text-studio-muted">
                  {formatSessionDate(item.startsAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-xs tabular-nums text-studio-muted">
                  {itemBooked}/{item.capacity} chỗ
                </span>
                <StudioBadge
                  tone={
                    itemRemaining === 0
                      ? 'danger'
                      : itemRemaining <= 3
                        ? 'warning'
                        : 'neutral'
                  }
                  className="text-xs py-0.5 px-2"
                >
                  {itemRemaining === 0 ? 'Hết chỗ' : `Còn ${itemRemaining}`}
                </StudioBadge>
              </div>
            </li>
          );
        })}
      </ul>
    </StudioCard>
  );
}
