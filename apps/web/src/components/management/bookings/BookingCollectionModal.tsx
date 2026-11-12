import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../ui/dialog';
import { StudioButton } from '../StudioPrimitives';
import { formatPrice } from '@/lib/format';

export interface BookingMinimal {
  id: string;
  orderCode: string;
  balanceAmount: number;
  contactName: string;
}

export interface BookingCollectionModalProps {
  selected: BookingMinimal | null;
  onClose: () => void;
  onConfirm: (booking: BookingMinimal) => void;
  isPending: boolean;
  errorMessage?: string;
}

export function BookingCollectionModal({
  selected,
  onClose,
  onConfirm,
  isPending,
  errorMessage,
}: BookingCollectionModalProps) {
  return (
    <Dialog
      open={Boolean(selected)}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      {selected && (
        <DialogContent
          closeDisabled={isPending}
          className="space-y-4 border-studio-border bg-studio-surface text-studio-ink sm:max-w-md p-5 sm:p-6"
        >
          <DialogTitle className="font-heading text-lg sm:text-xl font-semibold">
            Xác nhận đã nhận tiền đơn #{selected.orderCode}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-studio-muted">
            Đã nhận đủ {formatPrice(selected.balanceAmount)} đ từ{' '}
            {selected.contactName}?
          </DialogDescription>
          {errorMessage && (
            <p role="alert" className="text-sm text-studio-danger">
              {errorMessage}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <StudioButton
              variant="secondary"
              disabled={isPending}
              onClick={onClose}
            >
              Đóng
            </StudioButton>
            <StudioButton
              disabled={isPending}
              onClick={() => onConfirm(selected)}
              loading={isPending}
            >
              {isPending ? 'Đang ghi nhận…' : 'Đã nhận đủ tiền'}
            </StudioButton>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
