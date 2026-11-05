import type { RefObject } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

export function FooterInformationDialog({
  selected,
  onClose,
  opener,
}: {
  selected: { label: string; text: string };
  onClose: () => void;
  opener: RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
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
        <DialogTitle>{selected.label}</DialogTitle>
        <p
          id="footer-information-description"
          className="text-base leading-relaxed text-ink"
        >
          {selected.text}
        </p>
      </DialogContent>
    </Dialog>
  );
}
