import { Link } from 'react-router-dom';
import { FooterLinks } from './FooterLinks';
import { PageContainer } from './PageContainer';

export function SiteFooter() {
  return (
    <footer className="bg-soft py-7 text-ink" id="footer">
      <PageContainer>
        <div className="flex flex-col justify-between gap-6 lg:flex-row">
          <p className="max-w-lg text-2xl sm:text-3xl leading-relaxed">
            Gặp gỡ nghệ nhân.
            <br />
            Tự tay làm điều có ý nghĩa.
          </p>
          <FooterLinks />
        </div>
        <Link
          className="my-4 block w-fit hover:text-primary focus-visible:outline-primary font-heading text-[10vw] font-medium leading-tight tracking-[-.065em] md:text-[5.5vw]"
          to="/"
          aria-label="Open Slot, trang chủ"
        >
          Open Slot
        </Link>
        <div className="flex flex-col items-start gap-3 text-sm md:flex-row md:justify-between">
          <span>© 2026 Open Slot Vietnam</span>
          {import.meta.env.DEV && (
            <span>
              Hình ảnh minh họa từ thư viện ảnh sẵn có của dự án · Unsplash
            </span>
          )}
        </div>
      </PageContainer>
    </footer>
  );
}
