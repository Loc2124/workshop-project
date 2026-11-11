import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { loadConfig } from '../../config.js';
import { AppError } from '../../errors/app-error.js';
import { query } from '../../db/pool.js';
import {
  retryFailedEmails,
  sendEmail,
  processResendEvent,
} from '../../services/email.js';
import { emailTemplate } from '../../services/templates.js';
import { cleanupImages } from '../images/images.service.js';

export const emailRouter = Router();
export const resendWebhookRouter = Router();

emailRouter.get('/cron/remind', async (request, response) => {
  const secret = loadConfig().CRON_SECRET;
  if (!secret)
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Cron chưa được cấu hình.');
  if (request.get('Authorization') !== `Bearer ${secret}`)
    throw new AppError(401, 'UNAUTHORIZED', 'Không được phép gọi cron.');

  const retried = await retryFailedEmails();
  const result = await query<{
    id: string;
    email: string;
    fullName: string;
    workshopTitle: string;
    studioName: string;
    startsAt: Date;
    orderCode: string;
    ticketCodes: string[];
  }>(
    `SELECT b.id,u.email,u.full_name AS "fullName",w.title AS "workshopTitle",
      st.name AS "studioName",s.starts_at AS "startsAt",b.order_code::text AS "orderCode",
      ARRAY(SELECT t.manual_code FROM tickets t WHERE t.booking_id=b.id AND t.status='valid'
        ORDER BY t.seq) AS "ticketCodes"
     FROM bookings b JOIN users u ON u.id=b.user_id JOIN sessions s ON s.id=b.session_id
     JOIN workshops w ON w.id=s.workshop_id JOIN studios st ON st.id=w.studio_id
     WHERE b.reservation_status='confirmed' AND b.schedule_version=s.schedule_version
       AND NOT b.reschedule_pending AND s.status='scheduled'
       AND s.starts_at>=now()+interval '23 hours' AND s.starts_at<now()+interval '24 hours'
       AND b.reminder24h_sent_at IS NULL
     ORDER BY s.starts_at,b.id LIMIT 500`,
  );
  let sent = 0;
  let failed = 0;
  for (const booking of result.rows) {
    const claim = await query(
      `UPDATE bookings SET reminder24h_lock_at=now()
       WHERE id=$1 AND reminder24h_sent_at IS NULL
         AND (reminder24h_lock_at IS NULL OR reminder24h_lock_at<now()-interval '15 minutes')
       RETURNING id`,
      [booking.id],
    );
    if (!claim.rowCount) continue;
    try {
      const when = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(booking.startsAt);
      const content = emailTemplate({
        title: 'Workshop của bạn diễn ra vào ngày mai',
        paragraphs: [
          `Xin chào ${booking.fullName},`,
          `${booking.workshopTitle} tại ${booking.studioName} bắt đầu lúc ${when} (giờ Việt Nam).`,
          `Mã đơn ${booking.orderCode} · Mã vé: ${booking.ticketCodes.join(', ') || 'xem trong tài khoản Open Slot'}.`,
        ],
        cta: {
          label: 'Xem lịch đặt của tôi',
          href: new URL(
            '/lich-dat-cua-toi',
            loadConfig().CLIENT_URL,
          ).toString(),
        },
      });
      await sendEmail({
        to: booking.email,
        subject: `Nhắc lịch ngày mai: ${booking.workshopTitle}`,
        ...content,
        type: 'reminder_24h',
        idempotencyKey: `reminder24h:${booking.id}:${booking.startsAt.toISOString()}`,
      });
      await query(
        `UPDATE bookings SET reminder24h_sent_at=now(),reminder24h_lock_at=NULL
         WHERE id=$1 AND reminder24h_sent_at IS NULL`,
        [booking.id],
      );
      sent++;
    } catch (error) {
      await query('UPDATE bookings SET reminder24h_lock_at=NULL WHERE id=$1', [
        booking.id,
      ]);
      failed++;
      console.error(
        `24-hour reminder failed for booking ${booking.id}.`,
        error,
      );
    }
  }
  let imagesCleaned = 0;
  try {
    imagesCleaned = await cleanupImages();
  } catch (error) {
    console.error('Scheduled image cleanup skipped or failed.', error);
  }
  response.json({
    ok: true,
    remindersSent: sent,
    remindersFailed: failed,
    emailsRetried: retried,
    imagesCleaned,
  });
});

resendWebhookRouter.post('/', async (request, response) => {
  const secret = loadConfig().RESEND_WEBHOOK_SECRET;
  if (!secret)
    throw new AppError(404, 'NOT_FOUND', 'Webhook chưa được cấu hình.');
  if (!Buffer.isBuffer(request.body))
    throw new AppError(400, 'BAD_REQUEST', 'Nội dung webhook không hợp lệ.');
  const raw = request.body.toString('utf8');
  if (!verifyResendSignature(request, raw, secret))
    throw new AppError(400, 'BAD_REQUEST', 'Chữ ký webhook không hợp lệ.');
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'JSON webhook không hợp lệ.');
  }
  const event = z
    .object({
      type: z.string(),
      data: z
        .object({
          email_id: z.string().optional(),
          to: z.union([z.string(), z.array(z.string())]).optional(),
        })
        .passthrough(),
    })
    .safeParse(parsedBody);
  if (!event.success)
    throw new AppError(400, 'BAD_REQUEST', 'Dữ liệu webhook không hợp lệ.');
  if (['email.bounced', 'email.complained'].includes(event.data.type)) {
    const recipients = Array.isArray(event.data.data.to)
      ? event.data.data.to
      : event.data.data.to
        ? [event.data.data.to]
        : [];
    const resendId = event.data.data.email_id;
    for (const email of recipients) {
      await processResendEvent({
        id: request.get('svix-id') ?? '',
        resendId,
        type: event.data.type,
        email,
      });
    }
  }
  response.sendStatus(204);
});

function verifyResendSignature(
  request: Request,
  raw: string,
  secret: string,
): boolean {
  const id = request.get('svix-id');
  const timestamp = request.get('svix-timestamp');
  const signatures = request.get('svix-signature');
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp))
    return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret);
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${raw}`)
    .digest('base64');
  return signatures.split(' ').some((entry) => {
    const supplied = entry.split(',');
    if (supplied[0] !== 'v1' || !supplied[1]) return false;
    const actual = Buffer.from(supplied[1]);
    const target = Buffer.from(expected);
    return actual.length === target.length && timingSafeEqual(actual, target);
  });
}
