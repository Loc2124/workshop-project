import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';

const ticketSchema = z.object({
  id: z.uuid(),
  seq: z.number(),
  status: z.string(),
  attendanceStatus: z.enum(['unmarked', 'attended', 'absent']),
  attendanceMethod: z
    .enum(['check_in', 'manual_confirmation'])
    .nullable()
    .optional(),
  version: z.number(),
  paidAmount: z.number(),
  depositAmount: z.number(),
  refundDueAmount: z.number(),
  refundedAmount: z.number(),
  refundHistoryLocked: z.boolean(),
  startsAt: z.string(),
  endsAt: z.string(),
  serverNow: z.string(),
  canMark: z.boolean(),
});
type Ticket = z.infer<typeof ticketSchema>;
const labels = {
  unmarked: 'Chưa ghi nhận',
  attended: 'Đã tham dự',
  absent: 'Vắng mặt',
};
const button =
  'min-h-11 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50';
export function TicketAttendanceEditor({
  bookingId,
  studioId,
  admin = false,
  onUpdated,
}: {
  bookingId: string;
  studioId?: string;
  admin?: boolean;
  onUpdated: () => Promise<unknown>;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<{
    ticket: Ticket;
    status: 'attended' | 'absent';
  } | null>(null);
  const [reason, setReason] = useState(''),
    [refundAction, setRefundAction] = useState<
      'preserve' | 'cancel_pending' | ''
    >('');
  const [notice, setNotice] = useState(''),
    [now, setNow] = useState(Date.now);
  const offset = useRef(0),
    inFlight = useRef(false),
    opener = useRef<HTMLButtonElement | null>(null),
    keep = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const prefix = admin
    ? `/admin/bookings/${bookingId}`
    : `/studios/${studioId}/bookings/${bookingId}`;
  const tickets = useQuery({
    queryKey: ['ticket-attendance', user?.id, admin, studioId, bookingId],
    queryFn: async ({ signal }) => {
      const data = z
        .object({ tickets: z.array(ticketSchema) })
        .parse(await apiFetch(prefix + '/tickets', { signal }));
      if (data.tickets[0])
        offset.current = Date.parse(data.tickets[0].serverNow) - Date.now();
      setNow(Date.now() + offset.current);
      return data.tickets;
    },
    refetchInterval: 30000,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  const requiresManualReason = Boolean(
    selected &&
    selected.status === 'attended' &&
    now >= Date.parse(selected.ticket.endsAt),
  );
  const update = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Vui lòng chọn vé.');
      return apiFetch(prefix + `/tickets/${selected.ticket.id}/attendance`, {
        method: 'POST',
        body: JSON.stringify({
          status: selected.status,
          expectedVersion: selected.ticket.version,
          ...(admin
            ? { reason, ...(refundAction ? { refundAction } : {}) }
            : requiresManualReason
              ? { reason }
              : {}),
        }),
      });
    },
    onSuccess: async () => {
      setSelected(null);
      setNotice('Đã ghi nhận tham dự cho vé này.');
      await Promise.all([tickets.refetch(), onUpdated()]);
    },
    onError: async () => {
      const latest = await tickets.refetch();
      setSelected((previous) =>
        previous
          ? {
              ...previous,
              ticket:
                latest.data?.find((t) => t.id === previous.ticket.id) ??
                previous.ticket,
            }
          : null,
      );
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  if (tickets.isPending)
    return (
      <p role="status" className="py-3 text-sm">
        Đang tải từng vé…
      </p>
    );
  if (tickets.isError)
    return (
      <p role="alert" className="py-3 text-sm text-brick">
        Chưa tải được vé.{' '}
        <button className={button} onClick={() => void tickets.refetch()}>
          Thử lại
        </button>
      </p>
    );
  const needsRefundChoice =
    admin &&
    selected?.ticket.refundHistoryLocked &&
    selected.status === 'attended';
  const absentRefund = selected
    ? Math.max(0, selected.ticket.paidAmount - selected.ticket.depositAmount)
    : 0;
  return (
    <div ref={container} tabIndex={-1} className="space-y-3 py-3 outline-none">
      <ul className="space-y-3">
        {tickets.data.map((t) => {
          const started = now >= Date.parse(t.startsAt),
            canAbsent = now >= Date.parse(t.startsAt) + 1800000,
            locked = t.refundHistoryLocked && !admin;
          return (
            <li key={t.id} className="rounded-lg bg-soft p-3 text-sm">
              <p className="font-semibold">
                Vé số {t.seq} ·{' '}
                {t.attendanceStatus === 'attended' &&
                t.attendanceMethod === 'manual_confirmation'
                  ? 'Đã tham dự · Xác nhận thủ công'
                  : labels[t.attendanceStatus]}
              </p>
              <p className="mt-1 text-stone-700">
                Đã trả {formatPrice(t.paidAmount)} đ · Cọc{' '}
                {formatPrice(t.depositAmount)} đ
              </p>
              {t.refundDueAmount > 0 && (
                <p className="mt-1">
                  Đã ghi khoản hoàn {formatPrice(t.refundDueAmount)} đ; đã hoàn{' '}
                  {formatPrice(t.refundedAmount)} đ.
                </p>
              )}
              {locked && (
                <p className="mt-2 text-stone-700">
                  Vé đã phát sinh khoản hoàn. Quản trị hỗ trợ điều chỉnh điểm
                  danh.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(['attended', 'absent'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={button}
                    disabled={
                      update.isPending ||
                      locked ||
                      !t.canMark ||
                      !started ||
                      (status === 'absent' && !canAbsent) ||
                      t.attendanceStatus === status
                    }
                    onClick={(event) => {
                      opener.current = event.currentTarget;
                      update.reset();
                      setReason('');
                      setRefundAction('');
                      setSelected({ ticket: t, status });
                    }}
                  >
                    {labels[status]}
                  </button>
                ))}
              </div>
              {!canAbsent && t.canMark && (
                <p className="mt-2 text-stone-700">
                  Ghi nhận vắng mặt từ 30 phút sau giờ bắt đầu.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {!tickets.data.length && (
        <p className="text-sm">Chưa có vé được xác nhận.</p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!inFlight.current && !open) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface"
          closeDisabled={update.isPending}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            keep.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (opener.current?.isConnected && !opener.current.disabled
              ? opener.current
              : container.current
            )?.focus();
          }}
        >
          <DialogTitle>
            Ghi nhận vé số {selected?.ticket.seq}{' '}
            {selected?.status === 'attended' ? 'đã đến' : 'vắng mặt'}?
          </DialogTitle>
          <DialogDescription className="mt-3 leading-6">
            {selected?.status === 'absent'
              ? absentRefund > 0
                ? `Khoản cần hoàn là ${formatPrice(absentRefund)} đ. ${selected.ticket.depositAmount > 0 ? 'Khoản cọc gốc được giữ lại.' : 'Vé này không cọc nên toàn bộ số tiền đã trả được hoàn.'} Sau khi phát sinh khoản hoàn, chỉ quản trị được điều chỉnh điểm danh.`
                : `${selected.ticket.paidAmount > 0 && selected.ticket.depositAmount > 0 ? 'Khoản cọc đã nhận được giữ lại.' : 'Vé này chưa thanh toán.'} Việc ghi nhận vắng mặt không tự xóa số tiền khách còn phải trả.`
              : 'Chỉ vé này được ghi nhận đã đến. Thông tin thanh toán và các vé khác được giữ nguyên.'}
          </DialogDescription>
          {(admin || requiresManualReason) && (
            <label className="mt-3 block text-sm">
              {requiresManualReason
                ? 'Lý do xác nhận đã tham dự thủ công'
                : 'Lý do điều chỉnh'}
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 p-3"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
              />
            </label>
          )}
          {needsRefundChoice && (
            <fieldset className="mt-3 space-y-3 text-sm">
              <legend className="font-semibold">Xử lý khoản hoàn đã ghi</legend>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="attendance-refund"
                  value="preserve"
                  checked={refundAction === 'preserve'}
                  onChange={() => setRefundAction('preserve')}
                />
                Giữ nguyên lịch sử và khoản hoàn
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="attendance-refund"
                  value="cancel_pending"
                  checked={refundAction === 'cancel_pending'}
                  disabled={(selected?.ticket.refundedAmount ?? 0) > 0}
                  onChange={() => setRefundAction('cancel_pending')}
                />
                Dừng khoản hoàn chưa chuyển
              </label>
              <p>
                Tiền đã hoàn không bị xóa. Nếu cần thu lại, hãy đối soát và xử
                lý riêng với khách.
              </p>
            </fieldset>
          )}
          {update.isError && (
            <p role="alert" className="mt-3 text-sm text-brick">
              {update.error.message} Vui lòng xem lại trước khi xác nhận.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              ref={keep}
              className={button + ' flex-1'}
              type="button"
              disabled={update.isPending}
              onClick={() => setSelected(null)}
            >
              Quay lại
            </button>
            <button
              className={button + ' flex-1 bg-primary text-white'}
              type="button"
              disabled={
                update.isPending ||
                ((admin || requiresManualReason) && reason.trim().length < 3) ||
                !!(needsRefundChoice && !refundAction)
              }
              aria-busy={update.isPending}
              onClick={() => {
                if (inFlight.current) return;
                inFlight.current = true;
                update.mutate();
              }}
            >
              {update.isPending ? 'Đang ghi nhận…' : 'Xác nhận'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
