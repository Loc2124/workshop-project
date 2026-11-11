import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, CameraOff, Search } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { useMyStudios } from '../hooks/useOwnedStudios';
import { apiFetch } from '../lib/api-client';
import { formatDate, formatPrice } from '../lib/format';
import { Button } from '../components/ui/button';

const ticketSchema = z.object({
  ticketId: z.uuid(),
  bookingId: z.uuid(),
  ticketNumber: z.number(),
  version: z.number(),
  ticketStatus: z.string(),
  attendanceStatus: z.string(),
  attendanceMethod: z.enum(['check_in', 'manual_confirmation']).nullable(),
  checkedInAt: z.string().nullable(),
  checkedInBy: z.string().nullable(),
  workshopTitle: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  customerName: z.string(),
  quantity: z.number(),
  checkedInCount: z.number(),
  remainingAmount: z.number(),
  paymentStatus: z.string(),
  reservationStatus: z.string(),
  sessionStatus: z.string(),
  reschedulePending: z.boolean(),
  serverNow: z.string(),
  canCheckIn: z.boolean(),
  canConfirmManually: z.boolean(),
});
type Ticket = z.infer<typeof ticketSchema>;

export function StudioCheckInPage() {
  const { user, isLoading } = useAuth();
  const studios = useMyStudios();
  const [search, setSearch] = useSearchParams();
  const available =
    studios.data?.filter(
      (studio) => studio.status === 'approved' && !studio.isDraft,
    ) ?? [];
  const requested = search.get('studioId');
  const studio =
    available.find((item) => item.id === requested) ?? available[0];
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'lookup' | 'payment' | 'check-in' | null>(
    null,
  );
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannedRef = useRef(false);

  const lookup = useCallback(
    async (value: string) => {
      if (!studio) return;
      setBusy('lookup');
      setTicket(null);
      setMessage('');
      try {
        const response = await apiFetch<unknown>(
          `/studios/${studio.id}/check-in/lookup`,
          { method: 'POST', body: JSON.stringify({ code: value.trim() }) },
        );
        setTicket(z.object({ ticket: ticketSchema }).parse(response).ticket);
        setManualReason('');
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'Không tra cứu được mã vé.',
        );
      } finally {
        setBusy(null);
      }
    },
    [studio],
  );

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let controls: IScannerControls | undefined;
    scannedRef.current = false;
    const start = async () => {
      const video = videoRef.current;
      if (!video || !navigator.mediaDevices?.getUserMedia) {
        setMessage(
          'Không truy cập được camera. Hãy mở trang bằng HTTPS, cấp quyền camera hoặc nhập mã vé.',
        );
        setScanning(false);
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            const value = result?.getText();
            if (!value || scannedRef.current || stopped) return;
            scannedRef.current = true;
            controls?.stop();
            setCode(value.replace(/^OS-TICKET:/i, ''));
            setScanning(false);
            void lookup(value);
          },
        );
        if (stopped) controls.stop();
      } catch (error) {
        if (stopped) return;
        setMessage(
          error instanceof Error && error.name === 'NotAllowedError'
            ? 'Bạn chưa cấp quyền camera cho trang này. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.'
            : 'Không mở được camera. Hãy dùng trang HTTPS, kiểm tra quyền camera hoặc nhập mã vé.',
        );
        setScanning(false);
      }
    };
    void start();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [lookup, scanning]);

  const confirm = async () => {
    if (!studio || !ticket || busy) return;
    setBusy('check-in');
    setMessage('');
    try {
      const response = await apiFetch<unknown>(
        `/studios/${studio.id}/check-in/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({
            code: code.trim(),
            expectedVersion: ticket.version,
            ...(ticket.canConfirmManually
              ? { reason: manualReason.trim() }
              : {}),
          }),
        },
      );
      setTicket(z.object({ ticket: ticketSchema }).parse(response).ticket);
      setMessage('Đã xác nhận check-in cho vé này.');
    } catch (error) {
      const explanation =
        error instanceof Error ? error.message : 'Không thể check-in.';
      await lookup(code);
      setMessage(explanation);
    } finally {
      setBusy(null);
    }
  };

  const recordPayment = async () => {
    if (!studio || !ticket || busy || ticket.remainingAmount <= 0) return;
    setBusy('payment');
    setMessage('');
    try {
      await apiFetch(
        `/studios/${studio.id}/bookings/${ticket.bookingId}/confirm-payment`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedAmount: ticket.remainingAmount }),
        },
      );
      const response = await apiFetch<unknown>(
        `/studios/${studio.id}/check-in/lookup`,
        { method: 'POST', body: JSON.stringify({ code: code.trim() }) },
      );
      setTicket(z.object({ ticket: ticketSchema }).parse(response).ticket);
      setMessage(
        'Đã ghi nhận khoản tiền thu tại studio. Trạng thái check-in không thay đổi.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Không ghi nhận được tiền.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || studios.isPending)
    return (
      <main className="mx-auto max-w-3xl p-6">Đang tải quyền studio…</main>
    );
  if (!user)
    return (
      <main className="mx-auto max-w-3xl p-6">Hãy đăng nhập để check-in.</main>
    );
  if (!studio)
    return (
      <main className="mx-auto max-w-3xl p-6" role="alert">
        {studios.isError
          ? 'Không tải được danh sách studio. Vui lòng thử lại.'
          : 'Tài khoản này chưa thuộc studio được duyệt.'}
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-5">
        <p className="text-sm text-muted">Open Slot · {studio.name}</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold">
          Check-in vé tham gia
        </h1>
        <p className="mt-2 text-sm text-muted">
          Quét mã để xem vé. Chỉ nút xác nhận mới ghi nhận khách đã đến.
        </p>
      </header>
      {available.length > 1 && (
        <label className="block text-sm font-medium">
          Studio
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-surface px-3"
            value={studio.id}
            onChange={(event) => {
              setSearch({ studioId: event.target.value });
              setTicket(null);
              setScanning(false);
            }}
          >
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <section
        className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
        aria-label="Tra cứu vé"
      >
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(code);
          }}
        >
          <label className="min-w-0 flex-1 text-sm font-medium">
            Mã vé tham gia
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setTicket(null);
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="Nhập mã 8 ký tự trên vé"
              className="mt-2 min-h-11 w-full rounded-lg border border-line bg-paper px-3 font-mono text-sm"
            />
          </label>
          <Button type="submit" disabled={!code.trim() || busy !== null}>
            <Search className="size-4" aria-hidden="true" /> Tra cứu
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setScanning((value) => !value)}
          >
            {scanning ? (
              <CameraOff className="size-4" aria-hidden="true" />
            ) : (
              <Camera className="size-4" aria-hidden="true" />
            )}
            {scanning ? 'Dừng camera' : 'Quét QR'}
          </Button>
        </form>
        {scanning && (
          <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 size-full object-cover"
              aria-label="Camera quét mã QR"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[12%] z-10"
            >
              <span className="absolute left-0 top-0 size-8 rounded-tl-lg border-l-[3px] border-t-[3px] border-white" />
              <span className="absolute right-0 top-0 size-8 rounded-tr-lg border-r-[3px] border-t-[3px] border-white" />
              <span className="absolute bottom-0 left-0 size-8 rounded-bl-lg border-b-[3px] border-l-[3px] border-white" />
              <span className="absolute bottom-0 right-0 size-8 rounded-br-lg border-b-[3px] border-r-[3px] border-white" />
            </div>
          </div>
        )}
      </section>
      {message && (
        <p
          role="status"
          className="rounded-lg border border-line bg-paper p-3 text-sm"
        >
          {message}
        </p>
      )}
      {ticket && (
        <section
          className="rounded-2xl border border-line bg-surface p-4 sm:p-6"
          aria-label="Thông tin vé"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-sm text-muted">
                Vé số {ticket.ticketNumber} · {ticket.checkedInCount}/
                {ticket.quantity} người đã check-in
              </p>
              <h2 className="mt-1 font-heading text-xl font-semibold">
                {ticket.workshopTitle}
              </h2>
              <p className="mt-1 text-sm">{formatDate(ticket.startsAt)}</p>
            </div>
            <span className="rounded-full border border-line px-3 py-1 text-sm font-medium">
              {ticket.attendanceStatus === 'attended'
                ? ticket.attendanceMethod === 'manual_confirmation'
                  ? 'Đã tham dự · Xác nhận thủ công'
                  : 'Đã tham dự'
                : ticket.ticketStatus === 'void' ||
                    ticket.reservationStatus === 'cancelled'
                  ? 'Vé đã hủy'
                  : ticket.attendanceStatus === 'absent'
                    ? 'Đã ghi vắng'
                    : Date.parse(ticket.serverNow) >=
                          Date.parse(ticket.endsAt) &&
                        ticket.attendanceStatus === 'unmarked'
                      ? 'Đã qua buổi · Chưa check-in'
                      : ticket.ticketStatus === 'used'
                        ? 'Vé đã sử dụng'
                        : 'Chưa check-in'}
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Khách đặt</dt>
              <dd className="font-medium">{ticket.customerName}</dd>
            </div>
            <div>
              <dt className="text-muted">Số người trong đặt chỗ</dt>
              <dd className="font-medium">{ticket.quantity}</dd>
            </div>
            <div>
              <dt className="text-muted">Còn phải trả tại studio</dt>
              <dd className="font-semibold tabular-nums">
                {formatPrice(ticket.remainingAmount)} đ
              </dd>
            </div>
            <div>
              <dt className="text-muted">Thanh toán</dt>
              <dd className="font-medium">
                {ticket.remainingAmount > 0 ? 'Chưa thu đủ' : 'Đã ghi nhận đủ'}
              </dd>
            </div>
          </dl>
          {ticket.attendanceStatus === 'attended' && ticket.checkedInAt && (
            <p className="mt-4 border-t border-line pt-4 text-sm">
              {ticket.attendanceMethod === 'manual_confirmation'
                ? 'Đã tham dự, xác nhận thủ công lúc '
                : 'Đã check-in lúc '}
              {formatDate(ticket.checkedInAt)}
              {ticket.checkedInBy ? ` bởi ${ticket.checkedInBy}` : ''}.
            </p>
          )}
          {ticket.remainingAmount > 0 &&
            ticket.ticketStatus !== 'void' &&
            !ticket.reschedulePending &&
            ticket.sessionStatus === 'scheduled' &&
            ['confirmed', 'completed'].includes(ticket.reservationStatus) && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-3 text-sm text-muted">
                  Chỉ ghi nhận thanh toán sau khi thực sự nhận đủ tiền. Thao tác
                  này không check-in vé.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void recordPayment()}
                >
                  {busy === 'payment'
                    ? 'Đang ghi nhận…'
                    : `Đã thu ${formatPrice(ticket.remainingAmount)} đ — ghi nhận thanh toán`}
                </Button>
              </div>
            )}
          {ticket.canCheckIn ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-3 text-sm text-muted">
                Đối chiếu khách và giờ học trước khi xác nhận. Check-in không
                thay đổi thanh toán.
              </p>
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => void confirm()}
              >
                {busy === 'check-in' ? 'Đang xác nhận…' : 'Xác nhận check-in'}
              </Button>
            </div>
          ) : ticket.canConfirmManually ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-3 text-sm text-muted">
                Buổi học đã kết thúc. Chỉ xác nhận nếu đã đối chiếu được rằng
                khách thực sự tham dự; thao tác sẽ lưu người xác nhận và lý do.
              </p>
              <label className="block text-sm font-medium">
                Lý do xác nhận đã tham dự
                <textarea
                  className="mt-2 min-h-24 w-full rounded-lg border border-line bg-paper p-3"
                  value={manualReason}
                  onChange={(event) => setManualReason(event.target.value)}
                  maxLength={1000}
                  required
                />
              </label>
              <Button
                type="button"
                className="mt-3"
                disabled={busy !== null || manualReason.trim().length < 3}
                onClick={() => void confirm()}
              >
                {busy === 'check-in' ? 'Đang xác nhận…' : 'Xác nhận đã tham dự'}
              </Button>
            </div>
          ) : (
            ticket.attendanceStatus === 'unmarked' && (
              <p className="mt-5 border-t border-line pt-4 text-sm text-brick">
                {Date.parse(ticket.serverNow) < Date.parse(ticket.startsAt)
                  ? 'Chỉ check-in từ giờ bắt đầu buổi học.'
                  : Date.parse(ticket.serverNow) >= Date.parse(ticket.endsAt)
                    ? 'Buổi đã qua. QR hết hiệu lực; dùng mã 8 ký tự và xác nhận thủ công nếu đã đối chiếu khách thực sự tham dự.'
                    : 'Vé chưa đủ điều kiện check-in. Kiểm tra trạng thái đặt chỗ và lịch học.'}
              </p>
            )
          )}
        </section>
      )}
    </main>
  );
}
