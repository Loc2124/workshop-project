import { Router } from 'express';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { newPasswordSchema } from '@workshop/shared';
import { adminBookingDecision } from '../admin/admin-bookings.js';
import { cancelBookingForCustomer } from '../bookings/bookings.service.js';
import { validateBody } from '../../middleware/validate-body.js';
import { query } from '../../db/pool.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { listStudiosForUser } from '../studios/studios.service.js';
import { getCurrentUser, hashPassword } from './auth.service.js';
import { findUserById } from './auth.repository.js';

const router = Router();

router.use(requireAuth());
router.post(
  '/bookings/:id/cancel',
  validateUuidParam('id'),
  validateBody(
    adminBookingDecision.extend({
      status: z.literal('cancelled'),
      quoteToken: z.string().min(1).max(2000).optional(),
    }),
  ),
  async (req, res) =>
    res.json(
      await cancelBookingForCustomer(
        req.user!.sub,
        String(req.params.id),
        req.body.quoteToken,
      ),
    ),
);
router.get('/notifications', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    notifications: (
      await query(
        `SELECT items.id, items."studioId", items."workshopId", items."bookingId",
           items.type, items.title, items.body, items.reason,
           b.order_code::text AS "orderCode", w.title AS "workshopTitle",
           st.name AS "studioName", s.starts_at AS "startsAt",
           b.hold_expires_at AS "holdExpiresAt", items."createdAt", items."readAt"
         FROM (
           SELECT id, studio_id AS "studioId", workshop_id AS "workshopId",
             booking_id AS "bookingId", template_key AS type, title, body, reason,
             created_at AS "createdAt", read_at AS "readAt"
           FROM studio_notifications
           WHERE user_id = $1
             AND (booking_id IS NULL OR template_key <> 'booking_success')
           UNION ALL
           SELECT id, NULL::uuid AS "studioId", NULL::uuid AS "workshopId",
             booking_id AS "bookingId", type, title, body, NULL::text AS reason,
             created_at AS "createdAt", read_at AS "readAt"
           FROM user_notifications
           WHERE user_id = $1
         ) items
         LEFT JOIN bookings b ON b.id = items."bookingId"
         LEFT JOIN sessions s ON s.id = b.session_id
         LEFT JOIN workshops w ON w.id = s.workshop_id
         LEFT JOIN studios st ON st.id = w.studio_id
         ORDER BY "createdAt" DESC, id DESC
         LIMIT 100`,
        [request.user!.sub],
      )
    ).rows,
  });
});
router.patch('/notifications/read-all', async (request, response) => {
  await query(
    'UPDATE studio_notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND read_at IS NULL',
    [request.user!.sub],
  );
  await query(
    'UPDATE user_notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND read_at IS NULL',
    [request.user!.sub],
  );
  response.json({ ok: true });
});
router.patch(
  '/notifications/:id/read',
  validateUuidParam('id'),
  async (request, response) => {
    const result = await query(
      'UPDATE studio_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',
      [request.params.id, request.user!.sub],
    );
    if (!result.rowCount) {
      const bookingNotification = await query(
        'UPDATE user_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id',
        [request.params.id, request.user!.sub],
      );
      if (!bookingNotification.rowCount)
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
    }
    response.json({ ok: true });
  },
);

router.get('/', async (request, response) => {
  const user = await getCurrentUser(request.user!.sub);
  if (!user) {
    throw new AppError(
      401,
      'UNAUTHORIZED',
      'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
    );
  }
  response.json({ user });
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ và tên tối thiểu 2 ký tự').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại không hợp lệ (ví dụ: 0912345678)')
    .optional()
    .or(z.literal(''))
    .nullable(),
});

router.patch(
  '/profile',
  validateBody(updateProfileSchema),
  async (request, response) => {
    const { fullName, phone } = request.body;
    const normalizedPhone =
      phone && String(phone).trim() ? String(phone).trim() : null;

    const result = await query<{
      id: string;
      email: string;
      fullName: string;
      phone: string | null;
      role: 'customer' | 'studio_owner' | 'admin';
      createdAt: string;
    }>(
      `UPDATE users
       SET full_name = $1, phone = $2
       WHERE id = $3
       RETURNING id, email, full_name AS "fullName", phone, role, created_at AS "createdAt"`,
      [fullName, normalizedPhone, request.user!.sub],
    );

    response.json({ user: result.rows[0] });
  },
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
});

router.patch(
  '/password',
  validateBody(changePasswordSchema),
  async (request, response) => {
    const { currentPassword, newPassword } = request.body;
    const user = await findUserById(request.user!.sub);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Mật khẩu hiện tại không chính xác.',
      );
    }

    const parsed = newPasswordSchema.safeParse(newPassword);
    if (!parsed.success) {
      throw new AppError(
        422,
        'UNPROCESSABLE_ENTITY',
        parsed.error.issues[0]?.message ?? 'Mật khẩu mới chưa đạt yêu cầu.',
      );
    }

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newHash,
      request.user!.sub,
    ]);

    response.json({ ok: true, message: 'Đổi mật khẩu thành công.' });
  },
);

router.get('/studios', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json(await listStudiosForUser(request.user!.sub));
});

export default router;
