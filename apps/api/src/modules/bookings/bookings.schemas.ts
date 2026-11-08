import { z } from 'zod';

export const createBookingSchema = z
  .object({
    requestId: z.uuid(),
    sessionId: z.uuid(),
    quantity: z.number().int().min(1).max(10),
    paymentChoice: z.enum(['deposit', 'in_studio']).optional(),
  })
  .strict();

export const confirmStudioPaymentSchema = z
  .object({
    expectedAmount: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();

export const cancelBookingSchema = z
  .object({
    quoteToken: z.string().min(1).max(2000).optional(),
  })
  .strict()
  .default({});
