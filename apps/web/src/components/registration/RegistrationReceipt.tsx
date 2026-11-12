import { ArrowRight, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import type { CreatedStudio } from '@/services/managementService';
import { Button } from '../ui/button';

export interface RegistrationReceiptProps {
  receipt: CreatedStudio;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export function RegistrationReceipt({
  receipt,
  headingRef,
}: RegistrationReceiptProps) {
  return (
    <section
      className="max-w-2xl rounded-2xl bg-soft p-6 md:p-10"
      aria-labelledby="studio-application-title"
    >
      <CheckCircle2 size={32} className="text-primary" aria-hidden="true" />
      <h1
        id="studio-application-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 font-heading text-3xl font-semibold text-primary focus:outline-none"
      >
        Hồ sơ đã được gửi
      </h1>
      <p className="mt-4 text-lg">
        <strong>{receipt.name}</strong> đang chờ Open Slot xét duyệt.
      </p>
      <p className="mt-3 leading-7 text-muted">
        Bạn đã được ghi nhận là chủ studio. Theo dõi trạng thái hồ sơ trong mục
        Quản lý studio; studio sẽ xuất hiện công khai sau khi được duyệt.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Button asChild className="min-h-11">
          <Link to={`/studio/studios/${receipt.id}`}>
            Xem hồ sơ studio
            <ArrowRight size={17} />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/studio">Danh sách studio</Link>
        </Button>
      </div>
    </section>
  );
}
