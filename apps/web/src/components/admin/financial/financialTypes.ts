import { formatPrice } from '../../../lib/format';

export type Obligation = {
  id: string;
  bookingId: string;
  orderCode: string;
  studioId: string;
  studioName: string;
  ticketId: string | null;
  kind: 'customer_refund' | 'studio_payout' | 'studio_recovery';
  sourceKey: string;
  amount: number | string;
  settledAmount: number | string;
  reservedAmount: number | string;
  dueAt: string | null;
  status: string;
  reason: string;
  createdAt: string;
  dueState: 'overdue' | 'due_soon' | null;
  destinationBankBin?: string | null;
  destinationBankName?: string | null;
  destinationHolder?: string | null;
  destinationLast4?: string | null;
  destinationStatus?: 'pending' | 'verified' | null;
};

export type VietqrPreview = {
  obligationId: string;
  kind: 'customer_refund' | 'studio_payout';
  bookingId: string;
  orderCode: string;
  studioName: string;
  amount: number;
  accountId: string;
  accountStatus: string;
  bankBin: string | null;
  bankName: string | null;
  bankDisplay: string;
  accountHolder: string;
  accountNumber: string;
  last4: string;
  transferContent: string;
  vietqrUrl: string | null;
};

export type Transfer = {
  id: string;
  obligationId: string;
  kind: string;
  bookingId: string;
  orderCode: string;
  direction: 'inbound' | 'outbound';
  purpose: string;
  amount: number | string;
  providerFee: number | string | null;
  provider: string | null;
  reference: string | null;
  status: string;
  approvedAt: string | null;
  destinationBank: string | null;
  destinationName: string | null;
  destinationLast4: string | null;
  destinationValid: boolean | null;
  settledAt: string | null;
  failureReason: string | null;
  createdAt: string;
  dueAt: string | null;
  dueState: 'overdue' | 'due_soon' | null;
};

export type TransferEvent = {
  id: number;
  event: string;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
};

export type CalendarDay = {
  date: string;
  type: 'working' | 'non_working';
  label: string;
  officialReference: string;
  active: boolean;
  updatedAt: string;
};

export type PaymentFee = {
  paymentId: string;
  bookingId: string;
  orderCode: string;
  studioId: string;
  studioName: string;
  workshopTitle: string;
  amount: number | string;
  provider: string;
  providerReference: string | null;
  paidAt: string | null;
};

export const money = (value: number | string) =>
  `${formatPrice(Number(value) || 0)} đ`;

export const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Chưa đặt hạn';

export const obligationName = (kind: string) =>
  kind === 'customer_refund'
    ? 'Hoàn cho khách'
    : kind === 'studio_recovery'
      ? 'Studio hoàn về Open Slot'
      : 'Chi studio';

export const statusName = (value: string) =>
  ({
    awaiting_funds: 'Chờ tiền về',
    awaiting_approval: 'Chờ duyệt',
    approved: 'Đã duyệt',
    processing: 'Đang xử lý',
    partially_paid: 'Đã xử lý một phần',
    paid: 'Đã xử lý',
    failed: 'Thất bại',
    manual_review: 'Cần đối soát',
    cancelled: 'Đã dừng',
    pending_approval: 'Chờ duyệt',
    created: 'Đã lập giao dịch',
    submitted: 'Đã gửi giao dịch',
    recorded: 'Đã ghi nhận',
    succeeded: 'Thành công',
  })[value] ?? value;

export const stateColor = (value: string) =>
  value === 'paid' || value === 'succeeded' || value === 'approved'
    ? 'bg-[#DCEFC8] text-[#2A4710]'
    : value === 'manual_review' || value === 'failed'
      ? 'bg-[#FCE0DB] text-[#9B2C1A]'
      : value === 'cancelled'
        ? 'bg-[#E8E4D8] text-[#4A453C]'
        : 'bg-[#FBE8B5] text-[#7A4B00]';

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Có lỗi xảy ra. Vui lòng thử lại.';
}
