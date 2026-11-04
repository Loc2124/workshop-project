import { Router } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import {
  cancelBookingForCustomer,
  createCustomerBooking,
  getBookingForCustomer,
  getBookingsForCustomer,
  getTicketsForCustomer,
} from './bookings.service.js';
import { confirmStudioPayment } from '../payments/payments.service.js';
import { listStudioBookings } from './bookings.repository.js';
import {
  confirmStudioPaymentSchema,
  createBookingSchema,
} from './bookings.schemas.js';

const router = Router();

router.get(
  '/studios/:studioId/bookings',
  requireAuth(),
  validateUuidParam('studioId'),
  async (req, res) => {
    const bookings = await listStudioBookings(
      String(req.params.studioId),
      req.user!.sub,
    );
    if (!bookings)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
    res.set('Cache-Control', 'no-store').json({ bookings });
  },
);

router.post(
  '/bookings',
  requireAuth(['customer']),
  validateBody(createBookingSchema),
  async (request, response) => {
    response
      .status(201)
      .json(await createCustomerBooking(request.user!.sub, request.body));
  },
);

router.get(
  '/me/bookings',
  requireAuth(['customer']),
  async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(await getBookingsForCustomer(request.user!.sub));
  },
);

router.get(
  '/bookings/:id',
  requireAuth(['customer']),
  validateUuidParam('id'),
  async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(
      await getBookingForCustomer(request.user!.sub, String(request.params.id)),
    );
  },
);

router.get(
  '/bookings/:id/tickets',
  requireAuth(['customer']),
  validateUuidParam('id'),
  async (request, response) =>
    response.json(
      await getTicketsForCustomer(request.user!.sub, String(request.params.id)),
    ),
);

router.post(
  '/bookings/:id/cancel',
  requireAuth(['customer']),
  validateUuidParam('id'),
  async (request, response) =>
    response.json(
      await cancelBookingForCustomer(
        request.user!.sub,
        String(request.params.id),
      ),
    ),
);

router.post(
  '/studios/:studioId/bookings/:id/confirm-payment',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  validateBody(confirmStudioPaymentSchema),
  async (request, response) => {
    const result = await confirmStudioPayment(
      String(request.params.studioId),
      request.user!.sub,
      String(request.params.id),
      request.body.expectedAmount,
    );
    if (result === 'not_found') {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đặt chỗ.');
    }
    if (result === 'conflict') {
      throw new AppError(
        409,
        'CONFLICT',
        'Khoản thanh toán đã thay đổi hoặc không còn phải thu.',
      );
    }
    response.json({ ok: true });
  },
);

export default router;
