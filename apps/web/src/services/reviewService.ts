import { apiFetch } from '@/lib/api-client';
import type {
  CreateReviewInput,
  ReplyReviewInput,
  ReviewEligibilityDto,
  ReviewDto,
} from '@workshop/shared';

export const reviewService = {
  async checkEligibility(bookingId: string): Promise<ReviewEligibilityDto> {
    return apiFetch<ReviewEligibilityDto>(
      `/bookings/${encodeURIComponent(bookingId)}/review-eligibility`,
    );
  },

  async submitReview(
    bookingId: string,
    data: CreateReviewInput,
  ): Promise<{ review: ReviewDto }> {
    return apiFetch<{ review: ReviewDto }>(
      `/bookings/${encodeURIComponent(bookingId)}/reviews`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    );
  },

  async getStudioReviews(
    studioId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    reviews: ReviewDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return apiFetch<{
      reviews: ReviewDto[];
      total: number;
      page: number;
      pageSize: number;
    }>(
      `/studios/${encodeURIComponent(studioId)}/reviews?page=${page}&pageSize=${pageSize}`,
    );
  },

  async replyReview(
    studioId: string,
    reviewId: string,
    data: ReplyReviewInput,
  ): Promise<{ id: string; replyComment: string; repliedAt: string }> {
    return apiFetch<{ id: string; replyComment: string; repliedAt: string }>(
      `/studios/${encodeURIComponent(studioId)}/reviews/${encodeURIComponent(reviewId)}/reply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    );
  },
};
