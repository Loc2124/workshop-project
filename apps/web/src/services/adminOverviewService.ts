import { z } from 'zod';
import { apiFetch, ApiResponseError } from '../lib/api-client';
const count = z.number().int().nonnegative();
const schema = z.object({
  generatedAt: z.string(),
  metrics: z.object({
    pendingStudios: count,
    newWorkshops: count,
    todayBookings: count,
    newUsers: count,
  }),
  tasks: z.object({
    overdueStudios: count,
    openReports: count,
    resubmittedStudios: count,
  }),
  activities: z
    .array(
      z.object({
        id: z.string(),
        actorName: z.string(),
        action: z.string(),
        entityType: z.string(),
        entityId: z.string(),
        entityName: z.string(),
        createdAt: z.string(),
      }),
    )
    .max(10),
  bookingSeries: z.array(z.object({ date: z.string(), count })),
});
export type AdminOverview = z.infer<typeof schema>;
export async function getAdminOverview(
  signal?: AbortSignal,
): Promise<AdminOverview> {
  const result = schema.safeParse(
    await apiFetch('/admin/overview', { signal }),
  );
  if (!result.success) throw new ApiResponseError();
  return result.data;
}
