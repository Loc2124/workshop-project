import { beforeEach, describe, expect, it } from 'vitest';
import { useBookingFlowStore } from './booking-flow.store';

describe('useBookingFlowStore', () => {
  beforeEach(() => {
    useBookingFlowStore.getState().resetFlow();
  });

  it('starts at initial state and step 1', () => {
    const state = useBookingFlowStore.getState();
    expect(state.step).toBe(1);
    expect(state.workshopId).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.ticketQuantity).toBe(1);
  });

  it('progresses to step 2 when session is chosen', () => {
    useBookingFlowStore.getState().setSession('workshop-1', 'session-101');
    const state = useBookingFlowStore.getState();
    expect(state.workshopId).toBe('workshop-1');
    expect(state.sessionId).toBe('session-101');
    expect(state.step).toBe(2);
  });

  it('updates tickets and advances to step 3', () => {
    useBookingFlowStore.getState().setSession('workshop-1', 'session-101');
    useBookingFlowStore
      .getState()
      .setTickets(3, 'Cần thêm chỗ ngồi gần cửa sổ');
    const state = useBookingFlowStore.getState();
    expect(state.ticketQuantity).toBe(3);
    expect(state.customerNote).toBe('Cần thêm chỗ ngồi gần cửa sổ');
    expect(state.step).toBe(3);
  });

  it('updates customer info and advances to step 4', () => {
    useBookingFlowStore.getState().setCustomerInfo({
      customerName: 'Nguyễn Văn A',
      customerEmail: 'vana@example.com',
      customerPhone: '0912345678',
    });
    const state = useBookingFlowStore.getState();
    expect(state.customerName).toBe('Nguyễn Văn A');
    expect(state.customerEmail).toBe('vana@example.com');
    expect(state.customerPhone).toBe('0912345678');
    expect(state.step).toBe(4);
  });

  it('supports navigation actions (nextStep, prevStep, goToStep, resetFlow)', () => {
    useBookingFlowStore.getState().goToStep(3);
    expect(useBookingFlowStore.getState().step).toBe(3);

    useBookingFlowStore.getState().nextStep();
    expect(useBookingFlowStore.getState().step).toBe(4);

    useBookingFlowStore.getState().prevStep();
    expect(useBookingFlowStore.getState().step).toBe(3);

    useBookingFlowStore.getState().resetFlow();
    expect(useBookingFlowStore.getState().step).toBe(1);
    expect(useBookingFlowStore.getState().workshopId).toBeNull();
  });
});
