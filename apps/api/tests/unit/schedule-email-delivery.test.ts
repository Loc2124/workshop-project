import { afterEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ query: vi.fn(), client: { query: vi.fn() } }));
vi.mock('../../src/db/pool.js', () => ({
  query: db.query,
  withTransaction: (action: (client: typeof db.client) => unknown) =>
    action(db.client),
}));
import { sendQueuedEmails } from '../../src/modules/bookings/attendance-job.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const email = {
  id: 'email',
  recipient: 'customer@example.test',
  subject: 'Studio đã đổi giờ học',
  body: 'Xem giờ học mới.',
  idempotency_key: 'booking:schedule:2',
};
it('does not send a claimed notice if the booking changed before dispatch', async () => {
  vi.stubEnv('EMAIL_DELIVERY_URL', 'https://mailer.example.test/send');
  const send = vi.fn();
  vi.stubGlobal('fetch', send);
  db.client.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [email] });
  db.query
    .mockResolvedValueOnce({ rowCount: 0 })
    .mockResolvedValueOnce({ rowCount: 1 });
  await sendQueuedEmails();
  expect(send).not.toHaveBeenCalled();
  expect(db.query.mock.calls.at(-1)?.[0]).toContain("status='cancelled'");
});
it('keeps the provider request key and marks receipt only after a successful delivery response', async () => {
  vi.stubEnv('EMAIL_DELIVERY_URL', 'https://mailer.example.test/send');
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', send);
  db.client.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [email] });
  db.query
    .mockResolvedValueOnce({ rowCount: 1 })
    .mockResolvedValueOnce({ rowCount: 1 });
  await sendQueuedEmails();
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][1].headers['Idempotency-Key']).toBe(
    email.idempotency_key,
  );
  expect(db.query.mock.calls.at(-1)?.[0]).toContain("status='sent'");
});
it('leaves failed delivery retryable without marking it sent', async () => {
  vi.stubEnv('EMAIL_DELIVERY_URL', 'https://mailer.example.test/send');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
  );
  db.client.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [email] });
  db.query
    .mockResolvedValueOnce({ rowCount: 1 })
    .mockResolvedValueOnce({ rowCount: 1 });
  await sendQueuedEmails();
  expect(db.query.mock.calls.at(-1)?.[0]).toContain("status='failed'");
});
