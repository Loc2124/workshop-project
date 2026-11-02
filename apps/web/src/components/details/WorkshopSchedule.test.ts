import { describe, expect, it } from 'vitest';
import { bookingQuantityLimit, clampBookingQuantity } from './WorkshopSchedule';

describe('workshop booking quantity', () => {
  it('caps selections at ten and never exceeds available seats', () => {
    expect(bookingQuantityLimit(15)).toBe(10);
    expect(clampBookingQuantity(15, 15)).toBe(10);
    expect(clampBookingQuantity(7, 3)).toBe(3);
    expect(clampBookingQuantity(4, 0)).toBe(0);
  });
});
