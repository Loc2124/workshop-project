import { Star } from 'lucide-react';
import { MediaImage } from '../ui/MediaImage';

export function ArtisanCard({
  name,
  photo,
  intro,
  rating,
  reviewCount,
  workshopCount,
  nearestTitle,
}: {
  name: string;
  photo?: string;
  intro?: string;
  rating?: number;
  reviewCount?: number;
  workshopCount?: number;
  nearestTitle?: string;
}) {
  const hasWorkshops = Number.isInteger(workshopCount) && workshopCount! > 0;
  const hasRating = Number.isFinite(rating) && rating! >= 1 && rating! <= 5;
  return (
    <article className="h-full rounded-xl bg-soft p-5">
      <div className="flex items-center gap-4">
        <MediaImage
          thumbnail
          src={photo}
          alt={name}
          placeholder={name.replace(/^Nghệ nhân\s+/i, '').slice(0, 1)}
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-full"
        />
        <h3 className="font-heading text-xl font-semibold">{name}</h3>
      </div>
      {intro && (
        <p className="mt-4 text-sm leading-relaxed text-stone-700">{intro}</p>
      )}
      {(hasWorkshops || hasRating) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-700">
          {hasWorkshops && (
            <span>
              Dạy {workshopCount} workshop
              {workshopCount === 1 && nearestTitle?.trim()
                ? `: ${nearestTitle}`
                : ''}
            </span>
          )}
          {hasRating && (
            <span className="inline-flex items-center gap-1.5">
              <Star
                size={16}
                className="fill-current text-rating"
                aria-hidden="true"
              />
              <b className="text-ink">{rating!.toFixed(1)}</b>
              {Number.isInteger(reviewCount) && reviewCount! >= 0 && (
                <span>({reviewCount} đánh giá)</span>
              )}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
