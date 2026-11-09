import { query, withTransaction } from '../../db/pool.js';
import { releaseUnconfirmedBookings } from './attendance-confirmation.js';
import { expireScheduleResponses } from './schedule-changes.js';
import { sendEmail } from '../../services/email.js';
import { emailTemplate } from '../../services/templates.js';
import { loadConfig } from '../../config.js';

export async function runAttendanceReminders(sessionIds?: string[]) {
  await withTransaction(async (client) => {
    const lock = await client.query<{ ok: boolean }>(
      'SELECT pg_try_advisory_xact_lock(731904,46) AS ok',
    );
    if (!lock.rows[0]?.ok) return;
    const sessions = await client.query<{ id: string }>(
      `SELECT id FROM sessions WHERE status='scheduled' AND starts_at>now() AND starts_at<=now()+interval '24 hours' AND ($1::uuid[] IS NULL OR id=ANY($1)) ORDER BY id FOR UPDATE SKIP LOCKED`,
      [sessionIds ?? null],
    );
    for (const slot of sessions.rows) {
      await expireScheduleResponses(client, [slot.id]);
      await releaseUnconfirmedBookings(client, [slot.id]);
      const reminders = await client.query<{
        id: string;
        userId: string;
        email: string;
        title: string;
        startsAt: Date;
        kind: string;
        paymentMode: string;
        releaseIfUnconfirmed: boolean;
        attendanceConfirmedAt: Date | null;
        paidAmount: number;
        scheduleVersion: number;
      }>(
        `SELECT b.id,b.user_id AS "userId",u.email,w.title,s.starts_at AS "startsAt",CASE WHEN s.starts_at<=now()+interval '2 hours' THEN '2h' ELSE '24h' END AS kind,b.payment_mode AS "paymentMode",b.release_if_unconfirmed AS "releaseIfUnconfirmed",b.attendance_confirmed_at AS "attendanceConfirmedAt",b.paid_amount AS "paidAmount",s.schedule_version AS "scheduleVersion" FROM bookings b JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id JOIN users u ON u.id=b.user_id WHERE s.id=$1 AND b.reservation_status='confirmed' AND NOT b.reschedule_pending AND b.schedule_version=s.schedule_version`,
        [slot.id],
      );
      for (const b of reminders.rows) {
        const when = new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh',
          hourCycle: 'h23',
        }).format(b.startsAt);
        const href = '/me/bookings/' + b.id;
        const requestConfirmation =
          b.paymentMode !== 'payos_deposit' &&
          b.paidAmount === 0 &&
          b.releaseIfUnconfirmed &&
          !b.attendanceConfirmedAt;
        let confirmationInserted = false;
        if (requestConfirmation) {
          const title = 'Bạn sẽ đến buổi học chứ?';
          const body = `${b.title} · ${when}. Mở đặt chỗ và chọn “Xác nhận tôi sẽ đến”. Chỗ chỉ được nhả trước giờ học khi bạn chưa xác nhận và email yêu cầu xác nhận đã gửi thành công ít nhất 2 giờ.`;
          const insertedRequest = await client.query(
            `INSERT INTO email_outbox(booking_id,recipient,subject,body,idempotency_key,delivery_type,schedule_version,reminder_starts_at) SELECT $1,$2,$3,$4,$5,'attendance_confirmation',$6,s.starts_at FROM sessions s WHERE s.id=$7 ON CONFLICT DO NOTHING RETURNING id`,
            [
              b.id,
              b.email,
              title,
              body +
                '\n' +
                loadConfig().CLIENT_URL +
                href,
              `${b.id}:attendance-confirmation:${b.scheduleVersion}`,
              b.scheduleVersion,
              slot.id,
            ],
          );
          confirmationInserted = !!insertedRequest.rowCount;
          if (confirmationInserted)
            await client.query(
              `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) VALUES($1,$2,'attendance_confirmation_requested',$3,$4,$5)`,
              [b.userId, b.id, title, body, href],
            );
        }
        const inserted = await client.query(
          `INSERT INTO booking_reminders(booking_id,kind,starts_at) SELECT $1,$2,s.starts_at FROM sessions s WHERE s.id=$3 ON CONFLICT DO NOTHING RETURNING booking_id`,
          [b.id, b.kind, slot.id],
        );
        if (!inserted.rowCount) continue;
        // The request email also contains the reminder; do not send two together.
        if (confirmationInserted || (requestConfirmation && b.kind === '24h'))
          continue;
        const title =
          b.kind === '24h'
            ? 'Nhắc bạn về buổi học sắp tới'
            : 'Buổi học sắp bắt đầu';
        const body = `${b.title} · ${when}. Xem lại địa chỉ và thông tin trước khi đến nhé.`;
        await client.query(
          `INSERT INTO user_notifications(user_id,booking_id,type,title,body,href) VALUES($1,$2,'class_reminder',$3,$4,$5)`,
          [b.userId, b.id, title, body, href],
        );
        await client.query(
          `INSERT INTO email_outbox(booking_id,recipient,subject,body,idempotency_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [
            b.id,
            b.email,
            title,
            body +
              '\n' +
              loadConfig().CLIENT_URL +
              href,
            `${b.id}:${b.kind}:${b.startsAt.toISOString()}`,
          ],
        );
      }
    }
  });
}
export async function sendQueuedEmails(bookingIds?: string[]) {
  const batch = await withTransaction(async (client) => {
    await client.query(
      `UPDATE email_outbox SET status='failed' WHERE status='processing' AND locked_at<now()-interval '10 minutes' AND ($1::uuid[] IS NULL OR booking_id=ANY($1))`,
      [bookingIds ?? null],
    );
    return (
      await client.query<{
        id: string;
        recipient: string;
        subject: string;
        body: string;
        idempotency_key: string;
      }>(
        `WITH claimed AS (
          SELECT e.id FROM email_outbox e
          JOIN bookings b ON b.id=e.booking_id
          JOIN sessions s ON s.id=b.session_id
          WHERE e.status IN ('pending','failed') AND e.attempts<5
            AND ($1::uuid[] IS NULL OR e.booking_id=ANY($1))
            AND b.reservation_status='confirmed' AND s.status<>'cancelled' AND s.starts_at>now()
            AND ((e.delivery_type='reminder' AND NOT b.reschedule_pending AND EXISTS (
              SELECT 1 FROM booking_reminders r WHERE r.booking_id=b.id AND r.starts_at=s.starts_at
                AND e.idempotency_key=r.booking_id::text||':'||r.kind||':'||to_char(r.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )) OR (e.delivery_type='attendance_confirmation' AND NOT b.reschedule_pending AND b.schedule_version=s.schedule_version AND e.schedule_version=s.schedule_version AND e.reminder_starts_at=s.starts_at AND b.release_if_unconfirmed AND b.attendance_confirmed_at IS NULL AND b.payment_mode<>'payos_deposit' AND b.paid_amount=0)
            OR (e.delivery_type='schedule_change' AND b.reschedule_pending AND b.proposed_schedule_version=e.schedule_version AND s.schedule_version=e.schedule_version AND b.reschedule_deadline>clock_timestamp()))
          ORDER BY e.created_at LIMIT 10 FOR UPDATE OF e SKIP LOCKED
        ) UPDATE email_outbox e SET status='processing',attempts=attempts+1,locked_at=now() FROM claimed WHERE e.id=claimed.id RETURNING e.*`,
        [bookingIds ?? null],
      )
    ).rows;
  });
  for (const email of batch) {
    try {
      const current = await query(
        `SELECT 1 FROM email_outbox e JOIN bookings b ON b.id=e.booking_id JOIN sessions s ON s.id=b.session_id
         WHERE e.id=$1 AND e.status='processing' AND b.reservation_status='confirmed' AND s.status='scheduled' AND s.starts_at>clock_timestamp()
          AND ((e.delivery_type='schedule_change' AND b.reschedule_pending AND b.proposed_schedule_version=e.schedule_version AND s.schedule_version=e.schedule_version AND b.reschedule_deadline>clock_timestamp())
           OR (e.delivery_type='attendance_confirmation' AND NOT b.reschedule_pending AND b.schedule_version=s.schedule_version AND e.schedule_version=s.schedule_version AND e.reminder_starts_at=s.starts_at AND b.release_if_unconfirmed AND b.attendance_confirmed_at IS NULL AND b.payment_mode<>'payos_deposit' AND b.paid_amount=0)
           OR (e.delivery_type='reminder' AND NOT b.reschedule_pending AND EXISTS (SELECT 1 FROM booking_reminders r WHERE r.booking_id=b.id AND r.starts_at=s.starts_at AND e.idempotency_key=r.booking_id::text||':'||r.kind||':'||to_char(r.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))))`,
        [email.id],
      );
      if (!current.rowCount) {
        await query(
          "UPDATE email_outbox SET status='cancelled' WHERE id=$1 AND status='processing'",
          [email.id],
        );
        continue;
      }
      const content = emailTemplate({
        title: email.subject,
        paragraphs: [email.body],
      });
      await sendEmail({
        to: email.recipient,
        subject: email.subject,
        ...content,
        type: 'attendance_confirmation',
        idempotencyKey: `email-outbox:${email.idempotency_key}`,
      });
      await query(
        `UPDATE email_outbox SET status='sent',sent_at=COALESCE(sent_at,clock_timestamp()) WHERE id=$1 AND status='processing'`,
        [email.id],
      );
    } catch {
      await query(
        `UPDATE email_outbox SET status='failed' WHERE id=$1 AND status='processing'`,
        [email.id],
      );
    }
  }
}
export function startAttendanceJob() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runAttendanceReminders();
      await sendQueuedEmails();
    } catch (error) {
      console.error('Attendance reminder job failed', error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), 60000);
  timer.unref();
  return () => clearInterval(timer);
}
