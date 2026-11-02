import { Link, useParams } from 'react-router-dom';
import { StudioNotifications } from '../components/management/StudioNotifications';
import { Check, Circle } from 'lucide-react';
import {
  useMyStudios,
  useStudioSessions,
  useStudioWorkshops,
} from '../hooks/useManagement';
import {
  studioDashboardStats,
  studioPage,
  studioState,
  studioStates,
} from '../lib/studio-dashboard';
import { StudioStatusBadge } from '../components/layout/StudioSwitcher';
import { Button } from '../components/ui/button';

const panel = 'rounded-md border border-line bg-surface p-4 md:p-5';
export function StudioOverviewPage() {
  const { studioId } = useParams();
  const studio = useMyStudios().data?.find(
    (s) => s.id === studioId && s.role === 'owner',
  );
  const workshops = useStudioWorkshops(
    studio && !studio.isDraft ? studio.id : '',
  );
  const sessions = useStudioSessions(
    studio && !studio.isDraft ? studio.id : '',
  );
  if (!studio) return null;
  const state = studioState(studio);
  const stats = studioDashboardStats(workshops.data ?? [], sessions.data ?? []);
  const checklist = [
    {
      label: 'Hồ sơ đã gửi',
      done: !studio.isDraft,
      to: studio.isDraft
        ? `/dang-ky-studio?draftStudioId=${studio.id}`
        : studioPage(studio.id, 'profile'),
      pending: false,
    },
    {
      label: 'Tạo workshop đầu tiên',
      done: Boolean(workshops.data?.length),
      to: studio.isDraft ? undefined : studioPage(studio.id, 'workshops'),
      pending: workshops.isPending && !studio.isDraft,
    },
    {
      label: 'Thêm slot đầu tiên',
      done: Boolean(sessions.data?.length),
      to:
        studio.status === 'approved'
          ? studioPage(studio.id, 'sessions')
          : undefined,
      pending: sessions.isPending && !studio.isDraft,
    },
  ];
  return (
    <div className="space-y-5">
      <StudioNotifications studioId={studio.id} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Tổng quan</h1>
        {state === 'approved' && (
          <Button asChild variant="outline">
            <Link to={`/studios/${studio.slug}`}>Xem trang công khai</Link>
          </Button>
        )}
      </header>
      {state === 'approved' && (
        <section
          aria-label="Số liệu studio"
          className="grid gap-3 sm:grid-cols-3"
        >
          {[
            {
              label: 'Đặt chỗ sắp tới',
              value: '—',
              note: 'Chưa có dữ liệu đặt chỗ',
            },
            {
              label: 'Workshop đang mở',
              value:
                workshops.isPending ||
                sessions.isPending ||
                workshops.error ||
                sessions.error
                  ? '—'
                  : stats.openWorkshops,
              note: 'Đã duyệt, có lịch còn chỗ',
            },
            {
              label: 'Slot còn trống',
              value:
                sessions.isPending || sessions.error
                  ? '—'
                  : stats.availableSeats,
              note: 'Số chỗ còn lại trong lịch sắp tới',
            },
          ].map((item) => (
            <div key={item.label} className={panel}>
              <p className="text-sm text-muted">{item.label}</p>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {item.value}
              </div>
              <p className="mt-1 text-xs text-muted">{item.note}</p>
            </div>
          ))}
        </section>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className={panel} aria-labelledby="studio-status-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="studio-status-title"
                className="font-heading text-lg font-semibold"
              >
                Trạng thái hồ sơ
              </h2>
              <StudioStatusBadge studio={studio} />
            </div>
            <p className="mt-3 text-xs text-muted">
              {studio.isDraft
                ? 'Hồ sơ chưa gửi'
                : `Đã gửi ngày ${new Date(studio.createdAt).toLocaleDateString('vi-VN')}`}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {studioStates[state].description}
            </p>
            {(state === 'rejected' ||
              state === 'needs_changes' ||
              state === 'suspended') && (
              <>
                <div className="mt-4 rounded-sm bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-medium">
                    {state === 'suspended'
                      ? 'Lý do tạm ngưng'
                      : state === 'needs_changes'
                        ? 'Nội dung cần bổ sung'
                        : 'Lý do từ chối'}
                  </p>
                  <p className="mt-1">
                    {studio.rejectionReason ||
                      'Chưa có lý do được ghi nhận. Vui lòng liên hệ Open Slot để xác nhận thông tin cần bổ sung.'}
                  </p>
                </div>
                {state !== 'suspended' && (
                  <Button asChild className="mt-4">
                    <Link to={`${studioPage(studio.id, 'profile')}?edit=1`}>
                      Chỉnh sửa và gửi lại
                    </Link>
                  </Button>
                )}
              </>
            )}
            {state === 'draft' && (
              <Button asChild className="mt-4">
                <Link to={`/dang-ky-studio?draftStudioId=${studio.id}`}>
                  Tiếp tục hoàn thiện hồ sơ
                </Link>
              </Button>
            )}
          </section>
          <section className={panel} aria-labelledby="studio-checklist-title">
            <h2
              id="studio-checklist-title"
              className="font-heading text-lg font-semibold"
            >
              Các bước bắt đầu
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="flex min-h-12 items-center gap-3 py-2"
                >
                  {item.done ? (
                    <Check
                      size={18}
                      className="shrink-0 text-primary"
                      aria-label="Hoàn thành"
                    />
                  ) : (
                    <Circle
                      size={18}
                      className="shrink-0 text-muted"
                      aria-label={item.pending ? 'Đang tải' : 'Chưa hoàn thành'}
                    />
                  )}
                  {item.to ? (
                    <Link
                      to={item.to}
                      className="text-sm underline-offset-4 hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted">
                      {item.label}
                      <span className="block text-xs">
                        {studio.isDraft
                          ? 'Hoàn thiện và gửi hồ sơ trước'
                          : 'Mở sau khi studio được duyệt'}
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {(workshops.error || sessions.error) && (
              <p role="alert" className="mt-2 text-sm text-brick">
                Chưa tải được tiến độ.{' '}
                <button
                  className="underline"
                  onClick={() => {
                    void workshops.refetch();
                    void sessions.refetch();
                  }}
                >
                  Thử lại
                </button>
              </p>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <section className={panel}>
            <h2 className="font-heading text-lg font-semibold">
              Liên hệ hỗ trợ
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Cần hỗ trợ hồ sơ hoặc lịch workshop? Xem hướng dẫn đăng ký và các
              thông tin Open Slot dành cho nghệ nhân.
            </p>
            <Link
              to="/danh-cho-nghe-nhan"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline"
            >
              Hướng dẫn dành cho nghệ nhân
            </Link>
          </section>
          <section className={panel}>
            <h2 className="font-heading text-lg font-semibold">
              Thông tin studio
            </h2>
            <p className="mt-3 font-medium">
              {studio.isDraft ? 'Hồ sơ nháp' : studio.name}
            </p>
            <dl className="mt-3 space-y-3 text-sm">
              {[
                [
                  'Địa chỉ',
                  [studio.address, studio.province].filter(Boolean).join(', '),
                ],
                ['Số điện thoại', studio.contactPhone],
                ['Email', studio.contactEmail],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 break-words">
                    {value || 'Chưa bổ sung'}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              to={studioPage(studio.id, 'profile')}
              className="mt-3 inline-flex min-h-11 items-center text-sm underline"
            >
              Xem hồ sơ studio
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
