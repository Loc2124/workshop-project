import { z } from 'zod';

export const organizerStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
]);

export const updateOrganizerStatusSchema = z.object({
  status: organizerStatusSchema,
});

export type OrganizerApprovalStatus = z.infer<typeof organizerStatusSchema>;
