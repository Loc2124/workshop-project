import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { StudioBookingManager } from './StudioBookingManager';
import { queryKeys } from '../../lib/query-keys';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'owner' } }),
}));

const booking = {
  id: '10000000-0000-4000-8000-000000000001',
  orderCode: '100000001',
  workshopTitle: 'Nặn gốm',
  contactName: 'Minh Anh',
  contactPhone: '0901234567',
  quantity: 1,
  totalAmount: 200000,
  paidAmount: 10000,
  depositAmount: 10000,
  balanceAmount: 190000,
  paymentMode: 'payos_deposit',
  paymentStatus: 'pending',
  reservationStatus: 'completed',
  startsAt: '2026-01-01T01:00:00Z',
  endsAt: '2026-01-01T03:00:00Z',
  attendanceStatus: 'attended',
  refundStatus: 'not_applicable',
  refundDueAmount: 0,
  reschedulePending: false,
};
function render(overrides: Partial<typeof booking> = {}) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.bookings.forStudio('owner', 'studio'), [
    { ...booking, ...overrides },
  ]);
  client.setQueryData(['studio-attendance', 'studio'], {
    stats: { attended: 1, absent: 0 },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <StudioBookingManager studioId="studio" />
    </QueryClientProvider>,
  );
}
describe('studio collection after attendance', () => {
  it('shows the pending schedule decision and hides collection in both layouts', () => {
    const html = render({
      reschedulePending: true,
      reservationStatus: 'confirmed',
    });
    expect(html).toContain('Chờ khách xác nhận giờ mới');
    expect(html).not.toContain('Ghi nhận thu 190.000');
  });
  it('keeps collection available on desktop and mobile for a completed booking with unpaid balance', () => {
    const html = render();
    expect(html).toContain('aria-label="Ghi nhận thu 190.000 đồng');
    expect(html).toContain('Ghi nhận thu 190.000 đ');
  });
  it.each([
    { reservationStatus: 'cancelled' },
    { reservationStatus: 'pending', paymentStatus: 'expired' },
    { paymentStatus: 'refund_needed', refundStatus: 'pending' },
    { refundStatus: 'pending' },
    { refundStatus: 'refunded' },
    { paymentStatus: 'paid', paidAmount: 200000, balanceAmount: 0 },
  ])(
    'does not invite collection for inactive/settled booking %j',
    (overrides) => {
      expect(render(overrides)).not.toContain('Ghi nhận thu 190.000');
    },
  );
});
