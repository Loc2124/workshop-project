import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import {
  requestImageUpload,
  finishImageUpload,
  deleteOwnedImage,
  listOwnedImages,
} from './images.service.js';

const router = Router();
router.use(requireAuth(['customer', 'studio_owner', 'admin']));
router.get('/', async (request, response) => {
  const input = z
    .object({
      studioId: z.string().uuid(),
      workshopId: z.string().uuid().optional(),
    })
    .strict()
    .parse(request.query);
  response.json(
    await listOwnedImages(input.studioId, request.user!.sub, input.workshopId),
  );
});
router.post(
  '/upload-url',
  rateLimit({ windowMs: 3600000, limit: 30 }),
  validateBody(
    z
      .object({
        studioId: z.string().uuid(),
        workshopId: z.string().uuid().nullable().optional(),
        byteSize: z
          .number()
          .int()
          .positive()
          .max(20 * 1024 * 1024),
      })
      .strict(),
  ),
  async (request, response) => {
    response
      .status(201)
      .json(await requestImageUpload(request.user!.sub, request.body));
  },
);
router.post(
  '/:id/complete',
  validateUuidParam('id'),
  async (request, response) => {
    response.json(
      await finishImageUpload(String(request.params.id), request.user!.sub),
    );
  },
);
router.delete('/:id', validateUuidParam('id'), async (request, response) => {
  await deleteOwnedImage(String(request.params.id), request.user!.sub);
  response.sendStatus(204);
});
export default router;
