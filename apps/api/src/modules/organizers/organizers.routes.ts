import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { organizerProfileSchema } from './organizers.schemas.js';
import { createOrganizerProfile } from './organizers.service.js';

const router = Router();

router.post(
  '/profile',
  requireAuth(['customer', 'organizer']),
  validateBody(organizerProfileSchema),
  async (request, response) => {
    const result = await createOrganizerProfile(
      request.user!.sub,
      request.body,
    );
    response
      .status(result.created ? 201 : 200)
      .json({ organizer: result.organizer });
  },
);

export default router;
