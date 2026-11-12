import { describe, expect, it } from 'vitest';
import { studioReviewMissing, formatReviewDate } from './studio-review';
describe('studio profile review', () => {
  it('counts missing contact and real attached ready photos', () => {
    expect(studioReviewMissing({})).toEqual(['SĐT', 'email', 'ảnh (0/3)']);
    const images = ['a', 'b', 'c'].map((id) => ({
      id,
      url: 'https://example.test/photo.webp',
      key: id,
    }));
    const profile = {
      contactPhone: '0901234567',
      contactEmail: 'studio@example.test',
      photoIds: ['a', 'b', 'c'],
      images,
      profileComplete: true,
    };
    expect(studioReviewMissing(profile)).toEqual([]);
    expect(
      studioReviewMissing({
        ...profile,
        images: [images[0], images[0], { ...images[1], id: 'unattached' }],
      }),
    ).toEqual(['ảnh (1/3)']);
    expect(
      studioReviewMissing({ ...profile, contactEmail: 'not an email' }),
    ).toEqual(['email']);
  });
  it('formats submission timestamps in Vietnam without locale punctuation', () => {
    expect(formatReviewDate('2026-11-02T04:05:00Z')).toBe('02/11/2026 11:05');
    expect(formatReviewDate('invalid')).toBe('—');
  });
});
