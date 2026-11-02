import { z } from 'zod';

export const DEFAULT_DEPOSIT_PERCENT = 20;
export const MAX_DEPOSIT_PERCENT = 30;
export const depositPercentSchema = z
  .number()
  .int()
  .min(0, 'Mức cọc không được âm.')
  .max(MAX_DEPOSIT_PERCENT, 'Mức cọc tối đa là 30%.');
export function effectiveDepositPercent(
  configured: number,
  eligible: boolean,
): number {
  return eligible ? depositPercentSchema.parse(configured) : 0;
}
export function calculateDeposit(total: number, percent: number): number {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error('Invalid booking total.');
  const rate = depositPercentSchema.parse(percent);
  // Integer VND, rounded down; avoid unsafe multiplication for large totals.
  return (
    Math.floor(total / 100) * rate + Math.floor(((total % 100) * rate) / 100)
  );
}
