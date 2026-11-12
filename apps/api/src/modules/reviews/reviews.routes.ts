import { Router, type Request } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate-body.js';
import { validateUuidParam } from '../../middleware/validate-uuid-param.js';
import { createReviewSchema, replyReviewSchema } from '@workshop/shared';
import * as reviewsService from './reviews.service.js';

export const reviewsRouter = Router();

// Khách kiểm tra quyền đánh giá đơn đặt chỗ
reviewsRouter.get(
  '/bookings/:id/review-eligibility',
  requireAuth(),
  validateUuidParam('id'),
  async (req: Request, res) => {
    const bookingId = req.params.id as string;
    const result = await reviewsService.checkReviewEligibility(
      req.user!.sub,
      bookingId,
    );
    res.json(result);
  },
);

// Khách gửi đánh giá cho đơn đặt chỗ
reviewsRouter.post(
  '/bookings/:id/reviews',
  requireAuth(),
  validateUuidParam('id'),
  validateBody(createReviewSchema),
  async (req: Request, res) => {
    const bookingId = req.params.id as string;
    const review = await reviewsService.createReview(
      req.user!.sub,
      bookingId,
      req.body,
    );
    res.status(201).json({ review });
  },
);

// Studio xem danh sách đánh giá của các workshop thuộc studio
reviewsRouter.get(
  '/studios/:studioId/reviews',
  requireAuth(),
  validateUuidParam('studioId'),
  async (req: Request, res) => {
    const studioId = req.params.studioId as string;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.pageSize || '20'), 10) || 20),
    );

    const result = await reviewsService.getStudioReviews(
      studioId,
      req.user!.sub,
      page,
      pageSize,
    );
    res.json(result);
  },
);

// Studio phản hồi đánh giá
reviewsRouter.post(
  '/studios/:studioId/reviews/:reviewId/reply',
  requireAuth(),
  validateUuidParam('studioId'),
  validateUuidParam('reviewId'),
  validateBody(replyReviewSchema),
  async (req: Request, res) => {
    const studioId = req.params.studioId as string;
    const reviewId = req.params.reviewId as string;

    const result = await reviewsService.replyStudioReview(
      studioId,
      req.user!.sub,
      reviewId,
      req.body,
    );
    res.json(result);
  },
);
