import { describe, expect, it } from 'vitest';
import { studioReviewDecisionSchema } from '@workshop/shared';
import {
  adminWorkshopListQuerySchema,
  updateStudioStatusSchema,
} from '../../src/modules/admin/admin.schemas.js';
describe('studio review decisions', () => {
  it('requires a trimmed reason of at least 10 characters for both negative decisions', () => {
    for (const status of ['needs_changes', 'rejected']) {
      for (const reason of [undefined, '', '  short  ', 'a'.repeat(1001)])
        expect(
          updateStudioStatusSchema.safeParse({ status, reason }).success,
        ).toBe(false);
      expect(
        updateStudioStatusSchema.parse({
          status,
          reason: '  Bổ sung ảnh studio  ',
        }),
      ).toEqual({ status, reason: 'Bổ sung ảnh studio' });
    }
    expect(
      studioReviewDecisionSchema.safeParse({ status: 'approved' }).success,
    ).toBe(true);
    expect(
      studioReviewDecisionSchema.safeParse({ status: 'pending' }).success,
    ).toBe(false);
  });
  it('does not introduce studio-only states into workshop filters', () => {
    expect(
      adminWorkshopListQuerySchema.safeParse({ status: 'needs_changes' })
        .success,
    ).toBe(false);
  });
});
