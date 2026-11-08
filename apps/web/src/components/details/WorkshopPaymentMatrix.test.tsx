import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { WorkshopSchedule } from './WorkshopSchedule';
import type { Workshop } from '../../types/workshop';
import { mockWorkshops } from '../../test-fixtures/mockWorkshops';
const workshop: Workshop = {
  ...mockWorkshops[0],
  basePrice: 200000,
  studioTrustLevel: 'verified',
  sessions: [
    {
      id: 'future-session',
      startsAt: '2099-11-07T01:00:00Z',
      endsAt: '2099-11-07T03:00:00Z',
      price: 200000,
      availableSeats: 8,
    },
  ],
};
const render = (mode: 'none' | 'optional' | 'required', percent: number) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <WorkshopSchedule
        workshop={{
          ...workshop,
          depositMode: mode,
          depositPercent: percent,
          effectiveDepositPercent: percent,
        }}
      />
    </MemoryRouter>,
  );
describe('workshop payment matrix', () => {
  it('none hides the payment selector and confirms studio-payment intent', () => {
    const html = render('none', 0);
    expect(html).not.toContain('name="payment-choice"');
    expect(html).toContain('Đặt chỗ · Trả tại studio');
    expect(html).not.toContain('Đặt cọc (');
  });
  for (const percent of [5, 20, 50]) {
    it(`optional ${percent}% exposes exactly two choices, defaulting to studio payment`, () => {
      const html = render('optional', percent);
      expect(html.match(/name="payment-choice"/g)).toHaveLength(2);
      expect(html).toContain('Cọc trước');
      expect(html).toContain('Trả tại studio');
      expect(html).toContain('Đặt chỗ · Trả tại studio');
    });
    it(`required ${percent}% hides the selector and uses a dynamic deposit CTA`, () => {
      const html = render('required', percent);
      expect(html).not.toContain('name="payment-choice"');
      expect(html).toContain(`Đặt cọc (${percent}%)`);
      expect(html).toContain(
        'Đặt chỗ · Cọc ' +
          new Intl.NumberFormat('vi-VN').format((200000 * percent) / 100) +
          ' đ',
      );
      expect(html).not.toContain('PayOS');
      expect(html).toContain('15 phút');
    });
  }
});
