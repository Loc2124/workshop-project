import { LoadingState } from '../ui/LoadingState';
import { StudioTrustBadge } from '../ui/StudioTrustBadge';
import { StudioEvidenceEditor } from './StudioEvidenceEditor';
import { AuthLink } from '../ui/auth-link';
import { studioApplicationStatus } from '@/lib/studio-application-status';
import { useSiteInformation } from '@/hooks/useSiteInformation';
import { Link } from 'react-router-dom';
import type { AuthUser } from '@/services/authService';
import type {
  MemberStudio,
  StudioSession,
  StudioWorkshop,
} from '@/types/management';
import { StudioSessionManager } from './StudioSessionManager';
import { StudioWorkshopManager } from './StudioWorkshopManager';
import { Button } from '../ui/button';
import { useCategories } from '@/hooks/useCategories';
import { categories as localCategories } from '@/constants/categories';

type Props = {
  user: AuthUser | null;
  authLoading: boolean;
  authError: Error | null;
  studiosLoading: boolean;
  studiosError: Error | null;
  studio: MemberStudio | undefined;
  retryAuth: () => void;
  retryStudios: () => void;
  workshops: StudioWorkshop[] | undefined;
  workshopsLoading: boolean;
  workshopsError: Error | null;
  retryWorkshops: () => void;
  sessions: StudioSession[] | undefined;
  sessionsLoading: boolean;
  sessionsError: Error | null;
  retrySessions: () => void;
};

export function StudioManagementContent({
  user,
  authLoading,
  authError,
  studiosLoading,
  studiosError,
  studio,
  retryAuth,
  retryStudios,
  workshops,
  workshopsLoading,
  workshopsError,
  retryWorkshops,
  sessions,
  sessionsLoading,
  sessionsError,
  retrySessions,
}: Props) {
  const { siteContact } = useSiteInformation();
  const categories = useCategories();
  if (authLoading || studiosLoading || workshopsLoading || sessionsLoading) {
    return (
      <LoadingState
        label={
          authLoading || studiosLoading
            ? 'Đang kiểm tra quyền truy cập studio…'
            : 'Đang tải thông tin studio…'
        }
        variant="page"
      />
    );
  }

  if (authError) {
    return (
      <section className="space-y-4 py-12">
        <h1 className="font-heading text-3xl font-semibold">
          Không thể mở trang quản lý
        </h1>
        <p className="text-brick" role="alert">
          Không thể kiểm tra phiên đăng nhập: {authError.message}
        </p>
        <Button onClick={retryAuth} type="button" variant="outline">
          Thử lại
        </Button>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-12">
        <h1 className="font-heading text-3xl font-semibold">
          Đăng nhập để quản lý studio
        </h1>
        <Button asChild className="mt-6">
          <AuthLink to="/dang-nhap">Đăng nhập</AuthLink>
        </Button>
      </section>
    );
  }

  if (studiosError) {
    return (
      <section className="space-y-4 py-12">
        <h1 className="font-heading text-3xl font-semibold">
          Không thể mở trang quản lý
        </h1>
        <p className="text-brick" role="alert">
          Không thể xác minh thành viên studio: {studiosError.message}
        </p>
        <Button onClick={retryStudios} type="button" variant="outline">
          Thử lại
        </Button>
      </section>
    );
  }

  if (!studio) {
    return (
      <section className="py-12">
        <h1 className="font-heading text-3xl font-semibold">
          Bạn không có quyền quản lý studio này
        </h1>
        <p className="mt-3 text-muted">
          Chỉ thành viên của studio mới xem được nội dung quản lý.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/studio">Về danh sách studio</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          to="/studio"
        >
          Danh sách studio
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold md:text-4xl">
              {studio.name}
            </h1>
            <StudioTrustBadge level={studio.trustLevel} explain />
            {studio.proposedCategoryName && (
              <p className="mt-2 break-words text-sm text-muted">
                Loại đề xuất: {studio.proposedCategoryName} (chưa được duyệt)
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              Loại workshop:{' '}
              {(studio.categoryIds ?? [studio.categoryId])
                .map(
                  (id) =>
                    (categories ?? localCategories).find(
                      (category) => category.id === id,
                    )?.name ?? id,
                )
                .join(', ')}
            </p>
            <p className="mt-2 text-muted">
              {[studio.area, studio.province].filter(Boolean).join(', ') ||
                studio.address}
            </p>
          </div>
          <span className="rounded-full bg-soft px-3 py-1 text-sm font-semibold">
            {studio.role === 'owner' ? 'Chủ studio' : 'Nhân viên'}
          </span>
        </div>
        {studio.status === 'approved' && (
          <Link
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            to={`/studios/${encodeURIComponent(studio.slug)}`}
          >
            Xem trang công khai
          </Link>
        )}
      </header>

      <section
        aria-label="Trạng thái hồ sơ studio"
        className="rounded-xl bg-soft p-5 md:p-6"
      >
        <h2 className="font-heading text-2xl font-semibold text-primary">
          {studioApplicationStatus[studio.status].title}
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted">
          {studioApplicationStatus[studio.status].description}
        </p>
        {studio.status === 'rejected' && siteContact.hotline && (
          <a
            href={`tel:${siteContact.hotline.replace(/\s/g, '')}`}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Liên hệ hỗ trợ: {siteContact.hotline}
          </a>
        )}
      </section>

      {studio.role === 'owner' && (
        <StudioEvidenceEditor key={studio.id} studio={studio} />
      )}
      <StudioWorkshopManager
        error={workshopsError}
        isLoading={workshopsLoading}
        onRetry={retryWorkshops}
        studio={studio}
        workshops={workshops}
      />
      <StudioSessionManager
        error={sessionsError}
        isLoading={sessionsLoading}
        onRetry={retrySessions}
        sessions={sessions}
        studio={studio}
        workshops={workshops}
      />
    </div>
  );
}
