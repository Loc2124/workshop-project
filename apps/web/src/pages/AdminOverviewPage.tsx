import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowRight, RefreshCw } from 'lucide-react';
import { getAdminOverview } from '../services/adminOverviewService';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { formatReviewDate } from '../lib/studio-review';
const BookingsChart = lazy(
  () => import('../components/admin/AdminBookingsChart'),
);
const metricLinks = [
  {
    key: 'pendingStudios',
    label: 'Hồ sơ chờ duyệt',
    to: '/admin/ho-so-studio?tab=pending&page=1',
    note: 'Hồ sơ studio đã gửi',
  },
  {
    key: 'newWorkshops',
    label: 'Workshop mới (7 ngày)',
    to: '/admin/workshop?tab=all&filter.period=7d&page=1',
    note: 'Được tạo trong 7 ngày qua',
  },
  {
    key: 'todayBookings',
    label: 'Đặt chỗ hôm nay',
    to: '/admin/dat-cho?tab=all&filter.period=today&page=1',
    note: 'Theo ngày tạo đơn',
  },
  {
    key: 'newUsers',
    label: 'Người dùng mới (7 ngày)',
    to: '/admin/nguoi-dung?tab=all&filter.period=7d&page=1',
    note: 'Tài khoản mới trong 7 ngày',
  },
] as const;
const taskLinks = [
  {
    key: 'overdueStudios',
    label: 'Hồ sơ chờ duyệt quá 48 giờ',
    to: '/admin/ho-so-studio?tab=pending&filter.reviewQueue=overdue&page=1',
  },
  {
    key: 'openReports',
    label: 'Báo cáo chưa xử lý',
    to: '/admin/bao-cao?tab=new&page=1',
  },
  {
    key: 'resubmittedStudios',
    label: 'Studio cần bổ sung đã gửi lại',
    to: '/admin/ho-so-studio?tab=pending&filter.reviewQueue=resubmitted&page=1',
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
  const overview = useQuery({
    queryKey: ['management', 'admin-overview'],
    queryFn: ({ signal }) => getAdminOverview(signal),
    staleTime: 30000,
  });
  const data = overview.data;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Tổng quan</h1>
          <p className="mt-1 text-xs text-muted">
            {data
              ? `Cập nhật ${formatReviewDate(data.generatedAt)} · Giờ Việt Nam`
              : 'Hoạt động và hàng đợi quản trị Open Slot'}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={overview.isFetching}
          onClick={() => void overview.refetch()}
        >
          <RefreshCw size={14} />
          {overview.isFetching ? 'Đang tải…' : 'Làm mới'}
        </Button>
      </header>
      {overview.isPending ? (
        <OverviewSkeleton />
      ) : overview.error ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p role="alert" className="text-sm text-brick">
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
            <section
              className="grid grid-cols-2 gap-3 lg:grid-cols-4"
              aria-label="Số liệu tổng quan"
            >
              {metricLinks.map((metric) => (
                <Card
                  key={metric.key}
                  className="relative transition-colors hover:border-primary/40"
                >
                  <CardContent className="p-3 sm:p-5">
                    <Link
                      to={metric.to}
                      className="group block outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-primary"
                    >
                      <span className="flex min-h-10 items-start justify-between gap-2 text-sm text-muted">
                        {metric.label}
                        <ArrowUpRight size={14} className="mt-0.5 shrink-0" />
                      </span>
                      <div className="mt-3 text-3xl font-semibold tabular-nums">
                        {data.metrics[metric.key].toLocaleString('vi-VN')}
                      </div>
                      <p className="mt-2 text-xs text-muted">{metric.note}</p>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </section>
            <Card>
              <CardHeader>
                <CardTitle>Đặt chỗ 30 ngày</CardTitle>
                <CardDescription>
                  Số đơn theo ngày tạo, gồm mọi trạng thái · Giờ Việt Nam
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                  <BookingsChart data={data.bookingSeries} />
                </Suspense>
              </CardContent>
            </Card>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Việc cần làm</CardTitle>
                  <CardDescription>
                    Các hồ sơ và nội dung cần được xem xét.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-line">
                    {taskLinks.map((task) => (
                      <li key={task.key}>
                        <Link
                          to={task.to}
                          className="flex min-h-14 items-center justify-between gap-3 py-3 text-sm hover:underline"
                        >
                          <span>{task.label}</span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span
                              className={`tabular-nums font-semibold ${data.tasks[task.key] ? 'text-primary' : 'text-muted'}`}
                            >
                              {data.tasks[task.key]}
                            </span>
                            <ArrowRight size={15} className="text-muted" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {Object.values(data.tasks).every((value) => value === 0) && (
                    <p className="mt-3 text-xs text-muted">
                      Hiện không có việc tồn đọng trong các hàng đợi này.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Hoạt động gần đây</CardTitle>
                  <CardDescription>
                    10 hoạt động mới nhất từ nhật ký.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.activities.length ? (
                    <ol className="divide-y divide-line">
                      {data.activities.map((activity) => (
                        <li
                          key={activity.id}
                          className="space-y-1 py-3 first:pt-0"
                        >
                          <p className="text-sm leading-6">
                            <span className="font-medium">
                              {activity.actorName}
                            </span>{' '}
                            {actions[activity.action] ?? 'đã cập nhật'}{' '}
                            <Link
                              className="font-medium underline-offset-4 hover:underline"
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
                            .
                          </p>
                          <time
                            dateTime={activity.createdAt}
                            className="block text-xs text-muted"
                          >
                            {formatReviewDate(activity.createdAt)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="py-4 text-sm text-muted">
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
function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Đang tải Tổng quan" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="space-y-5 p-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-64 w-full" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-5 p-5">
            <Skeleton className="h-5 w-36" />
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
