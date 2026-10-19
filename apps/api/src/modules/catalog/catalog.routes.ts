import { Router } from 'express';
import { AppError } from '../../errors/app-error.js';
import { catalogQuerySchema, toCatalogFilters } from './catalog.schemas.js';
import { listPublicWorkshops, readPublicWorkshop } from './catalog.service.js';

const router = Router();

router.get('/workshops', async (request, response) => {
  const parsed = catalogQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw parsed.error;
  }

  response.json(await listPublicWorkshops(toCatalogFilters(parsed.data)));
});

router.get('/workshops/:id', async (request, response) => {
  const workshopId = request.params.id;
  if (
    !workshopId ||
    Array.isArray(workshopId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workshopId,
    )
  ) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }

  response.json(await readPublicWorkshop(workshopId));
});

export default router;
