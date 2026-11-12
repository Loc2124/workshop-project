import { StatusBadge } from '../ui/status-badge';
import { formatReviewDate } from '@/lib/studio-review';
import { studioStates } from '@/lib/studio-dashboard';
type Entry = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorName: string;
  reason: string | null;
  createdAt: string;
};
export function StudioStatusTimeline({ entries }: { entries: Entry[] }) {
  return (
    <section aria-labelledby="studio-status-history-title">
      <h3
        id="studio-status-history-title"
        className="font-heading text-lg font-semibold"
      >
        Lịch sử trạng thái
      </h3>
      {entries.length ? (
        <ol className="ml-1 mt-4 space-y-5 border-l border-line">
          {entries.map((entry) => (
            <li key={entry.id} className="relative space-y-2 pl-5">
              <span
                aria-hidden="true"
                className="absolute -left-[4px] top-2 size-2 rounded-full bg-muted"
              />
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={entry.toStatus} />
                {entry.fromStatus && (
                  <span className="text-xs text-muted">
                    Từ{' '}
                    {studioStates[entry.fromStatus as keyof typeof studioStates]
                      ?.label ?? entry.fromStatus}
                  </span>
                )}
              </div>
              <p className="text-sm">
                <span className="font-medium">{entry.actorName}</span>
                <time
                  dateTime={entry.createdAt}
                  className="mt-1 block text-xs text-muted"
                >
                  {formatReviewDate(entry.createdAt)}
                </time>
              </p>
              {entry.reason ? (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {entry.reason}
                </p>
              ) : (
                ['needs_changes', 'rejected', 'suspended'].includes(
                  entry.toStatus,
                ) && (
                  <p className="text-xs text-muted">
                    Chưa có lý do được ghi nhận trong lịch sử cũ.
                  </p>
                )
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Chưa có lịch sử trạng thái được ghi nhận.
        </p>
      )}
    </section>
  );
}
