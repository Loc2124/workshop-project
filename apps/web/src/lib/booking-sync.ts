const CHANNEL_NAME = 'open-slot:booking-sync';
const STORAGE_KEY = 'open-slot:booking-sync:event';

export type BookingSyncEventType = 'payment_cancelled' | 'payment_returned';

export interface BookingSyncMessage {
  bookingId: string;
  type: BookingSyncEventType;
  at: number;
}

/**
 * Notify other open tabs that a booking's payment/cancellation state changed.
 */
export function notifyBookingUpdated(
  bookingId: string,
  type: BookingSyncEventType,
): void {
  if (typeof window === 'undefined' || !bookingId) return;
  const message: BookingSyncMessage = {
    bookingId,
    type,
    at: Date.now(),
  };

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    } catch {
      // Ignore BroadcastChannel errors in restricted contexts.
    }
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // Ignore storage errors (e.g., private mode quota).
  }
}

/**
 * Subscribe to cross-tab booking updates for a specific booking ID.
 */
export function subscribeBookingUpdates(
  bookingId: string,
  onUpdate: (message: BookingSyncMessage) => void,
): () => void {
  if (typeof window === 'undefined' || !bookingId) return () => {};

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data as Partial<BookingSyncMessage> | null;
        if (data?.bookingId === bookingId && data.type) {
          onUpdate({
            bookingId: data.bookingId,
            type: data.type,
            at: typeof data.at === 'number' ? data.at : Date.now(),
          });
        }
      };
    } catch {
      channel = null;
    }
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue) as Partial<BookingSyncMessage>;
      if (data?.bookingId === bookingId && data.type) {
        onUpdate({
          bookingId: data.bookingId,
          type: data.type,
          at: typeof data.at === 'number' ? data.at : Date.now(),
        });
      }
    } catch {
      // Ignore malformed storage payloads.
    }
  };

  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
