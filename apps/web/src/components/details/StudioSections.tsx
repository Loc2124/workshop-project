import { Star } from 'lucide-react';
import type { StudioDetailsContent } from '@/types/studio';
import type { Workshop } from '@/types/workshop';
import { MediaImage } from '../ui/MediaImage';
import { studioArtisans } from '@/lib/studioRatings';
import { ArtisanCard } from './ArtisanCard';
import { DetailRating, DetailSection } from './DetailPrimitives';

export { StudioSidebar } from './StudioSidebar';

export function StudioArtists({ workshops }: { workshops: Workshop[] }) {
  const artisans = studioArtisans(workshops);
  if (!artisans.length) return null;
  return (
    <DetailSection
      id="studio-artists-heading"
      title="Gặp những đôi tay ở studio"
    >
      <div
        className={`grid items-stretch gap-4 ${artisans.length > 1 ? 'md:grid-cols-2' : ''}`}
      >
        {artisans.map((artisan) => (
          <ArtisanCard
            key={artisan.name}
            name={artisan.name}
            photo={artisan.photo}
            intro={artisan.intro}
            rating={artisan.rating}
            reviewCount={artisan.reviewCount}
            workshopCount={artisan.workshops.length}
            nearestTitle={artisan.nearestTitle}
          />
        ))}
      </div>
    </DetailSection>
  );
}

export function StudioExtras({
  studio,
}: {
  studio: StudioDetailsContent & {
    name: string;
    rating?: number;
    reviewCount?: number;
  };
}) {
  const gallery = studio.gallery?.filter((image) => image.url.trim()) ?? [];
  const reviews =
    studio.reviews?.filter(
      (review) =>
        review.comment.trim() &&
        Number.isFinite(review.rating) &&
        review.rating >= 1 &&
        review.rating <= 5,
    ) ?? [];
  const recent = [...reviews]
    .sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    )
    .slice(0, 3);
  const information = studio.information;
  const facts = [
    ['Đỗ xe', information?.parking?.trim()],
    ['Dụng cụ', information?.materials?.trim()],
    [
      'Số người tối đa',
      information?.maxParticipants && information.maxParticipants > 0
        ? `${information.maxParticipants} người`
        : undefined,
    ],
    ['Chính sách hủy', information?.cancellationPolicy?.trim()],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));
  return (
    <>
      {gallery.length > 0 && (
        <DetailSection id="studio-gallery-heading" title="Ảnh studio">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {gallery.map((photo, index) => (
              <MediaImage
                key={`${photo.url}-${index}`}
                src={photo.url}
                alt={photo.alt || `${studio.name} · ảnh ${index + 1}`}
                placeholder="Ảnh studio"
                width={600}
                height={450}
                className="aspect-4/3 rounded-xl"
              />
            ))}
          </div>
        </DetailSection>
      )}
      {recent.length > 0 && (
        <DetailSection id="studio-reviews-heading" title="Đánh giá">
          <div className="mb-4">
            <DetailRating
              rating={
                studio.rating ??
                reviews.reduce((sum, review) => sum + review.rating, 0) /
                  reviews.length
              }
              count={studio.reviewCount ?? reviews.length}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {recent.map((review) => (
              <article
                key={review.id}
                className="rounded-xl border border-stone-200 bg-stone-50 p-5"
              >
                <div className="flex items-center gap-3">
                  {review.avatarUrl && (
                    <MediaImage
                      src={review.avatarUrl}
                      alt=""
                      placeholder={review.author.slice(0, 1)}
                      width={40}
                      height={40}
                      className="size-10 shrink-0 rounded-full"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{review.author}</h3>
                    {Number.isFinite(Date.parse(review.createdAt)) && (
                      <time
                        dateTime={review.createdAt}
                        className="text-[13px] text-stone-700"
                      >
                        {new Intl.DateTimeFormat('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          timeZone: 'Asia/Ho_Chi_Minh',
                        }).format(new Date(review.createdAt))}
                      </time>
                    )}
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1 text-sm font-bold">
                    <Star
                      size={14}
                      aria-hidden="true"
                      className="fill-current text-rating"
                    />
                    {review.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-stone-700">
                  {review.comment}
                </p>
              </article>
            ))}
          </div>
        </DetailSection>
      )}
      {facts.length > 0 && (
        <DetailSection
          id="studio-information-heading"
          title="Thông tin cần biết"
        >
          <dl className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-stone-50 px-5">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]"
              >
                <dt className="text-sm font-semibold">{label}</dt>
                <dd className="whitespace-pre-line text-[13px] leading-relaxed text-stone-700">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      )}
    </>
  );
}
