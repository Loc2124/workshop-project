import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { studioProfileSchema } from './studios.schemas.js';
import { registerStudio } from './studios.service.js';

const router = Router();

router.post(
  '/',
  requireAuth(['customer', 'admin']),
  validateBody(studioProfileSchema),
  async (request, response) => {
    const result = await registerStudio(request.user!.sub, request.body);
    response.status(201).json(result);
  },
);

export default router;
