import type { RefObject } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import {
  PolicyTermsDialog,
  type PolicyTabKey,
} from '../common/PolicyTermsDialog';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';
import { Headphones, Mail, Phone } from 'lucide-react';
import { useSiteInformation } from '@/hooks/useSiteInformation';

export function FooterInformationDialog({
  selected,
  onClose,
  opener,
}: {
  selected: { id?: string; label: string; text: string };
  onClose: () => void;
  opener: RefObject<HTMLAnchorElement | null>;
}) {
  const { siteContact } = useSiteInformation();

  // If the user opened a policy/terms item, render the comprehensive PolicyTermsDialog window
  if (
    selected.id === 'dieu-khoan-dich-vu' ||
    selected.id === 'chinh-sach-dat-lich' ||
    selected.id === 'chinh-sach-bao-mat'
  ) {
    let tab: PolicyTabKey = 'terms';
    if (selected.id === 'chinh-sach-dat-lich') tab = 'booking';
    if (selected.id === 'chinh-sach-bao-mat') tab = 'privacy';

    return (
      <PolicyTermsDialog
        open
        defaultTab={tab}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
            if (opener.current) opener.current.focus();
          }
        }}
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby="footer-information-description"
        className="rounded-2xl max-w-md p-6 bg-surface"
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
        <div className="mb-4">
          <div className="flex items-center gap-2 text-primary">
            <Headphones className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Trung tâm trợ giúp
            </span>
          </div>
          <DialogTitle className="text-xl font-bold font-heading text-ink">
            {selected.label}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted">
            Đội ngũ chăm sóc khách hàng Open Slot luôn sẵn sàng đồng hành cùng
            bạn.
          </DialogDescription>
        </div>

        <div
          id="footer-information-description"
          className="space-y-4 text-sm leading-relaxed text-ink/90"
        >
          <p>{selected.text}</p>

          <div className="rounded-xl border border-line bg-soft/60 p-4 space-y-2.5 text-xs text-stone-700">
            {siteContact.hotline && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Hotline:{' '}
                  <strong className="text-ink">{siteContact.hotline}</strong> (
                  {siteContact.workingHours || '8:00 - 21:00'})
                </span>
              </div>
            )}
            {siteContact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Email:{' '}
                  <strong className="text-ink">{siteContact.email}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" asChild onClick={onClose}>
            <Link to="/tro-giup">Xem câu hỏi thường gặp (FAQ)</Link>
          </Button>
          <Button variant="default" size="sm" asChild onClick={onClose}>
            <Link to="/lien-he">Gửi phản hồi / Liên hệ</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
