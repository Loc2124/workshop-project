import type { WorkshopSession } from '../../types/workshop';

export type SessionStatus =
  'available' | 'full' | 'closed' | 'ongoing' | 'ended' | 'cancelled';

export function sessionStatus(
  session: WorkshopSession,
  now = Date.now(),
): SessionStatus {
  if (session.status === 'cancelled') return 'cancelled';
  const start = Date.parse(session.startsAt);
  const end = Date.parse(session.endsAt);
  if (now >= end) return 'ended';
  if (now >= start) return 'ongoing';
  if (now >= Date.parse(session.registrationDeadline ?? session.startsAt))
    return 'closed';
  return session.availableSeats > 0 ? 'available' : 'full';
}

export const sessionStatusLabel: Record<SessionStatus, string> = {
  available: 'Còn chỗ',
  full: 'Hết chỗ',
  closed: 'Đã đóng đăng ký',
  ongoing: 'Đang diễn ra',
  ended: 'Đã kết thúc',
  cancelled: 'Đã hủy',
};

export function displaySession(sessions: WorkshopSession[], now = Date.now()) {
  const sorted = [...sessions].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );
  return (
    sorted.find((item) => sessionStatus(item, now) === 'available') ??
    sorted.find((item) =>
      ['full', 'closed'].includes(sessionStatus(item, now)),
    ) ??
    sorted.find((item) => sessionStatus(item, now) === 'ongoing') ??
    sorted.find(
      (item) =>
        sessionStatus(item, now) === 'cancelled' &&
        Date.parse(item.endsAt) > now,
    )
  );
}

export function nextSessionBoundary(
  sessions: WorkshopSession[],
  now = Date.now(),
) {
  return sessions
    .flatMap((session) => [
      session.startsAt,
      session.endsAt,
      session.registrationDeadline ?? session.startsAt,
    ])
    .map(Date.parse)
    .filter((time) => Number.isFinite(time) && time > now)
    .sort((a, b) => a - b)[0];
}
