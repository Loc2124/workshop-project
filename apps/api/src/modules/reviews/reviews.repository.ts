import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { ReviewDto, ReviewEligibilityDto } from '@workshop/shared';

interface ReviewEligibilityRow {
  bookingId: string;
  userId: string;
  bookingStatus: string;
  sessionId: string;
  workshopId: string;
  workshopTitle: string;
  sessionStartsAt: Date;
  sessionEndsAt: Date;
  sessionStatus: string;
  reviewId: string | null;
  reviewRating: number | null;
  reviewComment: string | null;
  reviewCreatedAt: Date | null;
  replyComment: string | null;
  repliedAt: Date | null;
  attendedTicketsCount: number;
  absentTicketsCount: number;
  validTicketsCount: number;
}

export async function checkReviewEligibility(
  userId: string,
  bookingId: string,
): Promise<ReviewEligibilityDto> {
  const result = await query<ReviewEligibilityRow>(
    `SELECT 
      b.id AS "bookingId",
      b.user_id AS "userId",
      b.status AS "bookingStatus",
      b.session_id AS "sessionId",
      s.workshop_id AS "workshopId",
      w.title AS "workshopTitle",
      s.starts_at AS "sessionStartsAt",
      s.ends_at AS "sessionEndsAt",
      s.status AS "sessionStatus",
      rev.id AS "reviewId",
      rev.rating AS "reviewRating",
      rev.comment AS "reviewComment",
      rev.created_at AS "reviewCreatedAt",
      rev.reply_comment AS "replyComment",
      rev.replied_at AS "repliedAt",
      (SELECT COUNT(*)::int FROM tickets t WHERE t.booking_id = b.id AND (t.attendance_status = 'attended' OR t.checked_in_at IS NOT NULL)) AS "attendedTicketsCount",
      (SELECT COUNT(*)::int FROM tickets t WHERE t.booking_id = b.id AND t.attendance_status = 'absent') AS "absentTicketsCount",
      (SELECT COUNT(*)::int FROM tickets t WHERE t.booking_id = b.id AND t.status != 'void') AS "validTicketsCount"
    FROM bookings b
    JOIN sessions s ON s.id = b.session_id
    JOIN workshops w ON w.id = s.workshop_id
    LEFT JOIN reviews rev ON rev.booking_id = b.id
    WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, userId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt chỗ.');
  }

  // Nếu đã đánh giá rồi
  if (row.reviewId) {
    return {
      eligible: false,
      reviewed: true,
      reason: 'Bạn đã đánh giá đơn đặt chỗ này.',
      review: {
        id: row.reviewId,
        bookingId: row.bookingId,
        workshopId: row.workshopId,
        workshopTitle: row.workshopTitle,
        author: '',
        rating: row.reviewRating ?? 5,
        comment: row.reviewComment,
        createdAt: row.reviewCreatedAt
          ? row.reviewCreatedAt.toISOString()
          : new Date().toISOString(),
        replyComment: row.replyComment,
        repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null,
      },
    };
  }

  // Đơn phải ở trạng thái paid
  if (row.bookingStatus !== 'paid') {
    return {
      eligible: false,
      reviewed: false,
      reason:
        'Chỉ đơn đặt chỗ đã thanh toán thành công mới có thể gửi đánh giá.',
    };
  }

  const now = new Date();
  const sessionEnded =
    now >= new Date(row.sessionEndsAt) || row.sessionStatus === 'completed';

  // Điều kiện tham dự
  if (!sessionEnded && row.attendedTicketsCount === 0) {
    return {
      eligible: false,
      reviewed: false,
      reason:
        'Chỉ có thể đánh giá sau khi đã tham gia buổi workshop hoặc buổi học đã kết thúc.',
    };
  }

  // Nếu toàn bộ vé bị đánh dấu vắng hoặc hủy
  if (
    row.validTicketsCount === 0 ||
    (row.absentTicketsCount > 0 &&
      row.absentTicketsCount === row.validTicketsCount &&
      row.attendedTicketsCount === 0)
  ) {
    return {
      eligible: false,
      reviewed: false,
      reason:
        'Đơn đặt chỗ đã bị hủy hoặc vắng mặt toàn bộ nên không thể đánh giá.',
    };
  }

  return {
    eligible: true,
    reviewed: false,
  };
}

export async function createReview(
  userId: string,
  bookingId: string,
  rating: number,
  comment: string | null,
): Promise<ReviewDto> {
  return withTransaction(async (client) => {
    // 1. Kiểm tra lại điều kiện trong transaction
    const eligibility = await checkReviewEligibility(userId, bookingId);
    if (!eligibility.eligible) {
      throw new AppError(
        eligibility.reviewed ? 409 : 403,
        eligibility.reviewed ? 'CONFLICT' : 'FORBIDDEN',
        eligibility.reason || 'Không đủ điều kiện đánh giá đơn đặt chỗ này.',
      );
    }

    // 2. Lấy thông tin workshop_id và user full_name
    const metaRes = await client.query<{
      workshopId: string;
      author: string;
      workshopTitle: string;
    }>(
      `SELECT s.workshop_id AS "workshopId", u.full_name AS author, w.title AS "workshopTitle"
       FROM bookings b
       JOIN sessions s ON s.id = b.session_id
       JOIN workshops w ON w.id = s.workshop_id
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [bookingId],
    );
    const meta = metaRes.rows[0];
    if (!meta) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy thông tin đơn đặt chỗ.',
      );
    }

    // 3. Insert review
    const insertRes = await client.query<{
      id: string;
      booking_id: string;
      workshop_id: string;
      rating: number;
      comment: string | null;
      created_at: Date;
    }>(
      `INSERT INTO reviews (booking_id, user_id, workshop_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, booking_id, workshop_id, rating, comment, created_at`,
      [bookingId, userId, meta.workshopId, rating, comment],
    );

    const inserted = insertRes.rows[0]!;

    return {
      id: inserted.id,
      bookingId: inserted.booking_id,
      workshopId: inserted.workshop_id,
      workshopTitle: meta.workshopTitle,
      author: meta.author,
      rating: inserted.rating,
      comment: inserted.comment,
      createdAt: inserted.created_at.toISOString(),
      replyComment: null,
      repliedAt: null,
    };
  });
}

export async function getStudioReviews(
  studioId: string,
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<{
  reviews: ReviewDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  // Phân quyền theo studio_members
  const memberRes = await query<{ role: string }>(
    `SELECT role FROM studio_members WHERE studio_id = $1 AND user_id = $2`,
    [studioId, userId],
  );
  if (memberRes.rowCount === 0) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Bạn không có quyền truy cập đánh giá của studio này.',
    );
  }

  const countRes = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM reviews rev
     JOIN workshops w ON w.id = rev.workshop_id
     WHERE w.studio_id = $1`,
    [studioId],
  );
  const total = countRes.rows[0]?.total ?? 0;

  const offset = (page - 1) * pageSize;
  const listRes = await query<{
    id: string;
    bookingId: string;
    workshopId: string;
    workshopTitle: string;
    author: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    replyComment: string | null;
    repliedAt: Date | null;
  }>(
    `SELECT rev.id,
            rev.booking_id AS "bookingId",
            rev.workshop_id AS "workshopId",
            w.title AS "workshopTitle",
            u.full_name AS author,
            rev.rating,
            rev.comment,
            rev.created_at AS "createdAt",
            rev.reply_comment AS "replyComment",
            rev.replied_at AS "repliedAt"
     FROM reviews rev
     JOIN workshops w ON w.id = rev.workshop_id
     JOIN users u ON u.id = rev.user_id
     WHERE w.studio_id = $1
     ORDER BY rev.created_at DESC
     LIMIT $2 OFFSET $3`,
    [studioId, pageSize, offset],
  );

  return {
    reviews: listRes.rows.map((row) => ({
      id: row.id,
      bookingId: row.bookingId,
      workshopId: row.workshopId,
      workshopTitle: row.workshopTitle,
      author: row.author,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      replyComment: row.replyComment,
      repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null,
    })),
    total,
    page,
    pageSize,
  };
}

export async function replyStudioReview(
  studioId: string,
  userId: string,
  reviewId: string,
  replyComment: string,
): Promise<{ id: string; replyComment: string; repliedAt: string }> {
  // Phân quyền theo studio_members
  const memberRes = await query<{ role: string }>(
    `SELECT role FROM studio_members WHERE studio_id = $1 AND user_id = $2`,
    [studioId, userId],
  );
  if (memberRes.rowCount === 0) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Bạn không có quyền phản hồi đánh giá của studio này.',
    );
  }

  const reviewRes = await query<{ id: string }>(
    `SELECT rev.id
     FROM reviews rev
     JOIN workshops w ON w.id = rev.workshop_id
     WHERE rev.id = $1 AND w.studio_id = $2`,
    [reviewId, studioId],
  );
  if (reviewRes.rowCount === 0) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Không tìm thấy đánh giá thuộc studio này.',
    );
  }

  const updateRes = await query<{
    id: string;
    reply_comment: string;
    replied_at: Date;
  }>(
    `UPDATE reviews
     SET reply_comment = $2, replied_at = now()
     WHERE id = $1
     RETURNING id, reply_comment, replied_at`,
    [reviewId, replyComment],
  );

  const updated = updateRes.rows[0]!;
  return {
    id: updated.id,
    replyComment: updated.reply_comment,
    repliedAt: updated.replied_at.toISOString(),
  };
}
