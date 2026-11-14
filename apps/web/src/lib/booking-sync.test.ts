import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  notifyBookingUpdated,
  subscribeBookingUpdates,
  type BookingSyncMessage,
} from './booking-sync';

describe('booking-sync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies subscribers for matching bookingId via BroadcastChannel', () => {
    const listeners = new Set<(event: MessageEvent<unknown>) => void>();

    class FakeBroadcastChannel {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      constructor(public name: string) {
        listeners.add((ev) => this.onmessage?.(ev));
      }
      postMessage(data: unknown) {
        const event = { data } as MessageEvent<unknown>;
        for (const listener of listeners) listener(event);
      }
      close() {}
    }

    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      localStorage: { setItem: vi.fn() },
    });

    const received: BookingSyncMessage[] = [];
    const unsubscribe = subscribeBookingUpdates('booking-1', (msg) => {
      received.push(msg);
    });

    notifyBookingUpdated('booking-2', 'payment_cancelled');
    notifyBookingUpdated('booking-1', 'payment_cancelled');

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      bookingId: 'booking-1',
      type: 'payment_cancelled',
    });

    unsubscribe();
  });

  it('notifies subscribers via storage event fallback', () => {
    const handlers: Record<string, ((event: StorageEvent) => void)[]> = {};
    const setItem = vi.fn((key: string, value: string) => {
      for (const fn of handlers.storage ?? []) {
        fn({ key, newValue: value } as StorageEvent);
      }
    });

    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(
        (type: string, fn: (event: StorageEvent) => void) => {
          handlers[type] ??= [];
          handlers[type].push(fn);
        },
      ),
      removeEventListener: vi.fn(),
      localStorage: { setItem },
    });

    const received: BookingSyncMessage[] = [];
    const unsubscribe = subscribeBookingUpdates('booking-9', (msg) => {
      received.push(msg);
    });

    notifyBookingUpdated('booking-9', 'payment_returned');

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      bookingId: 'booking-9',
      type: 'payment_returned',
    });

    unsubscribe();
  });
});
