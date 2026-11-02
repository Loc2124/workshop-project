import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createReportSchema } from '@workshop/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { createReport } from './reports.repository.js';
import {
  reserveReportImage,
  confirmReportImage,
  deleteReportImage,
} from './report-storage.js';
const router = Router();
router.use(requireAuth());
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    keyGenerator: (request) => request.user!.sub,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
router.post('/', validateBody(createReportSchema), async (req, res) =>
  res.status(201).json(await createReport(req.user!.sub, req.body)),
);
router.post(
  '/attachments/upload-url',
  validateBody(
    z.object({ byteSize: z.number().int().min(30).max(1048576) }).strict(),
  ),
  async (req, res) =>
    res.json(await reserveReportImage(req.user!.sub, req.body.byteSize)),
);
router.post(
  '/attachments/:id/confirm',
  validateUuidParam('id'),
  async (req, res) =>
    res.json(await confirmReportImage(String(req.params.id), req.user!.sub)),
);
router.delete('/attachments/:id', validateUuidParam('id'), async (req, res) =>
  res.json(await deleteReportImage(String(req.params.id), req.user!.sub)),
);
export default router;
