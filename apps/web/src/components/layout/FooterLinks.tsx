import { Link, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useRef, type ReactNode } from 'react';

import { useSiteInformation } from '@/hooks/useSiteInformation';

const loadInformationDialog = () =>
  import('./FooterInformationDialog').then((module) => ({
    default: module.FooterInformationDialog,
  }));
const InformationDialog = lazy(loadInformationDialog);

const linkClass =
  'inline-flex min-h-11 items-center rounded-lg text-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:min-h-7 max-[480px]:min-h-10 max-[480px]:text-[14px]';

function FooterGroup({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`footer-link-group flex min-w-0 flex-col items-start gap-2 ${className} ${className.includes('footer-discover') ? 'max-[480px]:hidden' : 'max-[480px]:contents'}`}
    >
      <h2 className="mb-1 font-sans text-base font-bold leading-normal max-[480px]:hidden">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function FooterLinks() {
  const { siteContact, information } = useSiteInformation();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const currentPath = pathname.replace(/\/+$/, '') || '/';
  const opener = useRef<HTMLAnchorElement | null>(null);
  const selected = information.find((item) => `#${item.id}` === hash);
  return (
    <>
      <nav
        aria-label="Điều hướng cuối trang"
        className="footer-links grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8 max-[480px]:gap-x-4 max-[480px]:gap-y-3"
      >
        <FooterGroup title="Khám phá" className="footer-discover">
          <Link
            className={linkClass}
            to="/kham-pha?view=workshop"
            aria-current={
              currentPath === '/kham-pha' || currentPath === '/explore'
                ? 'page'
                : undefined
            }
          >
            Khám phá workshop
          </Link>
          <Link
            className={linkClass}
            to="/"
            aria-current={currentPath === '/' ? 'page' : undefined}
          >
            Trang chủ
          </Link>
        </FooterGroup>
        <FooterGroup title="Dành cho nghệ nhân">
          <Link
            className={linkClass}
            to="/danh-cho-nghe-nhan"
            aria-current={
              currentPath === '/danh-cho-nghe-nhan' ? 'page' : undefined
            }
          >
            Mở studio trên Open Slot
          </Link>
        </FooterGroup>
        <FooterGroup title="Hỗ trợ">
          <a
            className={`${linkClass} max-w-full break-all`}
            href={`mailto:${siteContact.email}`}
          >
            {siteContact.email}
          </a>
          <Link
            className={linkClass}
            to="/ve-open-slot"
            aria-current={currentPath === '/ve-open-slot' ? 'page' : undefined}
          >
            Về Open Slot
          </Link>
          <Link
            className={linkClass}
            to="/tro-giup"
            aria-current={
              currentPath === '/tro-giup' || currentPath === '/faq'
                ? 'page'
                : undefined
            }
          >
            Câu hỏi thường gặp
          </Link>
          <Link
            className={linkClass}
            to="/lien-he"
            aria-current={
              currentPath === '/lien-he' || currentPath === '/contact'
                ? 'page'
                : undefined
            }
          >
            Liên hệ hỗ trợ
          </Link>
          {information
            .filter((item) => item.id !== 'ho-tro')
            .map((item) => {
              const id = item.id;
              return (
                <Link
                  className={linkClass}
                  key={id}
                  to={`${pathname}${search}#${id}`}
                  aria-haspopup="dialog"
                  onMouseEnter={() =>
                    void loadInformationDialog().catch(() => {})
                  }
                  onFocus={() => void loadInformationDialog().catch(() => {})}
                  onClick={(event) => {
                    opener.current = event.currentTarget;
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          {(siteContact.hotline?.trim() ||
            siteContact.workingHours?.trim()) && (
            <p className="footer-hotline max-w-full break-words text-sm font-semibold leading-relaxed max-[480px]:col-span-2 max-[480px]:flex max-[480px]:min-h-10 max-[480px]:items-center max-[480px]:text-[14px]">
              {siteContact.hotline?.trim() && (
                <a
                  href={'tel:' + siteContact.hotline.replace(/[^\d+]/g, '')}
                  className="rounded-lg hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Hotline {siteContact.hotline}
                  {siteContact.workingHours?.trim() &&
                    ` · ${siteContact.workingHours}`}
                </a>
              )}
              {!siteContact.hotline?.trim() &&
                siteContact.workingHours?.trim() && (
                  <span className="font-normal">
                    {siteContact.workingHours}
                  </span>
                )}
            </p>
          )}
        </FooterGroup>
      </nav>
      {selected && (
        <Suspense fallback={null}>
          <InformationDialog
            selected={selected}
            opener={opener}
            onClose={() => navigate(`${pathname}${search}`, { replace: true })}
          />
        </Suspense>
      )}
    </>
  );
}
