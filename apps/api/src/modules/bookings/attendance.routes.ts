import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { query } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import { createApiRateLimiter } from '../../middleware/rate-limits.js';
import {
  confirmTicketCheckIn,
  findTicketForCheckIn,
} from './ticket-check-in.js';
import {
  listAttendanceTickets,
  markTicketAttendance,
} from './ticket-attendance.js';
export const attendanceRouter = Router();
const checkInCode = z.object({ code: z.string().min(1).max(128) }).strict();
attendanceRouter.post(
  '/studios/:studioId/check-in/lookup',
  requireAuth(),
  validateUuidParam('studioId'),
  createApiRateLimiter({ limit: 30, windowMs: 60_000 }),
  async (req, res) => {
    const { code } = checkInCode.parse(req.body);
    res.set('Cache-Control', 'no-store').json({
      ticket: await findTicketForCheckIn(
        String(req.params.studioId),
        req.user!.sub,
        code,
      ),
    });
  },
);
attendanceRouter.post(
  '/studios/:studioId/check-in/confirm',
  requireAuth(),
  validateUuidParam('studioId'),
  async (req, res) => {
    const { code, expectedVersion, reason } = checkInCode
      .extend({
        expectedVersion: z.number().int().positive(),
        reason: z.string().trim().max(1000).optional(),
      })
      .parse(req.body);
    res.set('Cache-Control', 'no-store').json({
      ticket: await confirmTicketCheckIn(
        String(req.params.studioId),
        req.user!.sub,
        code,
        expectedVersion,
        reason,
      ),
    });
  },
);
attendanceRouter.get(
  '/studios/:studioId/attendance',
  requireAuth(),
  validateUuidParam('studioId'),
  async (req, res) => {
    const member = await query(
      'SELECT 1 FROM studio_members WHERE studio_id=$1 AND user_id=$2',
      [req.params.studioId, req.user!.sub],
    );
    if (!member.rowCount)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
    const stats = await query(
      `SELECT count(*) FILTER(WHERE t.attendance_status='attended')::integer AS attended,count(*) FILTER(WHERE t.attendance_status='absent')::integer AS absent FROM tickets t JOIN bookings b ON b.id=t.booking_id JOIN sessions s ON s.id=b.session_id JOIN workshops w ON w.id=s.workshop_id WHERE w.studio_id=$1`,
      [req.params.studioId],
    );
    res.json({ stats: stats.rows[0] });
  },
);
attendanceRouter.post(
  '/studios/:studioId/bookings/:id/attendance',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  async (req, res) => {
    const input = z
      .object({
        status: z.enum(['attended', 'absent']),
        reason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);
    await markTicketAttendance(
      String(req.params.id),
      null,
      req.user!.sub,
      input,
      String(req.params.studioId),
    );
    res.json({ ok: true });
  },
);

const ticketInput = z
  .object({
    status: z.enum(['attended', 'absent']),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();
attendanceRouter.get(
  '/studios/:studioId/bookings/:id/tickets',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  async (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      tickets: await listAttendanceTickets(
        String(req.params.id),
        req.user!.sub,
        String(req.params.studioId),
      ),
    });
  },
);
attendanceRouter.post(
  '/studios/:studioId/bookings/:id/tickets/:ticketId/attendance',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  validateUuidParam('ticketId'),
  async (req, res) => {
    const input = ticketInput.parse(req.body);
    res.json(
      await markTicketAttendance(
        String(req.params.id),
        String(req.params.ticketId),
        req.user!.sub,
        input,
        String(req.params.studioId),
      ),
    );
  },
);
attendanceRouter.get(
  '/admin/bookings/:id/tickets',
  requireAuth(['admin']),
  validateUuidParam('id'),
  async (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      tickets: await listAttendanceTickets(
        String(req.params.id),
        req.user!.sub,
        undefined,
        true,
      ),
    });
  },
);
attendanceRouter.post(
  '/admin/bookings/:id/tickets/:ticketId/attendance',
  requireAuth(['admin']),
  validateUuidParam('id'),
  validateUuidParam('ticketId'),
  async (req, res) => {
    const input = ticketInput
      .extend({
        reason: z.string().trim().min(3).max(1000),
        refundAction: z.enum(['preserve', 'cancel_pending']).optional(),
      })
      .parse(req.body);
    res.json(
      await markTicketAttendance(
        String(req.params.id),
        String(req.params.ticketId),
        req.user!.sub,
        input,
        undefined,
        true,
      ),
    );
  },
);
