import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { useHomeCatalog } from '../../hooks/useHomeCatalog';
import { PageContainer } from '../layout/PageContainer';
import { SectionHeading } from '../layout/SectionHeading';
import { Button } from '../ui/button';
import { TicketRow, toTicketProps } from '../tickets';
import type { Workshop } from '../../types/workshop';
import { useSessionClock } from '../../hooks/useSessionClock';
import { sessionStatus } from '../../lib/sessionStatus';

type Props = Pick<
  ReturnType<typeof useHomeCatalog>,
  'browseUrl' | 'loading' | 'error' | 'refetch'
> & { featuredWorkshops: Workshop[] };

export function HomeWorkshopSection({
  featuredWorkshops,
  browseUrl,
  loading,
  error,
  refetch,
}: Props) {
  const now = useSessionClock(
    featuredWorkshops.flatMap((workshop) => workshop.sessions),
  );
  const bookable = featuredWorkshops.filter((workshop) =>
    workshop.sessions.some(
      (session) => sessionStatus(session, now) === 'available',
    ),
  );
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
        <div className="home-workshop-list grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className={index === 0 ? 'lg:col-span-2' : undefined}
            >
              <TicketRow loading />
            </div>
          ))}
        </div>
      ) : error || !bookable.length ? (
        <div className="rounded-2xl bg-soft p-6" role="status">
          <p>
            {error
              ? 'Chưa tải được workshop. Bạn có thể thử lại.'
              : 'Hiện chưa có workshop đang nhận đăng ký.'}
          </p>
          {error && (
            <Button type="button" onClick={refetch} className="mt-4">
              Thử lại
            </Button>
          )}
          {!error && (
            <Button asChild className="mt-4">
              <Link to={browseUrl}>Khám phá workshop</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="home-workshop-list grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
          {bookable.map((workshop, index) => (
            <div
              key={workshop.id}
              className={index === 0 ? 'lg:col-span-2' : undefined}
            >
              <TicketRow
                {...toTicketProps(workshop, now)}
                featured={index === 0}
                priority={index === 0}
              />
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
