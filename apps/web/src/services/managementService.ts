import {
  studioTrustLevelSchema,
  studioVerificationDecisionSchema,
  type StudioVerificationDecision,
} from '@workshop/shared';
import { z } from 'zod';
import { ApiResponseError, apiFetch } from '../lib/api-client';
import {
  adminStudioSchema,
  adminWorkshopSchema,
  memberStudioSchema,
  studioSessionSchema,
  studioSessionInputSchema,
  studioSessionUpdateInputSchema,
  studioStatusSchema,
  studioWorkshopSchema,
  studioWorkshopInputSchema,
  studioWorkshopUpdateInputSchema,
  workshopDecisionSchema,
  type AdminStudio,
  type AdminWorkshop,
  type MemberStudio,
  type StudioApprovalStatus,
  type StudioSession,
  type StudioSessionInput,
  type StudioSessionUpdateInput,
  type StudioProfileInput,
  type StudioWorkshop,
  type StudioWorkshopInput,
  type StudioWorkshopUpdateInput,
  type WorkshopDecision,
} from '../types/management';

const memberStudiosResponseSchema = z
  .object({ studios: z.array(memberStudioSchema) })
  .strict();
const studioWorkshopsResponseSchema = z
  .object({ workshops: z.array(studioWorkshopSchema) })
  .strict();
const studioSessionsResponseSchema = z
  .object({ sessions: z.array(studioSessionSchema) })
  .strict();
const adminStudiosResponseSchema = z
  .object({ items: z.array(adminStudioSchema), total: z.number() })
  .strict();
const adminWorkshopsResponseSchema = z
  .object({ items: z.array(adminWorkshopSchema), total: z.number() })
  .strict();
const studioResponseSchema = z.object({ studio: adminStudioSchema }).strict();
const workshopResponseSchema = z
  .object({ workshop: adminWorkshopSchema })
  .strict();
const studioCreationResponseSchema = z
  .object({
    studio: z
      .object({
        id: z.string().uuid(),
        slug: z.string(),
        name: z.string(),
        categoryId: z.string(),
        categoryIds: z.array(z.string()).optional(),
        trustLevel: studioTrustLevelSchema.optional(),
        profileComplete: z.boolean().optional(),
        contactPhone: z.string().nullable().optional(),
        contactEmail: z.string().nullable().optional(),
        photoIds: z.array(z.string().uuid()).optional(),
        paymentQrImageId: z.string().uuid().nullable().optional(),
        paymentQrImageUrl: z.string().nullable().optional(),
        facebookUrl: z.string().nullable().optional(),
        instagramUrl: z.string().nullable().optional(),
        googleMapsUrl: z.string().nullable().optional(),
        images: z
          .array(
            z
              .object({
                id: z.string().uuid(),
                key: z.string(),
                url: z.string().url(),
                thumbnailUrl: z.string().url().optional(),
                mediumUrl: z.string().url().optional(),
              })
              .strict(),
          )
          .optional(),
        proposedCategoryName: z.string().nullable().optional(),
        description: z.string().nullable(),
        provinceId: z.string(),
        areaId: z.string().uuid().nullable(),
        address: z.string(),
        status: studioStatusSchema,
        createdAt: z.string(),
      })
      .strict(),
  })
  .strict();
const sessionMutationResponseSchema = z
  .object({
    session: z
      .object({
        id: z.string().uuid(),
        workshopId: z.string().uuid(),
        startsAt: z.string(),
        endsAt: z.string(),
        price: z.number().int(),
        capacity: z.number().int(),
        seatsHeld: z.number().int(),
        seatsSold: z.number().int(),
        status: z.enum(['scheduled', 'cancelled', 'completed']),
        registrationDeadline: z.string().nullable().optional(),
        scheduleVersion: z.number().int().positive().optional(),
        createdAt: z.string(),
      })
      .strict(),
  })
  .strict();

export type CreatedStudio = z.infer<
  typeof studioCreationResponseSchema
>['studio'];

function parseResponse<T>(schema: z.ZodType<T>, response: unknown): T {
  const parsed = schema.safeParse(response);
  if (!parsed.success) throw new ApiResponseError();
  return parsed.data;
}

export type AdminWorkshopFilters = {
  status?: StudioApprovalStatus;
  page?: number;
  pageSize?: number;
};

function parseStatus(status: StudioApprovalStatus): StudioApprovalStatus {
  return studioStatusSchema.parse(status);
}

export const managementService = {
  async getAdminStudio(
    studioId: string,
    signal?: AbortSignal,
  ): Promise<AdminStudio> {
    return parseResponse(
      studioResponseSchema,
      await apiFetch(`/admin/studios/${encodeURIComponent(studioId)}`, {
        signal,
      }),
    ).studio;
  },
  async createStudio(input: StudioProfileInput): Promise<CreatedStudio> {
    const body = createStudioRegistrationSchema(
      (await fetchSiteSettings()).studio,
    )
      .strict()
      .parse(input);
    const response = await apiFetch<unknown>('/studios', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return parseResponse(studioCreationResponseSchema, response).studio;
  },

  async listMyStudios(signal?: AbortSignal): Promise<MemberStudio[]> {
    const response = await apiFetch<unknown>('/me/studios', { signal });
    return parseResponse(memberStudiosResponseSchema, response).studios;
  },

  async listStudioWorkshops(
    studioId: string,
    signal?: AbortSignal,
  ): Promise<StudioWorkshop[]> {
    const response = await apiFetch<unknown>(
      `/studios/${encodeURIComponent(studioId)}/workshops`,
      { signal },
    );
    return parseResponse(studioWorkshopsResponseSchema, response).workshops;
  },

  async listStudioSessions(
    studioId: string,
    signal?: AbortSignal,
  ): Promise<StudioSession[]> {
    const response = await apiFetch<unknown>(
      `/studios/${encodeURIComponent(studioId)}/sessions`,
      { signal },
    );
    return parseResponse(studioSessionsResponseSchema, response).sessions;
  },

  async saveStudioWorkshop(
    studioId: string,
    workshopId: string | null,
    input: StudioWorkshopInput | StudioWorkshopUpdateInput,
  ): Promise<void> {
    const body = workshopId
      ? studioWorkshopUpdateInputSchema.parse(input)
      : studioWorkshopInputSchema.parse(input);
    const path = `/studios/${encodeURIComponent(studioId)}/workshops${
      workshopId ? `/${encodeURIComponent(workshopId)}` : ''
    }`;
    const response = await apiFetch<unknown>(path, {
      method: workshopId ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    });
    parseResponse(
      z.object({ workshop: studioWorkshopSchema }).strict(),
      response,
    );
  },

  async saveStudioSession(
    studioId: string,
    workshopId: string | null,
    sessionId: string | null,
    input: StudioSessionInput | StudioSessionUpdateInput,
  ): Promise<void> {
    if (!sessionId && !workshopId) {
      throw new Error('Cần chọn workshop trước khi tạo buổi.');
    }
    const body = sessionId
      ? studioSessionUpdateInputSchema.parse(input)
      : studioSessionInputSchema.parse(input);
    const path = sessionId
      ? `/studios/${encodeURIComponent(studioId)}/sessions/${encodeURIComponent(sessionId)}`
      : workshopId
        ? `/studios/${encodeURIComponent(studioId)}/workshops/${encodeURIComponent(workshopId)}/sessions`
        : null;
    if (!path) {
      throw new Error('Cần chọn workshop trước khi tạo buổi.');
    }
    const response = await apiFetch<unknown>(path, {
      method: sessionId ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    });
    parseResponse(sessionMutationResponseSchema, response);
  },

  async cancelStudioSession(
    studioId: string,
    sessionId: string,
  ): Promise<void> {
    const response = await apiFetch<unknown>(
      `/studios/${encodeURIComponent(studioId)}/sessions/${encodeURIComponent(sessionId)}/cancel`,
      { method: 'POST' },
    );
    parseResponse(sessionMutationResponseSchema, response);
  },

  async listAdminStudios(
    status?: StudioApprovalStatus,
    signal?: AbortSignal,
  ): Promise<AdminStudio[]> {
    const query = status
      ? `?status=${encodeURIComponent(parseStatus(status))}`
      : '';
    const response = await apiFetch<unknown>(`/admin/studios${query}`, {
      signal,
    });
    return parseResponse(adminStudiosResponseSchema, response).items;
  },

  async listAdminWorkshops(
    filters: AdminWorkshopFilters = {},
    signal?: AbortSignal,
  ): Promise<{
    workshops: AdminWorkshop[];
    pagination: { page: number; pageSize: number; total: number };
  }> {
    const query = new URLSearchParams();
    if (filters.status) query.set('status', parseStatus(filters.status));
    if (filters.page !== undefined) query.set('page', String(filters.page));
    if (filters.pageSize !== undefined)
      query.set('pageSize', String(filters.pageSize));
    const suffix = query.size ? `?${query.toString()}` : '';
    const response = await apiFetch<unknown>(`/admin/workshops${suffix}`, {
      signal,
    });
    const data = parseResponse(adminWorkshopsResponseSchema, response);
    return {
      workshops: data.items,
      pagination: {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
        total: data.total,
      },
    };
  },

  async setStudioVerification(
    studioId: string,
    input: StudioVerificationDecision,
  ) {
    const decision = studioVerificationDecisionSchema.parse(input);
    const response = await apiFetch<unknown>(
      `/admin/studios/${encodeURIComponent(studioId)}/verification`,
      { method: 'PATCH', body: JSON.stringify(decision) },
    );
    return parseResponse(
      z
        .object({
          verification: z
            .object({
              trustLevel: studioTrustLevelSchema,
              verifiedAt: z.string().nullable(),
            })
            .strict(),
        })
        .strict(),
      response,
    ).verification;
  },

  async setStudioStatus(
    studioId: string,
    status: StudioApprovalStatus,
    reason?: string,
  ): Promise<AdminStudio> {
    const response = await apiFetch<unknown>(
      `/admin/studios/${encodeURIComponent(studioId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: parseStatus(status),
          ...(reason === undefined ? {} : { reason: reason.trim() }),
        }),
      },
    );
    return parseResponse(studioResponseSchema, response).studio;
  },

  async decideWorkshop(
    workshopId: string,
    input: WorkshopDecision,
  ): Promise<AdminWorkshop> {
    const decision = workshopDecisionSchema.parse(input);
    const response = await apiFetch<unknown>(
      `/admin/workshops/${encodeURIComponent(workshopId)}/status`,
      { method: 'PATCH', body: JSON.stringify(decision) },
    );
    return parseResponse(workshopResponseSchema, response).workshop;
  },
};
import { createStudioRegistrationSchema } from '@workshop/shared';
import { fetchSiteSettings } from '../hooks/useSiteSettings';
