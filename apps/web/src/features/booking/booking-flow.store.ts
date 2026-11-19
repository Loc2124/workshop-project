import { create } from 'zustand';

export interface BookingFlowState {
  workshopId: string | null;
  sessionId: string | null;
  ticketQuantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNote: string;
  paymentChoice: 'deposit' | 'in_studio';
  step: number;

  // Actions
  setSession: (workshopId: string, sessionId: string) => void;
  setTickets: (ticketQuantity: number, customerNote?: string) => void;
  setCustomerInfo: (info: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  }) => void;
  setPaymentChoice: (choice: 'deposit' | 'in_studio') => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  resetFlow: () => void;
}

const initialState = {
  workshopId: null,
  sessionId: null,
  ticketQuantity: 1,
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerNote: '',
  paymentChoice: 'deposit' as const,
  step: 1,
};

export const useBookingFlowStore = create<BookingFlowState>((set) => ({
  ...initialState,

  setSession: (workshopId, sessionId) =>
    set({ workshopId, sessionId, step: 2 }),

  setTickets: (ticketQuantity, customerNote = '') =>
    set({ ticketQuantity, customerNote, step: 3 }),

  setCustomerInfo: (info) =>
    set({
      customerName: info.customerName,
      customerEmail: info.customerEmail,
      customerPhone: info.customerPhone,
      step: 4,
    }),

  setPaymentChoice: (paymentChoice) => set({ paymentChoice }),

  nextStep: () => set((state) => ({ step: state.step + 1 })),

  prevStep: () => set((state) => ({ step: Math.max(1, state.step - 1) })),

  goToStep: (step) => set({ step: Math.max(1, step) }),

  resetFlow: () => set({ ...initialState }),
}));
