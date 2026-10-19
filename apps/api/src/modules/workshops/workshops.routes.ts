import { Router, type Request } from 'express';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import {
  createWorkshopSchema,
  updateWorkshopSchema,
} from './workshops.schemas.js';
import {
  createOrganizerWorkshop,
  getOrganizerWorkshops,
  updateOrganizerWorkshop,
} from './workshops.service.js';
import { createOrganizerSession } from '../sessions/sessions.service.js';
import { createSessionSchema } from '../sessions/sessions.schemas.js';

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

router.get(
  '/workshops',
  requireAuth(['organizer']),
  async (request, response) => {
    response.json(await getOrganizerWorkshops(getOrganizerId(request)));
  },
);

router.post(
  '/workshops',
  requireAuth(['organizer']),
  validateBody(createWorkshopSchema),
  async (request, response) => {
    const result = await createOrganizerWorkshop(
      getOrganizerId(request),
      request.body,
    );
    response.status(201).json(result);
  },
);

router.patch(
  '/workshops/:id',
  requireAuth(['organizer']),
  validateBody(updateWorkshopSchema),
  async (request, response) => {
    response.json(
      await updateOrganizerWorkshop(
        getOrganizerId(request),
        getResourceId(request),
        request.body,
      ),
    );
  },
);

router.post(
  '/workshops/:id/sessions',
  requireAuth(['organizer']),
  validateBody(createSessionSchema),
  async (request, response) => {
    const result = await createOrganizerSession(
      getOrganizerId(request),
      getResourceId(request),
      request.body,
    );
    response.status(201).json(result);
  },
);

export default router;
