import { Link } from 'react-router-dom';
import { FooterLinks } from './FooterLinks';
import { PageContainer } from './PageContainer';

export function SiteFooter() {
  return (
    <footer className="bg-soft py-8 text-ink" id="footer">
      <PageContainer>
        <div className="flex flex-col justify-between gap-6 lg:flex-row max-[480px]:gap-3">
          <p className="max-w-lg text-2xl leading-relaxed sm:text-3xl max-[480px]:text-[21px] max-[480px]:leading-tight">
            Gặp gỡ nghệ nhân.
            <br />
            Tự tay làm điều có ý nghĩa.
          </p>
          <FooterLinks />
        </div>
        <Link
          className="my-4 block w-fit font-heading text-[10vw] font-medium leading-tight tracking-[-.065em] hover:text-primary focus-visible:outline-primary md:text-[5.5vw] max-[480px]:hidden"
          to="/"
          aria-label="Open Slot, trang chủ"
        >
          Open Slot
        </Link>
        <div className="flex flex-col items-start gap-3 text-sm md:flex-row md:justify-between max-[480px]:flex-row max-[480px]:items-center max-[480px]:justify-between max-[480px]:gap-2 max-[480px]:text-xs">
          <span>© 2026 Open Slot Vietnam</span>
          <span>Ảnh minh họa: Unsplash</span>
        </div>
      </PageContainer>
    </footer>
  );
}
