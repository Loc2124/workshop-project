import { Star } from 'lucide-react';
import type { Workshop } from '@/types/workshop';
import { workshopReviewSummary } from './workshopPresentation';

export function WorkshopRating({ workshop }: { workshop: Workshop }) {
  const { rating, reviewCount } = workshopReviewSummary(workshop);
  if (rating === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums text-ink">
      <Star size={16} className="fill-current text-rating" aria-hidden="true" />
      <span aria-label={rating.toFixed(1) + ' trên 5'}>
        {rating.toFixed(1)}
      </span>
      {reviewCount !== undefined && (
        <span className="font-normal text-stone-700">
          ({reviewCount} đánh giá)
        </span>
      )}
    </span>
  );
}
