import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GreenSection } from '../layout/GreenSection';

const steps = [
  {
    title: 'Tìm điều muốn thử',
    description: 'Chọn bộ môn, tỉnh thành và ngày bạn muốn dành cho sáng tạo.',
  },
  {
    title: 'Chọn buổi phù hợp',
    description: 'Đặt chỗ online, trả trước hoặc trả tại xưởng.',
  },
  {
    title: 'Gặp nhau tại xưởng',
    description:
      'Kiểm tra thông tin đặt chỗ trước khi đến. Nghệ nhân sẽ hướng dẫn bạn từng bước.',
  },
];

export function HomeProcessSection({ browseUrl }: { browseUrl: string }) {
  return (
    <GreenSection className="home-process" labelledBy="booking-steps-title">
      <div>
        <h2
          id="booking-steps-title"
          className="font-heading text-[40px] font-medium leading-tight tracking-tight lg:text-[58px]"
        >
          Đến xưởng.
          <br />
          Thử điều mới.
        </h2>
        <p className="mt-8 max-w-[33ch] text-base leading-relaxed">
          Không cần bắt đầu thật giỏi. Chỉ cần bắt đầu từ điều bạn tò mò.
        </p>
        <Link
          to={browseUrl}
          className="mt-6 inline-flex min-h-11 items-center gap-4 rounded-lg text-xl font-semibold underline underline-offset-4 focus-visible:outline-white"
        >
          Tìm buổi dành cho bạn
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </div>
      <ol className="grid list-decimal gap-8 pl-8 marker:text-2xl marker:font-semibold">
        {steps.map((step) => (
          <li className="pl-3" key={step.title}>
            <h3 className="mb-2.5 font-heading text-2xl font-medium leading-snug">
              {step.title}
            </h3>
            <p className="max-w-[48ch] text-base leading-relaxed">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </GreenSection>
  );
}
