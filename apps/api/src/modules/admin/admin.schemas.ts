import { adminListFields } from './admin-list-query.js';
import { z } from 'zod';
import {
  studioReviewStatusSchema,
  studioReviewDecisionSchema,
} from '@workshop/shared';

export const studioStatusSchema = studioReviewStatusSchema;

export const updateStudioStatusSchema = studioReviewDecisionSchema;

const page = adminListFields.page.optional();
const pageSize = adminListFields.pageSize.optional();
const sortSchema = (fields: string[]) =>
  z
    .string()
    .max(100)
    .refine((value) => {
      const [field, direction, extra] = value.split(':');
      return (
        fields.includes(field) && ['asc', 'desc'].includes(direction) && !extra
      );
    }, 'Invalid sort column or direction.')
    .optional();
const listFields = {
  page,
  pageSize,
  q: z.string().trim().max(200).optional(),
  provinceId: z.string().trim().min(1).max(100).optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  period: z.enum(['7d', 'today']).optional(),
  reviewQueue: z.enum(['overdue', 'resubmitted']).optional(),
};
export const adminStudioListQuerySchema = z
  .object({
    ...listFields,
    status: z.union([studioStatusSchema, z.literal('all')]).default('all'),
    sort: sortSchema([
      'name',
      'ownerFullName',
      'submittedAt',
      'province',
      'createdAt',
      'status',
    ]),
  })
  .strict();
export const adminWorkshopListQuerySchema = z
  .object({
    ...listFields,
    status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
    sort: sortSchema([
      'title',
      'studioName',
      'basePrice',
      'province',
      'createdAt',
      'status',
    ]),
  })
  .strict();
export type AdminStudioListQuery = Partial<
  z.infer<typeof adminStudioListQuerySchema>
>;
export type AdminRecordKind = 'users' | 'bookings' | 'reports';
export function adminRecordQuerySchema(kind: AdminRecordKind) {
  const statuses =
    kind === 'users'
      ? ['all', 'customer', 'studio_owner', 'admin']
      : kind === 'bookings'
        ? ['all', 'pending', 'paid', 'expired', 'cancelled', 'refund_needed']
        : ['all', 'pending', 'resolved', 'dismissed'];
  const sorts =
    kind === 'users'
      ? ['fullName', 'email', 'role', 'createdAt']
      : kind === 'bookings'
        ? ['createdAt', 'totalAmount', 'status', 'workshopTitle']
        : ['createdAt', 'status'];
  return z
    .object({
      page,
      pageSize,
      q: z.string().trim().max(200).optional(),
      period: z.enum(['7d', 'today']).optional(),
      status: z.enum(statuses).optional(),
      sort: sortSchema(sorts),
    })
    .strict();
}
export type AdminRecordQuery = z.infer<
  ReturnType<typeof adminRecordQuerySchema>
>;

export const updateWorkshopStatusSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.status === 'rejected' && !decision.reason) {
      context.addIssue({
        code: 'custom',
        message: 'A reason is required when rejecting a workshop.',
        path: ['reason'],
      });
    }
    if (decision.status === 'approved' && decision.reason) {
      context.addIssue({
        code: 'custom',
        message: 'A reason is only accepted when rejecting a workshop.',
        path: ['reason'],
      });
    }
  });

export type StudioApprovalStatus = z.infer<typeof studioStatusSchema>;
export type AdminWorkshopListQuery = z.infer<
  typeof adminWorkshopListQuerySchema
>;
export type WorkshopDecision = z.infer<typeof updateWorkshopStatusSchema>;
