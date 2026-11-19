import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';
import { getAdminOverview } from '@/services/adminOverviewService';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { formatReviewDate } from '@/lib/studio-review';

const BookingsChart = lazy(
  () => import('@/features/admin-finance/components/AdminBookingsChart'),
);

const metricLinks = [
  {
    key: 'pendingStudios',
    label: 'Hồ sơ chờ duyệt',
    to: '/admin/ho-so-studio?tab=pending&page=1',
    note: 'Hồ sơ studio đã gửi',
    icon: ClipboardCheck,
  },
  {
    key: 'newWorkshops',
    label: 'Workshop mới (7 ngày)',
    to: '/admin/workshop?tab=all&filter.period=7d&page=1',
    note: 'Được tạo trong 7 ngày qua',
    icon: Sparkles,
  },
  {
    key: 'todayBookings',
    label: 'Đặt chỗ hôm nay',
    to: '/admin/dat-cho?tab=all&filter.period=today&page=1',
    note: 'Theo ngày tạo đơn',
    icon: Ticket,
  },
  {
    key: 'newUsers',
    label: 'Người dùng mới (7 ngày)',
    to: '/admin/nguoi-dung?tab=all&filter.period=7d&page=1',
    note: 'Tài khoản mới trong 7 ngày',
    icon: Users,
  },
] as const;

const taskLinks = [
  {
    key: 'overdueStudios',
    label: 'Hồ sơ chờ duyệt quá 48 giờ',
    to: '/admin/ho-so-studio?tab=pending&filter.reviewQueue=overdue&page=1',
    icon: Clock,
    urgentBg:
      'bg-studio-danger-soft text-studio-danger border-studio-danger/30',
  },
  {
    key: 'openReports',
    label: 'Báo cáo chưa xử lý',
    to: '/admin/bao-cao?tab=new&page=1',
    icon: AlertTriangle,
    urgentBg:
      'bg-studio-warning-soft text-studio-warning border-studio-warning/30',
  },
  {
    key: 'resubmittedStudios',
    label: 'Studio cần bổ sung đã gửi lại',
    to: '/admin/ho-so-studio?tab=pending&filter.reviewQueue=resubmitted&page=1',
    icon: RotateCcw,
    urgentBg: 'bg-studio-selected text-studio-primary border-studio-primary/30',
  },
] as const;

const actions: Record<string, string> = {
  'studio.suspended': 'đã tạm ngưng studio',
  'studio.restored': 'đã khôi phục studio',
  'studio.approved': 'đã duyệt studio',
  'studio.rejected': 'đã từ chối studio',
  'studio.needs_changes': 'đã yêu cầu bổ sung hồ sơ',
  'studio.submitted': 'đã gửi hồ sơ studio',
  'studio.resubmitted': 'đã gửi lại hồ sơ studio',
  'message_template.updated': 'đã sửa mẫu thông báo',
  'settings.updated': 'đã sửa cài đặt hệ thống',
  'message_template.reset': 'đã khôi phục mẫu thông báo mặc định',
  'featured.updated': 'đã cập nhật nội dung trang chủ',
  'report.hide': 'đã ẩn nội dung bị báo cáo',
  'report.suspend': 'đã tạm ngưng studio bị báo cáo',
  'report.start': 'đã bắt đầu xử lý báo cáo',
  'report.resolve': 'đã xử lý báo cáo',
  'report.dismiss': 'đã bỏ qua báo cáo',
  'report.note': 'đã thêm ghi chú báo cáo',
  'studio.hidden': 'đã ẩn studio',
  'studio.shown': 'đã hiện lại studio',
  'user.blocked': 'đã khóa tài khoản',
  'user.unblocked': 'đã mở khóa tài khoản',
  'user.role_changed': 'đã đổi vai trò',
  'booking.pending': 'đã tạo đặt chỗ',
  'booking.confirmed': 'đã xác nhận đặt chỗ',
  'booking.cancelled': 'đã hủy đặt chỗ',
  'booking.completed': 'đã hoàn tất đặt chỗ',
  'workshop.hidden': 'đã ẩn workshop',
  'workshop.removed': 'đã gỡ workshop',
  'workshop.restored': 'đã khôi phục workshop',
  'workshop.approved': 'đã duyệt workshop',
  'workshop.rejected': 'đã từ chối workshop',
  'verification.verified': 'đã xác minh studio',
  'verification.revoked': 'đã thu hồi xác minh studio',
};

export default function AdminOverviewPage() {
  const userId = useAuth().user?.id;
  const overview = useQuery({
    queryKey: queryKeys.overview.config(userId),
    queryFn: ({ signal }) => getAdminOverview(signal),
    staleTime: 30000,
  });
  const data = overview.data;

  if (overview.isPending) {
    return <LoadingState label="Đang tải tổng quan…" variant="page" />;
  }

  return (
    <div className="space-y-studio-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-studio-border pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-studio-ink sm:text-3xl">
            Tổng quan quản trị
          </h1>
          <p className="mt-1 text-xs text-studio-muted sm:text-sm">
            {data
              ? `Cập nhật lúc ${formatReviewDate(data.generatedAt)} · Giờ Việt Nam`
              : 'Hoạt động và hàng đợi kiểm duyệt Open Slot'}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={overview.isFetching}
          onClick={() => void overview.refetch()}
          className="gap-2 rounded-studio-control border-studio-border bg-studio-surface text-xs font-semibold text-studio-ink hover:bg-studio-subtle"
        >
          <RefreshCw
            size={14}
            className={overview.isFetching ? 'animate-spin' : ''}
          />
          {overview.isFetching ? 'Đang tải…' : 'Làm mới số liệu'}
        </Button>
      </header>

      {overview.error ? (
        <div className="rounded-studio-card border border-studio-danger/30 bg-studio-danger-soft p-5">
          <p role="alert" className="text-sm font-medium text-studio-danger">
            Chưa tải được Tổng quan. {overview.error.message}
          </p>
          <Button
            variant="outline"
            onClick={() => void overview.refetch()}
            className="mt-3 rounded-studio-control border-studio-border bg-studio-surface"
          >
            Thử lại
          </Button>
        </div>
      ) : (
        data && (
          <>
            {/* KPI Metric Cards */}
            <section
              className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
              aria-label="Số liệu tổng quan"
            >
              {metricLinks.map((metric) => {
                const Icon = metric.icon;
                const value = data.metrics[metric.key];

                return (
                  <div
                    key={metric.key}
                    className="group rounded-studio-card border border-studio-border bg-studio-surface p-4 transition-all duration-200 hover:border-studio-primary/60 hover:shadow-md"
                  >
                    <Link to={metric.to} className="block outline-none">
                      <div className="flex items-center justify-between text-studio-muted">
                        <span className="text-xs font-semibold uppercase tracking-wider text-studio-muted">
                          {metric.label}
                        </span>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-studio-control bg-studio-selected/60 text-studio-primary transition-colors group-hover:bg-studio-primary group-hover:text-white">
                          <Icon size={16} aria-hidden="true" />
                        </div>
                      </div>
                      <div className="mt-2 font-heading text-2xl font-bold tabular-nums text-studio-ink sm:text-3xl">
                        {value.toLocaleString('vi-VN')}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-studio-muted">
                        <span className="truncate">{metric.note}</span>
                        <ArrowUpRight
                          size={14}
                          className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </section>

            {/* Bookings Chart */}
            <section className="rounded-studio-card border border-studio-border bg-studio-surface p-5 text-studio-ink shadow-studio-card sm:p-studio-card">
              <div className="border-b border-studio-border pb-3">
                <h2 className="font-heading text-lg font-bold text-studio-ink">
                  Đặt chỗ 30 ngày
                </h2>
                <p className="mt-1 text-xs text-studio-muted">
                  Số đơn theo ngày tạo, gồm mọi trạng thái · Giờ Việt Nam
                </p>
              </div>
              <div className="pt-4">
                <Suspense
                  fallback={
                    <Skeleton className="h-64 w-full rounded-studio-control" />
                  }
                >
                  <BookingsChart data={data.bookingSeries} />
                </Suspense>
              </div>
            </section>

            {/* Two-Column: Tasks & Recent Activities */}
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {/* Task Queue */}
              <section className="rounded-studio-card border border-studio-border bg-studio-surface p-5 text-studio-ink shadow-studio-card sm:p-studio-card">
                <div className="border-b border-studio-border pb-3">
                  <h2 className="font-heading text-lg font-bold text-studio-ink">
                    Hàng đợi cần xử lý
                  </h2>
                  <p className="mt-1 text-xs text-studio-muted">
                    Các hồ sơ và nội dung cần admin phê duyệt hoặc can thiệp.
                  </p>
                </div>
                <div className="pt-2">
                  <ul className="divide-y divide-studio-border/60">
                    {taskLinks.map((task) => {
                      const TaskIcon = task.icon;
                      const count = data.tasks[task.key];
                      const isUrgent = count > 0;

                      return (
                        <li key={task.key}>
                          <Link
                            to={task.to}
                            className="group flex min-h-14 items-center justify-between gap-3 py-3.5 text-sm transition-colors hover:bg-studio-subtle/50"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex size-8 shrink-0 items-center justify-center rounded-studio-control ${
                                  isUrgent
                                    ? task.urgentBg
                                    : 'bg-studio-subtle text-studio-muted'
                                }`}
                              >
                                <TaskIcon size={16} />
                              </div>
                              <span className="font-medium text-studio-ink group-hover:text-studio-primary">
                                {task.label}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {isUrgent ? (
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums ${task.urgentBg}`}
                                >
                                  {count}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-studio-subtle px-2.5 py-0.5 text-xs text-studio-muted">
                                  <CheckCircle2
                                    size={12}
                                    className="text-studio-success"
                                  />
                                  0
                                </span>
                              )}
                              <ArrowRight
                                size={14}
                                className="text-studio-muted transition-transform duration-200 group-hover:translate-x-0.5"
                              />
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {Object.values(data.tasks).every((value) => value === 0) && (
                    <div className="mt-4 flex items-center gap-2 rounded-studio-control bg-studio-success-soft p-3 text-xs font-medium text-studio-success">
                      <CheckCircle2 size={14} className="text-studio-success" />
                      Mọi hàng đợi kiểm duyệt hiện tại đều đã được xử lý xong.
                    </div>
                  )}
                </div>
              </section>

              {/* Recent Activities */}
              <section className="rounded-studio-card border border-studio-border bg-studio-surface p-5 text-studio-ink shadow-studio-card sm:p-studio-card">
                <div className="border-b border-studio-border pb-3">
                  <h2 className="font-heading text-lg font-bold text-studio-ink">
                    Nhật ký hoạt động gần đây
                  </h2>
                  <p className="mt-1 text-xs text-studio-muted">
                    10 hành động mới nhất được hệ thống ghi nhận.
                  </p>
                </div>
                <div className="pt-3">
                  {data.activities.length ? (
                    <ol className="divide-y divide-studio-border/60">
                      {data.activities.map((activity) => (
                        <li
                          key={activity.id}
                          className="flex items-start gap-3 py-3 first:pt-1"
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-studio-subtle text-xs font-bold text-studio-muted">
                            {activity.actorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-sm leading-snug text-studio-ink">
                              <span className="font-semibold">
                                {activity.actorName}
                              </span>{' '}
                              <span className="text-studio-muted">
                                {actions[activity.action] ?? 'đã cập nhật'}
                              </span>{' '}
                              <Link
                                className="font-semibold text-studio-primary underline-offset-4 hover:underline"
                                to={
                                  activity.entityType === 'settings'
                                    ? '/admin/cai-dat'
                                    : activity.entityType === 'message_template'
                                      ? '/admin/mau-thong-bao'
                                      : activity.entityType === 'featured'
                                        ? '/admin/noi-dung'
                                        : activity.entityType === 'report'
                                          ? '/admin/bao-cao?tab=all'
                                          : activity.entityType === 'review'
                                            ? '/admin/bao-cao?tab=all&filter.targetType=review'
                                            : activity.entityType === 'category'
                                              ? '/admin/danh-muc'
                                              : activity.entityType === 'user'
                                                ? `/admin/nguoi-dung?tab=all&q=${encodeURIComponent(activity.entityName)}`
                                                : activity.entityType ===
                                                    'booking'
                                                  ? `/admin/dat-cho?tab=all&q=${encodeURIComponent(activity.entityName)}`
                                                  : activity.entityType ===
                                                      'workshop'
                                                    ? `/admin/workshop?tab=all&q=${encodeURIComponent(activity.entityName)}`
                                                    : `/admin/studios?tab=all&q=${encodeURIComponent(activity.entityName)}`
                                }
                              >
                                {activity.entityName}
                              </Link>
                            </p>
                            <time
                              dateTime={activity.createdAt}
                              className="flex items-center gap-1 text-[11px] text-studio-muted"
                            >
                              <Clock size={11} />
                              {formatReviewDate(activity.createdAt)}
                            </time>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="py-6 text-center text-sm text-studio-muted">
                      Chưa có hoạt động được ghi nhận.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </>
        )
      )}
    </div>
  );
}
