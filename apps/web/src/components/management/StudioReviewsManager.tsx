import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  MessageSquare,
  CornerDownRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { reviewService } from '@/services/reviewService';
import type { ReviewDto } from '@workshop/shared';

export function StudioReviewsManager({ studioId }: { studioId: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['studio-reviews', studioId, page],
    queryFn: () => reviewService.getStudioReviews(studioId, page, pageSize),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-stone-200 bg-white p-8">
        <div className="flex items-center gap-3 text-stone-500">
          <Loader2 className="h-6 w-6 animate-spin text-forest" />
          <span>Đang tải danh sách đánh giá…</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
        <p className="mt-2 text-sm font-semibold text-rose-800">
          {error instanceof Error
            ? error.message
            : 'Không thể tải danh sách đánh giá.'}
        </p>
        <button
          onClick={() => void refetch()}
          className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm border border-stone-200 hover:bg-stone-50"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const reviews = data?.reviews ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Đánh giá từ học viên</h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Tổng cộng {total} lượt đánh giá từ khách hàng đã tham gia workshop.
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <Star className="mx-auto h-10 w-10 text-stone-300" />
          <h3 className="mt-3 text-base font-bold text-ink">
            Chưa có đánh giá nào
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Khi học viên tham gia workshop và gửi đánh giá, các phản hồi sẽ xuất
            hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <ReviewItem key={rev.id} studioId={studioId} review={rev} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-200 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Trang trước
          </button>
          <span className="text-xs text-stone-500">
            Trang {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewItem({
  studioId,
  review,
}: {
  studioId: string;
  review: ReviewDto;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState(review.replyComment || '');
  const queryClient = useQueryClient();

  const replyMutation = useMutation({
    mutationFn: () =>
      reviewService.replyReview(studioId, review.id, {
        replyComment: replyText.trim(),
      }),
    onSuccess: () => {
      setIsReplying(false);
      void queryClient.invalidateQueries({
        queryKey: ['studio-reviews', studioId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['workshop-reviews'],
      });
    },
  });

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-block rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
            {review.workshopTitle || 'Workshop'}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-bold text-ink">{review.author}</span>
            <span className="text-xs text-stone-400">·</span>
            <span className="text-xs text-stone-500">
              {new Date(review.createdAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1"
          aria-label={`${review.rating} sao`}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={16}
              className={
                s <= review.rating
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-stone-200'
              }
            />
          ))}
          <span className="ml-1 text-xs font-bold text-amber-800">
            {review.rating}.0
          </span>
        </div>
      </div>

      {review.comment && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">
          {review.comment}
        </p>
      )}

      {/* Phản hồi từ studio nếu có */}
      {review.replyComment && !isReplying && (
        <div className="mt-4 rounded-xl border-l-4 border-emerald-600 bg-emerald-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CornerDownRight className="h-4 w-4" />
              Phản hồi của studio
              {review.repliedAt && (
                <span className="font-normal text-emerald-600">
                  · {new Date(review.repliedAt).toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setReplyText(review.replyComment || '');
                setIsReplying(true);
              }}
              className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-900"
            >
              Chỉnh sửa
            </button>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-sm text-stone-700">
            {review.replyComment}
          </p>
        </div>
      )}

      {/* Nút mở phản hồi nếu chưa có */}
      {!review.replyComment && !isReplying && (
        <div className="mt-4 border-t border-stone-100 pt-3">
          <button
            type="button"
            onClick={() => setIsReplying(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Phản hồi đánh giá này
          </button>
        </div>
      )}

      {/* Form viết / sửa phản hồi */}
      {isReplying && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!replyText.trim() || replyMutation.isPending) return;
            replyMutation.mutate();
          }}
          className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4"
        >
          <label className="block text-xs font-bold text-stone-700">
            Nội dung phản hồi từ Studio:
          </label>
          <textarea
            rows={3}
            maxLength={1000}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Cảm ơn học viên đã tham gia và đóng góp ý kiến..."
            className="mt-1.5 w-full rounded-lg border border-stone-300 p-2.5 text-sm text-ink focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest"
          />
          {replyMutation.isError && (
            <p className="mt-1.5 text-xs text-rose-600">
              {replyMutation.error instanceof Error
                ? replyMutation.error.message
                : 'Không thể lưu phản hồi.'}
            </p>
          )}
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={replyMutation.isPending}
              onClick={() => setIsReplying(false)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!replyText.trim() || replyMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-1.5 text-xs font-semibold text-white hover:bg-forest/90 disabled:opacity-50"
            >
              {replyMutation.isPending && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              Lưu phản hồi
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
