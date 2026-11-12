import { useParams } from 'react-router-dom';
import { DetailState } from '../../components/details/DetailPrimitives';
import { WorkshopDetails } from '../../components/details/WorkshopDetails';
import type { WorkshopBookingHandler } from '../../components/details/WorkshopSchedule';
import {
  workshopSuggestions,
  workshopText,
} from '../../components/details/workshopPresentation';
import { PageBreadcrumb } from '../../components/layout/PageBreadcrumb';
import { PageContainer } from '../../components/layout/PageContainer';
import { ReportButton } from '../../components/reports/ReportButton';
import {
  useCatalog,
  useWorkshop,
  useWorkshopReviews,
} from '../../hooks/useCatalog';
import { ApiError } from '../../lib/api-client';
import { useAuth } from '../../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerBookingService } from '../../services/customerBookingService';
import { queryKeys } from '../../lib/query-keys';
export function WorkshopPage({
  onBook,
}: {
  onBook?: WorkshopBookingHandler;
} = {}) {
  const { id, slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const identifier = slug ?? id ?? '';
  const query = useWorkshop(identifier);
  const sourceWorkshop = query.data?.workshop;
  const reviews = useWorkshopReviews(identifier);
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
    Boolean(identifier),
  );
  const related = workshop
    ? workshopSuggestions(workshop, relatedQuery.data?.items ?? [])
    : [];
  const notFound =
    query.error instanceof ApiError && query.error.status === 404;
  const handleBooking: WorkshopBookingHandler | undefined =
    onBook ??
    (user?.role === 'customer'
      ? async ({ sessionId, quantity, paymentChoice }) => {
          const result = await customerBookingService.create(
            {
              sessionId,
              quantity,
              paymentChoice,
            },
            user.id,
            `workshop:${workshop?.id ?? identifier}`,
          );
          await queryClient.invalidateQueries({
            queryKey: queryKeys.bookings.all(user.id),
          });
          if (!result.checkoutUrl) {
            navigate(`/me/bookings/${result.booking.id}`);
          }
          return {
            id: result.booking.id,
            checkoutUrl: result.checkoutUrl,
            checkoutQrCode: result.checkoutQrCode,
          };
        }
      : undefined);
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
              onBook={handleBooking}
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
