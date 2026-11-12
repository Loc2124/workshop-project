import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { reviewService } from '@/services/reviewService';

const RATING_LABELS: Record<number, string> = {
  1: 'Rất không hài lòng',
  2: 'Chưa hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất hài lòng',
};

export function BookingReviewSection({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const {
    data: eligibility,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['booking-review-eligibility', bookingId],
    queryFn: () => reviewService.checkEligibility(bookingId),
    staleTime: 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      reviewService.submitReview(bookingId, {
        rating,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      setIsOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ['booking-review-eligibility', bookingId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['workshop-reviews'],
      });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          <span className="text-sm">Đang tải thông tin đánh giá…</span>
        </div>
      </div>
    );
  }

  if (isError || !eligibility) {
    return null;
  }

  // Đã đánh giá -> Hiển thị đánh giá đã gửi
  if (eligibility.reviewed && eligibility.review) {
    const rev = eligibility.review;
    return (
      <section
        aria-label="Đánh giá của bạn"
        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Đánh giá của bạn
          </h2>
          <span className="text-xs text-stone-700">
            {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
          </span>
        </div>

        <div className="mt-4">
          <div
            className="flex items-center gap-1.5"
            aria-label={`${rev.rating} trên 5 sao`}
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={18}
                className={
                  s <= rev.rating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-stone-300'
                }
              />
            ))}
            <span className="ml-2 text-sm font-semibold text-stone-700">
              {RATING_LABELS[rev.rating]}
            </span>
          </div>

          {rev.comment && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">
              {rev.comment}
            </p>
          )}

          {rev.replyComment && (
            <div className="mt-4 rounded-xl border-l-4 border-emerald-600 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <MessageSquare className="h-4 w-4" />
                Phản hồi từ studio
                {rev.repliedAt && (
                  <span className="font-normal text-emerald-600">
                    · {new Date(rev.repliedAt).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-stone-700">
                {rev.replyComment}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Đủ điều kiện đánh giá
  if (eligibility.eligible) {
    return (
      <section
        aria-label="Đánh giá buổi học"
        className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              Đánh giá trải nghiệm buổi học
            </h2>
            <p className="mt-1 text-sm text-stone-700">
              Chia sẻ cảm nhận của bạn để giúp workshop và studio hoàn thiện
              hơn.
            </p>
          </div>
          {!isOpen && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-forest px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              Viết đánh giá
            </button>
          )}
        </div>

        {isOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (submitMutation.isPending) return;
              submitMutation.mutate();
            }}
            className="mt-5 rounded-xl border border-stone-200 bg-white p-4 sm:p-5"
          >
            <div>
              <label className="block text-sm font-semibold text-ink">
                Mức độ hài lòng của bạn:
              </label>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => {
                    const activeRating = hoverRating ?? rating;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-label={`${s} sao`}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setRating(s)}
                        className="rounded p-1 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-forest"
                      >
                        <Star
                          size={28}
                          className={
                            s <= activeRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-stone-300'
                          }
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-sm font-medium text-amber-800">
                  {RATING_LABELS[hoverRating ?? rating]}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="review-comment"
                className="block text-sm font-semibold text-ink"
              >
                Nhận xét chi tiết (tùy chọn):
              </label>
              <textarea
                id="review-comment"
                rows={4}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Buổi học thế nào? Giảng viên hướng dẫn có nhiệt tình không? Thành phẩm mang về có ưng ý không?..."
                className="mt-1.5 w-full rounded-xl border border-stone-300 p-3 text-sm text-ink placeholder:text-stone-600 focus:border-forest focus:outline-none focus:ring-1 focus:ring-forest"
              />
              <div className="mt-1 text-right text-xs text-stone-600">
                {comment.length}/1000 ký tự
              </div>
            </div>

            {submitMutation.isError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  {submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : 'Không thể gửi đánh giá. Vui lòng thử lại.'}
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={submitMutation.isPending}
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest/90 disabled:opacity-50"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang gửi…
                  </>
                ) : (
                  'Gửi đánh giá'
                )}
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  // Chưa đủ điều kiện
  return null;
}
