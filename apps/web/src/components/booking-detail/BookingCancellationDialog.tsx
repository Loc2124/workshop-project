import { type RefObject } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';

const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-soft disabled:opacity-60';

export interface BookingCancellationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  isFetchingQuote: boolean;
  quoteHasError: boolean;
  quoteHasData: boolean;
  cancelErrorMessage?: string;
  cancellationDescription: string;
  cancelOpenerRef: RefObject<HTMLButtonElement | null>;
  cancelTriggerRef: RefObject<HTMLButtonElement | null>;
  keepBookingRef: RefObject<HTMLButtonElement | null>;
  onRetryQuote: () => void;
  onConfirmCancel: () => void;
}

export function BookingCancellationDialog({
  open,
  onOpenChange,
  isPending,
  isFetchingQuote,
  quoteHasError,
  quoteHasData,
  cancelErrorMessage,
  cancellationDescription,
  cancelOpenerRef,
  cancelTriggerRef,
  keepBookingRef,
  onRetryQuote,
  onConfirmCancel,
}: BookingCancellationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface p-5 sm:p-6"
        closeDisabled={isPending}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepBookingRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const opener = cancelOpenerRef.current;
          (opener?.isConnected ? opener : cancelTriggerRef.current)?.focus();
        }}
      >
        <DialogTitle className="pr-10 font-heading text-lg sm:text-xl">
          Hủy đặt chỗ này?
        </DialogTitle>
        <DialogDescription className="mt-3 leading-6 text-sm sm:text-base">
          {cancellationDescription}
        </DialogDescription>
        {quoteHasError && (
          <p role="alert" className="mt-3 text-sm text-brick">
            Chưa kiểm tra được thông tin hủy.{' '}
            <button
              type="button"
              className="underline font-semibold"
              onClick={onRetryQuote}
            >
              Thử lại
            </button>
          </p>
        )}
        {cancelErrorMessage && (
          <p role="alert" className="mt-4 text-sm text-brick">
            {cancelErrorMessage} Chưa nhận được xác nhận hủy. Vui lòng kiểm tra
            trạng thái trước khi thử lại.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            ref={keepBookingRef}
            type="button"
            disabled={isPending}
            className={`${secondary} flex-1`}
            onClick={() => onOpenChange(false)}
          >
            Giữ đặt chỗ
          </button>
          <button
            type="button"
            disabled={
              isPending || isFetchingQuote || !quoteHasData || quoteHasError
            }
            aria-busy={isPending || isFetchingQuote}
            className="min-h-11 flex-1 rounded-lg bg-brick px-4 text-sm font-semibold text-white hover:bg-brick/90 disabled:cursor-wait disabled:opacity-60"
            onClick={onConfirmCancel}
          >
            {isPending ? 'Đang hủy…' : 'Xác nhận hủy'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
