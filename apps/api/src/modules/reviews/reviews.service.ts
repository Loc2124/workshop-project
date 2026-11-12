import * as reviewsRepo from './reviews.repository.js';
import type { CreateReviewInput, ReplyReviewInput } from '@workshop/shared';

export async function checkReviewEligibility(
  userId: string,
  bookingId: string,
) {
  return reviewsRepo.checkReviewEligibility(userId, bookingId);
}

export async function createReview(
  userId: string,
  bookingId: string,
  input: CreateReviewInput,
) {
  return reviewsRepo.createReview(
    userId,
    bookingId,
    input.rating,
    input.comment,
  );
}

export async function getStudioReviews(
  studioId: string,
  userId: string,
  page = 1,
  pageSize = 20,
) {
  return reviewsRepo.getStudioReviews(studioId, userId, page, pageSize);
}

export async function replyStudioReview(
  studioId: string,
  userId: string,
  reviewId: string,
  input: ReplyReviewInput,
) {
  return reviewsRepo.replyStudioReview(
    studioId,
    userId,
    reviewId,
    input.replyComment,
  );
}
