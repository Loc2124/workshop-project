import { useRef, useState } from 'react';
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
const button =
  'min-h-11 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50';
const money = (amount: number) => `${formatPrice(amount)} đ`;
export function BookingSeatCancellation({
  bookingId,
  pending,
  onUpdated,
}: {
  bookingId: string;
  pending: boolean;
  onUpdated: () => Promise<unknown>;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false),
    [sequences, setSequences] = useState<number[]>([]),
    [open, setOpen] = useState(false),
    [notice, setNotice] = useState('');
  const inFlight = useRef(false),
    trigger = useRef<HTMLButtonElement>(null),
    keep = useRef<HTMLButtonElement>(null),
    container = useRef<HTMLDivElement>(null);
  const seats = useQuery({
    queryKey: ['booking-seats', user?.id, bookingId],
    queryFn: ({ signal }) => customerBookingService.seats(bookingId, signal),
    enabled: !!user && expanded,
    refetchOnWindowFocus: true,
    refetchInterval: pending ? 5000 : 15000,
  });
  const quote = useQuery({
    queryKey: ['seat-cancellation-quote', user?.id, bookingId, sequences],
    queryFn: ({ signal }) =>
      customerBookingService.quoteSeats(bookingId, sequences, signal),
    enabled: !!user && open && !!sequences.length,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
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
      setNotice('Đã hủy các chỗ đã chọn.');
      await Promise.all([seats.refetch(), onUpdated()]);
    },
    onError: async () => {
      await Promise.all([quote.refetch(), seats.refetch(), onUpdated()]);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  return (
    <div
      ref={container}
      tabIndex={-1}
      className="mt-4 rounded-lg border border-primary/20 p-3 outline-none"
    >
      <button
        type="button"
        className="min-h-11 w-full text-left text-sm font-semibold text-primary underline"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        Xem và hủy từng chỗ
      </button>
      {expanded && (
        <div className="mt-2 space-y-3 text-sm">
          <p>
            Chọn đúng những chỗ bạn muốn hủy. Các chỗ khác vẫn được giữ theo
            lịch đã đặt.
          </p>
          {seats.isPending && <p role="status">Đang tải các chỗ đã đặt…</p>}
          {seats.isError && (
            <p role="alert" className="text-brick">
              Chưa tải được các chỗ đã đặt.{' '}
              <button className={button} onClick={() => void seats.refetch()}>
                Thử lại
              </button>
            </p>
          )}
          <ul className="space-y-2">
            {seats.data?.map((seat) => (
              <li key={seat.id} className="rounded-lg bg-soft p-3">
                <label className="flex min-h-11 items-start gap-3">
                  <input
                    className="mt-1 size-5 shrink-0 accent-primary"
                    type="checkbox"
                    aria-label={`Hủy chỗ số ${seat.seq}`}
                    disabled={!seat.canCancel || cancel.isPending || open}
                    checked={sequences.includes(seat.seq)}
                    onChange={(event) =>
                      setSequences((values) =>
                        (event.target.checked
                          ? [...values, seat.seq]
                          : values.filter((seq) => seq !== seat.seq)
                        ).sort((a, b) => a - b),
                      )
                    }
                  />
                  <span>
                    <strong>Chỗ số {seat.seq}</strong> ·{' '}
                    {seat.state === 'cancelled'
                      ? 'Đã hủy'
                      : seat.state === 'expired'
                        ? 'Hết hạn giữ chỗ'
                        : seat.attendanceStatus === 'attended'
                          ? 'Đã đến'
                          : seat.attendanceStatus === 'absent'
                            ? 'Vắng mặt'
                            : 'Còn hiệu lực'}
                    <span className="mt-1 block text-stone-700">
                      Giá {money(seat.totalAmount)} · Cọc gốc{' '}
                      {money(seat.depositAmount)}
                    </span>
                    <span className="block text-stone-700">
                      Đã trả {money(seat.paidAmount)}
                      {seat.refundDueAmount > 0
                        ? ` · Khoản hoàn ${money(seat.refundDueAmount)}, đã hoàn ${money(seat.refundedAmount)}`
                        : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            ref={trigger}
            type="button"
            className={button + ' w-full'}
            disabled={!sequences.length || cancel.isPending || seats.isFetching}
            onClick={() => {
              cancel.reset();
              setOpen(true);
            }}
          >
            Hủy {sequences.length || ''} chỗ đã chọn
          </button>
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!inFlight.current) setOpen(value);
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface"
          closeDisabled={cancel.isPending}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            keep.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (trigger.current && !trigger.current.disabled
              ? trigger.current
              : container.current
            )?.focus();
          }}
        >
          <DialogTitle>Hủy {sequences.length} chỗ đã chọn?</DialogTitle>
          <DialogDescription className="mt-3 leading-6">
            {quote.isFetching
              ? 'Đang kiểm tra khoản hoàn và số chỗ còn lại…'
              : quote.data
                ? `Sau khi hủy, còn ${quote.data.remainingQuantity} chỗ. ${quote.data.paidAmount === 0 ? 'Bạn chưa thanh toán cho các chỗ này nên không mất khoản nào.' : `Khoản cần hoàn: ${money(quote.data.refundDueAmount)}. Phần giữ lại theo cọc gốc: ${money(quote.data.retainedAmount)}.${(quote.data.alreadyRefundedAmount ?? 0) > 0 ? ` Trước đó đã hoàn ${money(quote.data.alreadyRefundedAmount!)}.` : ''}`}`
                : 'Vui lòng kiểm tra thông tin trước khi xác nhận hủy.'}
          </DialogDescription>
          {pending && quote.data && quote.data.remainingQuantity > 0 && (
            <p className="mt-3 text-sm">
              Mã cọc sẽ đổi theo số chỗ còn lại. Hạn giữ chỗ ban đầu được giữ
              nguyên.
            </p>
          )}
          {!!quote.data?.refundDueAmount && (
            <p className="mt-3 text-sm">
              Khoản cần hoàn được xử lý trong tối đa 7 ngày làm việc theo chính
              sách.
            </p>
          )}
          {quote.isError && (
            <p role="alert" className="mt-3 text-sm text-brick">
              {quote.error.message}{' '}
              <button
                className="underline"
                onClick={() => void quote.refetch()}
              >
                Kiểm tra lại
              </button>
            </p>
          )}
          {cancel.isError && (
            <p role="alert" className="mt-3 text-sm text-brick">
              {cancel.error.message} Vui lòng xem lại và xác nhận lần nữa nếu
              vẫn muốn hủy.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              ref={keep}
              type="button"
              className={button + ' flex-1'}
              disabled={cancel.isPending}
              onClick={() => setOpen(false)}
            >
              Giữ các chỗ này
            </button>
            <button
              type="button"
              className={button + ' flex-1 border-brick bg-brick text-white'}
              disabled={
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
            >
              {cancel.isPending ? 'Đang hủy…' : 'Xác nhận hủy'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
