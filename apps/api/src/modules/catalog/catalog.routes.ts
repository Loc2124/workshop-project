import { Router } from 'express';
import { publicFeatured } from '../admin/featured.repository.js';
import { query } from '../../db/pool.js';
import { listCategories } from './categories.repository.js';
import { AppError } from '../../errors/app-error.js';
import {
  catalogQuerySchema,
  provinceListQuerySchema,
  toCatalogFilters,
} from './catalog.schemas.js';
import {
  listPublicWorkshops,
  listPublicStudios,
  readPublicStudio,
  readAreas,
  readProvinces,
  readPublicWorkshop,
} from './catalog.service.js';

const router = Router();
router.get('/home/featured', async (_req, res) =>
  res.set('Cache-Control', 'no-store').json(await publicFeatured()),
);
router.get('/workshops/:id/reviews', async (request, response) => {
  const result = await query(
    `SELECT rev.id,u.full_name AS author,rev.rating,coalesce(rev.comment,'') AS comment,rev.created_at AS "createdAt" FROM reviews rev JOIN users u ON u.id=rev.user_id JOIN workshops w ON w.id=rev.workshop_id JOIN studios st ON st.id=w.studio_id WHERE (w.id::text=$1 OR w.slug=$1) AND NOT rev.is_hidden AND w.status='approved' AND NOT w.is_simulated AND w.visibility_status='active' AND w.publication_status='published' AND st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft AND studio_profile_complete(st) ORDER BY rev.created_at DESC,rev.id LIMIT 100`,
    [String(request.params.id)],
  );
  response.json({ reviews: result.rows });
});

router.get('/categories', async (_request, response) => {
  response.json({ categories: await listCategories() });
});

router.get('/provinces', async (request, response) => {
  const parsed = provinceListQuerySchema.safeParse(request.query);
  if (!parsed.success) throw parsed.error;
  response.json(await readProvinces(parsed.data.include_empty === 'true'));
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

  response.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
  );
  response.json(await listPublicWorkshops(toCatalogFilters(parsed.data)));
});

router.get('/catalog/studios', async (request, response) => {
  const parsed = catalogQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw parsed.error;
  }

  response.json(await listPublicStudios(toCatalogFilters(parsed.data)));
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
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy studio.');
  }

  response.json(await readPublicStudio(studioId));
});

export default router;
