import { z } from 'zod';

export const studioStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const updateStudioStatusSchema = z.object({
  status: studioStatusSchema,
});

export type StudioApprovalStatus = z.infer<typeof studioStatusSchema>;
