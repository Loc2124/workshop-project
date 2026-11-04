import { memo } from 'react';
import { Link } from 'react-router-dom';
import { StudioTrustBadge } from '../ui/StudioTrustBadge';
import { formatCategoryLabel } from '../../lib/format';
import { TicketPrice, TicketRating } from '../tickets/TicketContent';
import { TicketAction } from '../tickets/TicketPrimitives';
import { TicketStub } from '../tickets/TicketStub';
import type { StudioListing } from '../../types/studio';

export const StudioCard = memo(function StudioCard({
  studio,
  priority = false,
}: {
  studio: StudioListing;
  priority?: boolean;
}) {
  return (
    <Link
      to={`/studios/${studio.slug ?? studio.id}`}
      aria-label={`Xem studio ${studio.name}`}
      className="studio-card horizontal-ticket group block h-full min-w-0 rounded-ticket text-ink focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary motion-safe:transition-transform motion-safe:hover:-translate-y-0.5"
    >
      <article className="flex h-full min-w-0 overflow-hidden rounded-ticket border border-stone-200 bg-stone-50">
        <TicketStub
          imageUrl={studio.imageUrl}
          thumbnailUrl={studio.thumbnailUrl}
          priority={priority}
          categoryId={studio.categoryId}
          alt={`Không gian ${studio.name}`}
        >
          <span className="font-heading text-4xl font-bold leading-none">
            {studio.workshopCount}
          </span>
          <span className="mt-2 text-[13px] font-bold">WORKSHOP</span>
        </TicketStub>
        <div className="@container flex min-w-0 flex-1 flex-col p-3 lg:p-5">
          <p className="text-[13px] font-bold text-stone-700">
            {studio.categoryIds.map(formatCategoryLabel).join(' · ') ||
              'Studio sáng tạo'}
          </p>
          <h3
            title={studio.name}
            className="mt-2 line-clamp-2 font-heading text-lg font-bold leading-tight"
          >
            {studio.name}
          </h3>
          <div className="mt-2">
            <StudioTrustBadge level={studio.trustLevel} />
          </div>
          <p className="mt-2 text-[13px] text-stone-700">
            {[studio.areaName, studio.province].filter(Boolean).join(' · ')}
          </p>
          <p className="mb-4 mt-2 line-clamp-2 text-[13px] text-stone-700">
            {studio.description}
          </p>
          <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-stone-400 pt-3 text-[13px] @min-[22rem]:flex-nowrap">
            <div className="flex flex-col items-start gap-y-1">
              {studio.startingPrice !== null ? (
                <>
                  <span className="text-[13px] text-stone-700">Từ</span>
                  <TicketPrice
                    price={studio.startingPrice}
                    compact
                    className="text-lg tabular-nums [&>span]:hidden"
                  />
                </>
              ) : (
                <span className="text-sm text-stone-700">
                  Chưa có lịch tổ chức
                </span>
              )}
              <TicketRating
                workshop={{
                  id: studio.id,
                  title: studio.name,
                  categoryId: '',
                  price: studio.startingPrice ?? 0,
                  rating: studio.rating,
                  ratingCount: studio.reviewCount,
                }}
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-lg border border-green-300 bg-green-50 px-2.5 py-1.5 text-[13px] font-bold text-green-800">
                {studio.availableSessions} buổi còn chỗ
              </span>
              <TicketAction />
            </div>
          </footer>
        </div>
      </article>
    </Link>
  );
});
