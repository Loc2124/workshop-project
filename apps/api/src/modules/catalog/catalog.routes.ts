import { Router } from 'express';
import { createHash } from 'node:crypto';
import { requireAuth } from '../../middleware/auth.js';
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
router.get(
  '/workshops/:id/schedule-subscription/unsubscribe',
  async (request, response) => {
    const workshopId = String(request.params.id);
    const token =
      typeof request.query.token === 'string' ? request.query.token : '';
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        workshopId,
      )
    )
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
    if (!/^[a-f0-9]{64}$/i.test(token))
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Liên kết hủy nhận thông báo không hợp lệ.',
      );
    const result = await query(
      `DELETE FROM workshop_schedule_subscriptions sub
     USING workshop_schedule_unsubscribe_tokens token
     WHERE sub.workshop_id=$1 AND token.workshop_id=sub.workshop_id
       AND token.user_id=sub.user_id AND token.token_hash=$2
     RETURNING sub.workshop_id`,
      [workshopId, createHash('sha256').update(token).digest('hex')],
    );
    response
      .type('html')
      .send(
        result.rowCount
          ? '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Đã hủy đăng ký</title><body style="font:16px Arial;background:#FFFBF2;color:#1C1A16;padding:32px"><h1>Đã hủy nhận thông báo lịch mới</h1><p>Bạn sẽ không nhận email lịch mới cho workshop này nữa.</p></body></html>'
          : '<!doctype html><html lang="vi"><meta charset="utf-8"><title>Liên kết đã dùng</title><body style="font:16px Arial;background:#FFFBF2;color:#1C1A16;padding:32px"><h1>Liên kết đã được dùng hoặc không hợp lệ</h1></body></html>',
      );
  },
);
router.post(
  '/workshops/:id/schedule-subscription',
  requireAuth(['customer']),
  async (request, response) => {
    const id = String(request.params.id);
    if (!/^[a-f0-9-]{36}$/i.test(id))
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
    const result = await query(
      `INSERT INTO workshop_schedule_subscriptions (workshop_id,user_id)
     SELECT w.id,$2 FROM workshops w JOIN studios st ON st.id=w.studio_id
     WHERE w.id=$1 AND w.status='approved' AND NOT w.is_simulated
       AND w.visibility_status='active' AND w.publication_status='published'
       AND st.status='approved' AND NOT st.is_hidden AND NOT st.is_draft
     ON CONFLICT (workshop_id,user_id) DO NOTHING RETURNING workshop_id`,
      [id, request.user!.sub],
    );
    if (!result.rowCount) {
      const existing = await query(
        'SELECT 1 FROM workshop_schedule_subscriptions WHERE workshop_id=$1 AND user_id=$2',
        [id, request.user!.sub],
      );
      if (!existing.rowCount)
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy workshop.');
    }
    response.status(201).json({ subscribed: true });
  },
);
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
