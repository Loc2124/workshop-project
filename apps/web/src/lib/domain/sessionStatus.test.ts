import { describe, expect, it } from 'vitest';
import { displaySession, sessionStatus } from './sessionStatus';
import type { WorkshopSession } from '@/types/workshop';

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;
function session(
  day: string,
  start: string,
  end: string,
  availableSeats = 2,
): WorkshopSession {
  return {
    id: `${day}-${start}`,
    startsAt: at(day, start),
    endsAt: at(day, end),
    price: 100000,
    availableSeats,
  };
}

describe('workshop session status in Vietnam time', () => {
  const today = session('2026-11-07', '14:00', '16:00');
  it('changes exactly at start and end, including yesterday', () => {
    expect(sessionStatus(today, Date.parse(at('2026-11-07', '13:59')))).toBe(
      'available',
    );
    expect(sessionStatus(today, Date.parse(at('2026-11-07', '14:00')))).toBe(
      'ongoing',
    );
    expect(sessionStatus(today, Date.parse(at('2026-11-07', '16:00')))).toBe(
      'ended',
    );
    expect(sessionStatus(today, Date.parse(at('2026-11-08', '10:00')))).toBe(
      'ended',
    );
  });
  it('handles full, closed, cancelled, and midnight crossing sessions', () => {
    const now = Date.parse(at('2026-11-07', '13:00'));
    expect(sessionStatus({ ...today, availableSeats: 0 }, now)).toBe('full');
    expect(
      sessionStatus(
        { ...today, registrationDeadline: at('2026-11-07', '12:00') },
        now,
      ),
    ).toBe('closed');
    expect(
      sessionStatus(
        { ...today, status: 'cancelled' },
        Date.parse(at('2026-11-08', '10:00')),
      ),
    ).toBe('cancelled');
    const overnight = {
      ...today,
      startsAt: at('2026-11-07', '23:00'),
      endsAt: at('2026-11-08', '01:00'),
    };
    expect(
      sessionStatus(overnight, Date.parse(at('2026-11-08', '00:30'))),
    ).toBe('ongoing');
    expect(
      sessionStatus(overnight, Date.parse(at('2026-11-08', '01:00'))),
    ).toBe('ended');
  });
  it('chooses the next bookable session and has no date when all ended', () => {
    const tomorrow = session('2026-11-08', '14:00', '16:00');
    expect(
      displaySession([today, tomorrow], Date.parse(at('2026-11-08', '10:00')))
        ?.id,
    ).toBe(tomorrow.id);
    expect(
      displaySession([today], Date.parse(at('2026-11-08', '10:00'))),
    ).toBeUndefined();
  });
});
