import { Router } from 'express';
import { z } from 'zod';
import {
  changeAdminBooking,
  adminBookingDecision,
} from '../admin/admin-bookings.js';
import { validateBody } from '../../middleware/validate-body.js';
import { query } from '../../db/pool.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { listStudiosForUser } from '../studios/studios.service.js';
import { getCurrentUser } from './auth.service.js';

const router = Router();

router.use(requireAuth());
router.post(
  '/bookings/:id/cancel',
  validateUuidParam('id'),
  validateBody(adminBookingDecision.extend({ status: z.literal('cancelled') })),
  async (req, res) =>
    res.json(
      await changeAdminBooking(
        String(req.params.id),
        req.user!.sub,
        req.body,
        req.user!.sub,
      ),
    ),
);
router.get('/notifications', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    notifications: (
      await query(
        `SELECT id, "studioId", "workshopId", "bookingId", title, body, reason,
           "createdAt", "readAt"
         FROM (
           SELECT id, studio_id AS "studioId", workshop_id AS "workshopId",
             booking_id AS "bookingId", title, body, reason,
             created_at AS "createdAt", read_at AS "readAt"
           FROM studio_notifications
           WHERE user_id = $1
           UNION ALL
           SELECT id, NULL::uuid AS "studioId", NULL::uuid AS "workshopId",
             booking_id AS "bookingId", title, body, NULL::text AS reason,
             created_at AS "createdAt", read_at AS "readAt"
           FROM user_notifications
           WHERE user_id = $1
         ) items
         ORDER BY "createdAt" DESC, id DESC
         LIMIT 100`,
        [request.user!.sub],
      )
    ).rows,
  });
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

router.get('/studios', async (request, response) => {
  response.json(await listStudiosForUser(request.user!.sub));
});

export default router;
