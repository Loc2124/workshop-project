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
  | 'featuredWorkshops'
  | 'provinceName'
  | 'browseUrl'
  | 'loading'
  | 'error'
  | 'refetch'
>;

export function HomeWorkshopSection({
  featuredWorkshops,
  provinceName,
  browseUrl,
  loading,
  error,
  refetch,
}: Props) {
  const simulated =
    import.meta.env.DEV ||
    featuredWorkshops.some((workshop) => workshop.isSimulated);
  return (
    <PageContainer
      as="section"
      id="workshops"
      aria-labelledby="featured-title"
      className="home-schedule"
    >
      <SectionHeading
        id="featured-title"
        title={
          <>Những buổi hẹn sắp tới{provinceName ? ` ở ${provinceName}` : ''}</>
        }
        description={
          <>
            {provinceName
              ? `Khám phá workshop ở ${provinceName}.`
              : 'Chọn một buổi, dành thời gian cho điều bạn thích.'}
            {simulated && ' Dữ liệu mô phỏng.'}
          </>
        }
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
              : 'Chưa có workshop tại đây. Hãy thử tỉnh, thành phố khác.'}
          </p>
          {error && (
            <Button type="button" onClick={refetch} className="mt-4">
              Thử lại
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {featuredWorkshops.map((workshop, index) => (
            <div key={workshop.id} className={index === 0 ? 'md:col-span-2' : undefined}>
              <WorkshopCard workshop={workshop} variant={index === 0 ? 'featured' : 'default'} />
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
