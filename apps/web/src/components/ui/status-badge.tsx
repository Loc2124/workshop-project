import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const tones = {
  gray: 'bg-neutral-100 text-neutral-700',
  yellow: 'bg-amber-50 text-amber-800',
  green: 'bg-emerald-50 text-emerald-800',
  red: 'bg-red-50 text-red-800',
  orange: 'bg-orange-50 text-orange-800',
} as const;
const statuses: Record<string, { label: string; tone: keyof typeof tones }> = {
  draft: { label: 'Nháp', tone: 'gray' },
  new: { label: 'Mới', tone: 'yellow' },
  in_progress: { label: 'Đang xử lý', tone: 'orange' },
  pending: { label: 'Chờ duyệt', tone: 'yellow' },
  approved: { label: 'Đã duyệt', tone: 'green' },
  rejected: { label: 'Từ chối', tone: 'red' },
  needs_changes: { label: 'Cần bổ sung', tone: 'orange' },
  suspended: { label: 'Tạm ngưng', tone: 'gray' },
  active: { label: 'Hoạt động', tone: 'green' },
  hidden: { label: 'Đã ẩn', tone: 'gray' },
  removed: { label: 'Bị gỡ', tone: 'red' },
  inactive: { label: 'Ngừng hoạt động', tone: 'gray' },
  blocked: { label: 'Đã khóa', tone: 'red' },
  scheduled: { label: 'Đã lên lịch', tone: 'green' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
  confirmed: { label: 'Đã xác nhận', tone: 'green' },
  completed: { label: 'Hoàn thành', tone: 'gray' },
  paid: { label: 'Đã thanh toán', tone: 'green' },
  expired: { label: 'Hết hạn', tone: 'gray' },
  refund_needed: { label: 'Cần hoàn tiền', tone: 'orange' },
  resolved: { label: 'Đã xử lý', tone: 'green' },
  dismissed: { label: 'Bỏ qua', tone: 'gray' },
};
export function StatusBadge({
  status,
  label,
  tone,
  className,
  ...props
}: ComponentProps<'span'> & {
  status: string;
  label?: string;
  tone?: keyof typeof tones;
}) {
  const mapped = statuses[status];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium',
        tones[tone ?? mapped?.tone ?? 'gray'],
        className,
      )}
      {...props}
    >
      {label ?? mapped?.label ?? status}
    </span>
  );
}
