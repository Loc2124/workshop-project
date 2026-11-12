import { ArrowRight, Check, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StudioCard } from '../StudioPrimitives';

export type ChecklistItem = {
  label: string;
  detail: string;
  done: boolean;
  to?: string;
  pending: boolean;
};

export interface OverviewChecklistCardProps {
  checklist: ChecklistItem[];
  completed: number;
  progressKnown: boolean;
  hasError: boolean;
  onRetry: () => void;
}

export function OverviewChecklistCard({
  checklist,
  completed,
  progressKnown,
  hasError,
  onRetry,
}: OverviewChecklistCardProps) {
  return (
    <StudioCard aria-labelledby="studio-checklist-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-studio-border pb-3">
        <div>
          <h2
            id="studio-checklist-title"
            className="font-heading text-lg font-semibold text-studio-ink"
          >
            Các bước bắt đầu
          </h2>
          <p className="mt-0.5 text-xs text-studio-muted">
            Hoàn thành 3 bước để sẵn sàng nhận đặt chỗ trực tuyến.
          </p>
        </div>
        <span className="rounded-full bg-studio-subtle px-2.5 py-0.5 text-xs font-semibold tabular-nums text-studio-ink">
          {progressKnown ? `${completed}/${checklist.length}` : '…'}
        </span>
      </div>

      {progressKnown ? (
        <progress
          aria-label="Tiến độ các bước bắt đầu"
          max={checklist.length}
          value={completed}
          className="studio-progress mt-4 h-1.5 w-full overflow-hidden rounded-full"
        />
      ) : !hasError ? (
        <div
          role="status"
          aria-label="Đang tải"
          className="mt-4 h-1.5 rounded-full bg-studio-subtle motion-safe:animate-pulse"
        />
      ) : null}

      <ul className="mt-3 divide-y divide-studio-border">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center gap-3 py-3">
            {item.done ? (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-studio-success-soft text-studio-success">
                <Check size={14} aria-label="Hoàn thành" />
              </span>
            ) : (
              <Circle
                size={18}
                className="shrink-0 text-studio-muted"
                aria-label={item.pending ? 'Đang tải' : 'Chưa hoàn thành'}
              />
            )}
            <div className="min-w-0 flex-1">
              {item.to ? (
                <Link
                  to={item.to}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-studio-ink hover:text-studio-primary hover:underline"
                >
                  {item.label}
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="text-studio-muted"
                  />
                </Link>
              ) : (
                <p className="text-sm font-semibold text-studio-ink">
                  {item.label}
                </p>
              )}
              <p className="mt-0.5 text-xs text-studio-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {hasError && (
        <p role="alert" className="mt-3 text-xs text-studio-danger">
          Chưa tải được tiến độ.{' '}
          <button
            className="underline font-semibold"
            onClick={onRetry}
          >
            Thử lại
          </button>
        </p>
      )}
    </StudioCard>
  );
}
