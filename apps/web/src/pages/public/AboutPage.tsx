import { ImagePreload } from '../../components/ui/ImagePreload';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DetailHero,
  DetailSection,
} from '../../components/details/DetailPrimitives';
import { GreenSection } from '../../components/layout/GreenSection';
import { PageBreadcrumb } from '../../components/layout/PageBreadcrumb';
import { PageContainer } from '../../components/layout/PageContainer';
import { Button } from '../../components/ui/button';
import { useSiteInformation } from '../../hooks/useSiteInformation';

const aboutContent = {
  isSimulated: false,
  imageUrl: '/images/workshops/craftPhoto.webp',
  imageAlt: 'Ba bình gốm thủ công với sắc men mộc và cành hoa khô',
};

const activities = [
  {
    title: 'Khám phá',
    text: 'Tìm workshop theo bộ môn, địa điểm và thời gian bạn muốn dành cho mình.',
  },
  {
    title: 'Đặt chỗ',
    text: 'Xem lịch, giá và số chỗ còn để chọn buổi phù hợp. Kiểm tra điều kiện tham gia trước khi đặt.',
  },
  {
    title: 'Gặp nhau tại studio',
    text: 'Đến studio, gặp nghệ nhân và tự tay làm dưới sự hướng dẫn của người làm nghề.',
  },
];

export function AboutPage() {
  const { siteContact, information: footerInformation } = useSiteInformation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const policies = footerInformation.filter(
    (item) =>
      ['chinh-sach-dat-lich', 'dieu-khoan-dich-vu'].includes(item.id) &&
      item.text.trim(),
  );
  const hasContact = Boolean(
    siteContact.hotline?.trim() ||
    siteContact.workingHours?.trim() ||
    policies.length,
  );
  return (
    <>
      <ImagePreload src="/images/workshops/craftPhoto.webp" />
      <main>
        <PageContainer>
          <PageBreadcrumb
            className="py-4"
            items={[{ label: 'Về Open Slot' }]}
          />
          <DetailHero
            compact
            imageOnRight
            imageUrl={aboutContent.imageUrl}
            alt={aboutContent.imageAlt}
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">
                Về Open Slot
              </h1>
            </div>
            <p className="mt-5 max-w-prose text-base leading-7 text-stone-700">
              Open Slot kết nối bạn với studio thủ công và người làm nghề. Tìm
              một buổi phù hợp, đến studio và tự tay làm điều có ý nghĩa.
            </p>
            <Button asChild className="mt-6 w-fit">
              <Link to="/kham-pha">
                Khám phá workshop
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </Button>
          </DetailHero>
          <div className="space-y-12 pt-12 md:space-y-16 md:pt-16">
            <DetailSection id="about-activities" title="Open Slot làm gì">
              <div className="grid gap-4 md:grid-cols-3">
                {activities.map((item) => (
                  <article key={item.title} className="rounded-xl bg-soft p-5">
                    <h3 className="font-heading text-xl font-semibold">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-stone-700">
                      {item.text}
                    </p>
                  </article>
                ))}
              </div>
            </DetailSection>
            <div className="grid gap-6 md:grid-cols-2">
              <DetailSection
                id="about-participants"
                title="Dành cho người trải nghiệm"
                className="flex flex-col rounded-xl bg-soft p-5 sm:p-6"
              >
                <p className="mb-6 leading-relaxed text-stone-700">
                  Dành thời gian cho một điều bạn tò mò. Xem nội dung buổi học,
                  yêu cầu tham gia và thành phẩm trước khi chọn studio.
                </p>
                <Button asChild className="mt-auto w-fit">
                  <Link to="/kham-pha">
                    Tìm workshop phù hợp
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </Button>
              </DetailSection>
              <DetailSection
                id="about-artisans"
                title="Dành cho nghệ nhân"
                className="flex flex-col rounded-xl bg-soft p-5 sm:p-6"
              >
                <p className="mb-6 leading-relaxed text-stone-700">
                  Chia sẻ nghề và đón những người muốn bắt đầu. Tìm hiểu cách
                  giới thiệu studio, buổi trải nghiệm và những điều bạn muốn
                  truyền lại.
                </p>
                <Button asChild className="mt-auto w-fit">
                  <Link to="/danh-cho-nghe-nhan">
                    Dành cho nghệ nhân
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </Button>
              </DetailSection>
            </div>
            {hasContact && (
              <DetailSection id="about-contact" title="Liên hệ Open Slot">
                <dl className="grid gap-5 sm:grid-cols-2">
                  {siteContact.hotline?.trim() && (
                    <div>
                      <dt className="text-sm text-stone-700">Hotline</dt>
                      <dd className="mt-1">
                        <a
                          href={
                            'tel:' + siteContact.hotline.replace(/[^\d+]/g, '')
                          }
                          className="inline-flex min-h-11 items-center rounded-lg text-lg font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {siteContact.hotline}
                        </a>
                      </dd>
                    </div>
                  )}
                  {siteContact.workingHours?.trim() && (
                    <div>
                      <dt className="text-sm text-stone-700">Giờ làm việc</dt>
                      <dd className="mt-1 inline-flex min-h-11 items-center text-lg font-semibold">
                        {siteContact.workingHours}
                      </dd>
                    </div>
                  )}
                </dl>
                {policies.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    {policies.map((item) => (
                      <Button
                        key={item.id}
                        asChild
                        variant="link"
                        className="px-0"
                      >
                        <Link
                          to={'/ve-open-slot#' + item.id}
                          aria-haspopup="dialog"
                        >
                          {item.label}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </Button>
                    ))}
                  </div>
                )}
              </DetailSection>
            )}
          </div>
        </PageContainer>
        <GreenSection
          labelledBy="about-cta-title"
          contentClassName="items-center"
        >
          <div>
            <h2
              id="about-cta-title"
              className="font-heading text-[40px] font-medium leading-tight tracking-tight lg:text-[58px]"
            >
              Tìm buổi dành cho bạn
            </h2>
            <p className="mt-6 max-w-prose text-base leading-relaxed">
              Không cần bắt đầu thật giỏi. Chỉ cần bắt đầu từ điều bạn tò mò.
            </p>
          </div>
          <Link
            to="/kham-pha"
            className="inline-flex min-h-11 w-fit items-center gap-4 rounded-lg text-xl font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-white md:justify-self-end"
          >
            Khám phá workshop
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </GreenSection>
      </main>
    </>
  );
}
