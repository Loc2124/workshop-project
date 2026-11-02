import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { useHomeCatalog } from '../../hooks/useHomeCatalog';
import { PageContainer } from '../layout/PageContainer';
import { SectionHeading } from '../layout/SectionHeading';
import { Button } from '../ui/button';
import { WorkshopGrid } from '../catalog/WorkshopGrid';
import { WorkshopCard } from '../catalog/WorkshopCard';

type Props = Pick<
  ReturnType<typeof useHomeCatalog>,
  'featuredWorkshops' | 'browseUrl' | 'loading' | 'error' | 'refetch'
>;

export function HomeWorkshopSection({
  featuredWorkshops,
  browseUrl,
  loading,
  error,
  refetch,
}: Props) {
  return (
    <PageContainer
      as="section"
      id="workshops"
      aria-labelledby="featured-title"
      className="home-schedule"
    >
      <SectionHeading
        id="featured-title"
        title="Workshop nổi bật"
        description="Chọn một trải nghiệm, dành thời gian cho điều bạn thích."
        action={
          <Button asChild variant="link" className="px-0">
            <Link to={browseUrl}>
              Xem tất cả
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      {loading ? (
        <WorkshopGrid workshops={[]} columns="home" loading error={false} />
      ) : error || !featuredWorkshops.length ? (
        <div className="rounded-2xl bg-soft p-6" role="status">
          <p>
            {error
              ? 'Chưa tải được workshop. Bạn có thể thử lại.'
              : 'Chưa có workshop công khai để giới thiệu.'}
          </p>
          {error && (
            <Button type="button" onClick={refetch} className="mt-4">
              Thử lại
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {featuredWorkshops.map((workshop) => (
            <div key={workshop.id}>
              <WorkshopCard workshop={workshop} variant="default" />
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
