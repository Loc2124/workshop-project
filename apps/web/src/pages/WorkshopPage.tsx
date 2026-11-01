import { useParams } from 'react-router-dom';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';
import { PageContainer } from '../components/layout/PageContainer';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SiteHeader } from '../components/layout/SiteHeader';
import { DetailState } from '../components/details/DetailPrimitives';
import { WorkshopDetails } from '../components/details/WorkshopDetails';
import type { WorkshopBookingHandler } from '../components/details/WorkshopSchedule';
import { workshopSuggestions, workshopText } from '../components/details/workshopPresentation';
import { mockWorkshops } from '../data/mockWorkshops';
import { useCatalog, useWorkshop } from '../hooks/useCatalog';

export function WorkshopPage({
  onBook,
}: { onBook?: WorkshopBookingHandler } = {}) {
  const { id, slug } = useParams();
  const identifier = slug ?? id ?? '';
  const sampleWorkshop = mockWorkshops.find(
    (workshop) => workshop.id === identifier || workshop.slug === identifier,
  );
  const query = useWorkshop(sampleWorkshop ? '' : identifier);
  const workshop = sampleWorkshop ?? query.data?.workshop;
  const relatedQuery = useCatalog(
    { page: 1, pageSize: 100 },
    Boolean(workshop) && !sampleWorkshop,
  );
  const related = workshop
    ? workshopSuggestions(
        workshop,
        sampleWorkshop ? mockWorkshops : (relatedQuery.data?.items ?? []),
      )
    : [];
  return (
    <div className="min-h-screen bg-paper pb-28 text-ink lg:pb-0">
      <SiteHeader />
      <PageContainer as="main" className="pb-12">
        <PageBreadcrumb
          className="py-4"
          items={[
            { label: 'Khám phá', href: '/kham-pha' },
            ...(workshop && workshopText(workshop.studioName)
              ? [
                  {
                    label: workshop.studioName,
                    href: `/xuong/${workshop.studioSlug ?? workshop.studioId}`,
                  },
                ]
              : []),
            { label: workshop?.title ?? 'Workshop' },
          ]}
        />
        {workshop ? (
          <WorkshopDetails
            key={workshop.id}
            workshop={workshop}
            related={related}
            onBook={onBook}
          />
        ) : (
          <DetailState
            loading={query.isLoading}
            error={query.isError}
            label="workshop"
            onRetry={() => void query.refetch()}
          />
        )}
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
