import { AppError } from '../../errors/app-error.js';
import {
  cancelSession as cancelOwnedSession,
  createSession as insertSession,
  listStudioSessions as selectStudioSessions,
  updateSession as saveSession,
} from './sessions.repository.js';
import type { SessionInput, SessionUpdate } from './sessions.schemas.js';
import { getStudioMemberRole } from '../studios/studios.repository.js';
import { createHash, randomBytes } from 'node:crypto';
import { query } from '../../db/pool.js';
import { loadConfig } from '../../config.js';
import { queueEmail } from '../../services/email.js';
import { emailTemplate } from '../../services/templates.js';
import { queueBookingEmail } from '../../services/booking-emails.js';

export async function getStudioSessions(studioId: string, userId: string) {
  const role = await getStudioMemberRole(studioId, userId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  return {
    sessions: (await selectStudioSessions(studioId, userId)) ?? [],
  };
}

export async function createStudioSession(
  studioId: string,
  userId: string,
  workshopId: string,
  input: SessionInput,
) {
  const role = await getStudioMemberRole(studioId, userId);
  if (!role) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  if (Object.hasOwn(input, 'price') && role !== 'owner') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio được đặt giá buổi workshop.',
    );
  }

  const session = await insertSession(studioId, userId, workshopId, input);
  if (!session) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }
  queueScheduleEmails(workshopId, session.id);
  return { session };
}

function queueScheduleEmails(workshopId: string, sessionId: string) {
  void (async () => {
    const subscribers = await query<{
      userId: string;
      email: string;
      fullName: string;
      workshopTitle: string;
      slug: string;
      studioName: string;
      startsAt: Date;
    }>(
      `SELECT sub.user_id AS "userId",u.email,u.full_name AS "fullName",
        w.title AS "workshopTitle",w.slug,st.name AS "studioName",s.starts_at AS "startsAt"
       FROM workshop_schedule_subscriptions sub JOIN users u ON u.id=sub.user_id
       JOIN workshops w ON w.id=sub.workshop_id JOIN studios st ON st.id=w.studio_id
       JOIN sessions s ON s.id=$2
       WHERE sub.workshop_id=$1 AND w.status='approved' AND w.publication_status='published'
         AND w.visibility_status='active' AND NOT w.is_discontinued AND s.status='scheduled'`,
      [workshopId, sessionId],
    );
    const config = loadConfig();
    for (const subscriber of subscribers.rows) {
      const token = randomBytes(32).toString('hex');
      const hash = createHash('sha256').update(token).digest('hex');
      await query(
        `INSERT INTO workshop_schedule_unsubscribe_tokens(workshop_id,user_id,token_hash)
         VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [workshopId, subscriber.userId, hash],
      );
      const date = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(subscriber.startsAt);
      const unsubscribeUrl = new URL(
        `/api/workshops/${workshopId}/schedule-subscription/unsubscribe?token=${token}`,
        config.CLIENT_URL,
      ).toString();
      const content = emailTemplate({
        title: 'Workshop đã có lịch mới',
        paragraphs: [
          `Xin chào ${subscriber.fullName},`,
          `${subscriber.workshopTitle} tại ${subscriber.studioName} vừa mở lịch ${date}.`,
        ],
        cta: {
          label: 'Xem workshop và đặt chỗ',
          href: new URL(
            `/workshop/${subscriber.slug}`,
            config.CLIENT_URL,
          ).toString(),
        },
        unsubscribe: {
          label: 'Hủy nhận thông báo workshop này',
          href: unsubscribeUrl,
        },
      });
      queueEmail({
        to: subscriber.email,
        subject: `Có lịch mới: ${subscriber.workshopTitle}`,
        ...content,
        type: 'schedule_available',
        idempotencyKey: `schedule:${sessionId}:${subscriber.userId}`,
      });
    }
  })().catch((error: unknown) =>
    console.error('Schedule announcement failed.', error),
  );
}

export async function updateStudioSession(
  studioId: string,
  userId: string,
  sessionId: string,
  input: SessionUpdate,
) {
  const result = await saveSession(studioId, userId, sessionId, input);
  if (!result) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy buổi workshop.');
  }
  if (result.conflict === 'capacity') {
    throw new AppError(
      409,
      'CONFLICT',
      'Sức chứa phải lớn hơn số chỗ đã giữ hoặc đã bán và thời gian kết thúc phải sau thời gian bắt đầu.',
    );
  }
  if (result.conflict === 'price_locked') {
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể đổi giá buổi đã có đăng ký đang chờ thanh toán, đã thanh toán hoặc cần hoàn tiền.',
    );
  }
  if (result.conflict === 'schedule_locked') {
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể đổi lịch buổi đã có đăng ký đang chờ thanh toán, đã thanh toán hoặc cần hoàn tiền.',
    );
  }
  if (result.conflict === 'session_closed') {
    throw new AppError(
      409,
      'CONFLICT',
      'Không thể sửa buổi đã hủy, đã hoàn thành hoặc đã bắt đầu.',
    );
  }
  if (result.conflict === 'reschedule_too_soon') {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Chỉ có thể đổi sang giờ học còn trên 12 giờ. Nếu không thể giữ giờ cũ, vui lòng hủy buổi học để hoàn tiền cho khách.',
    );
  }
  if (result.conflict === 'owner_required') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Chỉ chủ studio được thay đổi giá buổi workshop.',
    );
  }
  if (result.conflict === 'invalid_schedule') {
    throw new AppError(
      422,
      'UNPROCESSABLE_ENTITY',
      'Thời gian kết thúc phải sau thời gian bắt đầu.',
    );
  }
  return { session: result.session };
}

export async function cancelStudioSession(
  studioId: string,
  userId: string,
  sessionId: string,
) {
  const session = await cancelOwnedSession(studioId, userId, sessionId);
  if (!session) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Không tìm thấy buổi workshop có thể hủy.',
    );
  }
  const bookings = await query<{ id: string }>(
    `SELECT id FROM bookings WHERE session_id=$1 AND reservation_status='cancelled'
      AND status IN ('cancelled','refund_needed')`,
    [sessionId],
  );
  for (const booking of bookings.rows)
    queueBookingEmail(booking.id, 'booking_cancelled');
  return { session };
}
