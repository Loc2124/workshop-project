import { cn } from '../../lib/utils';
import type { ReactNode } from 'react';
import { TicketCard } from '../tickets';
import type { Workshop } from '../../types/workshop';
import type { StudioListing } from '../../types/studio';
import type { CatalogView } from './ViewToggle';
import { StudioCard } from './StudioCard';
import { WorkshopCard } from './WorkshopCard';

type Props = {
  workshops: Workshop[];
  studios?: StudioListing[];
  view?: CatalogView;
  columns?: 'default' | 'home';
  loading: boolean;
  error: boolean;
  emptyMessage?: string;
  emptyState?: ReactNode;
};

export function WorkshopGrid({
  workshops,
  studios = [],
  view = 'workshops',
  columns = 'default',
  loading,
  error,
  emptyMessage,
  emptyState,
}: Props) {
  const gridClass = cn(
    'grid grid-cols-1 items-stretch gap-5 md:grid-cols-2',
    columns === 'home' && 'home-workshop-list',
  );
  const isEmpty =
    view === 'studios' ? studios.length === 0 : workshops.length === 0;
  if (loading && view === 'workshops')
    return (
      <div className={gridClass}>
        {Array.from({ length: 6 }, (_, index) => (
          <TicketCard key={index} loading />
        ))}
      </div>
    );
  if (loading || error || isEmpty) {
    return (
      <div
        aria-live="polite"
        className="rounded-lg border border-line bg-surface px-6 py-12 text-center text-base text-muted"
      >
        {loading
          ? 'Đang tìm workshop phù hợp…'
          : error
            ? 'Chưa tải được danh sách workshop. Vui lòng thử lại sau.'
            : emptyState ?? emptyMessage ?? `Chưa có ${view === 'studios' ? 'studio' : 'workshop'} phù hợp. Hãy thử thay đổi bộ lọc.`}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {view === 'studios'
        ? studios.map((studio, index) => (
            <StudioCard key={studio.id} studio={studio} priority={index < 2} />
          ))
        : workshops.map((workshop, index) => (
            <WorkshopCard
              key={workshop.id}
              workshop={workshop}
              priority={index < 2}
            />
          ))}
    </div>
  );
}
