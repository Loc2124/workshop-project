import { z } from 'zod';

export const organizerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  district: z.string().trim().max(100).optional().nullable(),
});

export type OrganizerProfileInput = z.infer<typeof organizerProfileSchema>;
