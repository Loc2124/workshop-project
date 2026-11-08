import { Router } from 'express';
import { depositSettingsRouter } from './deposit-settings.js';
import { payoutAccountsRouter } from './payout-accounts.js';
import {
  createStudioEvidenceSchema,
  createStudioRegistrationSchema,
} from '@workshop/shared';
import { getSiteSettings } from '../settings/settings.repository.js';
import { submitStudioEvidence } from './studios.service.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { requireAuth } from '../../middleware/auth.js';
import { registerStudio, startStudioDraft } from './studios.service.js';

const router = Router();
router.use(depositSettingsRouter);
router.use(payoutAccountsRouter);
router.post(
  '/drafts',
  requireAuth(['customer', 'studio_owner', 'admin']),
  async (request, response) => {
    response.status(201).json(await startStudioDraft(request.user!.sub));
  },
);

router.patch(
  '/:studioId/evidence',
  requireAuth(['customer', 'studio_owner', 'admin']),
  validateUuidParam('studioId'),
  async (request, response) => {
    response.json(
      await submitStudioEvidence(
        String(request.params.studioId),
        request.user!.sub,
        createStudioEvidenceSchema((await getSiteSettings()).studio).parse(
          request.body,
        ),
      ),
    );
  },
);

router.post(
  '/',
  requireAuth(['customer', 'studio_owner', 'admin']),
  async (request, response) => {
    const result = await registerStudio(
      request.user!.sub,
      createStudioRegistrationSchema((await getSiteSettings()).studio).parse({
        categoryId: 'other',
        ...request.body,
      }),
    );
    response.status(201).json(result);
  },
);

export default router;
