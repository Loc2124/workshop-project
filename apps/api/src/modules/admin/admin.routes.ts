import { Router } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import {
  organizerStatusSchema,
  updateOrganizerStatusSchema,
} from './admin.schemas.js';
import { getOrganizersForAdmin, setOrganizerStatus } from './admin.service.js';

const router = Router();

router.get('/organizers', requireAuth(['admin']), async (request, response) => {
  const rawStatus = request.query.status;
  let status: 'pending' | 'approved' | 'rejected' | undefined;

  if (Array.isArray(rawStatus)) {
    throw new AppError(400, 'BAD_REQUEST', 'Trạng thái duyệt không hợp lệ.');
  }

  if (typeof rawStatus === 'string' && rawStatus.length > 0) {
    const parsed = organizerStatusSchema.safeParse(rawStatus);
    if (!parsed.success) {
      throw new AppError(400, 'BAD_REQUEST', 'Trạng thái duyệt không hợp lệ.');
    }

    status = parsed.data;
  }

  const result = await getOrganizersForAdmin(status);
  response.json(result);
});

router.patch(
  '/organizers/:id/status',
  requireAuth(['admin']),
  validateBody(updateOrganizerStatusSchema),
  async (request, response) => {
    const organizerId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;

    if (!organizerId) {
      throw new AppError(400, 'BAD_REQUEST', 'Thiếu ID đơn vị tổ chức.');
    }

    const result = await setOrganizerStatus(organizerId, request.body.status);
    response.json(result);
  },
);

export default router;
