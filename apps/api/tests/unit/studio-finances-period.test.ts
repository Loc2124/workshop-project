import { describe, expect, it } from 'vitest';
import {
  financesPeriodRange,
  financesPeriodSchema,
} from '../../src/modules/studios/studio-finances.routes.js';

describe('studio finances period helpers', () => {
  it('defaults to all and rejects unknown period values', () => {
    expect(financesPeriodSchema.parse(undefined)).toBe('all');
    expect(financesPeriodSchema.parse('this_month')).toBe('this_month');
    expect(financesPeriodSchema.parse('last_month')).toBe('last_month');
    expect(() => financesPeriodSchema.parse('next_year')).toThrow();
  });

  it('returns null for all period', () => {
    expect(financesPeriodRange('all')).toBeNull();
  });

  it('computes half-open UTC+7 month boundaries across year rollover', () => {
    // 2026-01-01 00:30:00+07:00 is still 2025-12-31 17:30:00Z
    const janMorningVn = new Date('2025-12-31T17:30:00Z');
    expect(financesPeriodRange('this_month', janMorningVn)).toEqual({
      start: '2026-01-01T00:00:00+07:00',
      end: '2026-02-01T00:00:00+07:00',
    });
    expect(financesPeriodRange('last_month', janMorningVn)).toEqual({
      start: '2025-12-01T00:00:00+07:00',
      end: '2026-01-01T00:00:00+07:00',
    });
  });

  it('computes December -> January boundary for this_month', () => {
    const dec = new Date('2026-12-15T10:00:00+07:00');
    expect(financesPeriodRange('this_month', dec)).toEqual({
      start: '2026-12-01T00:00:00+07:00',
      end: '2027-01-01T00:00:00+07:00',
    });
  });
});
