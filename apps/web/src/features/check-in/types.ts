import { z } from 'zod';

export const ticketSchema = z.object({
  ticketId: z.string().uuid(),
  bookingId: z.string().uuid(),
  ticketNumber: z.number(),
  version: z.number(),
  ticketStatus: z.string(),
  attendanceStatus: z.string(),
  attendanceMethod: z.enum(['check_in', 'manual_confirmation']).nullable(),
  checkedInAt: z.string().nullable(),
  checkedInBy: z.string().nullable(),
  workshopTitle: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  customerName: z.string(),
  quantity: z.number(),
  checkedInCount: z.number(),
  remainingAmount: z.number(),
  totalAmount: z.number().optional(),
  depositAmount: z.number().optional(),
  paidAmount: z.number().optional(),
  inStudioAmount: z.number().optional(),
  paymentStatus: z.string(),
  reservationStatus: z.string(),
  sessionStatus: z.string(),
  reschedulePending: z.boolean(),
  serverNow: z.string(),
  canCheckIn: z.boolean(),
  canConfirmManually: z.boolean(),
});

export type CheckInTicket = z.infer<typeof ticketSchema>;
export type CheckInBusyState = 'lookup' | 'payment' | 'check-in' | null;
