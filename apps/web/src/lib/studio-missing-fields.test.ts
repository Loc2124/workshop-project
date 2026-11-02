import { describe, expect, it } from 'vitest';
import {
  studioRegistrationSchema,
  studioEvidenceSchema,
  studioProvinces,
  calculateDeposit,
  effectiveDepositPercent,
} from '@workshop/shared';
import { studioMissingFields } from './studio-missing-fields';
import { emptyStudioDraft } from './studio-registration-draft';
const ids = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
];
const valid = {
  ...emptyStudioDraft,
  name: 'Studio Gốm An',
  draftStudioId: ids[0],
  categoryId: 'ceramics',
  categoryIds: ['ceramics'],
  provinceId: 'ho-chi-minh',
  address: '12 Nguyễn Trãi',
  contactPhone: '0901 234 567',
  contactEmail: 'STUDIO@example.test',
  photoIds: ids,
  proposedCategoryName: null,
  facebookUrl: null,
  instagramUrl: null,
  googleMapsUrl: null,
};
describe('studio onboarding requirements', () => {
  it('explains all missing required groups without listing a draft ID or duplicating photos', () => {
    const result = studioRegistrationSchema.safeParse({
      ...emptyStudioDraft,
      facebookUrl: null,
      instagramUrl: null,
      googleMapsUrl: null,
      proposedCategoryName: null,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(studioMissingFields(result.error.issues)).toEqual([
        'tên studio',
        'loại workshop',
        'tỉnh/thành',
        'địa chỉ',
        'SĐT',
        'email',
        'ảnh',
      ]);
  });
  it('accepts complete evidence and normalizes both business contacts', () => {
    const result = studioRegistrationSchema.parse(valid);
    expect(result.contactPhone).toBe('0901234567');
    expect(result.contactEmail).toBe('studio@example.test');
    expect(studioProvinces).toHaveLength(34);
    expect(
      studioProvinces.some((province) => province.id === valid.provinceId),
    ).toBe(true);
  });
  it('rejects untrusted links, fewer than three photos and repeated photo IDs', () => {
    for (const facebookUrl of [
      'not a url',
      'javascript:alert(1)',
      'https://facebook.com.evil.test/profile',
      'https://user:password@facebook.com/page',
    ])
      expect(
        studioRegistrationSchema.safeParse({ ...valid, facebookUrl }).success,
      ).toBe(false);
    expect(
      studioRegistrationSchema.safeParse({
        ...valid,
        photoIds: ids.slice(0, 2),
      }).success,
    ).toBe(false);
    expect(
      studioRegistrationSchema.safeParse({
        ...valid,
        photoIds: [ids[0], ids[0], ids[1]],
      }).success,
    ).toBe(false);
    expect(
      studioEvidenceSchema.safeParse({
        contactPhone: 'abc',
        contactEmail: 'not-email',
        photoIds: ids,
      }).success,
    ).toBe(false);
  });
  it('uses integer VND and disables deposits outside the allowed trust tier', () => {
    expect(calculateDeposit(500000, 20)).toBe(100000);
    expect(calculateDeposit(500000, 30)).toBe(150000);
    expect(calculateDeposit(100001, 20)).toBe(20000);
    expect(effectiveDepositPercent(30, false)).toBe(0);
    expect(effectiveDepositPercent(30, true)).toBe(30);
    expect(() => calculateDeposit(500000, 31)).toThrow();
  });
});
