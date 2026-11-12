import { useAuth } from '../../hooks/useAuth';
import { queryKeys } from '../../lib/query-keys';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/ui/status-badge';
import {
  adminRecordsFetchers,
  type AdminRecordKind,
  type AdminRecord,
} from '../../services/adminRecordsService';
import { formatReviewDate } from '../../lib/studio-review';
import { formatPrice } from '../../lib/format';
const labels: Record<string, string> = {
  all: 'Tất cả',
  customer: 'Khách',
  admin: 'Quản trị',
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  refund_needed: 'Cần hoàn tiền',
  resolved: 'Đã xử lý',
  dismissed: 'Bỏ qua',
};
export function AdminRecordsPage({ kind }: { kind: AdminRecordKind }) {
  const userId = useAuth().user?.id;
  const title =
    kind === 'users'
      ? 'Người dùng'
      : kind === 'bookings'
        ? 'Đặt chỗ'
        : 'Báo cáo';
  const statuses =
    kind === 'users'
      ? ['all', 'customer', 'admin']
      : kind === 'bookings'
        ? ['all', 'pending', 'paid', 'expired', 'cancelled', 'refund_needed']
        : ['pending', 'resolved', 'dismissed', 'all'];
  const columns = useMemo<ColumnDef<AdminRecord>[]>(() => {
    const date: ColumnDef<AdminRecord> = {
      accessorKey: 'createdAt',
      header: kind === 'users' ? 'Ngày đăng ký' : 'Ngày tạo',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatReviewDate(row.original.createdAt)}
        </span>
      ),
    };
    const status: ColumnDef<AdminRecord> = {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status ?? ''}
          label={
            row.original.status === 'pending' && kind === 'reports'
              ? 'Chưa xử lý'
              : labels[row.original.status ?? '']
          }
        />
      ),
    };
    if (kind === 'users')
      return [
        { accessorKey: 'fullName', header: 'Họ tên' },
        { accessorKey: 'email', header: 'Email' },
        {
          accessorKey: 'role',
          header: 'Vai trò',
          cell: ({ row }) => (
            <StatusBadge
              status="draft"
              label={labels[row.original.role ?? '']}
            />
          ),
        },
        date,
      ];
    if (kind === 'bookings')
      return [
        {
          accessorKey: 'customerName',
          header: 'Khách hàng',
          enableSorting: false,
        },
        { accessorKey: 'workshopTitle', header: 'Workshop' },
        { accessorKey: 'studioName', header: 'Studio', enableSorting: false },
        { accessorKey: 'quantity', header: 'Số chỗ', enableSorting: false },
        {
          accessorKey: 'totalAmount',
          header: 'Tổng tiền',
          cell: ({ row }) => (
            <span className="whitespace-nowrap tabular-nums">
              {formatPrice(row.original.totalAmount ?? 0)}
            </span>
          ),
        },
        date,
        status,
      ];
    return [
      {
        accessorKey: 'targetName',
        header: 'Nội dung bị báo cáo',
        enableSorting: false,
      },
      {
        accessorKey: 'reporterName',
        header: 'Người gửi',
        enableSorting: false,
      },
      {
        accessorKey: 'reason',
        header: 'Lý do',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block min-w-48 max-w-80 whitespace-pre-wrap">
            {row.original.reason}
          </span>
        ),
      },
      date,
      status,
    ];
  }, [kind]);
  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-xs text-muted">
          Danh sách chỉ đọc · Giờ Việt Nam
        </p>
      </header>
      <DataTable
        key={kind}
        columns={columns}
        fetcher={adminRecordsFetchers[kind]}
        queryKey={queryKeys[kind].lists(userId)}
        tabs={statuses.map((value) => ({
          value,
          label:
            kind === 'reports' && value === 'pending'
              ? 'Chưa xử lý'
              : labels[value],
        }))}
        defaultTab={kind === 'reports' ? 'pending' : 'all'}
        defaultSort="createdAt:desc"
        filters={
          kind === 'reports'
            ? []
            : [
                {
                  id: 'period',
                  label: 'Thời gian',
                  options:
                    kind === 'users'
                      ? [{ value: '7d', label: '7 ngày qua' }]
                      : [
                          { value: 'today', label: 'Hôm nay' },
                          { value: '7d', label: '7 ngày qua' },
                        ],
                },
              ]
        }
        getRowId={(row) => row.id}
      />
    </div>
  );
}
