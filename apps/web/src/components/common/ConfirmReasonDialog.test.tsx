import { describe, expect, it } from 'vitest';
import { confirmationReasonSchema } from './ConfirmReasonDialog';
describe('confirmation reason validation', () => {
  it('requires 10 trimmed characters by default and trims the returned reason', () => {
    expect(
      confirmationReasonSchema().safeParse({ reason: '  short  ' }).success,
    ).toBe(false);
    expect(
      confirmationReasonSchema().parse({ reason: '  Bổ sung ảnh studio  ' }),
    ).toEqual({ reason: 'Bổ sung ảnh studio' });
  });
  it('supports confirmation without a reason and custom minimum lengths', () => {
    expect(confirmationReasonSchema(false).parse({ reason: '' })).toEqual({
      reason: '',
    });
    expect(
      confirmationReasonSchema(true, 15).safeParse({ reason: 'tenletters' })
        .success,
    ).toBe(false);
  });
});
