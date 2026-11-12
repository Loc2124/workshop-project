import { ArrowUpRight, Star } from 'lucide-react';
import { depositPaymentCopy } from '@workshop/shared';
import { getCategoryMeta } from '@/constants/categories';
import { Link } from 'react-router-dom';
import type { Workshop } from '@/types/workshop';
import { workshopLevel } from '@/lib/workshopDetails';
import { WorkshopCard } from '../catalog/WorkshopCard';
import { MediaImage } from '../ui/MediaImage';
import { DetailSection } from './DetailPrimitives';
import type { WorkshopBookingHandler } from './WorkshopSchedule';
import { DeferredSchedule } from './DeferredSchedule';
import {
  workshopAudience,
  workshopText,
  workshopReviewSummary,
} from './workshopPresentation';
import { studioAddress } from './StudioSidebar';

export function WorkshopDetails({
  workshop,
  related,
  onBook,
}: {
  workshop: Workshop;
  related: Workshop[];
  onBook?: WorkshopBookingHandler;
}) {
  const studioHref = `/studios/${workshop.studioSlug ?? workshop.studioId}`;
  const description = workshopText(workshop.description);
  const takeaway = workshopText(workshop.takeaway);
  const audience = workshopAudience(workshop.audience);
  const level = workshopText(workshop.level)
    ? workshopLevel(workshop.level)
    : '';
  const requirements = workshopText(workshop.requirements);
  const duplicatesLevel =
    /^(không cần kinh nghiệm|không yêu cầu kinh nghiệm)[.!]?$/i.test(
      requirements,
    ) && ['beginner', 'all'].includes(workshop.level);
  const preparation =
    duplicatesLevel ||
    !requirements ||
    /^(không cần|không|none)$/i.test(requirements)
      ? 'Không cần chuẩn bị gì'
      : requirements;
  const included = workshop.included?.map(workshopText).filter(Boolean) ?? [];
  const cancellationPolicy =
    (workshop.depositMode ?? 'none') === 'none'
      ? 'Hủy miễn phí trước giờ học 24h.'
      : 'Hủy miễn phí trước giờ học 24h. Nếu bạn chưa đặt cọc, bạn có thể hủy bất cứ lúc nào.';
  const paymentPolicy = depositPaymentCopy(
    workshop.depositMode ?? 'none',
    workshop.effectiveDepositPercent ?? workshop.depositPercent ?? 0,
  );
  const rawAddress = workshopText(workshop.address)
    .replace(/^Địa chỉ mô phỏng:\s*/i, '')
    .trim();
  const address = studioAddress(rawAddress, workshopText(workshop.province));
  const hasAddress = Boolean(
    rawAddress &&
    rawAddress.toLocaleLowerCase('vi') !==
      workshop.province.trim().toLocaleLowerCase('vi'),
  );
  const { reviews } = workshopReviewSummary(workshop);
  return (
    <>
      <div className="grid items-start gap-8 pb-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-10">
        <MediaImage
          src={
            workshop.imageUrl ||
            getCategoryMeta(workshop.categoryId).placeholderImage
          }
          fallbackSrc={
            getCategoryMeta(workshop.categoryId).placeholderImage ?? undefined
          }
          mediumUrl={workshop.mediumUrl}
          thumbnailUrl={workshop.thumbnailUrl}
          alt={`${workshop.title} tại ${workshop.studioName}`}
          placeholder={workshop.title}
          loading="eager"
          priority
          width={1000}
          height={750}
          className="aspect-4/3 rounded-2xl lg:col-start-1 lg:row-start-1"
        />
        <aside
          aria-label="Đặt chỗ và thông tin studio"
          className="min-w-0 space-y-4 self-start lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          {workshop.isDiscontinued ? (
            <section className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
              <h1 className="font-heading text-2xl font-semibold">
                {workshop.title}
              </h1>
              <p className="mt-3 font-semibold text-primary">
                Đã ngừng tổ chức
              </p>
              <p className="mt-2 text-sm text-stone-700">
                Studio không còn tổ chức workshop này. Bạn có thể xem các
                workshop tương tự bên dưới.
              </p>
              <a
                href={
                  related.length
                    ? '#related-heading'
                    : '/kham-pha?view=workshop'
                }
                className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white"
              >
                Xem workshop tương tự
              </a>
            </section>
          ) : (
            <DeferredSchedule workshop={workshop} onBook={onBook} />
          )}
          {(workshopText(workshop.studioName) || address) && (
            <section
              aria-label="Thông tin studio"
              className="rounded-xl bg-soft p-5"
            >
              {workshopText(workshop.studioName) && (
                <Link
                  to={studioHref}
                  className="inline-flex min-h-11 items-center gap-2 font-heading text-lg font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  {workshop.studioName}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              )}
              {address && (
                <p className="mt-1 text-sm leading-relaxed text-stone-700">
                  {address}
                </p>
              )}
              {hasAddress && (
                <iframe
                  title="Bản đồ studio"
                  className="mt-3 h-52 w-full rounded-lg border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={
                    'https://maps.google.com/maps?q=' +
                    encodeURIComponent(address) +
                    '&output=embed'
                  }
                />
              )}
              {address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hasAddress ? workshop.studioName : '', address].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                  {hasAddress ? 'Xem đường đi' : 'Xem khu vực trên bản đồ'}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              )}
            </section>
          )}
        </aside>
        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          {description && (
            <DetailSection
              id="experience-heading"
              title="Một buổi để tự tay làm"
            >
              <p className="whitespace-pre-line text-base leading-7 text-stone-700">
                {description}
              </p>
            </DetailSection>
          )}
          {((takeaway && takeaway !== description) ||
            workshop.durationMinutes > 0 ||
            level ||
            audience.length > 0 ||
            preparation) && (
            <DetailSection id="prepare-heading" title="Cần biết">
              <dl className="grid gap-5 sm:grid-cols-2">
                {workshop.durationMinutes > 0 && (
                  <div>
                    <dt className="text-sm text-stone-700">Thời lượng</dt>
                    <dd className="mt-1 font-semibold">
                      {workshop.durationMinutes} phút
                    </dd>
                  </div>
                )}
                {level && (
                  <div>
                    <dt className="text-sm text-stone-700">Dành cho</dt>
                    <dd className="mt-1 font-semibold">{level}</dd>
                  </div>
                )}
                {audience.length > 0 && (
                  <div>
                    <dt className="text-sm text-stone-700">Phù hợp với</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {audience.map((label) => (
                        <span
                          key={label}
                          className="rounded-md bg-beige px-3 py-1 text-sm font-semibold text-stone-700"
                        >
                          {label}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {preparation && (
                  <div>
                    <dt className="text-sm text-stone-700">
                      {/mang|chuẩn bị/i.test(preparation)
                        ? 'Cần mang theo'
                        : 'Lưu ý tham gia'}
                    </dt>
                    <dd className="mt-1 whitespace-pre-line leading-relaxed">
                      {preparation}
                    </dd>
                  </div>
                )}
              </dl>
            </DetailSection>
          )}
          {workshopText(workshop.artistName) && (
            <DetailSection id="maker-heading" title="Người cùng bạn thực hiện">
              <div className="flex items-start gap-4">
                <MediaImage
                  src={workshop.artistPhoto}
                  alt={workshop.artistName!}
                  placeholder={workshop.artistName!.slice(0, 1)}
                  width={80}
                  height={80}
                  className="size-16 shrink-0 rounded-full"
                />
                <div>
                  <h3 className="font-heading text-xl font-semibold">
                    {workshop.artistName}
                  </h3>
                  {workshopText(workshop.artistIntro) && (
                    <p className="mt-2 text-sm leading-relaxed text-stone-700">
                      {workshop.artistIntro}
                    </p>
                  )}
                </div>
              </div>
            </DetailSection>
          )}
          {reviews.length > 0 && (
            <DetailSection id="reviews-heading" title="Đánh giá">
              <div className="space-y-4">
                {reviews.slice(0, 3).map((review) => (
                  <article key={review.id} className="rounded-xl bg-soft p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {workshopText(review.author) && (
                        <h3 className="font-semibold">{review.author}</h3>
                      )}
                      <span
                        className="inline-flex items-center gap-1 text-sm font-bold"
                        aria-label={`${review.rating} trên 5`}
                      >
                        <Star
                          size={15}
                          className="fill-current text-rating"
                          aria-hidden="true"
                        />
                        {review.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">
                      {review.comment}
                    </p>
                  </article>
                ))}
              </div>
            </DetailSection>
          )}
          {takeaway && takeaway !== description && (
            <DetailSection id="takeaway-heading" title="Bạn sẽ nhận được">
              <p className="whitespace-pre-line text-stone-700">{takeaway}</p>
            </DetailSection>
          )}
          <DetailSection id="included-heading" title="Bao gồm">
            {included.length ? (
              <ul className="list-disc space-y-2 pl-5 text-stone-700">
                {included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-700">
                Studio chưa cập nhật danh sách bao gồm. Bạn có thể liên hệ
                studio để biết thêm.
              </p>
            )}
          </DetailSection>
          {(cancellationPolicy || paymentPolicy) && (
            <DetailSection id="policies-heading" title="Chính sách">
              {cancellationPolicy && (
                <div className={included.length > 0 ? 'mt-5' : ''}>
                  <h3 className="font-semibold">Chính sách hủy</h3>
                  <p className="mt-2 whitespace-pre-line leading-relaxed text-stone-700">
                    {cancellationPolicy}
                  </p>
                </div>
              )}
              {paymentPolicy && (
                <div
                  className={
                    included.length || cancellationPolicy ? 'mt-5' : ''
                  }
                >
                  <h3 className="font-semibold">Chính sách thanh toán</h3>
                  <p className="mt-2 whitespace-pre-line leading-relaxed text-stone-700">
                    {paymentPolicy}
                  </p>
                </div>
              )}
            </DetailSection>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <DetailSection
          id="related-heading"
          title="Gợi ý cho bạn"
          className="pb-8"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {related.map((item) => (
              <WorkshopCard key={item.id} workshop={item} />
            ))}
          </div>
        </DetailSection>
      )}
    </>
  );
}
