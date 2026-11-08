import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import {
  listCustomerSeats,
  quoteSeatCancellation,
  cancelBookingSeats,
} from './partial-seats.repository.js';
import { refreshPartialCheckout } from './partial-checkout.service.js';
export const partialSeatsRouter = Router();
const selected = z
  .object({
    sequences: z
      .array(z.number().int().min(1).max(10))
      .min(1)
      .max(10)
      .refine(
        (values) => new Set(values).size === values.length,
        'Mỗi chỗ chỉ chọn một lần.',
      ),
  })
  .strict();
partialSeatsRouter.use(
  '/bookings/:id/seats',
  requireAuth(['customer']),
  validateUuidParam('id'),
);
partialSeatsRouter.get('/bookings/:id/seats', async (req, res) => {
  res
    .set('Cache-Control', 'no-store')
    .json(await listCustomerSeats(req.user!.sub, String(req.params.id)));
});
partialSeatsRouter.post(
  '/bookings/:id/seats/cancellation-quote',
  async (req, res) => {
    const input = selected.parse(req.body);
    res
      .set('Cache-Control', 'no-store')
      .json(
        await quoteSeatCancellation(
          req.user!.sub,
          String(req.params.id),
          input.sequences,
        ),
      );
  },
);
partialSeatsRouter.post('/bookings/:id/seats/cancel', async (req, res) => {
  const input = selected
    .extend({ quoteToken: z.string().min(1).max(2000) })
    .parse(req.body);
  const result = await cancelBookingSeats(
    req.user!.sub,
    String(req.params.id),
    input.sequences,
    input.quoteToken,
  );
  const checkout = result.paymentId
    ? await refreshPartialCheckout(req.user!.sub, String(req.params.id))
    : { checkoutState: 'unavailable' };
  res.json({ ...result, ...checkout, paymentId: undefined });
});
partialSeatsRouter.post(
  '/bookings/:id/deposit-checkout',
  requireAuth(['customer']),
  validateUuidParam('id'),
  async (req, res) => {
    res.json(
      await refreshPartialCheckout(req.user!.sub, String(req.params.id)),
    );
  },
);
