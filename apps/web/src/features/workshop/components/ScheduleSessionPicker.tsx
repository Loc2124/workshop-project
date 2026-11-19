import { CalendarDays } from 'lucide-react';
import type { WorkshopSession } from '@/types';
import { formatPrice } from '@/lib/core/format';
import { sessionStatus, sessionStatusLabel } from '@/lib/domain/sessionStatus';
import { workshopSessionRange } from './workshopPresentation';
import { ScheduleNotification } from './ScheduleNotification';
import { cn } from '@/lib/core/utils';

interface ScheduleSessionPickerProps {
  workshopId: string;
  sessions: WorkshopSession[];
  selected?: WorkshopSession;
  confirmed?: { session: WorkshopSession; quantity: number };
  showOtherSessions: boolean;
  locked: boolean;
  now: number;
  initial?: WorkshopSession;
  onSelectSession: (id: string) => void;
  onShowOtherSessions: () => void;
}

export function ScheduleSessionPicker({
  workshopId,
  sessions,
  selected,
  confirmed,
  showOtherSessions,
  locked,
  now,
  initial,
  onSelectSession,
  onShowOtherSessions,
}: ScheduleSessionPickerProps) {
  const dateDetails = (session: WorkshopSession) => (
    <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
      <time
        dateTime={session.startsAt}
        className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums"
      >
        <CalendarDays
          size={16}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        {workshopSessionRange(session)}
      </time>
      <span
        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
          confirmed
            ? 'bg-[#DCEFC8] text-[#2A4710]'
            : sessionStatus(session, now) === 'available' &&
                session.availableSeats <= 3
              ? 'bg-secondary text-white'
              : sessionStatus(session, now) === 'available'
                ? 'bg-[#DCEFC8] text-[#2A4710]'
                : 'bg-[#E8E4D8] text-[#4A453C]'
        }`}
      >
        {confirmed
          ? 'Đã đặt ' + confirmed.quantity + ' chỗ'
          : sessionStatus(session, now) === 'available'
            ? 'Còn ' + session.availableSeats + ' chỗ'
            : sessionStatusLabel[sessionStatus(session, now)]}
      </span>
    </span>
  );

  return (
    <>
      {confirmed ||
      sessions.length === 1 ||
      (sessions.length > 1 && !showOtherSessions) ? (
        <div className="rounded-xl bg-soft p-4">
          {dateDetails(confirmed?.session ?? selected ?? sessions[0])}
        </div>
      ) : sessions.length > 1 ? (
        <fieldset disabled={locked} className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Chọn buổi</legend>
          {sessions.map((session) => (
            <label
              key={session.id}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 focus-within:ring-2 focus-within:ring-primary',
                session.id === selected?.id && 'border-primary bg-soft',
                sessionStatus(session, now) === 'available' && !locked
                  ? 'cursor-pointer'
                  : 'cursor-default',
              )}
            >
              <input
                type="radio"
                name="workshop-session"
                value={session.id}
                checked={selected?.id === session.id}
                disabled={sessionStatus(session, now) !== 'available' || locked}
                onChange={() => onSelectSession(session.id)}
                className="size-4 shrink-0 accent-primary"
              />
              {dateDetails(session)}
              {selected?.price !== session.price && (
                <span className="pl-7 text-sm tabular-nums text-stone-700">
                  {formatPrice(session.price)} đ / người
                </span>
              )}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-sm font-semibold text-stone-700">
          {sessions.length === 0
            ? 'Hiện chưa có lịch.'
            : 'Các buổi trước đã kết thúc. Studio chưa công bố lịch tiếp theo.'}
        </p>
      )}

      {sessions.length > 1 && !showOtherSessions && (
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-primary underline"
          onClick={onShowOtherSessions}
        >
          Xem các buổi khác
        </button>
      )}

      {!initial && sessions.length === 0 && !confirmed && (
        <ScheduleNotification workshopId={workshopId} primary />
      )}
    </>
  );
}
