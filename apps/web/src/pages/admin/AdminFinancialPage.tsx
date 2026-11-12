import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/api-client';
import { AdminSettlementPanel } from '../../components/management/AdminSettlementPanel';
import { AdminAccountVerificationPanel } from '../../components/management/AdminAccountVerificationPanel';
import {
  type CalendarDay,
  errorMessage,
  type Obligation,
  type PaymentFee,
  type Transfer,
  type VietqrPreview,
} from '../../components/admin/financial/financialTypes';
import { FinancialObligationsTab } from '../../components/admin/financial/FinancialObligationsTab';
import {
  FinancialTransfersTab,
  type QueueFilter,
} from '../../components/admin/financial/FinancialTransfersTab';
import { FinancialFeesTab } from '../../components/admin/financial/FinancialFeesTab';
import { FinancialCalendarTab } from '../../components/admin/financial/FinancialCalendarTab';
import { VietqrTransferModal } from '../../components/admin/financial/VietqrTransferModal';

export function AdminFinancialPage() {
  const userId = useAuth().user?.id;
  const client = useQueryClient();
  const [tab, setTab] = useState<
    | 'queue'
    | 'obligations'
    | 'transfers'
    | 'settlements'
    | 'accounts'
    | 'fees'
    | 'calendar'
  >('queue');

  const [selectedPurpose, setSelectedPurpose] = useState<
    Record<string, 'customer_refund' | 'platform_advance'>
  >({});
  const [transferAmounts, setTransferAmounts] = useState<
    Record<string, string>
  >({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [transferReason, setTransferReason] = useState<Record<string, string>>(
    {},
  );
  const [calendar, setCalendar] = useState({
    date: '',
    type: 'non_working' as CalendarDay['type'],
    label: '',
    officialReference: '',
  });
  const [transferDetails, setTransferDetails] = useState<
    Record<string, { provider: string; reference: string; fee: string }>
  >({});
  const [collectionFees, setCollectionFees] = useState<
    Record<string, { provider: string; reference: string; fee: string }>
  >({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [vietqrModal, setVietqrModal] = useState<VietqrPreview | null>(null);
  const [vietqrReference, setVietqrReference] = useState('');
  const [vietqrFee, setVietqrFee] = useState('0');

  const obligations = useQuery({
    queryKey: ['private', userId, 'financial-obligations'],
    queryFn: () =>
      apiFetch<Obligation[]>('/admin/tai-chinh/nghia-vu').then((items) =>
        items.sort(
          (a, b) =>
            new Date(a.dueAt ?? a.createdAt).getTime() -
            new Date(b.dueAt ?? b.createdAt).getTime(),
        ),
      ),
  });

  const transfers = useQuery({
    queryKey: ['private', userId, 'financial-transfers'],
    queryFn: () =>
      apiFetch<Transfer[]>('/admin/tai-chinh/chuyen-tien').then((items) =>
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      ),
  });

  const queue = useQuery({
    queryKey: ['private', userId, 'financial-queue'],
    queryFn: () =>
      apiFetch<Transfer[]>('/admin/tai-chinh/hang-cho-doi-soat').then((items) =>
        items.sort(
          (a, b) =>
            new Date(a.dueAt ?? a.createdAt).getTime() -
            new Date(b.dueAt ?? b.createdAt).getTime(),
        ),
      ),
  });

  const days = useQuery({
    queryKey: ['private', userId, 'financial-calendar'],
    queryFn: () => apiFetch<CalendarDay[]>('/admin/tai-chinh/lich-nghi'),
  });

  const fees = useQuery({
    queryKey: ['private', userId, 'financial-payment-fees'],
    queryFn: () =>
      apiFetch<PaymentFee[]>('/admin/tai-chinh/phi-thu-can-ghi-nhan'),
  });

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-obligations'],
      }),
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-transfers'],
      }),
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-queue'],
      }),
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-calendar'],
      }),
      client.invalidateQueries({
        queryKey: ['private', userId, 'financial-payment-fees'],
      }),
    ]);
  };

  const openVietqr = useMutation({
    mutationFn: (obligationId: string) =>
      apiFetch<VietqrPreview>(
        `/admin/tai-chinh/nghia-vu/${obligationId}/vietqr`,
      ),
    onSuccess: (data) => {
      setVietqrModal(data);
      setVietqrReference(data.transferContent);
      setVietqrFee('0');
      setFeedback(null);
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const confirmVietqr = useMutation({
    mutationFn: () => {
      if (!vietqrModal) {
        throw new Error('Chưa chọn lệnh chuyển VietQR');
      }
      return apiFetch(
        `/admin/tai-chinh/nghia-vu/${vietqrModal.obligationId}/vietqr-xac-nhan`,
        {
          method: 'POST',
          body: JSON.stringify({
            reference: vietqrReference.trim(),
            providerFee: Math.max(0, Number(vietqrFee) || 0),
          }),
        },
      );
    },
    onSuccess: async () => {
      setFeedback(
        'Đã ghi nhận lệnh chuyển VietQR 247 và tự động đối chiếu thành công.',
      );
      setVietqrModal(null);
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const createTransfer = useMutation({
    mutationFn: ({
      o,
      purpose,
    }: {
      o: Obligation;
      purpose: 'customer_refund' | 'platform_advance' | 'studio_payout' | 'studio_repayment';
    }) => {
      const remaining = Math.max(
        0,
        Number(o.amount) - Number(o.settledAmount) - Number(o.reservedAmount),
      );
      const parsedAmount = Number(transferAmounts[o.id] ?? remaining);
      const trimmedReason = reason[o.id]?.trim();
      return apiFetch(`/admin/tai-chinh/nghia-vu/${o.id}/chuyen-tien`, {
        method: 'POST',
        body: JSON.stringify({
          purpose,
          amount: Number.isFinite(parsedAmount) ? parsedAmount : remaining,
          ...(trimmedReason ? { reason: trimmedReason } : {}),
        }),
      });
    },
    onSuccess: async () => {
      setFeedback('Đã lập giao dịch chuyển tiền ở trạng thái chờ duyệt.');
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const approve = useMutation({
    mutationFn: (t: Transfer) =>
      apiFetch(`/admin/tai-chinh/chuyen-tien/${t.id}/duyet`, {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Đã đối chiếu nghĩa vụ và phê duyệt giao dịch.',
        }),
      }),
    onSuccess: async () => {
      setFeedback('Đã duyệt. Giao dịch chưa được xem là đã chuyển.');
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const result = useMutation({
    mutationFn: ({
      t,
      outcome,
    }: {
      t: Transfer;
      outcome: 'succeeded' | 'failed' | 'manual_review';
    }) => {
      const d = transferDetails[t.id] ?? {
        provider: t.provider ?? '',
        reference: t.reference ?? '',
        fee: '',
      };
      return apiFetch(`/admin/tai-chinh/chuyen-tien/${t.id}/ghi-nhan-ket-qua`, {
        method: 'POST',
        body: JSON.stringify({
          result: outcome,
          reason:
            outcome === 'succeeded'
              ? 'Đã đối chiếu kết quả và phí thực tế với chứng từ.'
              : transferReason[t.id]?.trim() || '',
          ...(outcome === 'succeeded'
            ? {
                provider: d.provider,
                reference: d.reference,
                providerFee: Number(d.fee),
              }
            : {}),
        }),
      });
    },
    onSuccess: async (_r, v) => {
      setFeedback(
        v.outcome === 'succeeded'
          ? 'Đã ghi nhận giao dịch thành công.'
          : 'Đã cập nhật kết quả giao dịch.',
      );
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const saveDay = useMutation({
    mutationFn: () =>
      apiFetch('/admin/tai-chinh/lich-nghi', {
        method: 'POST',
        body: JSON.stringify(calendar),
      }),
    onSuccess: async () => {
      setFeedback('Đã lưu ngoại lệ lịch nhà nước.');
      setCalendar({
        date: '',
        type: 'non_working',
        label: '',
        officialReference: '',
      });
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const disableDay = useMutation({
    mutationFn: (date: string) =>
      apiFetch(`/admin/tai-chinh/lich-nghi/${date}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setFeedback('Đã ngừng áp dụng ngày này.');
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  const recordCollectionFee = useMutation({
    mutationFn: ({ fee }: { fee: PaymentFee }) => {
      const draft = collectionFees[fee.paymentId] ?? {
        provider: fee.provider,
        reference: fee.providerReference ?? '',
        fee: '',
      };
      return apiFetch(`/admin/tai-chinh/phi-thu/${fee.paymentId}`, {
        method: 'POST',
        body: JSON.stringify({
          provider: draft.provider,
          reference: draft.reference,
          fee: Number(draft.fee),
        }),
      });
    },
    onSuccess: async () => {
      setFeedback('Đã ghi nhận phí thu thực tế cho khoản thanh toán.');
      await refresh();
    },
    onError: (e) => setFeedback(errorMessage(e)),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
            Vận hành
          </span>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Tài chính &amp; quyết toán
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-muted sm:text-sm">
            Theo dõi hạn hoàn, khoản studio cần chuyển về Open Slot và từng lần
            chuyển. Mọi khoản chuyển cần duyệt; ghi nhận thành công phải có mã
            đối chiếu, nhà cung cấp và phí thực tế.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refresh()}
          className="gap-2 text-xs"
        >
          <RefreshCw
            size={14}
            className={
              obligations.isFetching || transfers.isFetching || queue.isFetching
                ? 'animate-spin'
                : ''
            }
          />
          Làm mới số liệu
        </Button>
      </header>

      <nav
        aria-label="Các mục tài chính"
        className="flex gap-1 overflow-x-auto border-b border-line pb-px"
      >
        {(
          [
            ['queue', 'Cần đối soát', queue.data?.length ?? 0],
            ['obligations', 'Nghĩa vụ', obligations.data?.length ?? 0],
            ['transfers', 'Giao dịch', 0],
            ['settlements', 'Đối soát chi', 0],
            ['accounts', 'Tài khoản nhận', 0],
            ['fees', 'Phí thu', 0],
            ['calendar', 'Lịch nhà nước', 0],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-sm font-semibold transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  tab === key ? 'bg-primary text-white' : 'bg-soft text-muted'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {feedback && (
        <p
          role="status"
          className="rounded-lg bg-soft px-4 py-3 text-sm text-ink"
        >
          {feedback}
        </p>
      )}

      {tab === 'settlements' && <AdminSettlementPanel userId={userId} />}
      {tab === 'accounts' && <AdminAccountVerificationPanel userId={userId} />}

      {tab === 'obligations' && (
        <FinancialObligationsTab
          obligations={obligations.data}
          isLoading={obligations.isLoading}
          isError={obligations.isError}
          error={obligations.error}
          selectedPurpose={selectedPurpose}
          onPurposeChange={(id, val) =>
            setSelectedPurpose((x) => ({ ...x, [id]: val }))
          }
          transferAmounts={transferAmounts}
          onAmountChange={(id, val) =>
            setTransferAmounts((x) => ({ ...x, [id]: val }))
          }
          reason={reason}
          onReasonChange={(id, val) => setReason((x) => ({ ...x, [id]: val }))}
          onOpenVietqr={(id) => openVietqr.mutate(id)}
          isOpenVietqrPending={openVietqr.isPending}
          onCreateTransfer={(o, purpose) =>
            createTransfer.mutate({ o, purpose })
          }
          isCreateTransferPending={createTransfer.isPending}
        />
      )}

      {tab === 'queue' && (
        <FinancialTransfersTab
          isQueue={true}
          transfers={queue.data}
          obligations={obligations.data}
          isLoading={queue.isLoading}
          isError={queue.isError}
          error={queue.error}
          queueFilter={queueFilter}
          onQueueFilterChange={setQueueFilter}
          onNavigateToObligations={() => setTab('obligations')}
          userId={userId}
          transferDetails={transferDetails}
          onTransferDetailsChange={(id, details) =>
            setTransferDetails((x) => ({ ...x, [id]: details }))
          }
          transferReason={transferReason}
          onTransferReasonChange={(id, r) =>
            setTransferReason((x) => ({ ...x, [id]: r }))
          }
          onApprove={(t) => approve.mutate(t)}
          isApprovePending={approve.isPending}
          onOpenVietqr={(id) => openVietqr.mutate(id)}
          isOpenVietqrPending={openVietqr.isPending}
          onRecordResult={(t, outcome) => result.mutate({ t, outcome })}
          isRecordResultPending={result.isPending}
        />
      )}

      {tab === 'transfers' && (
        <FinancialTransfersTab
          isQueue={false}
          transfers={transfers.data}
          obligations={obligations.data}
          isLoading={transfers.isLoading}
          isError={transfers.isError}
          error={transfers.error}
          queueFilter={queueFilter}
          onQueueFilterChange={setQueueFilter}
          onNavigateToObligations={() => setTab('obligations')}
          userId={userId}
          transferDetails={transferDetails}
          onTransferDetailsChange={(id, details) =>
            setTransferDetails((x) => ({ ...x, [id]: details }))
          }
          transferReason={transferReason}
          onTransferReasonChange={(id, r) =>
            setTransferReason((x) => ({ ...x, [id]: r }))
          }
          onApprove={(t) => approve.mutate(t)}
          isApprovePending={approve.isPending}
          onOpenVietqr={(id) => openVietqr.mutate(id)}
          isOpenVietqrPending={openVietqr.isPending}
          onRecordResult={(t, outcome) => result.mutate({ t, outcome })}
          isRecordResultPending={result.isPending}
        />
      )}

      {tab === 'fees' && (
        <FinancialFeesTab
          fees={fees.data}
          isLoading={fees.isLoading}
          isError={fees.isError}
          error={fees.error}
          collectionFees={collectionFees}
          onCollectionFeeChange={(id: string, val: { provider: string; reference: string; fee: string }) =>
            setCollectionFees((x) => ({ ...x, [id]: val }))
          }
          onRecordFee={(fee) => recordCollectionFee.mutate({ fee })}
          isRecordFeePending={recordCollectionFee.isPending}
        />
      )}

      {tab === 'calendar' && (
        <FinancialCalendarTab
          calendar={calendar}
          setCalendar={setCalendar}
          days={days}
          onSaveDay={() => saveDay.mutate()}
          isSaving={saveDay.isPending}
          onDisableDay={(date) => disableDay.mutate(date)}
          isDisabling={disableDay.isPending}
        />
      )}

      {vietqrModal && (
        <VietqrTransferModal
          modal={vietqrModal}
          reference={vietqrReference}
          onReferenceChange={setVietqrReference}
          fee={vietqrFee}
          onFeeChange={setVietqrFee}
          onConfirm={() => confirmVietqr.mutate()}
          isConfirming={confirmVietqr.isPending}
          onClose={() => setVietqrModal(null)}
        />
      )}
    </div>
  );
}
export default AdminFinancialPage;
