import { Router, type Request } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { updateSessionSchema } from './sessions.schemas.js';
import {
  cancelStudioSession,
  getStudioSessions,
  updateStudioSession,
} from './sessions.service.js';

const router = Router({ mergeParams: true });

function getStudioId(request: Request): string {
  const studioId = request.params.studioId;
  if (!studioId || Array.isArray(studioId)) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }
  return studioId;
}

function getResourceId(request: Request): string {
  const id = request.params.id;
  if (!id || Array.isArray(id)) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
  }
  return id;
}

router.get(
  '/sessions',
  requireAuth(),
  validateUuidParam('studioId'),
  async (request, response) => {
    response.json(
      await getStudioSessions(getStudioId(request), request.user!.sub),
    );
  },
);

router.patch(
  '/sessions/:id',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  validateBody(updateSessionSchema),
  async (request, response) => {
    response.json(
      await updateStudioSession(
        getStudioId(request),
        request.user!.sub,
        getResourceId(request),
        request.body,
      ),
    );
  },
);

router.post(
  '/sessions/:id/cancel',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  async (request, response) => {
    response.json(
      await cancelStudioSession(
        getStudioId(request),
        request.user!.sub,
        getResourceId(request),
      ),
    );
  },
);

export default router;
