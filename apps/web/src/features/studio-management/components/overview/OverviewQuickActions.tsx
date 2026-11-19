import {
  CalendarCheck,
  CalendarPlus,
  PlusCircle,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { studioPage } from '@/lib/studio-dashboard';

export interface OverviewQuickActionsProps {
  studioId: string;
}

export function OverviewQuickActions({ studioId }: OverviewQuickActionsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <Link
        to={studioPage(studioId, 'sessions')}
        className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
          <CalendarPlus size={16} aria-hidden="true" />
        </span>
        <div className="mt-3">
          <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
            Lên lịch buổi
          </p>
          <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
            Thêm ngày giờ & số chỗ
          </p>
        </div>
      </Link>

      <Link
        to={studioPage(studioId, 'bookings')}
        className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
          <CalendarCheck size={16} aria-hidden="true" />
        </span>
        <div className="mt-3">
          <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
            Khách & Soát vé
          </p>
          <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
            Điểm danh & thu số dư
          </p>
        </div>
      </Link>

      <Link
        to={studioPage(studioId, 'workshops')}
        className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
          <PlusCircle size={16} aria-hidden="true" />
        </span>
        <div className="mt-3">
          <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
            Thêm workshop
          </p>
          <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
            Mở gói trải nghiệm mới
          </p>
        </div>
      </Link>

      <Link
        to={studioPage(studioId, 'finances')}
        className="group flex flex-col justify-between rounded-studio-card border border-studio-border bg-studio-surface p-3.5 transition-all hover:border-studio-primary hover:shadow-studio-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-primary"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-studio-primary-soft text-studio-primary transition-transform group-hover:scale-105">
          <WalletCards size={16} aria-hidden="true" />
        </span>
        <div className="mt-3">
          <p className="text-sm font-semibold text-studio-ink group-hover:text-studio-primary">
            Quyết toán sàn
          </p>
          <p className="mt-0.5 text-xs text-studio-muted line-clamp-1">
            Tiền cọc & đối soát
          </p>
        </div>
      </Link>
    </div>
  );
}
