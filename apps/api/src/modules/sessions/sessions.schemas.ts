import { z } from 'zod';

const sessionFields = {
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  price: z.number().int().min(0).max(2_147_483_647).optional(),
  capacity: z.number().int().positive().max(2_147_483_647),
  registrationDeadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
};

export const createSessionSchema = z
  .object(sessionFields)
  .strict()
  .refine((input) => new Date(input.endsAt) > new Date(input.startsAt))
  .refine(
    (input) =>
      !input.registrationDeadline ||
      new Date(input.registrationDeadline) <= new Date(input.startsAt),
  );

export const updateSessionSchema = z
  .object(sessionFields)
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0);

export type SessionInput = z.infer<typeof createSessionSchema>;
export type SessionUpdateInput = z.infer<typeof updateSessionSchema>;

export type SessionUpdate = {
  startsAt?: string;
  endsAt?: string;
  price?: number;
  capacity?: number;
  registrationDeadline?: string | null;
};
