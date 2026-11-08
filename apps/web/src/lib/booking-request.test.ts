import { describe, expect, it } from 'vitest';
import { getBookingRequestId, clearBookingRequest } from './booking-request';
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } as Storage;
}
const input = {
  sessionId: 'session-a',
  quantity: 1,
  paymentChoice: 'deposit' as const,
};
describe('booking retry identity', () => {
  it('keeps the same identity after a lost response or reload and rotates only after acknowledgment', () => {
    const target = storage();
    const first = getBookingRequestId(
      'customer-a',
      'workshop-a',
      input,
      target,
    );
    expect(
      getBookingRequestId('customer-a', 'workshop-a', { ...input }, target),
    ).toBe(first);
    clearBookingRequest('customer-a', 'workshop-a', input, target);
    expect(
      getBookingRequestId('customer-a', 'workshop-a', input, target),
    ).not.toBe(first);
  });
  it('separates accounts, booking intents and changed inputs', () => {
    const target = storage(),
      first = getBookingRequestId('customer-a', 'workshop-a', input, target);
    expect(
      getBookingRequestId('customer-b', 'workshop-a', input, target),
    ).not.toBe(first);
    expect(
      getBookingRequestId('customer-a', 'retry-old-booking', input, target),
    ).not.toBe(first);
    expect(
      getBookingRequestId(
        'customer-a',
        'workshop-a',
        { ...input, quantity: 2 },
        target,
      ),
    ).not.toBe(first);
  });
  it('fails clearly instead of silently losing retry identity when storage is blocked', () => {
    const target = {
      getItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() =>
      getBookingRequestId('customer-a', 'workshop-a', input, target),
    ).toThrow('Trình duyệt chưa lưu được yêu cầu');
  });
});
