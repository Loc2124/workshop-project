import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { TicketAttendanceEditor } from './TicketAttendanceEditor';
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'reviewer' } }),
}));
const tickets = [1, 2, 3].map((seq) => ({
  id: `20000000-0000-4000-8000-00000000000${seq}`,
  seq,
  status: seq === 1 ? 'used' : 'valid',
  attendanceStatus: seq === 1 ? 'attended' : seq === 2 ? 'absent' : 'unmarked',
  version: 1,
  totalAmount: 200000,
  depositAmount: 10000,
  paidAmount: 200000,
  refundDueAmount: seq === 2 ? 190000 : 0,
  refundedAmount: 0,
  refundHistoryLocked: seq === 2,
  startsAt: new Date(Date.now() - 3600000).toISOString(),
  serverNow: new Date().toISOString(),
  canMark: true,
}));
function render(admin = false) {
  const client = new QueryClient();
  client.setQueryData(
    ['ticket-attendance', 'reviewer', admin, 'studio', 'booking'],
    tickets,
  );
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <TicketAttendanceEditor
        bookingId="booking"
        studioId="studio"
        admin={admin}
        onUpdated={async () => undefined}
      />
    </QueryClientProvider>,
  );
  client.clear();
  return html.replace(/<!--.*?-->/g, '');
}
it('shows each individual attendance state and keeps unpaid/refund information distinct', () => {
  const html = render();
  expect(html.match(/<li /g)).toHaveLength(3);
  expect(html).toContain('Vé số 1');
  expect(html).toContain('Đã đến');
  expect(html).toContain('Vé số 2');
  expect(html).toContain('Vắng mặt');
  expect(html).toContain('Vé số 3');
  expect(html).toContain('Chưa ghi nhận');
  expect(html).toContain('190.000');
  expect(html).toContain('Quản trị hỗ trợ điều chỉnh');
});
it('gives administration a correction action without showing a studio lock as its own authority', () => {
  const html = render(true);
  expect(html).not.toContain('Quản trị hỗ trợ điều chỉnh');
  expect(html.match(/<li /g)).toHaveLength(3);
  expect(html).toContain('Đã ghi khoản hoàn');
});
