import { describe, expect, it } from 'vitest';
import {
  bookingFormSchema,
  bookingContactSchema,
  homeSearchFormSchema,
  requiredPriceFormSchema,
  searchQuerySchema,
  workshopSelectionSchema,
} from './form-validation';

describe('search forms', () => {
  it('trims search queries while allowing an empty search', () => {
    expect(searchQuerySchema.parse('  gom  ')).toBe('gom');
    expect(searchQuerySchema.parse('')).toBe('');
    expect(searchQuerySchema.safeParse('a'.repeat(201)).success).toBe(false);
  });
  it('validates actual calendar dates rather than just their format', () => {
    expect(
      homeSearchFormSchema.safeParse({ query: 'gom', date: '2026-02-30' })
        .success,
    ).toBe(false);
    expect(
      homeSearchFormSchema.safeParse({ query: 'gom', date: '2028-02-29' })
        .success,
    ).toBe(true);
    expect(
      homeSearchFormSchema.safeParse({ query: '', date: '' }).success,
    ).toBe(true);
  });
});
describe('booking form', () => {
  const booking = {
    workshopId: 'workshop',
    sessionId: 'session',
    quantity: 2,
    availableSeats: 3,
  };
  it('returns only the validated booking payload', () => {
    expect(bookingFormSchema.parse(booking)).toEqual({
      workshopId: 'workshop',
      sessionId: 'session',
      quantity: 2,
    });
  });
  it.each([0, -1, 1.5, 11, NaN, Infinity])(
    'rejects invalid quantity %s',
    (quantity) => {
      expect(
        bookingFormSchema.safeParse({ ...booking, quantity }).success,
      ).toBe(false);
    },
  );
  it('rejects bookings beyond current availability or missing session', () => {
    expect(
      bookingFormSchema.safeParse({ ...booking, quantity: 4 }).success,
    ).toBe(false);
    expect(
      bookingFormSchema.safeParse({ ...booking, sessionId: '' }).success,
    ).toBe(false);
  });
  it('requires a valid name and phone number for the reservation', () => {
    expect(
      bookingContactSchema.safeParse({
        contactName: ' Nguyễn An ',
        contactPhone: '+84 90 123 4567',
      }),
    ).toMatchObject({
      success: true,
      data: { contactName: 'Nguyễn An' },
    });
    expect(
      bookingContactSchema.safeParse({
        contactName: '',
        contactPhone: '0901234567',
      }).success,
    ).toBe(false);
    expect(
      bookingContactSchema.safeParse({
        contactName: 'An',
        contactPhone: 'phone',
      }).success,
    ).toBe(false);
  });
});
describe('management form selections', () => {
  it.each(['', '-1', '1.5', 'NaN', 'Infinity', '2147483648'])(
    'rejects invalid raw price %s',
    (value) => {
      expect(requiredPriceFormSchema.safeParse(value).success).toBe(false);
    },
  );
  it('allows zero VND but not an empty price', () => {
    expect(requiredPriceFormSchema.parse('0')).toBe(0);
    expect(requiredPriceFormSchema.parse(' 250000 ')).toBe(250000);
  });
  it('requires a workshop ID when selecting a workshop', () => {
    expect(workshopSelectionSchema.safeParse('').success).toBe(false);
    expect(
      workshopSelectionSchema.safeParse('00000000-0000-4000-8000-000000000001')
        .success,
    ).toBe(true);
  });
});
