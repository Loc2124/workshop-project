import { Router } from 'express';
import { listCategories } from './categories.repository.js';
import { AppError } from '../../errors/app-error.js';
import { catalogQuerySchema, toCatalogFilters } from './catalog.schemas.js';
import {
  listPublicWorkshops,
  readPublicStudio,
  readAreas,
  readProvinces,
  readPublicWorkshop,
} from './catalog.service.js';

const router = Router();

router.get('/categories', async (_request, response) => {
  response.json({ categories: await listCategories() });
});

router.get('/provinces', async (_request, response) => {
  response.json(await readProvinces());
});

router.get('/provinces/:id/areas', async (request, response) => {
  const provinceId = request.params.id;
  if (!provinceId || Array.isArray(provinceId)) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tỉnh/thành.');
  }
  response.json(await readAreas(provinceId));
});

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
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(workshopId)
  ) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
  }

  response.json(await readPublicWorkshop(workshopId));
});

router.get('/studios/:id', async (request, response) => {
  const studioId = request.params.id;
  if (
    !studioId ||
    Array.isArray(studioId) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(studioId)
  ) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy xưởng.');
  }

  response.json(await readPublicStudio(studioId));
});

export default router;
