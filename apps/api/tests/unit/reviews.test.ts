import { describe, expect, it } from 'vitest';
import {
  createReviewSchema,
  replyReviewSchema,
  reviewEligibilitySchema,
} from '@workshop/shared';

describe('Reviews validation schemas', () => {
  describe('createReviewSchema', () => {
    it('accepts valid review with 5 stars and comment', () => {
      const parsed = createReviewSchema.parse({
        rating: 5,
        comment: 'Buổi học rất vui và bổ ích!',
      });
      expect(parsed.rating).toBe(5);
      expect(parsed.comment).toBe('Buổi học rất vui và bổ ích!');
    });

    it('accepts valid review with 1 star and null/empty comment', () => {
      const parsed = createReviewSchema.parse({
        rating: 1,
        comment: '   ',
      });
      expect(parsed.rating).toBe(1);
      expect(parsed.comment).toBeNull();
    });

    it('rejects rating below 1 or above 5', () => {
      expect(() => createReviewSchema.parse({ rating: 0 })).toThrow();
      expect(() => createReviewSchema.parse({ rating: 6 })).toThrow();
    });

    it('rejects comment longer than 1000 characters', () => {
      const longComment = 'a'.repeat(1001);
      expect(() =>
        createReviewSchema.parse({ rating: 4, comment: longComment }),
      ).toThrow();
    });
  });

  describe('replyReviewSchema', () => {
    it('accepts valid studio reply', () => {
      const parsed = replyReviewSchema.parse({
        replyComment: 'Cảm ơn bạn đã tham gia buổi học cùng studio!',
      });
      expect(parsed.replyComment).toBe(
        'Cảm ơn bạn đã tham gia buổi học cùng studio!',
      );
    });

    it('rejects empty or whitespace-only reply', () => {
      expect(() =>
        replyReviewSchema.parse({
          replyComment: '   ',
        }),
      ).toThrow();
    });

    it('rejects reply longer than 1000 characters', () => {
      expect(() =>
        replyReviewSchema.parse({
          replyComment: 'a'.repeat(1001),
        }),
      ).toThrow();
    });
  });

  describe('reviewEligibilitySchema', () => {
    it('parses eligible response', () => {
      const parsed = reviewEligibilitySchema.parse({
        eligible: true,
        reviewed: false,
      });
      expect(parsed.eligible).toBe(true);
      expect(parsed.reviewed).toBe(false);
    });

    it('parses already reviewed response with review data', () => {
      const parsed = reviewEligibilitySchema.parse({
        eligible: false,
        reviewed: true,
        reason: 'Bạn đã đánh giá đơn đặt chỗ này.',
        review: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          author: 'Nguyễn Văn A',
          rating: 5,
          comment: 'Tuyệt vời',
          createdAt: new Date().toISOString(),
        },
      });
      expect(parsed.reviewed).toBe(true);
      expect(parsed.review?.rating).toBe(5);
    });
  });
});
