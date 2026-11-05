import { z } from 'zod';
import { apiFetch } from '../lib/api-client';

const paymentSchema = z.object({
  provider: z.string(),
  kind: z.string(),
  amount: z.number().int().nonnegative(),
  status: z.string(),
  checkoutUrl: z.string().url().nullable(),
  qrCode: z.string().nullable().optional(),
  paidAt: z.string().nullable(),
});

const bookingSchema = z.object({
  id: z.uuid(),
  orderCode: z.union([z.string(), z.number()]),
  sessionId: z.uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  depositAmount: z.number().int().nonnegative(),
  paidAmount: z.number().int().nonnegative(),
  balanceAmount: z.number().int().nonnegative(),
  paymentStatus: z.string(),
  reservationStatus: z.string(),
  paymentMode: z.string(),
  holdExpiresAt: z.string(),
  contactName: z.string(),
  contactPhone: z.string(),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  workshopId: z.uuid(),
  workshopTitle: z.string(),
  studioName: z.string(),
  address: z.string().nullable(),
  payments: z.array(paymentSchema),
});

const bookingListSchema = z.object({
  id: z.uuid(),
  orderCode: z.union([z.string(), z.number()]),
  quantity: z.number().int().positive(),
  totalAmount: z.number().int().nonnegative(),
  depositAmount: z.number().int().nonnegative(),
  paidAmount: z.number().int().nonnegative(),
  balanceAmount: z.number().int().nonnegative(),
  paymentStatus: z.string(),
  reservationStatus: z.string(),
  paymentMode: z.string(),
  createdAt: z.string(),
  startsAt: z.string(),
  workshopTitle: z.string(),
  studioName: z.string(),
});

const createdBookingSchema = z.object({
  booking: z.object({
    id: z.uuid(),
    orderCode: z.number().int(),
    paymentMode: z.string(),
    totalAmount: z.number().int().nonnegative(),
    depositAmount: z.number().int().nonnegative(),
    balanceAmount: z.number().int().nonnegative(),
    holdExpiresAt: z.string(),
    checkoutRequired: z.boolean(),
  }),
  checkoutUrl: z.string().url().nullable(),
  checkoutQrCode: z.string().nullable().optional(),
});

const ticketSchema = z.object({
  id: z.uuid(),
  seq: z.number().int().positive(),
  code: z.string().min(1),
  status: z.string(),
  issuedAt: z.string(),
});

export type CustomerBooking = z.infer<typeof bookingSchema>;
export type CustomerTicket = z.infer<typeof ticketSchema>;

export const customerBookingService = {
  async create(input: { sessionId: string; quantity: number }) {
    const response = await apiFetch<unknown>('/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return createdBookingSchema.parse(response);
  },

  async list(signal?: AbortSignal) {
    const response = await apiFetch<unknown>('/me/bookings', { signal });
    return z.object({ bookings: z.array(bookingListSchema) }).parse(response)
      .bookings;
  },

  async get(bookingId: string, signal?: AbortSignal) {
    const response = await apiFetch<unknown>(`/bookings/${bookingId}`, {
      signal,
    });
    return z.object({ booking: bookingSchema }).parse(response).booking;
  },

  async tickets(bookingId: string, signal?: AbortSignal) {
    const response = await apiFetch<unknown>(`/bookings/${bookingId}/tickets`, {
      signal,
    });
    return z.object({ tickets: z.array(ticketSchema) }).parse(response).tickets;
  },

  cancel(bookingId: string) {
    return apiFetch<{ ok: boolean }>(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
    });
  },

  confirmMockPayment(orderCode: string) {
    return apiFetch<{ ok: boolean }>(
      `/payments/mock/${encodeURIComponent(orderCode)}/confirm`,
      { method: 'POST' },
    );
  },
};
