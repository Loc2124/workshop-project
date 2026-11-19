import { useCallback, useEffect, useState } from 'react';
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useMyStudios } from '@/hooks/useOwnedStudios';
import {
  readActiveStudioId,
  writeActiveStudioId,
} from '@/lib/studio-dashboard';
import { apiFetch } from '@/lib/api-client';
import { formatPrice } from '@/lib/format';
import {
  ticketSchema,
  type CheckInTicket,
  type CheckInBusyState,
  CheckInLookupForm,
  TicketCheckInCard,
  useOfflineCheckInStore,
} from '@/features/check-in';

export function StudioCheckInPage() {
  const { user, isLoading } = useAuth();
  const studios = useMyStudios();
  const [search, setSearch] = useSearchParams();
  const { studioId } = useParams();
  const navigate = useNavigate();

  const available =
    studios.data?.filter(
      (studio) => studio.status === 'approved' && !studio.isDraft,
    ) ?? [];
  const requested =
    studioId ?? search.get('studioId') ?? readActiveStudioId(user?.id);
  const studio =
    available.find((item) => item.id === requested) ?? available[0];

  useEffect(() => {
    if (user && studio) {
      writeActiveStudioId(user.id, studio.id);
    }
  }, [user, studio]);

  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState<CheckInTicket | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<CheckInBusyState>(null);
  const [scanning, setScanning] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const { pendingQueue, enqueueTicket, dequeueTicket } =
    useOfflineCheckInStore();
  const studioPendingQueue = pendingQueue.filter(
    (item) => item.studioId === studio?.id,
  );

  const syncPendingQueue = useCallback(async () => {
    if (!studio || studioPendingQueue.length === 0 || syncingOffline) return;
    setSyncingOffline(true);
    let synced = 0;
    for (const item of [...studioPendingQueue]) {
      try {
        await apiFetch(`/studios/${studio.id}/check-in/confirm`, {
          method: 'POST',
          body: JSON.stringify({ code: item.ticketCode }),
        });
        dequeueTicket(item.ticketCode);
        synced++;
      } catch {
        // Keep in offline queue if it still fails
      }
    }
    setSyncingOffline(false);
    if (synced > 0) {
      setMessage(
        `Đã đồng bộ thành công ${synced} vé từ hàng đợi ngoại tuyến.`,
      );
    }
  }, [studio, studioPendingQueue, syncingOffline, dequeueTicket]);

  useEffect(() => {
    const handleOnline = () => {
      void syncPendingQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncPendingQueue]);

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

  const handleScanSuccess = useCallback(
    (value: string) => {
      const cleanCode = value.replace(/^OS-TICKET:/i, '');
      setCode(cleanCode);
      setScanning(false);
      void lookup(value);
    },
    [lookup],
  );

  const handleScanError = useCallback((errorMessage: string) => {
    setMessage(errorMessage);
    setScanning(false);
  }, []);

  const confirm = async () => {
    if (!studio || !ticket || busy) return;
    setBusy('check-in');
    setMessage('');

    // If device is offline, store in offline queue directly
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueTicket({
        ticketCode: code.trim(),
        studioId: studio.id,
        scannedAt: new Date().toISOString(),
      });
      setBusy(null);
      setMessage(
        'Thiết bị đang ngoại tuyến. Vé đã được lưu vào hàng đợi và sẽ tự động đồng bộ khi có kết nối mạng.',
      );
      return;
    }

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
      dequeueTicket(code.trim());
      setMessage('Đã xác nhận check-in cho vé này.');
    } catch (error) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueTicket({
          ticketCode: code.trim(),
          studioId: studio.id,
          scannedAt: new Date().toISOString(),
        });
        setMessage(
          'Mất kết nối mạng trong lúc check-in. Vé đã được lưu an toàn vào hàng đợi ngoại tuyến.',
        );
      } else {
        const explanation =
          error instanceof Error ? error.message : 'Không thể check-in.';
        await lookup(code);
        setMessage(explanation);
      }
    } finally {
      setBusy(null);
    }
  };

  const recordPayment = async () => {
    if (!studio || !ticket || busy || ticket.remainingAmount <= 0) return;
    const collectedAmount = ticket.remainingAmount;
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
        `Đã ghi nhận số tiền ${formatPrice(collectedAmount)} đ thu tại studio thành công. Trạng thái check-in không thay đổi.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Không ghi nhận được tiền.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || studios.isPending) {
    return (
      <main className="mx-auto max-w-3xl p-6">Đang tải quyền studio…</main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6">Hãy đăng nhập để check-in.</main>
    );
  }

  const requestedStudio = studioId
    ? studios.data?.find((item) => item.id === studioId)
    : undefined;

  if (
    requestedStudio &&
    (requestedStudio.isDraft || requestedStudio.status !== 'approved')
  ) {
    return (
      <Navigate
        to={`/studio/${encodeURIComponent(requestedStudio.id)}`}
        replace
      />
    );
  }

  if (!studio) {
    return (
      <main className="mx-auto max-w-3xl p-6" role="alert">
        {studios.isError
          ? 'Không tải được danh sách studio. Vui lòng thử lại.'
          : 'Tài khoản này chưa thuộc studio được duyệt.'}
      </main>
    );
  }

  if (studioId && studioId !== studio.id) {
    return (
      <Navigate
        to={`/studio/${encodeURIComponent(studio.id)}/check-in`}
        replace
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-studio-card px-4 py-8 sm:px-6">
      <header className="border-b border-studio-border pb-5">
        <p className="text-sm text-studio-muted">Open Slot · {studio.name}</p>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-studio-ink sm:text-3xl">
          Check-in vé tham gia
        </h1>
        <p className="mt-2 text-sm text-studio-muted">
          Quét mã để xem vé. Chỉ nút xác nhận mới ghi nhận khách đã đến.
        </p>
      </header>

      {studioPendingQueue.length > 0 && (
        <section
          aria-label="Hàng đợi ngoại tuyến"
          className="flex flex-wrap items-center justify-between gap-3 rounded-studio-card border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-amber-600 motion-safe:animate-pulse"
            />
            <span>
              <strong>{studioPendingQueue.length} vé</strong> đang lưu ngoại
              tuyến chờ đồng bộ.
            </span>
          </div>
          <button
            type="button"
            disabled={syncingOffline}
            onClick={() => void syncPendingQueue()}
            className="rounded-studio-control bg-amber-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncingOffline ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
          </button>
        </section>
      )}

      {available.length > 1 && (
        <label className="block text-sm font-medium text-studio-ink">
          Studio
          <select
            className="mt-2 min-h-11 w-full rounded-studio-control border border-studio-border bg-studio-surface px-3 text-studio-ink"
            value={studio.id}
            onChange={(event) => {
              const nextId = event.target.value;
              if (studioId) {
                navigate(`/studio/${encodeURIComponent(nextId)}/check-in`);
              } else {
                setSearch({ studioId: nextId });
              }
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

      <CheckInLookupForm
        code={code}
        onCodeChange={(nextCode) => {
          setCode(nextCode);
          setTicket(null);
        }}
        onSubmit={lookup}
        scanning={scanning}
        onToggleScanning={() => setScanning((prev) => !prev)}
        onScanSuccess={handleScanSuccess}
        onScanError={handleScanError}
        busy={busy}
      />

      {message && (
        <p
          role="status"
          className="rounded-studio-card border border-studio-border bg-studio-surface p-4 text-sm text-studio-ink shadow-sm"
        >
          {message}
        </p>
      )}

      {ticket && (
        <TicketCheckInCard
          ticket={ticket}
          manualReason={manualReason}
          onManualReasonChange={setManualReason}
          busy={busy}
          onConfirm={() => void confirm()}
          onRecordPayment={() => void recordPayment()}
        />
      )}
    </main>
  );
}
