import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { FeaturedStudio } from '../../services/featuredService';
import { PageContainer } from '../layout/PageContainer';
import { SectionHeading } from '../layout/SectionHeading';
import { MediaImage } from '../ui/MediaImage';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
export function HomeFeaturedStudios({
  studios,
  loading,
  error,
  refetch,
}: {
  studios: FeaturedStudio[];
  loading: boolean;
  error: boolean;
  refetch: () => void;
}) {
  return (
    <PageContainer
      as="section"
      className="py-12 md:py-20"
      aria-labelledby="featured-studios-title"
    >
      <SectionHeading
        id="featured-studios-title"
        title="Studio nổi bật"
        description="Những không gian để gặp gỡ, khám phá và tự tay làm điều mình thích."
      />
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg bg-soft p-5 text-sm" role="alert">
          <p>Chưa tải được studio nổi bật.</p>
          <Button className="mt-3" variant="outline" onClick={refetch}>
            Thử lại
          </Button>
        </div>
      ) : !studios.length ? (
        <p className="rounded-lg bg-soft p-5 text-sm text-muted">
          Chưa có studio công khai để giới thiệu.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {studios.map((studio) => (
            <Link
              key={studio.id}
              to={`/studios/${studio.slug}`}
              className="group overflow-hidden rounded-lg border border-line bg-surface focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MediaImage
                src={studio.imageUrl}
                alt={`Không gian ${studio.name}`}
                placeholder={studio.name}
                className="aspect-[4/3] w-full"
                loading="lazy"
              />
              <div className="space-y-2 p-4">
                <p className="text-xs text-muted">{studio.province}</p>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-xl font-semibold group-hover:text-primary">
                    {studio.name}
                  </h3>
                  <ArrowUpRight
                    size={17}
                    className="mt-1 shrink-0 text-muted"
                  />
                </div>
                {studio.description && (
                  <p className="line-clamp-2 text-sm leading-6 text-muted">
                    {studio.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
