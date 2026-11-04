import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CategoryShortcuts } from '../components/catalog/CategoryShortcuts';
import {
  DetailSection,
  DetailState,
} from '../components/details/DetailPrimitives';
import { StudioHero } from '../components/details/StudioHero';
import { StudioPhotoGrid } from '../components/details/StudioPhotoGrid';
import {
  StudioArtists,
  StudioExtras,
  StudioSidebar,
} from '../components/details/StudioSections';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';
import { PageContainer } from '../components/layout/PageContainer';
import { ReportButton } from '../components/reports/ReportButton';
import { TicketCard, toTicketProps } from '../components/tickets';
import { ApiError } from '../lib/api-client';
import { rankWorkshops } from '../lib/rankWorkshops';
import { catalogService } from '../services/catalogService';
import type { PublicStudio, Studio } from '../types/studio';
import type { Workshop } from '../types/workshop';
function StudioDetails({
  studio,
  workshops,
}: {
  studio: Studio | PublicStudio;
  workshops: Workshop[];
}) {
  const [category, setCategory] = useState('');
  const sorted = useMemo(() => rankWorkshops(workshops), [workshops]);
  const categoryIds = [...new Set(workshops.map((item) => item.categoryId))];
  const visible = category
    ? sorted.filter((item) => item.categoryId === category)
    : sorted;
  return (
    <>
      <StudioHero
        studio={studio}
        workshops={workshops}
        imageUrl={studio.photoUrls?.[0]}
      />
      <div className="mt-3 flex justify-end">
        <ReportButton
          key={studio.id}
          targetType="studio"
          targetId={studio.id}
        />
      </div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <DetailSection
            id="studio-workshops-heading"
            title="Workshop tại studio"
            className="min-w-0 scroll-mt-24"
          >
            <div id="workshop-tai-studio" className="scroll-mt-24">
              {categoryIds.length > 1 && (
                <div className="mb-4">
                  <CategoryShortcuts
                    workshops={workshops}
                    selected={category}
                    onSelect={(value) => setCategory(value ?? '')}
                  />
                </div>
              )}
              {visible.length ? (
                <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
                  {visible.map((workshop) => (
                    <TicketCard
                      key={workshop.id}
                      {...toTicketProps(workshop)}
                    />
                  ))}
                </div>
              ) : (
                <p
                  role="status"
                  className="rounded-xl bg-soft p-5 text-sm text-stone-700"
                >
                  Studio chưa có workshop thuộc bộ môn này.
                </p>
              )}
            </div>
          </DetailSection>
          <StudioArtists workshops={workshops} />
          {!!studio.photoUrls?.length && (
            <DetailSection id="studio-photos-heading" title="Không gian studio">
              <StudioPhotoGrid
                name={studio.name}
                urls={studio.photoUrls}
                images={studio.photoImages}
              />
            </DetailSection>
          )}
          <StudioExtras studio={studio} />
        </div>
        <aside
          aria-label="Địa chỉ studio"
          className="sticky top-20 min-w-0 self-start"
        >
          <StudioSidebar studio={studio} />
        </aside>
      </div>
    </>
  );
}
export function StudioPage() {
  const { id, slug } = useParams();
  const identifier = slug ?? id ?? '';
  const query = useQuery({
    queryKey: ['catalog', 'studios', 'detail', identifier],
    queryFn: ({ signal }) => catalogService.getStudioById(identifier, signal),
    enabled: Boolean(identifier) && true,
  });
  const studio = query.data?.studio;
  const workshops = query.data?.studio.workshops ?? [];
  const notFound =
    query.error instanceof ApiError && query.error.status === 404;
  return (
    <>
      <PageContainer as="main" className="pb-6 md:pb-8">
        <PageBreadcrumb
          className="py-4"
          items={[
            { label: 'Khám phá', href: '/kham-pha?view=studio' },
            { label: studio?.name ?? 'Studio' },
          ]}
        />
        {studio ? (
          <StudioDetails
            key={studio.id}
            studio={studio}
            workshops={workshops}
          />
        ) : (
          <DetailState
            loading={query.isLoading}
            error={query.isError && !notFound}
            label="studio"
            onRetry={() => void query.refetch()}
          />
        )}
      </PageContainer>
    </>
  );
}
