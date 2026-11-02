import { Router, type Request } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import {
  createWorkshopSchema,
  updateWorkshopSchema,
} from './workshops.schemas.js';
import {
  createStudioWorkshop,
  getStudioWorkshops,
  updateStudioWorkshop,
} from './workshops.service.js';
import { createStudioSession } from '../sessions/sessions.service.js';
import { createSessionSchema } from '../sessions/sessions.schemas.js';

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
  '/workshops',
  requireAuth(),
  validateUuidParam('studioId'),
  async (request, response) => {
    response.json(
      await getStudioWorkshops(getStudioId(request), request.user!.sub),
    );
  },
);

router.post(
  '/workshops',
  requireAuth(),
  validateUuidParam('studioId'),
  validateBody(createWorkshopSchema),
  async (request, response) => {
    const result = await createStudioWorkshop(
      getStudioId(request),
      request.user!.sub,
      request.body,
    );
    response.status(201).json(result);
  },
);

router.patch(
  '/workshops/:id',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  validateBody(updateWorkshopSchema),
  async (request, response) => {
    response.json(
      await updateStudioWorkshop(
        getStudioId(request),
        request.user!.sub,
        getResourceId(request),
        request.body,
      ),
    );
  },
);

router.post(
  '/workshops/:id/sessions',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('id'),
  validateBody(createSessionSchema),
  async (request, response) => {
    const result = await createStudioSession(
      getStudioId(request),
      request.user!.sub,
      getResourceId(request),
      request.body,
    );
    response.status(201).json(result);
  },
);

export default router;
