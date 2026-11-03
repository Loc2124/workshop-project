import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../lib/api-client';
import { ReportButton } from '../components/reports/ReportButton';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';
import { PageContainer } from '../components/layout/PageContainer';
import { DetailState } from '../components/details/DetailPrimitives';
import { WorkshopDetails } from '../components/details/WorkshopDetails';
import type { WorkshopBookingHandler } from '../components/details/WorkshopSchedule';
import {
  workshopSuggestions,
  workshopText,
} from '../components/details/workshopPresentation';
import { mockWorkshops } from '../data/mockWorkshops';
import { useCatalog, useWorkshop } from '../hooks/useCatalog';
import { isDemoDataMode } from '../lib/data-mode';
import { ApiError } from '../lib/api-client';

export function WorkshopPage({
  onBook,
}: { onBook?: WorkshopBookingHandler } = {}) {
  const { id, slug } = useParams();
  const identifier = slug ?? id ?? '';
  const sampleWorkshop = isDemoDataMode
    ? mockWorkshops.find(
        (workshop) =>
          workshop.id === identifier || workshop.slug === identifier,
      )
    : undefined;
  const query = useWorkshop(isDemoDataMode && sampleWorkshop ? '' : identifier);
  const sourceWorkshop = sampleWorkshop ?? query.data?.workshop;
  const reviews = useQuery({
    queryKey: ['catalog', 'reviews', sourceWorkshop?.id],
    enabled: !!sourceWorkshop && !isDemoDataMode,
    queryFn: async ({ signal }) =>
      z
        .object({
          reviews: z.array(
            z.object({
              id: z.string(),
              author: z.string(),
              rating: z.number(),
              comment: z.string(),
              createdAt: z.string(),
            }),
          ),
        })
        .parse(
          await apiFetch(`/workshops/${sourceWorkshop!.id}/reviews`, {
            signal,
          }),
        ).reviews,
  });
  const workshop =
    sourceWorkshop && reviews.data
      ? {
          ...sourceWorkshop,
          reviews: reviews.data,
          reviewCount: reviews.data.length,
          rating: reviews.data.length
            ? reviews.data.reduce((sum, r) => sum + r.rating, 0) /
              reviews.data.length
            : undefined,
        }
      : sourceWorkshop;
  const relatedQuery = useCatalog(
    { page: 1, pageSize: 100 },
    Boolean(workshop) && !isDemoDataMode,
  );
  const related = workshop
    ? workshopSuggestions(
        workshop,
        sampleWorkshop ? mockWorkshops : (relatedQuery.data?.items ?? []),
      )
    : [];
  const notFound =
    query.error instanceof ApiError && query.error.status === 404;
  return (
    <>
      <PageContainer as="main" className="pb-12">
        <PageBreadcrumb
          className="py-4"
          items={[
            { label: 'Khám phá', href: '/kham-pha' },
            ...(workshop && workshopText(workshop.studioName)
              ? [
                  {
                    label: workshop.studioName,
                    href: `/studios/${workshop.studioSlug ?? workshop.studioId}`,
                  },
                ]
              : []),
            { label: workshop?.title ?? 'Workshop' },
          ]}
        />
        {workshop ? (
          <>
            <div className="mb-3 flex justify-end">
              <ReportButton
                key={workshop.id}
                targetType="workshop"
                targetId={workshop.id}
              />
            </div>
            <WorkshopDetails
              key={workshop.id}
              workshop={workshop}
              related={related}
              onBook={onBook}
            />
          </>
        ) : (
          <DetailState
            loading={query.isLoading}
            error={query.isError && !notFound}
            label="workshop"
            onRetry={() => void query.refetch()}
          />
        )}
      </PageContainer>
    </>
  );
}
