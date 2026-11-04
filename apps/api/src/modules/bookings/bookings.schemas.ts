import { z } from 'zod';

export const createBookingSchema = z
  .object({
    sessionId: z.uuid(),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();

export const confirmStudioPaymentSchema = z
  .object({
    expectedAmount: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();
