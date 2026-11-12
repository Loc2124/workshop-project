type BookingRequest = {
  sessionId: string;
  quantity: number;
  paymentChoice?: 'deposit' | 'in_studio';
};
export function bookingRequestStorageKey(
  userId: string,
  intent: string,
  input: BookingRequest,
) {
  return (
    'open-slot:booking-request:' +
    JSON.stringify([
      userId,
      intent,
      input.sessionId,
      input.quantity,
      input.paymentChoice ?? null,
    ])
  );
}
export function getBookingRequestId(
  userId: string,
  intent: string,
  input: BookingRequest,
  storage?: Storage,
) {
  try {
    const target = storage ?? globalThis.localStorage;
    const key = bookingRequestStorageKey(userId, intent, input),
      existing = target.getItem(key);
    if (
      existing &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        existing,
      )
    )
      return existing;
    const id = crypto.randomUUID();
    target.setItem(key, id);
    return id;
  } catch {
    throw new Error(
      'Trình duyệt chưa lưu được yêu cầu. Vui lòng cho phép lưu dữ liệu trang rồi thử lại.',
    );
  }
}
export function clearBookingRequest(
  userId: string,
  intent: string,
  input: BookingRequest,
  storage?: Storage,
) {
  try {
    (storage ?? globalThis.localStorage).removeItem(
      bookingRequestStorageKey(userId, intent, input),
    );
  } catch {
    /* The same key can safely replay an acknowledged request. */
  }
}
export function clearUserBookingRequests(userId: string, storage?: Storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const prefix = `open-slot:booking-request:[${JSON.stringify(userId)},`;
    const keys: string[] = [];
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) target.removeItem(key);
  } catch {
    /* Storage can be disabled. */
  }
}
