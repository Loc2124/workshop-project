import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api-client';
import {
  getBookingRequestId,
  clearBookingRequest,
} from '../lib/booking-request';

const paymentSchema = z.object({
  provider: z.string(),
  kind: z.string(),
  amount: z.number().int().nonnegative(),
  status: z.string(),
  checkoutUrl: z.string().url().nullable(),
  qrCode: z.string().nullable().optional(),
  transferDescription: z.string().nullable().optional(),
  paidAt: z.string().nullable(),
  orderCode: z.union([z.number(), z.string()]).optional(),
  isCurrent: z.boolean().optional(),
  checkoutRevision: z.number().int().optional(),
});

const bookingSchema = z.object({
  id: z.uuid(),
  orderCode: z.union([z.string(), z.number()]),
  sessionId: z.uuid(),
  quantity: z.number().int().positive(),
  originalQuantity: z.number().int().positive().optional(),
  originalTotalAmount: z.number().nonnegative().optional(),
  originalDepositAmount: z.number().nonnegative().optional(),
  remainingQuantity: z.number().int().nonnegative().optional(),
  receivedAmount: z.number().nonnegative().optional(),
  seatRevision: z.number().int().nonnegative().optional(),
  paymentAllowed: z.boolean().optional(),
  checkoutState: z.string().nullable().optional(),
  unitPrice: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
  depositAmount: z.number().int().nonnegative(),
  paidAmount: z.number().int().nonnegative(),
  balanceAmount: z.number().int().nonnegative(),
  paymentStatus: z.string(),
  reservationStatus: z.string(),
  paymentMode: z.string(),
  holdExpiresAt: z.string(),
  serverNow: z.string().optional(),
  depositPercent: z.number().int().min(1).max(50).nullable().optional(),
  depositMode: z.enum(['none', 'optional', 'required']).nullable().optional(),
  releaseIfUnconfirmed: z.boolean().optional(),
  releaseBeforeMinutes: z.number().nullable().optional(),
  refundStatus: z.string().optional(),
  refundDueAmount: z.number().optional(),
  refundedAmount: z.number().optional(),
  hasAttendance: z.boolean().optional(),
  hasAttended: z.boolean().optional(),
  attendanceStatus: z.string().optional(),
  attendanceConfirmedAt: z.string().nullable().optional(),
  attendanceConfirmationDeadline: z.string().nullable().optional(),
  reschedulePending: z.boolean().optional(),
  scheduleVersion: z.number().int().positive().optional(),
  acceptedScheduleVersion: z.number().int().positive().optional(),
  proposedScheduleVersion: z.number().int().positive().nullable().optional(),
  rescheduleDeadline: z.string().nullable().optional(),
  bookedStartsAt: z.string().optional(),
  bookedEndsAt: z.string().optional(),
  cancelledAt: z.string().nullable().optional(),
  originalStartsAt: z.string().nullable().optional(),
  originalEndsAt: z.string().nullable().optional(),
  studioSlug: z.string().optional(),
  studioContactPhone: z.string().nullable().optional(),
  studioContactEmail: z.string().nullable().optional(),
  canRebook: z.boolean().optional(),
  contactName: z.string(),
  contactPhone: z.string(),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  sessionRecordStatus: z.enum(['scheduled', 'cancelled', 'completed']),
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
  endsAt: z.string(),
  sessionRecordStatus: z.enum(['scheduled', 'cancelled', 'completed']),
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
  manualCode: z.string().length(8).optional(),
  status: z.string(),
  issuedAt: z.string(),
  attendanceStatus: z.enum(['unmarked', 'attended', 'absent']).optional(),
  attendanceMethod: z
    .enum(['check_in', 'manual_confirmation'])
    .nullable()
    .optional(),
  attendanceMarkedAt: z.string().nullable().optional(),
  attendanceMarkedBy: z.string().nullable().optional(),
  refundDueAmount: z.number().optional(),
  refundedAmount: z.number().optional(),
});

export type CustomerBooking = z.infer<typeof bookingSchema>;
export type CustomerTicket = z.infer<typeof ticketSchema>;

const cancellationQuoteSchema = z.object({
  quoteToken: z.string(),
  refundDueAmount: z.number().int().nonnegative(),
  retainedAmount: z.number().int().nonnegative(),
  paidAmount: z.number().int().nonnegative(),
  alreadyRefundedAmount: z.number().nonnegative().optional(),
  expiresAt: z.string(),
  serverNow: z.string(),
});
const seatSchema = z.object({
  id: z.uuid(),
  seq: z.number().int(),
  state: z.enum(['active', 'cancelled', 'expired']),
  totalAmount: z.number(),
  depositAmount: z.number(),
  paidAmount: z.number(),
  refundDueAmount: z.number(),
  refundedAmount: z.number(),
  attendanceStatus: z.string(),
  canCancel: z.boolean(),
});
export type CustomerSeat = z.infer<typeof seatSchema>;

export const customerBookingService = {
  async create(
    input: {
      sessionId: string;
      quantity: number;
      paymentChoice?: 'deposit' | 'in_studio';
    },
    userId: string,
    intent: string,
  ) {
    const requestId = getBookingRequestId(userId, intent, input);
    try {
      const response = await apiFetch<unknown>('/bookings', {
        method: 'POST',
        body: JSON.stringify({ ...input, requestId }),
      });
      const result = createdBookingSchema.parse(response);
      clearBookingRequest(userId, intent, input);
      return result;
    } catch (error) {
      if (
        error instanceof ApiError &&
        [400, 403, 404, 409, 422].includes(error.status)
      )
        clearBookingRequest(userId, intent, input);
      throw error;
    }
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

  async cancellationQuote(bookingId: string, signal?: AbortSignal) {
    return z
      .object({ quote: cancellationQuoteSchema })
      .parse(
        await apiFetch(`/bookings/${bookingId}/cancellation-quote`, { signal }),
      ).quote;
  },

  cancel(bookingId: string, quoteToken: string) {
    return apiFetch<{ ok: boolean }>(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ quoteToken }),
    });
  },
  async seats(bookingId: string, signal?: AbortSignal) {
    return z
      .object({ seats: z.array(seatSchema) })
      .parse(await apiFetch(`/bookings/${bookingId}/seats`, { signal })).seats;
  },
  async quoteSeats(
    bookingId: string,
    sequences: number[],
    signal?: AbortSignal,
  ) {
    return z
      .object({
        quote: cancellationQuoteSchema.extend({
          sequences: z.array(z.number()),
          remainingQuantity: z.number().int().nonnegative(),
        }),
      })
      .parse(
        await apiFetch(`/bookings/${bookingId}/seats/cancellation-quote`, {
          method: 'POST',
          body: JSON.stringify({ sequences }),
          signal,
        }),
      ).quote;
  },
  cancelSeats(bookingId: string, sequences: number[], quoteToken: string) {
    return apiFetch<{
      ok: boolean;
      remainingQuantity: number;
      checkoutState: string;
    }>(`/bookings/${bookingId}/seats/cancel`, {
      method: 'POST',
      body: JSON.stringify({ sequences, quoteToken }),
    });
  },
  refreshCheckout(bookingId: string) {
    return apiFetch<{ checkoutState: string }>(
      `/bookings/${bookingId}/deposit-checkout`,
      { method: 'POST' },
    );
  },

  confirmMockPayment(orderCode: string) {
    return apiFetch<{ ok: boolean }>(
      `/payments/mock/${encodeURIComponent(orderCode)}/confirm`,
      { method: 'POST' },
    );
  },
};
