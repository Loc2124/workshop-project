import { LoadingState } from '../ui/LoadingState';
import { StudioTrustBadge } from '../ui/StudioTrustBadge';
import { AuthLink } from '../ui/auth-link';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { studioApplicationStatus } from '@/lib/studio-application-status';
import type { AuthUser } from '@/services/authService';
import type { MemberStudio } from '@/types/management';

type Props = {
  user: AuthUser | null;
  authLoading: boolean;
  authError: Error | null;
  retryAuth: () => void;
  studios: MemberStudio[] | undefined;
  studiosLoading: boolean;
  studiosError: Error | null;
  retryStudios: () => void;
};

const roleLabels = {
  owner: 'Chủ studio',
  staff: 'Nhân viên',
} as const;

export function StudioOverview({
  user,
  authLoading,
  authError,
  retryAuth,
  studios,
  studiosLoading,
  studiosError,
  retryStudios,
}: Props) {
  if (authLoading) {
    return (
      <LoadingState label="Đang kiểm tra phiên đăng nhập…" variant="page" />
    );
  }

  if (authError) {
    return (
      <section className="space-y-4 py-12" aria-labelledby="overview-title">
        <h1 className="font-heading text-3xl font-semibold" id="overview-title">
          Quản lý studio
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
      <section className="py-12" aria-labelledby="overview-title">
        <h1 className="font-heading text-3xl font-semibold" id="overview-title">
          Quản lý studio
        </h1>
        <p className="mt-3 text-muted">
          Đăng nhập để xem những studio bạn tham gia.
        </p>
        <Button asChild className="mt-6">
          <AuthLink to="/dang-nhap">Đăng nhập</AuthLink>
        </Button>
      </section>
    );
  }

  if (studiosLoading) {
    return <LoadingState label="Đang tải danh sách studio…" variant="page" />;
  }

  if (studiosError) {
    return (
      <section className="space-y-4 py-12" aria-labelledby="overview-title">
        <h1 className="font-heading text-3xl font-semibold" id="overview-title">
          Studio bạn tham gia
        </h1>
        <p className="text-brick" role="alert">
          Không thể tải danh sách studio: {studiosError.message}
        </p>
        <Button onClick={retryStudios} type="button" variant="outline">
          Tải lại danh sách
        </Button>
      </section>
    );
  }

  if (!studios?.length) {
    return (
      <section className="py-12" aria-labelledby="overview-title">
        <h1 className="font-heading text-3xl font-semibold" id="overview-title">
          Studio bạn tham gia
        </h1>
        <p className="mt-3 max-w-xl leading-7 text-muted">
          Tài khoản này chưa tham gia studio nào. Tìm hiểu cách đưa workshop của
          bạn đến với cộng đồng Open Slot.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/dang-ky-studio">Đăng ký mở studio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/danh-cho-nghe-nhan">Tìm hiểu dành cho nghệ nhân</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="overview-title" className="py-0">
      <p className="font-semibold text-primary">Không gian tổ chức</p>
      <h1
        className="mt-2 font-heading text-3xl font-semibold md:text-4xl"
        id="overview-title"
      >
        Studio bạn tham gia
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        Theo dõi hồ sơ đã gửi, xem kết quả xét duyệt và tiếp tục quản lý các
        workshop tại studio của bạn.
      </p>
      <Button asChild className="mt-5" variant="outline">
        <Link to="/dang-ky-studio">Đăng ký studio khác</Link>
      </Button>

      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {studios.map((studio) => (
          <li
            className="flex min-w-0 flex-col justify-between gap-6 rounded-md border border-line bg-surface p-4"
            key={studio.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 font-heading text-2xl font-semibold">
                  {studio.name}
                </h2>
                <StudioTrustBadge level={studio.trustLevel} />
                <span className="shrink-0 rounded-full bg-soft px-3 py-1 text-sm font-semibold">
                  {roleLabels[studio.role]}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">
                {[studio.area, studio.province].filter(Boolean).join(', ') ||
                  studio.address}
              </p>
              <p className="mt-4 text-sm">
                Trạng thái hồ sơ:{' '}
                <span className="font-semibold">
                  {studioApplicationStatus[studio.status].label}
                </span>
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {studioApplicationStatus[studio.status].description}
              </p>
              {studio.description && (
                <p className="mt-3 line-clamp-3 leading-6 text-muted">
                  {studio.description}
                </p>
              )}
            </div>
            <Link
              className="inline-flex min-h-11 w-fit items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              to={`/studio/studios/${encodeURIComponent(studio.id)}`}
            >
              {studio.status === 'approved'
                ? 'Quản lý studio'
                : 'Xem hồ sơ studio'}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
