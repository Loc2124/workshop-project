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
          className="rounded-lg border border-line bg-paper p-3 text-sm"
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
