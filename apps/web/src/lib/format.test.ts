import { describe, expect, it } from 'vitest';
import { formatDate, formatSessionDate, formatSlot } from './format';

describe('date formatters', () => {
  it('returns a safe placeholder for invalid date values', () => {
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatSessionDate('not-a-date')).toBe('—');
    expect(formatSessionDate('not-a-date', { parts: true })).toEqual({
      day: '—',
      month: '—',
      weekday: '—',
      date: '—',
      time: '—',
    });
    expect(formatSlot(new Date(Number.NaN))).toBe('—');
  });
});
