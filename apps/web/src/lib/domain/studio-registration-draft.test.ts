import { describe, expect, it } from 'vitest';
import { studioRegistrationSchema } from '@workshop/shared';
import {
  emptyStudioDraft,
  readStudioDraft,
  studioDraftKey,
  studioDraftSchema,
} from './studio-registration-draft';

describe('studio application validation', () => {
  const profile = {
    draftStudioId: '00000000-0000-4000-8000-000000000010',
    contactPhone: '0901234567',
    contactEmail: 'studio@example.test',
    photoIds: [
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000013',
    ],
    name: '  Gom Nha Minh  ',
    categoryId: 'ceramics',
    provinceId: 'ho-chi-minh',
    address: '  12 Nguyen Trai  ',
    description: null,
  };
  it('uses the shared Zod schema to normalize the submitted profile', () => {
    expect(studioRegistrationSchema.parse(profile)).toMatchObject({
      name: 'Gom Nha Minh',
      address: '12 Nguyen Trai',
      description: null,
    });
  });
  it('reports each missing required field', () => {
    const parsed = studioRegistrationSchema.safeParse({
      ...profile,
      name: ' ',
      categoryId: '',
      provinceId: '',
      address: ' ',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.map((issue) => issue.path[0])).toEqual([
        'name',
        'categoryId',
        'provinceId',
        'address',
      ]);
  });
  it('rejects overlong descriptions and addresses', () => {
    expect(
      studioRegistrationSchema.safeParse({
        ...profile,
        description: 'a'.repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      studioRegistrationSchema.safeParse({
        ...profile,
        address: 'a'.repeat(501),
      }).success,
    ).toBe(false);
  });
});
describe('studio application draft', () => {
  it('keeps the proposed type through refresh', () => {
    const values = {
      ...emptyStudioDraft,
      categoryId: 'other',
      categoryIds: ['ceramics', 'other'],
      proposedCategoryName: 'Thêu tay',
    };
    expect(
      readStudioDraft(
        { getItem: () => JSON.stringify({ values, step: 1 }) },
        studioDraftKey(),
      ),
    ).toEqual({ values, step: 1 });
  });
  it('restores multiple selections and upgrades a legacy single selection', () => {
    const values = {
      ...emptyStudioDraft,
      categoryId: 'ceramics',
      categoryIds: ['ceramics', 'candles'],
    };
    expect(
      readStudioDraft(
        { getItem: () => JSON.stringify({ values, step: 1 }) },
        studioDraftKey(),
      ).values.categoryIds,
    ).toEqual(['ceramics', 'candles']);
    const legacy = { ...values, categoryIds: undefined };
    expect(
      readStudioDraft(
        { getItem: () => JSON.stringify({ values: legacy, step: 0 }) },
        studioDraftKey(),
      ).values.categoryIds,
    ).toEqual(['ceramics']);
  });
  it('preserves incomplete input and the review step through storage', () => {
    const draft = {
      values: { ...emptyStudioDraft, name: 'My unfinished studio' },
      step: 1,
    };
    expect(
      readStudioDraft(
        { getItem: () => JSON.stringify(draft) },
        studioDraftKey(),
      ),
    ).toEqual(draft);
  });
  it.each([
    'invalid JSON',
    'null',
    '{"values":{},"step":0}',
    JSON.stringify({ values: emptyStudioDraft, step: 9 }),
  ])('recovers from corrupted storage', (value) => {
    expect(readStudioDraft({ getItem: () => value }, studioDraftKey())).toEqual(
      { values: emptyStudioDraft, step: 0 },
    );
  });
  it('tolerates disabled storage and separates account drafts', () => {
    expect(
      readStudioDraft(
        {
          getItem: () => {
            throw new Error('Disabled');
          },
        },
        studioDraftKey(),
      ),
    ).toEqual({ values: emptyStudioDraft, step: 0 });
    expect(studioDraftKey('account-a')).not.toBe(studioDraftKey('account-b'));
    expect(studioDraftKey('account-a')).not.toBe(studioDraftKey());
    expect(
      studioDraftSchema.safeParse({
        values: { ...emptyStudioDraft, role: 'admin' },
        step: 0,
      }).success,
    ).toBe(false);
  });
});
