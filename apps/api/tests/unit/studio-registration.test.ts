import { describe, expect, it } from 'vitest';
import { studioProfileSchema } from '../../src/modules/studios/studios.schemas.js';

describe('studio registration API schema', () => {
  const input = {
    draftStudioId: '00000000-0000-4000-8000-000000000010',
    contactPhone: '0901234567',
    contactEmail: 'studio@example.test',
    photoIds: [
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000013',
    ],
    name: 'New Studio',
    provinceId: 'ho-chi-minh',
    address: '12 Nguyen Trai',
  };
  it('preserves the default category for older clients', () => {
    expect(studioProfileSchema.parse(input)).toMatchObject({
      categoryId: 'other',
      ...input,
    });
  });
  it('accepts multiple types and rejects empty or repeated selections', () => {
    expect(
      studioProfileSchema.parse({
        ...input,
        categoryIds: ['ceramics', 'candles'],
      }).categoryIds,
    ).toEqual(['ceramics', 'candles']);
    for (const categoryIds of [[], ['ceramics', 'ceramics'], [' ']]) {
      expect(
        studioProfileSchema.safeParse({ ...input, categoryIds }).success,
      ).toBe(false);
    }
  });
  it('requires a proposal with Other and normalizes its name', () => {
    const other = { ...input, categoryIds: ['ceramics', 'other'] };
    for (const proposedCategoryName of [
      undefined,
      null,
      '',
      ' ',
      'a',
      'a'.repeat(81),
    ]) {
      expect(
        studioProfileSchema.safeParse({ ...other, proposedCategoryName })
          .success,
      ).toBe(false);
    }
    expect(
      studioProfileSchema.parse({
        ...other,
        proposedCategoryName: '  Thêu   tay  ',
      }).proposedCategoryName,
    ).toBe('Thêu tay');
    expect(
      studioProfileSchema.safeParse({
        ...input,
        categoryIds: ['ceramics'],
        proposedCategoryName: 'Thêu tay',
      }).success,
    ).toBe(false);
  });
  it('rejects empty profiles and invalid area IDs', () => {
    expect(
      studioProfileSchema.safeParse({ ...input, name: ' ', address: ' ' })
        .success,
    ).toBe(false);
    expect(
      studioProfileSchema.safeParse({ ...input, areaId: 'invalid' }).success,
    ).toBe(false);
  });
});
