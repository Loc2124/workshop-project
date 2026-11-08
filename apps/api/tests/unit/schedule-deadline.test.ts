import { expect, it } from 'vitest';
import { scheduleResponseDeadline } from '../../src/modules/bookings/schedule-changes.js';

const notified = Date.parse('2026-11-07T10:00:00+07:00');
it.each([0, 11.999, 12])('rejects a changed start %s hours away', (hours) => {
  expect(
    scheduleResponseDeadline(new Date(notified + hours * 3600000), notified),
  ).toBeNull();
});
it('allows a start strictly beyond twelve hours, with no minimum response window invented', () => {
  expect(
    scheduleResponseDeadline(
      new Date(notified + 12 * 3600000 + 1),
      notified,
    )?.getTime(),
  ).toBe(notified + 1);
});
it.each([
  [24, 12],
  [59, 47],
  [60, 48],
  [100, 48],
])(
  'chooses the earlier deadline for a start %s hours away',
  (hours, expected) => {
    expect(
      scheduleResponseDeadline(
        new Date(notified + hours * 3600000),
        notified,
      )?.getTime(),
    ).toBe(notified + expected * 3600000);
  },
);
it('uses absolute time for a session that crosses midnight in Vietnam', () => {
  const at = Date.parse('2026-11-07T23:00:00+07:00');
  expect(
    scheduleResponseDeadline('2026-11-08T23:30:00+07:00', at)?.toISOString(),
  ).toBe('2026-11-08T04:30:00.000Z');
});
