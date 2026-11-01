import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SiteHeader } from '../components/layout/SiteHeader';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';

export function ArtisanPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 lg:px-10 lg:py-16">
        <PageBreadcrumb
          className="mb-6"
          items={[{ label: 'Dành cho nghệ nhân' }]}
        />
        <p className="font-semibold text-forest">Dành cho nghệ nhân</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold leading-tight sm:text-5xl">
          Đưa nghề của bạn đến gần hơn với mọi người
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted">
          Open Slot kết nối xưởng thủ công với những người muốn học một kỹ năng
          mới, tự tay làm một món đồ và gặp gỡ người làm nghề.
        </p>
        <div className="mt-8 border-l-4 border-sand pl-5">
          <h2 className="font-heading text-2xl font-semibold">
            Đăng ký mở xưởng
          </h2>
          <p className="mt-2 leading-7 text-muted">
            Kênh đăng ký trực tuyến đang được hoàn thiện. Bạn có thể liên hệ đội
            ngũ Open Slot qua hotline để tìm hiểu về việc tham gia.
          </p>
          <a
            className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-forest px-4 font-semibold text-white hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            href="tel:19008889"
          >
            Gọi 1900 8889
          </a>
        </div>
        <Link
          className="mt-8 inline-flex min-h-11 items-center font-semibold text-porcelain underline"
          to="/explore"
        >
          Khám phá workshop
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
