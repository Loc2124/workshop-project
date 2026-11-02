import { PageContainer } from '../components/layout/PageContainer';
import { BOOKING_STATUSES } from '../components/tickets/booking';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/layout/SiteHeader';
import {
  BookingTicket,
  TicketCard,
  TicketRow,
  toTicketProps,
  type Booking,
  type TicketProps,
} from '../components/tickets';
import { mockWorkshops } from '../data/mockWorkshops';

const base = toTicketProps(mockWorkshops[0]);
const examples: TicketProps[] = [
  base,
  {
    ...toTicketProps(mockWorkshops[1]),
    session: { ...base.session, seatsLeft: 2 },
  },
  {
    ...toTicketProps(mockWorkshops[4]),
    workshop: { ...toTicketProps(mockWorkshops[4]).workshop, imageUrl: null },
    session: { ...base.session, seatsLeft: 0 },
  },
  {
    ...toTicketProps(mockWorkshops[5]),
    workshop: {
      ...toTicketProps(mockWorkshops[5]).workshop,
      title:
        'Tự tay làm vòng tay từ những hạt đá tự nhiên và lưu lại một buổi chiều thật khác cùng những người bạn',
      imageUrl: null,
    },
  },
];

export function TicketDemoPage() {
  const [pattern, setPattern] = useState(false);
  const [background, setBackground] = useState('paper');
  const [status, setStatus] = useState<Booking['status']>('confirmed');
  const [payment, setPayment] = useState<Booking['paymentMethod']>('at_studio');
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <PageContainer as="main" className="max-w-7xl py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-heading text-3xl font-bold leading-tight md:text-5xl">
              Một vé đến studio.
            </h1>
            <p className="mt-4 max-w-2xl text-base">
              Bộ component vé workshop Open Slot. Dữ liệu mô phỏng; mã QR trên
              trang này chỉ dùng để kiểm tra giao diện.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-primary underline underline-offset-4"
          >
            Về trang chủ
          </Link>
        </div>
        <div className="mb-8 flex flex-wrap items-center gap-6 rounded-2xl bg-soft p-4">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={pattern}
              onChange={(event) => setPattern(event.target.checked)}
            />
            Hiện họa tiết thủ công
          </label>
          <label className="flex min-h-11 items-center gap-3">
            Phông nền
            <select
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base"
              value={background}
              onChange={(event) => setBackground(event.target.value)}
            >
              <option value="paper">Nền giấy</option>
              <option value="green">Nền xanh</option>
            </select>
          </label>
        </div>
        <div
          data-demo-canvas
          className={`space-y-12 rounded-2xl p-4 md:p-6 ${background === 'green' ? 'bg-primary' : 'bg-beige'}`}
        >
          <section aria-labelledby="demo-row-title">
            <h2
              id="demo-row-title"
              className={`mb-5 font-heading text-2xl font-bold ${background === 'green' ? 'text-white' : 'text-ink'}`}
            >
              TicketRow · vé ngang
            </h2>
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <TicketRow
                {...examples[0]}
                featured
                ticketNumber={1}
                pattern={pattern}
                className="lg:col-span-2"
              />
              {examples.map((example, index) => (
                <TicketRow
                  key={index}
                  {...example}
                  ticketNumber={index + 2}
                  pattern={pattern}
                />
              ))}
            </div>
            <div className="mt-5">
              <TicketRow loading />
            </div>
          </section>
          <section aria-labelledby="demo-card-title">
            <h2
              id="demo-card-title"
              className={`mb-5 font-heading text-2xl font-bold ${background === 'green' ? 'text-white' : 'text-ink'}`}
            >
              TicketCard · vé dọc
            </h2>
            <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {examples.map((props, index) => (
                <TicketCard key={index} {...props} pattern={pattern} />
              ))}
              <TicketCard loading />
            </div>
          </section>
          <section aria-labelledby="demo-booking-title">
            <h2
              id="demo-booking-title"
              className={`mb-5 font-heading text-2xl font-bold ${background === 'green' ? 'text-white' : 'text-ink'}`}
            >
              BookingTicket · vé đặt chỗ
            </h2>
            <div className="mb-5 flex flex-wrap gap-4 rounded-lg bg-ticket p-4">
              <label className="grid gap-2 text-sm">
                Trạng thái
                <select
                  className="min-h-11 rounded-lg border border-primary bg-surface px-3 text-base"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as Booking['status'])
                  }
                >
                  {Object.entries(BOOKING_STATUSES).map(([value, state]) => (
                    <option value={value} key={value}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                Thanh toán
                <select
                  className="min-h-11 rounded-lg border border-primary bg-surface px-3 text-base"
                  value={payment}
                  onChange={(event) =>
                    setPayment(event.target.value as Booking['paymentMethod'])
                  }
                >
                  <option value="at_studio">Trả tại studio</option>
                  <option value="prepaid">Đã thanh toán trước</option>
                </select>
              </label>
            </div>
            <BookingTicket
              {...base}
              pattern={pattern}
              studio={{
                ...base.studio,
                address: 'Địa chỉ mô phỏng: 12 đường Gốm, TP. Hồ Chí Minh',
              }}
              booking={{
                code: 'OS-9031-1017',
                status,
                partySize: 2,
                paymentMethod: payment,
                paymentStatus: payment === 'prepaid' ? 'paid' : 'unpaid',
              }}
            />
          </section>
        </div>
      </PageContainer>
    </div>
  );
}
