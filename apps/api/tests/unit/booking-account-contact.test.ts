import { expect, it, vi } from 'vitest';

vi.mock('../../src/db/pool.js', () => ({ query: vi.fn() }));
vi.mock('../../src/config.js', () => ({
  loadConfig: () => ({ HOLD_MINUTES: 15, PAYMENT_PROVIDER: 'mock' }),
}));
vi.mock('../../src/modules/bookings/bookings.repository.js', () => ({
  createCustomerBooking: vi.fn(),
  failCheckout: vi.fn(),
  getCustomerBooking: vi.fn(),
  getCustomerTickets: vi.fn(),
  listCustomerBookings: vi.fn(),
  saveCheckoutLink: vi.fn(),
}));
vi.mock('../../src/modules/payments/payments.repository.js', () => ({
  cancelCustomerBooking: vi.fn(),
}));

import { query } from '../../src/db/pool.js';
import { createCustomerBooking as insertBooking } from '../../src/modules/bookings/bookings.repository.js';
import { createCustomerBooking } from '../../src/modules/bookings/bookings.service.js';
import { createBookingSchema } from '../../src/modules/bookings/bookings.schemas.js';

it.each(['0912345678', null, ''])(
  'takes contact data from the account with phone %s',
  async (phone) => {
    vi.mocked(query).mockResolvedValue({
      rows: [
        { fullName: 'Account name', email: 'account@example.test', phone },
      ],
    } as never);
    vi.mocked(insertBooking).mockResolvedValue({
      kind: 'created',
      booking: { checkoutRequired: false },
    } as never);
    await createCustomerBooking('account-id', {
      sessionId: 'session-id',
      quantity: 2,
    });
    expect(insertBooking).toHaveBeenLastCalledWith(
      'account-id',
      {
        sessionId: 'session-id',
        quantity: 2,
        contactName: 'Account name',
        contactPhone: phone || null,
      },
      15,
      'mock',
    );
  },
);

it('accepts only session and quantity from the browser', () => {
  const input = {
    sessionId: '123e4567-e89b-42d3-a456-426614174000',
    quantity: 1,
  };
  expect(createBookingSchema.safeParse(input).success).toBe(true);
  expect(
    createBookingSchema.safeParse({
      ...input,
      contactName: 'Forged name',
      contactPhone: '0999999999',
    }).success,
  ).toBe(false);
});
