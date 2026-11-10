import { StudioTrustBadge } from '../ui/StudioTrustBadge';
import { ArrowDown, Star } from 'lucide-react';
import { studioRating } from '../../lib/studioRatings';
import { Link } from 'react-router-dom';
import type { Studio, PublicStudio } from '../../types/studio';
import type { Workshop } from '../../types/workshop';
import { formatPrice, formatSessionDate, formatSlot } from '../../lib/format';
import { upcomingSessions } from '../../lib/workshopDetails';
import { MediaImage } from '../ui/MediaImage';
import { getCategoryIcon, getCategoryMeta } from '../../constants/categories';
import { studioHeroImage } from './studioHeroMedia';

export function StudioHero({
  studio,
  workshops,
  imageUrl,
}: {
  imageUrl?: string;
  studio: Studio | PublicStudio;
  workshops: Workshop[];
}) {
  const coverImage = studioHeroImage(studio, workshops, imageUrl);
  const categoryIds = [...new Set(workshops.map((item) => item.categoryId))];
  if (!categoryIds.length) categoryIds.push(studio.categoryId);
  const CategoryIcon = getCategoryIcon(studio.categoryId);
  const rating = studioRating(workshops);
  const sessions = upcomingSessions(workshops.flatMap((item) => item.sessions));
  const available = sessions.filter((item) => item.availableSeats > 0);
  const single = sessions.length === 1 && available.length === 1;
  const session = available[0];
  const workshop = single
    ? workshops.find((item) =>
        item.sessions.some((slot) => slot.id === session.id),
      )
    : undefined;
  const date = session
    ? formatSessionDate(session.startsAt, { parts: true })
    : undefined;
  const label =
    single && date
      ? `Đặt chỗ buổi ${date.weekday.replace('Thứ ', 'T')}, ${date.date}`
      : 'Khám phá workshop';
  const href = workshop
    ? `/workshop/${workshop.slug ?? workshop.id}#lich-trai-nghiem`
    : '#workshop-tai-studio';
  const scrollToWorkshops = () => {
    if (!workshop) {
      document
        .getElementById('workshop-tai-studio')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const prices = (
    available.length
      ? available.map((item) => item.price)
      : workshops.map((item) => item.basePrice)
  ).filter((price) => Number.isFinite(price) && price >= 0);
  const stats = [
    ...(session
      ? [{ label: 'Buổi gần nhất', value: formatSlot(session.startsAt) }]
      : []),
    ...(prices.length
      ? [
          {
            label: 'Giá tham gia',
            value: `Từ ${formatPrice(Math.min(...prices))} đ`,
          },
        ]
      : []),
    ...(workshops.length
      ? [{ label: 'Số workshop', value: String(workshops.length) }]
      : []),
    ...(sessions.length
      ? [
          {
            label: 'Lịch sắp tới',
            value: `${sessions.length} buổi · ${available.length} buổi còn chỗ`,
          },
        ]
      : []),
  ];
  const action =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
  return (
    <>
      <section
        aria-labelledby="studio-title"
        className="overflow-hidden rounded-2xl bg-soft"
      >
        <div
          className={`grid items-stretch gap-6 p-5 sm:p-8 ${coverImage ? 'lg:grid-cols-[3fr_2fr]' : 'lg:grid-cols-[3fr_1fr]'}`}
        >
          <div className="min-w-0 lg:order-first">
            <div
              className="mb-3 flex flex-wrap gap-2"
              aria-label="Danh mục của studio"
            >
              {categoryIds.map((id) => {
                const category = getCategoryMeta(id);
                const Icon = getCategoryIcon(id);
                return (
                  <Link
                    key={id}
                    to={`/kham-pha?mon=${encodeURIComponent(category.slug)}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-beige px-2.5 py-1 text-[13px] font-bold text-stone-700 hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    <Icon size={15} aria-hidden="true" />
                    {category.name}
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <h1
                id="studio-title"
                className="font-heading text-3xl font-semibold leading-tight sm:text-4xl"
              >
                {studio.name}
              </h1>
              <StudioTrustBadge level={studio.trustLevel} explain />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-700">
              <span>
                {[studio.areaName, studio.province].filter(Boolean).join(' · ')}
              </span>
              {rating.rating !== undefined && (
                <span
                  className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-stone-800"
                  aria-label={`Đánh giá ${rating.rating.toFixed(1)} trên 5, ${rating.reviewCount} đánh giá`}
                >
                  <Star
                    size={15}
                    className="shrink-0 fill-current text-rating"
                    aria-hidden="true"
                  />
                  {rating.rating.toFixed(1)} ({rating.reviewCount})
                </span>
              )}
            </div>
            {studio.description && (
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-stone-700">
                {studio.description}
              </p>
            )}
            {stats.length > 0 && (
              <dl className="my-6 grid grid-cols-2 items-baseline gap-x-6 gap-y-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="grid gap-1">
                    <dt className="text-[13px] leading-5 text-stone-700">
                      {stat.label}
                    </dt>
                    <dd className="text-lg font-semibold leading-7 tabular-nums text-ink">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <Link to={href} onClick={scrollToWorkshops} className={action}>
              {label}
              {!single && <ArrowDown size={16} aria-hidden="true" />}
            </Link>
          </div>
          <div className="relative order-first h-[200px] w-full self-stretch overflow-hidden rounded-2xl bg-beige md:aspect-4/3 md:h-auto lg:order-last lg:min-h-64">
            <div
              className="absolute inset-0 grid place-items-center"
              aria-hidden="true"
            >
              <CategoryIcon className="size-16 text-primary" strokeWidth={1} />
            </div>
            {coverImage && (
              <MediaImage
                src={coverImage}
                mediumUrl={
                  studio.photoImages?.find((image) => image.url === coverImage)
                    ?.mediumUrl ?? studio.mediumUrl
                }
                thumbnailUrl={
                  studio.photoImages?.find((image) => image.url === coverImage)
                    ?.thumbnailUrl ?? studio.thumbnailUrl
                }
                alt={`Ảnh bìa studio ${studio.name}`}
                placeholder={`Ảnh bìa studio ${studio.name}`}
                showPlaceholderText={false}
                priority
                width={800}
                height={600}
                className="absolute inset-0 bg-transparent"
              />
            )}
          </div>
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-40 bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
        <Link
          to={href}
          onClick={scrollToWorkshops}
          className={`${action} w-full`}
        >
          {label}
          {!single && <ArrowDown size={16} aria-hidden="true" />}
        </Link>
      </div>
    </>
  );
}
