import { Router, type Request } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { updateSessionSchema } from './sessions.schemas.js';
import {
  cancelOrganizerSession,
  updateOrganizerSession,
} from './sessions.service.js';

const router = Router();

function getOrganizerId(request: Request): string {
  const organizerId = request.user?.organizerId;
  if (!organizerId) {
    throw new AppError(403, 'FORBIDDEN', 'Tài khoản chưa có hồ sơ đơn vị.');
  }
  return organizerId;
}

function getResourceId(request: Request): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
  }
  return id;
}

router.patch(
  '/sessions/:id',
  requireAuth(['organizer']),
  validateBody(updateSessionSchema),
  async (request, response) => {
    response.json(
      await updateOrganizerSession(
        getOrganizerId(request),
        getResourceId(request),
        request.body,
      ),
    );
  },
);

router.post(
  '/sessions/:id/cancel',
  requireAuth(['organizer']),
  async (request, response) => {
    response.json(
      await cancelOrganizerSession(
        getOrganizerId(request),
        getResourceId(request),
      ),
    );
  },
);

export default router;
