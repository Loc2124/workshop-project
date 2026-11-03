import { lazy, Suspense } from 'react';
import { MapPin } from 'lucide-react';
import { Deferred } from '../ui/Deferred';
import { Skeleton } from '../ui/skeleton';
import { WorkshopRating } from './WorkshopRating';
import { SimulatedDataBadge } from '../ui/SimulatedDataBadge';
import type { Workshop } from '../../types/workshop';
import type { WorkshopBookingHandler } from './WorkshopSchedule';
const Schedule = lazy(() =>
  import('./WorkshopSchedule').then((module) => ({
    default: module.WorkshopSchedule,
  })),
);
export function DeferredSchedule({
  workshop,
  onBook,
}: {
  workshop: Workshop;
  onBook?: WorkshopBookingHandler;
}) {
  const fallback = (
    <section
      id="lich-trai-nghiem"
      aria-labelledby="booking-title"
      className="scroll-mt-24 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h1
          id="booking-title"
          className="font-heading text-2xl font-semibold leading-tight"
        >
          {workshop.title}
        </h1>
        {workshop.isSimulated && <SimulatedDataBadge />}
      </div>
      <div className="mt-3">
        <WorkshopRating workshop={workshop} />
      </div>
      <p className="mt-3 flex items-start gap-2 text-sm text-stone-700">
        <MapPin size={16} />
        {workshop.province}
      </p>
      <div className="mt-5 space-y-5" role="status" aria-label="Đang tải lịch">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </section>
  );
  return (
    <Deferred minHeight={460} fallback={fallback}>
      <Suspense fallback={fallback}>
        <Schedule workshop={workshop} onBook={onBook} />
      </Suspense>
    </Deferred>
  );
}
