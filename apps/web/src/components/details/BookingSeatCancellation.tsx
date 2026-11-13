import { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, Ticket, Users } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { customerBookingService } from '@/services/customerBookingService';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';

const money = (amount: number) => `${formatPrice(amount)} đ`;

export interface BookingSeatCancellationProps {
  bookingId: string;
  pending: boolean;
  canCancel: boolean;
  quantity: number;
  onUpdated: () => Promise<unknown>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialSequence?: number | null;
  onClearInitialSequence?: () => void;
}

export function BookingSeatCancellation({
  bookingId,
  pending,
  canCancel,
  quantity,
  onUpdated,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  initialSequence,
  onClearInitialSequence,
}: BookingSeatCancellationProps) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (setControlledOpen) {
      setControlledOpen(value);
    } else {
      setInternalOpen(value);
    }
    if (!value && onClearInitialSequence) {
      onClearInitialSequence();
    }
  };

  const [sequences, setSequences] = useState<number[]>([]);
  const inFlight = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  // Lấy danh sách chỗ khi mở modal hoặc có initialSequence
  const seats = useQuery({
    queryKey: ['booking-seats', user?.id, bookingId],
    queryFn: ({ signal }) => customerBookingService.seats(bookingId, signal),
    enabled: Boolean(user && (isOpen || quantity > 1)),
    refetchOnWindowFocus: true,
    refetchInterval: pending ? 5000 : 15000,
  });

  // Khi modal mở hoặc initialSequence thay đổi
  useEffect(() => {
    if (isOpen) {
      if (initialSequence !== undefined && initialSequence !== null) {
        setSequences([initialSequence]);
      }
    } else {
      setSequences([]);
    }
  }, [isOpen, initialSequence]);

  // Lấy báo giá hủy cho các chỗ đã chọn
  const quote = useQuery({
    queryKey: ['seat-cancellation-quote', user?.id, bookingId, sequences],
    queryFn: ({ signal }) =>
      customerBookingService.quoteSeats(bookingId, sequences, signal),
    enabled: Boolean(user && isOpen && sequences.length > 0),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Mutation thực hiện hủy
  const cancel = useMutation({
    mutationFn: () => {
      if (!quote.data || quote.isFetching)
        throw new Error('Vui lòng chờ kiểm tra các chỗ đã chọn.');
      return customerBookingService.cancelSeats(
        bookingId,
        sequences,
        quote.data.quoteToken,
      );
    },
    onSuccess: async () => {
      setOpen(false);
      setSequences([]);
      await Promise.all([seats.refetch(), onUpdated()]);
    },
    onError: async () => {
      await Promise.all([quote.refetch(), seats.refetch(), onUpdated()]);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  // Nếu đơn chỉ có 1 chỗ hoặc không đủ điều kiện hủy thì không hiển thị
  if (!canCancel || quantity <= 1) {
    return null;
  }

  const cancelableSeats = seats.data?.filter((s) => s.canCancel) ?? [];

  const handleToggleSequence = (seq: number) => {
    setSequences((prev) =>
      prev.includes(seq)
        ? prev.filter((item) => item !== seq)
        : [...prev, seq].sort((a, b) => a - b),
    );
  };

  const handleSelectAll = () => {
    if (sequences.length === cancelableSeats.length) {
      setSequences([]);
    } else {
      setSequences(cancelableSeats.map((s) => s.seq));
    }
  };

  return (
    <>
      {/* Nút hành động chính để mở modal hủy từng chỗ */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          cancel.reset();
          setOpen(true);
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-xs transition-colors hover:border-primary hover:bg-soft hover:text-primary"
      >
        <Ticket
          size={18}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <span>Hủy từng chỗ ({quantity} vé)</span>
      </button>

      {/* Modal Dialog chọn từng chỗ cần hủy */}
      <Dialog
        open={isOpen}
        onOpenChange={(value) => {
          if (!inFlight.current && !cancel.isPending) {
            setOpen(value);
          }
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto bg-surface p-5 sm:p-6"
          closeDisabled={cancel.isPending}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            keepRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <div className="flex items-center gap-2.5 pr-8">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brick/10 text-brick">
              <Users size={18} aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="font-heading text-lg font-semibold text-ink sm:text-xl">
                Hủy từng chỗ đã đặt
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted sm:text-sm">
                Chọn các chỗ muốn hủy. Các chỗ còn lại vẫn giữ nguyên lịch tham gia.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {/* Trạng thái tải danh sách chỗ */}
            {seats.isPending && (
              <div className="flex items-center justify-center py-8 text-sm text-muted">
                <LoaderCircle
                  size={20}
                  className="mr-2 animate-spin text-primary"
                />
                Đang tải danh sách chỗ…
              </div>
            )}

            {seats.isError && (
              <div
                role="alert"
                className="rounded-xl border border-brick/30 bg-brick/10 p-3.5 text-sm text-brick"
              >
                Chưa tải được danh sách chỗ.{' '}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => void seats.refetch()}
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Danh sách các chỗ để tick chọn */}
            {seats.isSuccess && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    Đã chọn:{' '}
                    <strong className="font-semibold text-ink">
                      {sequences.length} / {cancelableSeats.length}
                    </strong>{' '}
                    chỗ có thể hủy
                  </span>
                  {cancelableSeats.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={cancel.isPending}
                      className="font-semibold text-primary hover:underline"
                    >
                      {sequences.length === cancelableSeats.length
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </button>
                  )}
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {seats.data.map((seat) => {
                    const isSelected = sequences.includes(seat.seq);
                    const isCancelable = seat.canCancel;

                    return (
                      <div
                        key={seat.id}
                        onClick={() => {
                          if (isCancelable && !cancel.isPending) {
                            handleToggleSequence(seat.seq);
                          }
                        }}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                          !isCancelable
                            ? 'cursor-not-allowed border-line bg-soft/50 opacity-60'
                            : isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'border-line bg-surface hover:border-primary/40'
                        }`}
                      >
                        <div className="mt-0.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isCancelable || cancel.isPending}
                            onChange={() => {
                              // handled by container onClick
                            }}
                            className="size-4.5 rounded accent-primary"
                            aria-label={`Hủy chỗ số ${seat.seq}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-heading text-sm font-semibold text-ink">
                              Chỗ số {seat.seq}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                seat.state === 'cancelled'
                                  ? 'bg-studio-neutral-soft text-studio-neutral'
                                  : seat.attendanceStatus === 'attended'
                                    ? 'bg-studio-success-soft text-studio-success'
                                    : seat.attendanceStatus === 'absent'
                                      ? 'bg-studio-danger-soft text-studio-danger'
                                      : 'bg-studio-success-soft text-studio-success'
                              }`}
                            >
                              {seat.state === 'cancelled'
                                ? 'Đã hủy'
                                : seat.attendanceStatus === 'attended'
                                  ? 'Đã check-in'
                                  : seat.attendanceStatus === 'absent'
                                    ? 'Vắng mặt'
                                    : 'Còn hiệu lực'}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                            <span>Giá: {money(seat.totalAmount)}</span>
                            {seat.depositAmount > 0 && (
                              <span>Cọc: {money(seat.depositAmount)}</span>
                            )}
                            {seat.paidAmount > 0 && (
                              <span className="text-ink font-medium">
                                Đã cọc: {money(seat.paidAmount)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Thông tin hoàn tiền & tác động khi chọn hủy */}
            {sequences.length > 0 && (
              <div className="rounded-xl border border-line bg-soft p-3.5 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between font-semibold">
                  <span>Sau khi hủy:</span>
                  <span className="text-primary">
                    Còn lại{' '}
                    {quote.data?.remainingQuantity ??
                      quantity - sequences.length}{' '}
                    chỗ
                  </span>
                </div>

                {quote.isFetching ? (
                  <div className="flex items-center gap-2 py-2 text-muted">
                    <LoaderCircle size={14} className="animate-spin text-primary" />
                    Đang tính toán khoản tiền hoàn…
                  </div>
                ) : quote.data ? (
                  <div className="space-y-1.5 pt-1 text-ink">
                    {quote.data.paidAmount > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Khoản cần hoàn lại:</span>
                          <span className="font-bold text-studio-success tabular-nums">
                            {money(quote.data.refundDueAmount)}
                          </span>
                        </div>
                        {quote.data.retainedAmount > 0 && (
                          <div className="flex items-center justify-between text-muted">
                            <span>Cọc giữ lại (hủy trong 24h):</span>
                            <span className="tabular-nums">
                              {money(quote.data.retainedAmount)}
                            </span>
                          </div>
                        )}
                        <p className="pt-1 text-[11px] leading-4 text-muted">
                          Khoản hoàn sẽ được chuyển về tài khoản của bạn trong
                          vòng tối đa 7 ngày làm việc.
                        </p>
                      </>
                    ) : (
                      <p className="text-muted">
                        Bạn chưa thanh toán cho các chỗ này nên không mất khoản
                        phí nào.
                      </p>
                    )}

                    {pending && quote.data.remainingQuantity > 0 && (
                      <p className="text-[11px] leading-4 text-muted">
                        Mã cọc payOS sẽ đổi theo số chỗ còn lại. Hạn giữ chỗ ban
                        đầu vẫn được giữ nguyên.
                      </p>
                    )}
                  </div>
                ) : null}

                {quote.isError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 text-xs text-brick pt-1"
                  >
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <span>{quote.error.message}</span>
                      <button
                        type="button"
                        onClick={() => void quote.refetch()}
                        className="ml-1.5 font-semibold underline"
                      >
                        Kiểm tra lại
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {cancel.isError && (
              <p role="alert" className="text-xs text-brick font-medium">
                {cancel.error.message}. Vui lòng thử lại.
              </p>
            )}
          </div>

          {/* Nút xác nhận hoặc giữ lại */}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              ref={keepRef}
              type="button"
              disabled={cancel.isPending}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-soft"
            >
              Giữ các chỗ này
            </button>
            <button
              type="button"
              disabled={
                sequences.length === 0 ||
                cancel.isPending ||
                quote.isFetching ||
                quote.isError ||
                !quote.data
              }
              aria-busy={cancel.isPending || quote.isFetching}
              onClick={() => {
                if (inFlight.current) return;
                inFlight.current = true;
                cancel.mutate();
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brick px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brick/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancel.isPending ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  <span>Đang hủy chỗ…</span>
                </>
              ) : (
                <span>
                  Xác nhận hủy {sequences.length ? `${sequences.length} chỗ` : ''}
                </span>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
