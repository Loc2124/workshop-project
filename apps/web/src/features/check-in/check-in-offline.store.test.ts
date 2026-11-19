import { beforeEach, describe, expect, it } from 'vitest';
import { useOfflineCheckInStore } from './check-in-offline.store';

describe('useOfflineCheckInStore', () => {
  beforeEach(() => {
    useOfflineCheckInStore.getState().clearQueue();
  });

  it('starts with empty pending queue', () => {
    expect(useOfflineCheckInStore.getState().pendingQueue).toEqual([]);
  });

  it('enqueues a scanned ticket without duplicating', () => {
    useOfflineCheckInStore.getState().enqueueTicket({
      ticketCode: 'TK-12345',
      studioId: 'studio-1',
      scannedAt: '2026-11-19T10:00:00Z',
    });

    expect(useOfflineCheckInStore.getState().pendingQueue).toHaveLength(1);
    expect(useOfflineCheckInStore.getState().pendingQueue[0].ticketCode).toBe(
      'TK-12345',
    );

    // Enqueueing the same code updates it rather than duplicating
    useOfflineCheckInStore.getState().enqueueTicket({
      ticketCode: 'TK-12345',
      studioId: 'studio-1',
      scannedAt: '2026-11-19T10:05:00Z',
      notes: 'Thử lại lần 2',
    });

    expect(useOfflineCheckInStore.getState().pendingQueue).toHaveLength(1);
    expect(useOfflineCheckInStore.getState().pendingQueue[0].notes).toBe(
      'Thử lại lần 2',
    );
  });

  it('dequeues a ticket by code after successful sync', () => {
    useOfflineCheckInStore.getState().enqueueTicket({
      ticketCode: 'TK-001',
      studioId: 'studio-1',
      scannedAt: '2026-11-19T10:00:00Z',
    });
    useOfflineCheckInStore.getState().enqueueTicket({
      ticketCode: 'TK-002',
      studioId: 'studio-1',
      scannedAt: '2026-11-19T10:01:00Z',
    });

    expect(useOfflineCheckInStore.getState().pendingQueue).toHaveLength(2);

    useOfflineCheckInStore.getState().dequeueTicket('TK-001');

    const remaining = useOfflineCheckInStore.getState().pendingQueue;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ticketCode).toBe('TK-002');
  });

  it('clears all queued tickets', () => {
    useOfflineCheckInStore.getState().enqueueTicket({
      ticketCode: 'TK-001',
      studioId: 'studio-1',
      scannedAt: '2026-11-19T10:00:00Z',
    });
    useOfflineCheckInStore.getState().clearQueue();
    expect(useOfflineCheckInStore.getState().pendingQueue).toEqual([]);
  });
});
