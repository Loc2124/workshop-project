import { describe, expect, it } from 'vitest';
import {
  formatCalendarDate,
  getBusinessToday,
  parseCalendarDate,
} from './calendar-date';

describe('calendar date helpers', () => {
  it('rejects malformed and impossible calendar dates', () => {
    expect(parseCalendarDate('2025-02-29')).toBeUndefined();
    expect(parseCalendarDate('2024-13-01')).toBeUndefined();
    expect(parseCalendarDate('not-a-date')).toBeUndefined();
  });

  it('parses valid leap days and formats selected calendar dates', () => {
    const date = parseCalendarDate('2024-02-29');
    expect(date).toBeInstanceOf(Date);
    expect(formatCalendarDate(date!)).toBe('2024-02-29');
  });

  it('calculates today in the business timezone', () => {
    const now = new Date('2025-01-01T18:00:00.000Z');
    expect(formatCalendarDate(getBusinessToday(now))).toBe('2025-01-02');
  });
});
