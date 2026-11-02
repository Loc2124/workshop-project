import { z } from 'zod';
import type { DataTableFetcher } from '../lib/data-table';
import { createAdminTableFetcher } from './adminTableService';
export type AdminRecordKind = 'users' | 'bookings' | 'reports';
export type AdminRecord = {
  id: string;
  createdAt: string;
  fullName?: string;
  email?: string;
  role?: string;
  customerName?: string;
  workshopTitle?: string;
  studioName?: string;
  quantity?: number;
  totalAmount?: number;
  status?: string;
  startsAt?: string;
  reporterName?: string;
  targetName?: string;
  reason?: string;
};
const base = z.object({ id: z.string().uuid(), createdAt: z.string() });
const schemas = {
  users: base
    .extend({
      fullName: z.string(),
      email: z.string(),
      role: z.enum(['admin', 'customer', 'studio_owner']),
    })
    .strict(),
  bookings: base
    .extend({
      customerName: z.string(),
      workshopTitle: z.string(),
      studioName: z.string(),
      quantity: z.number().int(),
      totalAmount: z.number().int(),
      status: z.string(),
      startsAt: z.string(),
    })
    .strict(),
  reports: base
    .extend({
      reporterName: z.string(),
      targetName: z
        .string()
        .nullable()
        .transform((value) => value ?? 'Nội dung đã xóa'),
      reason: z.string(),
      status: z.string(),
    })
    .strict(),
};
function fetcher(kind: AdminRecordKind): DataTableFetcher<AdminRecord> {
  return createAdminTableFetcher<AdminRecord>(`/admin/${kind}`, schemas[kind]);
}
export const adminRecordsFetchers = {
  users: fetcher('users'),
  bookings: fetcher('bookings'),
  reports: fetcher('reports'),
};
