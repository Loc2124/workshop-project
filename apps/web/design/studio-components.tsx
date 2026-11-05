import { createRoot } from 'react-dom/client';
import { CalendarDays, Plus } from 'lucide-react';
import {
  StudioBadge,
  StudioButton,
  StudioCard,
  StudioEmptyState,
  StudioField,
  StudioFormSection,
  StudioSkeleton,
} from '../src/components/management/StudioPrimitives';
import '../src/styles.css';

function Preview() {
  return (
    <main className="min-h-screen bg-studio-canvas px-4 py-8 font-sans text-sm leading-relaxed text-studio-ink sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-studio-section">
        <header className="space-y-3">
          <img
            src="/brand/open-slot-logo.svg"
            alt="Open Slot"
            className="h-9 w-auto"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">
            Không gian quản lý studio
          </h1>
          <p className="max-w-xl text-base text-studio-muted">
            Bản xem trước bước 1 · Màu sắc, chữ và các thành phần dùng chung.
          </p>
        </header>
        <div className="grid gap-studio-card lg:grid-cols-2">
          <StudioCard className="space-y-studio-card">
            <h2 className="font-heading text-2xl font-bold">
              Thao tác và trạng thái
            </h2>
            <div className="flex flex-wrap gap-3">
              <StudioButton>
                <Plus size={16} aria-hidden="true" />
                Tạo workshop
              </StudioButton>
              <StudioButton variant="secondary">Chỉnh sửa</StudioButton>
              <StudioButton variant="ghost">Hủy</StudioButton>
            </div>
            <div className="flex flex-wrap gap-3">
              <StudioButton loading>Đang lưu…</StudioButton>
              <StudioButton disabled>Lưu hồ sơ</StudioButton>
            </div>
            <div className="flex flex-wrap gap-3">
              <StudioBadge tone="success">Đã thanh toán</StudioBadge>
              <StudioBadge tone="warning">Chờ duyệt</StudioBadge>
              <StudioBadge tone="danger">Đã hủy</StudioBadge>
              <StudioBadge>Đã diễn ra</StudioBadge>
            </div>
            <p className="text-studio-muted">
              Nút cao tối thiểu 44px. Dùng phím Tab để xem trạng thái focus.
            </p>
          </StudioCard>
          <StudioCard className="space-y-studio-card">
            <h2 className="font-heading text-2xl font-bold">
              Thông tin studio
            </h2>
            <StudioFormSection title="Thông tin cơ bản">
              <StudioField
                label="Tên studio"
                placeholder="Tên studio của bạn"
                hint="Tên hiển thị trên trang hồ sơ studio."
              />
              <StudioField
                label="Email liên hệ"
                type="email"
                defaultValue="studio@"
                error="Email không hợp lệ."
              />
            </StudioFormSection>
            <StudioButton>Lưu hồ sơ</StudioButton>
          </StudioCard>
        </div>
        <div className="grid gap-studio-card lg:grid-cols-2">
          <StudioEmptyState
            icon={CalendarDays}
            title="Chưa có buổi workshop"
            description="Các buổi workshop sẽ hiển thị tại đây."
            action={
              <StudioButton>
                <Plus size={16} aria-hidden="true" />
                Tạo buổi
              </StudioButton>
            }
          />
          <div className="space-y-studio-group">
            <h2 className="font-heading text-2xl font-bold">
              Đang tải thông tin
            </h2>
            <StudioSkeleton label="Đang tải thông tin studio…" />
            <p className="text-studio-muted">
              Hiệu ứng tải tôn trọng cài đặt giảm chuyển động của thiết bị.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
