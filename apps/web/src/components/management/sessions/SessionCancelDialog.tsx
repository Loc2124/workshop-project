import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../ui/dialog';
import { StudioButton } from '../StudioPrimitives';
import type { StudioSession } from '@/types/management';

export interface SessionCancelDialogProps {
  session: StudioSession | undefined;
  onClose: () => void;
  onConfirm: (session: StudioSession) => void;
  isPending: boolean;
}

export function SessionCancelDialog({
  session,
  onClose,
  onConfirm,
  isPending,
}: SessionCancelDialogProps) {
  return (
    <Dialog open={Boolean(session)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-studio-surface p-6">
        <DialogTitle className="font-heading text-xl font-semibold text-studio-ink">
          Hủy buổi workshop?
        </DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-6 text-studio-muted">
          Buổi học sẽ được đánh dấu đã hủy và không còn nhận đặt chỗ mới. Toàn
          bộ tiền cọc của khách đã đặt sẽ được ghi nhận để hoàn lại theo chính
          sách của nền tảng.
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <StudioButton
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onClose}
          >
            Giữ lại buổi
          </StudioButton>
          <StudioButton
            type="button"
            disabled={isPending}
            loading={isPending}
            onClick={() => session && onConfirm(session)}
            className="bg-studio-danger text-white hover:bg-studio-danger/90"
          >
            {isPending ? 'Đang hủy…' : 'Xác nhận hủy'}
          </StudioButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
