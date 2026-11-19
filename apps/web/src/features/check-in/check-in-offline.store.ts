import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PendingCheckIn {
  ticketCode: string;
  studioId: string;
  scannedAt: string;
  notes?: string;
}

export interface OfflineCheckInState {
  pendingQueue: PendingCheckIn[];
  enqueueTicket: (item: PendingCheckIn) => void;
  dequeueTicket: (ticketCode: string) => void;
  clearQueue: () => void;
}

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useOfflineCheckInStore = create<OfflineCheckInState>()(
  persist(
    (set) => ({
      pendingQueue: [],
      enqueueTicket: (item) =>
        set((state) => ({
          pendingQueue: [
            ...state.pendingQueue.filter(
              (q) => q.ticketCode !== item.ticketCode,
            ),
            item,
          ],
        })),
      dequeueTicket: (ticketCode) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.filter(
            (q) => q.ticketCode !== ticketCode,
          ),
        })),
      clearQueue: () => set({ pendingQueue: [] }),
    }),
    {
      name: 'openslot_offline_checkin_queue',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : memoryStorage,
      ),
    },
  ),
);
