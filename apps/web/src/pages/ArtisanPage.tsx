import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SiteHeader } from '../components/layout/SiteHeader';
import { PageBreadcrumb } from '../components/layout/PageBreadcrumb';
import { PageContainer } from '../components/layout/PageContainer';
import { MediaImage } from '../components/ui/MediaImage';
import { Button } from '../components/ui/button';
import { useMyStudios } from '../hooks/useManagement';
import { useAuth } from '../hooks/useAuth';
import { authHref } from '../lib/auth-navigation';
import { useSiteInformation } from '../hooks/useSiteInformation';

export function ArtisanPage() {
  const { siteContact, settings } = useSiteInformation();
  const { user } = useAuth();
  const registrationHref = user
    ? '/dang-ky-studio'
    : authHref('/dang-nhap', '/dang-ky-studio');
  const studios = useMyStudios();
  const pending =
    studios.data?.filter(
      (studio) => studio.role === 'owner' && studio.status === 'pending',
    ) ?? [];
  const hasStudios = Boolean(studios.data?.length);
  return (
    <div className="min-h-svh bg-paper text-ink">
      <SiteHeader />
      <main>
        <PageContainer className="pb-12 pt-6 md:pb-20">
          <PageBreadcrumb items={[{ label: 'Dành cho nghệ nhân' }]} />
          <section
            className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-16"
            aria-labelledby="artisan-title"
          >
            <div>
              <h1
                id="artisan-title"
                className="max-w-xl font-heading text-4xl font-semibold leading-tight text-primary md:text-5xl"
              >
                Mở studio trên Open Slot
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8">
                Đưa nghề của bạn đến gần hơn với những người muốn tự tay làm.
                Giới thiệu studio, đăng workshop và quản lý các buổi trải nghiệm
                trong cùng một nơi.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={hasStudios ? '/studio' : registrationHref}>
                    {pending.length
                      ? 'Theo dõi hồ sơ'
                      : hasStudios
                        ? 'Quản lý studio'
                        : 'Bắt đầu tạo hồ sơ studio'}
                    <ArrowRight size={18} />
                  </Link>
                </Button>
                {hasStudios && (
                  <Button asChild variant="outline" size="lg">
                    <Link to={registrationHref}>Đăng ký studio khác</Link>
                  </Button>
                )}
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted">
                Chuẩn bị tên studio, lĩnh vực và địa chỉ đón khách. Bạn sẽ được
                xem lại hồ sơ trước khi gửi xét duyệt.
              </p>
              {pending.length > 0 && (
                <div className="mt-6 rounded-xl bg-soft p-4" role="status">
                  <p className="font-semibold">
                    Bạn có {pending.length} hồ sơ đang chờ duyệt
                  </p>
                  <Link
                    to="/studio"
                    className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Theo dõi hồ sơ đã gửi
                    <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </div>
            <figure className="m-0">
              <MediaImage
                src="/images/workshops/craftPhoto.jpg"
                alt="Những chiếc bình gốm thủ công"
                placeholder="Thành phẩm thủ công"
                className="aspect-4/3 rounded-2xl lg:aspect-5/4"
                width={900}
                height={720}
                loading="eager"
              />
              <figcaption className="mt-3 text-sm text-muted">
                Một không gian để chia sẻ nghề và tạo nên những trải nghiệm mới.
              </figcaption>
            </figure>
          </section>
          <section
            className="mt-16 grid gap-8 lg:mt-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16"
            aria-labelledby="artisan-process"
          >
            <div>
              <h2
                id="artisan-process"
                className="font-heading text-3xl font-semibold"
              >
                Từ studio đến buổi hẹn
              </h2>
              <p className="mt-4 leading-7 text-muted">
                Mỗi hồ sơ gắn với một tài khoản chủ studio. Bạn có thể quản lý
                nhiều studio bằng cùng một tài khoản.
              </p>
            </div>
            <ol className="space-y-7">
              <li>
                <h3 className="font-heading text-xl font-semibold text-primary">
                  Giới thiệu studio
                </h3>
                <p className="mt-2 leading-7 text-muted">
                  Chọn lĩnh vực, chia sẻ câu chuyện và địa điểm tổ chức. Chưa
                  cần tạo lịch workshop ở bước này.
                </p>
              </li>
              <li>
                <h3 className="font-heading text-xl font-semibold text-primary">
                  Xem lại và gửi hồ sơ
                </h3>
                <p className="mt-2 leading-7 text-muted">
                  Đăng nhập trước khi mở hồ sơ, kiểm tra thông tin rồi gửi. Hồ
                  sơ chuyển sang trạng thái chờ duyệt; bản nháp không phải hồ sơ
                  đã gửi.
                </p>
              </li>
              <li>
                <h3 className="font-heading text-xl font-semibold text-primary">
                  Theo dõi và đón khách
                </h3>
                <p className="mt-2 leading-7 text-muted">
                  Theo dõi xét duyệt trong mục Quản lý studio. Sau khi studio
                  được duyệt, bạn có thể giới thiệu công khai không gian và các
                  workshop đã được duyệt.
                </p>
              </li>
            </ol>
          </section>
          <section
            className="mt-16 rounded-2xl bg-soft p-6 md:p-10 lg:mt-24"
            aria-labelledby="artisan-prepare"
          >
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h2
                  id="artisan-prepare"
                  className="font-heading text-3xl font-semibold"
                >
                  Bạn cần chuẩn bị gì?
                </h2>
                <p className="mt-4 leading-7 text-muted">
                  Thông tin rõ ràng giúp khách hiểu studio và biết nơi mình sẽ
                  đến.
                </p>
              </div>
              <ul className="space-y-3 leading-7">
                <li>Tên studio và lĩnh vực thủ công chính.</li>
                <li>Tỉnh/thành phố và địa chỉ cụ thể.</li>
                <li>Số điện thoại và email liên hệ của studio.</li>
                <li>
                  Ít nhất {settings.studio.minPhotos} ảnh thật: mặt tiền/biển
                  hiệu, không gian, khu làm workshop.
                </li>
                <li>
                  Một đoạn giới thiệu về nghề hoặc không gian, nếu bạn muốn.
                </li>
                <li>Tài khoản Open Slot để làm chủ và theo dõi hồ sơ.</li>
              </ul>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild>
                <Link to={registrationHref}>
                  Chuẩn bị hồ sơ của tôi
                  <ArrowRight size={17} />
                </Link>
              </Button>
              {siteContact.hotline && (
                <a
                  href={`tel:${siteContact.hotline.replace(/\s/g, '')}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Cần hỗ trợ? Gọi {siteContact.hotline}
                </a>
              )}
            </div>
          </section>
          <section
            className="mt-16 grid gap-8 lg:mt-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16"
            aria-labelledby="artisan-faq"
          >
            <h2
              id="artisan-faq"
              className="font-heading text-3xl font-semibold"
            >
              Trước khi bắt đầu
            </h2>
            <div className="space-y-4">
              {[
                [
                  'Tôi chưa có tài khoản thì sao?',
                  'Bấm bắt đầu để đăng nhập hoặc tạo tài khoản. Sau đó bạn sẽ được đưa về form đăng ký studio; thông tin đang nhập được giữ trong phiên trình duyệt này.',
                ],
                [
                  'Gửi hồ sơ xong, studio có hiển thị ngay không?',
                  'Chưa. Studio ở trạng thái chờ duyệt cho đến khi được Open Slot xác nhận. Trạng thái được cập nhật trong mục Quản lý studio.',
                ],
                [
                  'Tôi đã có studio trên Open Slot.',
                  'Vào mục Quản lý studio để tiếp tục quản lý. Nếu đăng ký thêm địa điểm, tạo một hồ sơ studio mới bằng cùng tài khoản.',
                ],
              ].map(([question, answer]) => (
                <details
                  key={question}
                  className="rounded-xl bg-surface px-5 py-4"
                >
                  <summary className="cursor-pointer font-semibold">
                    {question}
                  </summary>
                  <p className="mt-3 leading-7 text-muted">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </PageContainer>
      </main>
      <SiteFooter />
    </div>
  );
}
