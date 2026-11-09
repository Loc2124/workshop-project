import { withTransaction } from '../../db/pool.js';
import { releaseExpiredHolds } from './bookings.repository.js';
import { expirePendingScheduleResponses } from './schedule-changes.js';
import { queueBookingEmail } from '../../services/booking-emails.js';

const EXPIRY_LOCK_NAMESPACE = 731904;
const EXPIRY_LOCK_ID = 31;

export async function releaseExpiredBookingHolds(
  onlySessionIds?: readonly string[],
): Promise<number> {
  const result = await withTransaction(async (client) => {
    const lock = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1, $2) AS acquired',
      [EXPIRY_LOCK_NAMESPACE, EXPIRY_LOCK_ID],
    );
    if (!lock.rows[0]?.acquired) return { count: 0, expiredBookingIds: [] as string[] };

    const expiredBookings = await client.query<{ id: string }>(
      `SELECT id FROM bookings WHERE status='pending' AND reservation_status='pending'
       AND hold_expires_at<now() AND ($1::uuid[] IS NULL OR session_id=ANY($1::uuid[]))`,
      [onlySessionIds ?? null],
    );

    const expired = await client.query<{ sessionId: string }>(
      `SELECT DISTINCT session_id AS "sessionId"
       FROM bookings
       WHERE status = 'pending'
         AND reservation_status = 'pending'
         AND hold_expires_at < now()
         AND ($1::uuid[] IS NULL OR session_id = ANY($1::uuid[]))
       ORDER BY session_id`,
      [onlySessionIds ?? null],
    );
    const sessionIds = expired.rows.map(({ sessionId }) => sessionId);
    await releaseExpiredHolds(client, sessionIds);
    return { count: sessionIds.length, expiredBookingIds: expiredBookings.rows.map(({ id }) => id) };
  });
  for (const bookingId of result.expiredBookingIds)
    queueBookingEmail(bookingId, 'booking_expired');
  return result.count;
}

export function startBookingExpiryJob(intervalSeconds: number): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await releaseExpiredBookingHolds();
      await expirePendingScheduleResponses();
    } catch (error) {
      console.error('Booking expiry job failed.', error);
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), intervalSeconds * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
