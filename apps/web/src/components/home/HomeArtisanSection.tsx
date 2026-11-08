import { MediaImage } from '../ui/MediaImage';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageContainer } from '../layout/PageContainer';
import { Button } from '../ui/button';

export function HomeArtisanSection() {
  return (
    <PageContainer
      as="section"
      id="for-artists"
      aria-labelledby="artists-title"
      className="grid items-center gap-8 pb-16 md:grid-cols-2 lg:gap-16 lg:pb-28"
    >
      <div className="grid grid-cols-2 grid-rows-[repeat(2,8.75rem)] gap-4 md:grid-rows-[repeat(2,10.625rem)]">
        {['craftPhoto', 'flowerPhoto', 'candlePhoto'].map((photo, index) => (
          <MediaImage
            key={photo}
            src={`/images/workshops/${photo}.jpg`}
            alt={
              [
                'Sản phẩm gốm thủ công',
                'Hoa cắm tại buổi học',
                'Nến thơm thủ công',
              ][index]
            }
            placeholder=""
            showPlaceholderText={false}
            fallbackSrc="/images/workshops/craftPhoto.jpg"
            loading="lazy"
            width={500}
            height={600}
            className={`size-full min-w-0 rounded-lg object-cover ${index === 0 ? 'row-span-2' : ''}`}
          />
        ))}
      </div>
      <div>
        <h2
          id="artists-title"
          className="font-heading text-3xl font-medium leading-tight tracking-tight lg:text-[44px]"
        >
          Studio của bạn còn chỗ trống?
        </h2>
        <p className="mt-8 max-w-[40ch] leading-relaxed">
          Mời những người tò mò đến với nghề của bạn. Open Slot kết nối lớp trải
          nghiệm với những đôi tay đang muốn bắt đầu.
        </p>
        <p className="my-8 max-w-[40ch] leading-relaxed">
          Miễn phí trong giai đoạn đầu ra mắt. Đăng workshop, nhận đặt chỗ,
          thanh toán thẳng cho bạn.
        </p>
        <Button
          asChild
          className="min-h-12 w-full justify-between text-base font-semibold md:w-auto"
        >
          <Link to="/danh-cho-nghe-nhan">
            Dành cho nghệ nhân
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </PageContainer>
  );
}
