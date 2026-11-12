import type { FeaturedStudio } from '@/services/featuredService';
import { PageContainer } from '../layout/PageContainer';
import { SectionHeading } from '../layout/SectionHeading';
import { StudioCard } from '../catalog/StudioCard';
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-ticket" />
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
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {studios.map((studio) => (
            <StudioCard key={studio.id} studio={studio} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
