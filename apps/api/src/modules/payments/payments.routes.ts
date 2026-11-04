import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { confirmMockPayment } from './payments.service.js';

const router = Router();

router.post(
  '/mock/:orderCode/confirm',
  requireAuth(['customer']),
  async (request, response) => {
    response.json(
      await confirmMockPayment(
        request.user!.sub,
        String(request.params.orderCode),
      ),
    );
  },
);

export default router;
