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
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { formatReviewDate } from '@/lib/studio-review';

const BookingsChart = lazy(
  () => import('@/components/admin/AdminBookingsChart'),
);

const metricLinks = [
  {
    key: 'pendingStudios',
    label: 'Hồ sơ chờ duyệt',
    to: '/admin/ho-so-studio?tab=pending&page=1',
    note: 'Hồ sơ studio đã gửi',
    icon: ClipboardCheck,
    color: 'amber',
  },
  {
    key: 'newWorkshops',
    label: 'Workshop mới (7 ngày)',
    to: '/admin/workshop?tab=all&filter.period=7d&page=1',
    note: 'Được tạo trong 7 ngày qua',
    icon: Sparkles,
    color: 'purple',
  },
  {
    key: 'todayBookings',
    label: 'Đặt chỗ hôm nay',
    to: '/admin/dat-cho?tab=all&filter.period=today&page=1',
    note: 'Theo ngày tạo đơn',
    icon: Ticket,
    color: 'emerald',
  },
  {
    key: 'newUsers',
    label: 'Người dùng mới (7 ngày)',
    to: '/admin/nguoi-dung?tab=all&filter.period=7d&page=1',
    note: 'Tài khoản mới trong 7 ngày',
    icon: Users,
    color: 'blue',
  },
] as const;

const taskLinks = [
  {
    key: 'overdueStudios',
    label: 'Hồ sơ chờ duyệt quá 48 giờ',
    to: '/admin/ho-so-studio?tab=pending&filter.reviewQueue=overdue&page=1',
    icon: Clock,
    urgentBg: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    key: 'openReports',
    label: 'Báo cáo chưa xử lý',
    to: '/admin/bao-cao?tab=new&page=1',
    icon: AlertTriangle,
    urgentBg: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    key: 'resubmittedStudios',
    label: 'Studio cần bổ sung đã gửi lại',
    to: '/admin/ho-so-studio?tab=pending&filter.reviewQueue=resubmitted&page=1',
    icon: RotateCcw,
    urgentBg: 'bg-blue-50 text-blue-800 border-blue-200',
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Tổng quan quản trị
          </h1>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            {data
              ? `Cập nhật lúc ${formatReviewDate(data.generatedAt)} · Giờ Việt Nam`
              : 'Hoạt động và hàng đợi kiểm duyệt Open Slot'}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={overview.isFetching}
          onClick={() => void overview.refetch()}
          className="gap-2 text-xs"
        >
          <RefreshCw
            size={14}
            className={overview.isFetching ? 'animate-spin' : ''}
          />
          {overview.isFetching ? 'Đang tải…' : 'Làm mới số liệu'}
        </Button>
      </header>

      {overview.error ? (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="space-y-3 pt-5">
            <p role="alert" className="text-sm font-medium text-rose-800">
              Chưa tải được Tổng quan. {overview.error.message}
            </p>
            <Button variant="outline" onClick={() => void overview.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
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

                const colorStyles = {
                  amber: {
                    border: 'hover:border-amber-400/60',
                    bg: 'bg-amber-500/10 text-amber-700',
                  },
                  purple: {
                    border: 'hover:border-purple-400/60',
                    bg: 'bg-purple-500/10 text-purple-700',
                  },
                  emerald: {
                    border: 'hover:border-emerald-400/60',
                    bg: 'bg-emerald-500/10 text-emerald-700',
                  },
                  blue: {
                    border: 'hover:border-blue-400/60',
                    bg: 'bg-blue-500/10 text-blue-700',
                  },
                }[metric.color];

                return (
                  <Card
                    key={metric.key}
                    className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${colorStyles.border}`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <Link
                        to={metric.to}
                        className="group block outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-primary"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-muted sm:text-sm">
                            {metric.label}
                          </span>
                          <div
                            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${colorStyles.bg}`}
                          >
                            <Icon size={16} />
                          </div>
                        </div>
                        <div className="mt-3 font-heading text-2xl font-bold tabular-nums text-ink sm:text-3xl">
                          {value.toLocaleString('vi-VN')}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted">
                          <span>{metric.note}</span>
                          <ArrowUpRight
                            size={14}
                            className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          />
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            {/* Bookings Chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold">
                  Đặt chỗ 30 ngày
                </CardTitle>
                <CardDescription className="text-xs">
                  Số đơn theo ngày tạo, gồm mọi trạng thái · Giờ Việt Nam
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                  <BookingsChart data={data.bookingSeries} />
                </Suspense>
              </CardContent>
            </Card>

            {/* Two-Column: Tasks & Recent Activities */}
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {/* Task Queue */}
              <Card className="shadow-sm">
                <CardHeader className="border-b border-line/60 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">
                        Hàng đợi cần xử lý
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Các hồ sơ và nội dung cần admin phê duyệt hoặc can
                        thiệp.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <ul className="divide-y divide-line/60">
                    {taskLinks.map((task) => {
                      const TaskIcon = task.icon;
                      const count = data.tasks[task.key];
                      const isUrgent = count > 0;

                      return (
                        <li key={task.key}>
                          <Link
                            to={task.to}
                            className="group flex min-h-14 items-center justify-between gap-3 py-3.5 text-sm transition-colors hover:bg-soft/40"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                                  isUrgent
                                    ? task.urgentBg
                                    : 'bg-soft text-muted'
                                }`}
                              >
                                <TaskIcon size={16} />
                              </div>
                              <span className="font-medium text-ink group-hover:text-primary">
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
                                <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-0.5 text-xs text-muted">
                                  <CheckCircle2
                                    size={12}
                                    className="text-emerald-600"
                                  />
                                  0
                                </span>
                              )}
                              <ArrowRight
                                size={14}
                                className="text-muted transition-transform duration-200 group-hover:translate-x-0.5"
                              />
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {Object.values(data.tasks).every((value) => value === 0) && (
                    <div className="mt-4 flex items-center gap-2 rounded-md bg-emerald-50/70 p-3 text-xs font-medium text-emerald-800">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      Mọi hàng đợi kiểm duyệt hiện tại đều đã được xử lý xong.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activities */}
              <Card className="shadow-sm">
                <CardHeader className="border-b border-line/60 pb-3">
                  <CardTitle className="text-lg font-bold">
                    Nhật ký hoạt động gần đây
                  </CardTitle>
                  <CardDescription className="text-xs">
                    10 hành động mới nhất được hệ thống ghi nhận.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3">
                  {data.activities.length ? (
                    <ol className="divide-y divide-line/60">
                      {data.activities.map((activity) => (
                        <li
                          key={activity.id}
                          className="flex items-start gap-3 py-3 first:pt-1"
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-bold text-muted">
                            {activity.actorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-sm leading-snug text-ink">
                              <span className="font-semibold">
                                {activity.actorName}
                              </span>{' '}
                              <span className="text-muted">
                                {actions[activity.action] ?? 'đã cập nhật'}
                              </span>{' '}
                              <Link
                                className="font-semibold text-primary underline-offset-4 hover:underline"
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
                              className="flex items-center gap-1 text-[11px] text-muted"
                            >
                              <Clock size={11} />
                              {formatReviewDate(activity.createdAt)}
                            </time>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted">
                      Chưa có hoạt động được ghi nhận.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}
