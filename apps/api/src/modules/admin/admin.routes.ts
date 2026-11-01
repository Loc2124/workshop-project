import { Router } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import {
  studioStatusSchema,
  updateStudioStatusSchema,
} from './admin.schemas.js';
import { getStudiosForAdmin, setStudioStatus } from './admin.service.js';

const router = Router();

router.get('/studios', requireAuth(['admin']), async (request, response) => {
  const rawStatus = request.query.status;
  let status: 'pending' | 'approved' | 'rejected' | undefined;

  if (Array.isArray(rawStatus)) {
    throw new AppError(400, 'BAD_REQUEST', 'Trạng thái duyệt không hợp lệ.');
  }

  if (typeof rawStatus === 'string' && rawStatus.length > 0) {
    const parsed = studioStatusSchema.safeParse(rawStatus);
    if (!parsed.success) {
      throw new AppError(400, 'BAD_REQUEST', 'Trạng thái duyệt không hợp lệ.');
    }

    status = parsed.data;
  }

  const result = await getStudiosForAdmin(status);
  response.json(result);
});

router.patch(
  '/studios/:id/status',
  requireAuth(['admin']),
  validateBody(updateStudioStatusSchema),
  async (request, response) => {
    const studioId = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;

    if (!studioId) {
      throw new AppError(400, 'BAD_REQUEST', 'Thiếu ID xưởng.');
    }

    const result = await setStudioStatus(studioId, request.body.status);
    response.json(result);
  },
);

export default router;
