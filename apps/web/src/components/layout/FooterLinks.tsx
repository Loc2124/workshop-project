import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

import { useSiteInformation } from '../../hooks/useSiteInformation';

const linkClass =
  'inline-flex min-h-11 items-center rounded-lg text-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:min-h-7';

function FooterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="footer-link-group flex min-w-0 flex-col items-start gap-2">
      <h2 className="mb-1 font-sans text-base font-bold leading-normal">
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
        className="footer-links grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8"
      >
        <FooterGroup title="Khám phá">
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
          {information.map((item) => {
            const id = item.id;
            return (
              <Link
                className={linkClass}
                key={id}
                to={`${pathname}${search}#${id}`}
                aria-haspopup="dialog"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                }}
              >
                {id === 'ho-tro' ? 'Liên hệ hỗ trợ' : item.label}
              </Link>
            );
          })}
          {(siteContact.hotline?.trim() ||
            siteContact.workingHours?.trim()) && (
            <p className="footer-hotline max-w-full break-words text-sm font-semibold leading-relaxed">
              {siteContact.hotline?.trim() && (
                <a
                  href={'tel:' + siteContact.hotline.replace(/[^\d+]/g, '')}
                  className="rounded-lg hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Hotline {siteContact.hotline}
                </a>
              )}
              {siteContact.hotline?.trim() &&
                siteContact.workingHours?.trim() && <br />}
              {siteContact.workingHours?.trim() && (
                <span className="font-normal">{siteContact.workingHours}</span>
              )}
            </p>
          )}
        </FooterGroup>
      </nav>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) navigate(`${pathname}${search}`, { replace: true });
        }}
      >
        <DialogContent
          aria-describedby="footer-information-description"
          className="rounded-2xl"
          onOpenAutoFocus={() => {
            if (document.activeElement instanceof HTMLAnchorElement)
              opener.current = document.activeElement;
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          <DialogTitle>{selected?.label}</DialogTitle>
          <p
            id="footer-information-description"
            className="text-base leading-relaxed text-ink"
          >
            {selected?.text}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
