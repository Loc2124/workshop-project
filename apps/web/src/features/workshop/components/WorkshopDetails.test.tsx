import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Workshop } from '@/types/workshop';
import { WorkshopDetails } from './WorkshopDetails';

describe('WorkshopDetails policies', () => {
  it('renders cancellation and payment policies as separate labeled sections', () => {
    const workshop: Workshop = {
      id: 'workshop-id',
      slug: 'workshop',
      studioId: 'studio-id',
      studioSlug: 'studio',
      title: 'Workshop gốm',
      description: 'Thực hành tạo hình gốm.',
      categoryId: 'ceramics',
      level: 'beginner',
      audience: [],
      takeaway: null,
      durationMinutes: 60,
      basePrice: 100000,
      requirements: null,
      district: null,
      province: 'Hà Nội',
      provinceId: 'ha-noi',
      areaId: null,
      address: 'Địa chỉ thử nghiệm',
      isSimulated: true,
      studioName: 'Studio gốm',
      studioDescription: null,
      sessions: [],
      cancellationPolicy: 'Báo trước một ngày để đổi lịch.',
      paymentPolicy: 'Thanh toán khi đặt chỗ.',
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <WorkshopDetails workshop={workshop} related={[]} />
      </MemoryRouter>,
    );

    expect(html).toContain('Chính sách hủy');
    expect(html).toContain('Hủy miễn phí trước giờ học 24h.');
    expect(html).toContain('Chính sách thanh toán');
    expect(html).toContain('Thanh toán trực tiếp tại studio khi đến học.');
  });
});
