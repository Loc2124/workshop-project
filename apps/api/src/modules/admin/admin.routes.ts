import {
  countStudiosForAdmin,
  listWorkshopsForAdmin as selectWorkshopCounts,
} from './admin.repository.js';
import { selectAdminRecords } from './admin-records.repository.js';
import { Router } from 'express';
import { financialLedgerRouter } from './financial-ledger.js';
import { createAdminRateLimiter } from '../../middleware/rate-limits.js';
import {
  categoryListQuery,
  listCategoryItems,
  templateListQuery,
  listTemplateItems,
} from './admin-config-lists.js';
import { siteSettingsSchema } from '@workshop/shared';
import {
  getAdminSettings,
  saveSiteSettings,
} from '../settings/settings.repository.js';
import {
  auditQuery,
  listAuditLogs,
  getAuditLog,
  auditFilterOptions,
} from './admin-audit.js';
import {
  messageTemplateKeySchema,
  messageTemplateEditSchema,
  templateSave,
  templateReset,
  previewMessageTemplate,
  saveMessageTemplate,
} from './message-templates.js';
import {
  featuredSelection,
  featuredSave,
  featuredSearch,
  getFeatured,
  searchFeatured,
  saveFeatured,
  publicFeatured,
} from './featured.repository.js';
import {
  reportsQuery,
  reportDecision,
  listReports,
  getReport,
  addReportNote,
  actOnReport,
} from '../reports/reports.repository.js';
import { setStudioVisibility } from './studio-visibility.js';
import {
  categoryEdit,
  categoryVisibility,
  categoryOrder,
  saveCategory,
  setCategoryVisibility,
  reorderCategories,
} from './admin-categories.js';
import {
  userListQuery,
  userAction,
  listAdminUsers,
  moderateUser,
} from './admin-users.js';
import {
  adminBookingsQuery,
  adminBookingDecision,
  listAdminBookings,
  getAdminBooking,
  changeAdminBooking,
} from './admin-bookings.js';
import {
  moderationQuery,
  moderationDecision,
  listModeratedWorkshops,
  moderatedWorkshopDetail,
  moderateWorkshop,
  workshopStudioOptions,
  studioOptionsQuery,
} from './workshop-moderation.js';
import { z } from 'zod';
import { studioVerificationDecisionSchema } from '@workshop/shared';
import { setStudioVerification } from './admin.service.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import {
  adminWorkshopListQuerySchema,
  adminStudioListQuerySchema,
  adminRecordQuerySchema,
  updateStudioStatusSchema,
  updateWorkshopStatusSchema,
} from './admin.schemas.js';
import {
  getStudiosForAdmin,
  getWorkshopsForAdmin,
  setStudioStatus,
  setWorkshopStatus,
  getAdminOverview,
  getAdminRecords,
  getStudioForAdmin,
} from './admin.service.js';

async function adminItems(
  promise: Promise<{ rows: unknown[]; total: number }>,
) {
  const data = await promise;
  return { items: data.rows, total: data.total };
}
async function adminRecordItems(
  kind: import('./admin.schemas.js').AdminRecordKind,
  filters: import('./admin.schemas.js').AdminRecordQuery,
) {
  const data = await getAdminRecords(kind, filters);
  return { items: data.rows, total: data.pagination.total };
}
const router = Router();
router.use(requireAuth(), requireRole('admin'));
router.use(createAdminRateLimiter());
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use('/tai-chinh', financialLedgerRouter);
router.get('/studios/counts', async (req, res) =>
  res.json({
    counts: await countStudiosForAdmin(
      adminStudioListQuerySchema.parse(req.query),
    ),
  }),
);
router.get('/workshops/counts', async (req, res) =>
  res.json({
    counts: (
      await selectWorkshopCounts(
        adminWorkshopListQuerySchema.parse(req.query),
        true,
      )
    ).statusCounts,
  }),
);
router.get('/nguoi-dung/counts', async (req, res) =>
  res.json({
    counts: (await listAdminUsers(userListQuery.parse(req.query), true))
      .statusCounts,
  }),
);
router.get('/dat-cho/counts', async (req, res) =>
  res.json({
    counts: (await listAdminBookings(adminBookingsQuery.parse(req.query), true))
      .statusCounts,
  }),
);
router.get('/workshop/counts', async (req, res) =>
  res.json({
    counts: (
      await listModeratedWorkshops(moderationQuery.parse(req.query), true)
    ).statusCounts,
  }),
);
router.get('/bao-cao/counts', async (req, res) =>
  res.json({
    counts: (await listReports(reportsQuery.parse(req.query), true))
      .statusCounts,
  }),
);
for (const kind of ['users', 'bookings', 'reports'] as const)
  router.get(`/${kind}/counts`, async (req, res) =>
    res.json({
      counts: (
        await selectAdminRecords(
          kind,
          adminRecordQuerySchema(kind).parse(req.query),
          true,
        )
      ).statusCounts,
    }),
  );
router.get('/cai-dat', async (_req, res) =>
  res.set('Cache-Control', 'no-store').json(await getAdminSettings()),
);
router.put(
  '/cai-dat',

  validateBody(
    z
      .object({
        settings: siteSettingsSchema,
        expectedVersion: z.string().regex(/^\d+$/),
      })
      .strict(),
  ),
  async (req, res) => res.json(await saveSiteSettings(req.user!.sub, req.body)),
);
router.get('/nhat-ky/filters', async (req, res) =>
  res
    .set('Cache-Control', 'no-store')
    .json(
      await auditFilterOptions(
        z.string().trim().max(200).default('').parse(req.query.q),
      ),
    ),
);
router.get('/nhat-ky', async (req, res) =>
  res
    .set('Cache-Control', 'no-store')
    .json(await adminItems(listAuditLogs(auditQuery.parse(req.query)))),
);
router.get(
  '/nhat-ky/:id',

  validateUuidParam('id'),
  async (req, res) =>
    res
      .set('Cache-Control', 'no-store')
      .json(await getAuditLog(String(req.params.id))),
);
router.get('/mau-thong-bao', async (req, res) =>
  res
    .set('Cache-Control', 'no-store')
    .json(await listTemplateItems(templateListQuery.parse(req.query))),
);
router.put(
  '/mau-thong-bao/:key',

  validateBody(templateSave),
  async (req, res) =>
    res.json(
      await saveMessageTemplate(
        messageTemplateKeySchema.parse(req.params.key),
        req.user!.sub,
        req.body,
      ),
    ),
);
router.post(
  '/mau-thong-bao/:key/preview',

  validateBody(messageTemplateEditSchema),
  async (req, res) =>
    res
      .set('Cache-Control', 'no-store')
      .json(
        previewMessageTemplate(
          messageTemplateKeySchema.parse(req.params.key),
          req.body,
        ),
      ),
);
router.post(
  '/mau-thong-bao/:key/reset',

  validateBody(templateReset),
  async (req, res) =>
    res.json(
      await saveMessageTemplate(
        messageTemplateKeySchema.parse(req.params.key),
        req.user!.sub,
        req.body,
        true,
      ),
    ),
);
router.get('/noi-dung', async (_req, res) =>
  res.set('Cache-Control', 'no-store').json(await getFeatured()),
);
router.get('/noi-dung/search', async (req, res) =>
  res
    .set('Cache-Control', 'no-store')
    .json(await searchFeatured(featuredSearch.parse(req.query))),
);
router.put(
  '/noi-dung',

  validateBody(featuredSave),
  async (req, res) => res.json(await saveFeatured(req.user!.sub, req.body)),
);
router.post(
  '/noi-dung/preview',

  validateBody(featuredSelection),
  async (req, res) =>
    res.set('Cache-Control', 'no-store').json(await publicFeatured(req.body)),
);
router.get('/bao-cao', async (req, res) =>
  res
    .set('Cache-Control', 'no-store')
    .json(await adminItems(listReports(reportsQuery.parse(req.query)))),
);
router.get(
  '/bao-cao/:id',

  validateUuidParam('id'),
  async (req, res) =>
    res
      .set('Cache-Control', 'no-store')
      .json(await getReport(String(req.params.id))),
);
router.post(
  '/bao-cao/:id/notes',

  validateUuidParam('id'),
  validateBody(z.object({ body: z.string().trim().min(2).max(3000) }).strict()),
  async (req, res) =>
    res
      .status(201)
      .json(
        await addReportNote(
          String(req.params.id),
          req.user!.sub,
          req.body.body,
        ),
      ),
);
router.patch(
  '/bao-cao/:id/action',

  validateUuidParam('id'),
  validateBody(reportDecision),
  async (req, res) =>
    res.json(await actOnReport(String(req.params.id), req.user!.sub, req.body)),
);
router.patch(
  '/studios/:id/visibility',

  validateUuidParam('id'),
  validateBody(
    z
      .object({
        hidden: z.boolean(),
        reason: z.string().trim().min(10).max(1000),
      })
      .strict(),
  ),
  async (req, res) =>
    res.json(
      await setStudioVisibility(
        String(req.params.id),
        req.user!.sub,
        req.body.hidden,
        req.body.reason,
      ),
    ),
);
router.get('/danh-muc/counts', async (req, res) =>
  res.json({
    counts: (await listCategoryItems(categoryListQuery.parse(req.query), true))
      .counts,
  }),
);
router.get('/danh-muc', async (req, res) => {
  const { items, total } = await listCategoryItems(
    categoryListQuery.parse(req.query),
  );
  res.json({ items, total });
});
router.post(
  '/danh-muc',

  validateBody(categoryEdit),
  async (req, res) =>
    res.status(201).json(await saveCategory(null, req.user!.sub, req.body)),
);
router.patch(
  '/danh-muc/order',

  validateBody(categoryOrder),
  async (req, res) =>
    res.json(await reorderCategories(req.user!.sub, req.body)),
);
router.patch(
  '/danh-muc/:id/visibility',

  validateBody(categoryVisibility),
  async (req, res) =>
    res.json(
      await setCategoryVisibility(
        String(req.params.id),
        req.user!.sub,
        req.body.visible,
      ),
    ),
);
router.patch(
  '/danh-muc/:id',

  validateBody(categoryEdit),
  async (req, res) =>
    res.json(
      await saveCategory(String(req.params.id), req.user!.sub, req.body),
    ),
);
router.delete('/danh-muc/:id', async () => {
  throw new AppError(
    400,
    'BAD_REQUEST',
    'Không xóa loại workshop. Hãy ẩn loại để giữ dữ liệu workshop và studio đang dùng.',
  );
});
router.get('/nguoi-dung', async (req, res) =>
  res.json(await adminItems(listAdminUsers(userListQuery.parse(req.query)))),
);
router.patch(
  '/nguoi-dung/:id',

  validateUuidParam('id'),
  validateBody(userAction),
  async (req, res) =>
    res.json(
      await moderateUser(String(req.params.id), req.user!.sub, req.body),
    ),
);
router.get('/dat-cho', async (req, res) =>
  res.json(
    await adminItems(listAdminBookings(adminBookingsQuery.parse(req.query))),
  ),
);
router.get(
  '/dat-cho/:id',

  validateUuidParam('id'),
  async (req, res) => res.json(await getAdminBooking(String(req.params.id))),
);
router.patch(
  '/dat-cho/:id/status',

  validateUuidParam('id'),
  validateBody(adminBookingDecision),
  async (req, res) =>
    res.json(
      await changeAdminBooking(String(req.params.id), req.user!.sub, req.body),
    ),
);
router.get('/workshop', async (req, res) =>
  res.json(
    await adminItems(listModeratedWorkshops(moderationQuery.parse(req.query))),
  ),
);
router.get('/workshop-studios', async (req, res) =>
  res.json(await workshopStudioOptions(studioOptionsQuery.parse(req.query))),
);
router.get(
  '/workshop/:id',

  validateUuidParam('id'),
  async (req, res) =>
    res.json(await moderatedWorkshopDetail(String(req.params.id))),
);
router.patch(
  '/workshop/:id/visibility',

  validateUuidParam('id'),
  validateBody(moderationDecision),
  async (req, res) =>
    res.json(
      await moderateWorkshop(String(req.params.id), req.user!.sub, req.body),
    ),
);
router.get(
  '/studios/:id',

  validateUuidParam('id'),
  async (request, response) =>
    response.json(await getStudioForAdmin(String(request.params.id))),
);
router.get('/overview', async (_request, response) => {
  response.json(await getAdminOverview());
});
for (const kind of ['users', 'bookings', 'reports'] as const) {
  router.get(`/${kind}`, async (request, response) =>
    response.json(
      await adminRecordItems(
        kind,
        adminRecordQuerySchema(kind).parse(request.query),
      ),
    ),
  );
}

router.patch(
  '/studios/:id/verification',

  validateUuidParam('id'),
  validateBody(studioVerificationDecisionSchema),
  async (request, response) => {
    response.json(
      await setStudioVerification(
        String(request.params.id),
        request.user!.sub,
        request.body,
      ),
    );
  },
);

router.get('/studios', async (req, res) => {
  const filters = adminStudioListQuerySchema.parse(req.query);
  const data = await getStudiosForAdmin(undefined, {
    ...filters,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
  });
  res.json({ items: data.studios, total: data.pagination!.total });
});

router.patch(
  '/studios/:id/status',

  validateUuidParam('id'),
  validateBody(updateStudioStatusSchema),
  async (request, response) => {
    const studioId = request.params.id;
    if (!studioId || Array.isArray(studioId)) {
      throw new AppError(400, 'BAD_REQUEST', 'ID không hợp lệ.');
    }

    const result = await setStudioStatus(
      studioId,
      request.body.status,
      request.user!.sub,
      request.body.reason,
    );
    response.json(result);
  },
);

router.get('/workshops', async (request, response) => {
  const parsed = adminWorkshopListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw parsed.error;
  }
  const data = await getWorkshopsForAdmin(parsed.data);
  response.json({ items: data.workshops, total: data.pagination.total });
});

router.patch(
  '/workshops/:id/status',

  validateUuidParam('id'),
  validateBody(updateWorkshopStatusSchema),
  async (request, response) => {
    const workshopId = request.params.id;
    if (!workshopId || Array.isArray(workshopId)) {
      throw new AppError(400, 'BAD_REQUEST', 'ID không hợp lệ.');
    }

    response.json(
      await setWorkshopStatus(workshopId, request.user!.sub, request.body),
    );
  },
);

export default router;
