import { z } from 'zod';

export const studioProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  categoryId: z.string().trim().min(1).max(100).default('other'),
  description: z.string().trim().max(2000).optional().nullable(),
  provinceId: z.string().trim().min(1).max(100),
  areaId: z.string().uuid().optional().nullable(),
  address: z.string().trim().min(1).max(500),
});

export type StudioProfileInput = z.infer<typeof studioProfileSchema>;
