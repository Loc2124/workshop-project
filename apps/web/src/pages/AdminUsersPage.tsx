import type { QueryClient } from '@tanstack/react-query';
import { prefetchDefaultTable } from '../lib/prefetch-table';
import { queryKeys } from '../lib/query-keys';
import { invalidateResources } from '../lib/query-invalidation';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  DataTable,
  type DataTableFetcher,
} from '../components/admin/DataTable';
import { ConfirmReasonDialog } from '../components/admin/ConfirmReasonDialog';
import { StatusBadge } from '../components/ui/status-badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api-client';
import { createAdminTableFetcher } from '../services/adminTableService';
import { formatReviewDate } from '../lib/studio-review';
const roleSchema = z.enum(['customer', 'studio_owner', 'admin']);
type Role = z.infer<typeof roleSchema>;
const userSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: roleSchema,
  studioCount: z.number(),
  staffStudioCount: z.number(),
  status: z.enum(['active', 'blocked']),
  blockedReason: z.string().nullable(),
  createdAt: z.string(),
});
type User = z.infer<typeof userSchema>;
const roleTones: Record<Role, 'gray' | 'yellow' | 'green'> = {
  customer: 'gray',
  studio_owner: 'yellow',
  admin: 'green',
};
const labels: Record<Role, string> = {
  customer: 'Khách',
  studio_owner: 'Chủ studio',
  admin: 'Admin',
};
const fetcher: DataTableFetcher<User> = createAdminTableFetcher(
  '/admin/nguoi-dung',
  userSchema,
);
const tabs = [
  { value: 'all', label: 'Tất cả' },
  { value: 'customer', label: 'Khách' },
  { value: 'studio_owner', label: 'Chủ studio' },
  { value: 'admin', label: 'Admin' },
  { value: 'blocked', label: 'Bị khóa' },
];
export function AdminUsersPage() {
  const userId = useAuth().user?.id;
  const { user: current } = useAuth();
  const client = useQueryClient();
  const [selected, setSelected] = useState<User | null>(null);
  const [action, setAction] = useState<
    'block' | 'unblock' | 'change_role' | null
  >(null);
  const [role, setRole] = useState<Role>('customer');
  const mutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!selected || !action) throw new Error('Chưa chọn người dùng.');
      return apiFetch(`/admin/nguoi-dung/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          expectedRole: selected.role,
          expectedBlocked: selected.status === 'blocked',
          ...(action === 'change_role' ? { role } : {}),
          ...(action === 'unblock' ? {} : { reason }),
        }),
      });
    },
    onSuccess: async () => {
      await invalidateResources(client, userId, ['users']);
      toast.success('Đã cập nhật tài khoản và ghi nhật ký.');
      setSelected(null);
      setAction(null);
    },
    onError: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.users.lists(userId),
      });
    },
  });
  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: 'avatar',
        header: 'Avatar',
        enableSorting: false,
        cell: ({ row }) => (
          <Avatar className="size-9">
            <AvatarImage src={row.original.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>
              {row.original.fullName
                .trim()
                .split(/\s+/)
                .slice(-2)
                .map((n) => n[0])
                .join('')
                .toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        ),
      },
      {
        accessorKey: 'fullName',
        header: 'Tên',
        cell: ({ row }) => (
          <span className="block min-w-36 font-medium">
            {row.original.fullName}
            {row.original.id === current?.id && (
              <span className="ml-2 text-xs font-normal text-muted">Bạn</span>
            )}
          </span>
        ),
      },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'role',
        header: 'Vai trò',
        cell: ({ row }) => (
          <div className="space-y-1">
            <StatusBadge
              status={row.original.role}
              label={labels[row.original.role]}
              tone={roleTones[row.original.role]}
            />
            {row.original.staffStudioCount > 0 && (
              <p className="whitespace-nowrap text-xs text-muted">
                Nhân viên tại {row.original.staffStudioCount} studio
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'studioCount',
        header: 'Studio sở hữu',
        cell: ({ getValue }) => (
          <span className="block text-right tabular-nums">
            {getValue<number>()}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            label={row.original.status === 'blocked' ? 'Bị khóa' : 'Hoạt động'}
          />
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Ngày đăng ký',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted">
            {formatReviewDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const self = row.original.id === current?.id;
          function open(action: 'block' | 'unblock' | 'change_role') {
            setSelected(row.original);
            setRole(row.original.role);
            setAction(action);
          }
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={`Thao tác với ${row.original.fullName}`}
                  className="size-11 p-0"
                  disabled={mutation.isPending}
                >
                  <MoreHorizontal size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={self && row.original.status !== 'blocked'}
                  onSelect={() =>
                    open(
                      row.original.status === 'blocked' ? 'unblock' : 'block',
                    )
                  }
                >
                  {row.original.status === 'blocked' ? 'Mở khóa' : 'Khóa'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={self}
                  onSelect={() => open('change_role')}
                >
                  Đổi vai trò
                </DropdownMenuItem>
                {self && (
                  <p className="max-w-60 px-3 py-2 text-xs text-muted">
                    Bạn không thể tự khóa hoặc hạ quyền chính mình.
                  </p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [current?.id, mutation.isPending],
  );
  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Quản lý Người dùng
        </h1>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          Danh sách tài khoản khách hàng, chủ studio và quản trị viên trong hệ
          thống.
        </p>
      </header>
      <DataTable
        columns={columns}
        fetcher={fetcher}
        queryKey={queryKeys.users.lists(userId)}
        tabs={tabs}
        defaultTab="all"
        defaultSort="createdAt:desc"
        filters={[
          {
            id: 'period',
            label: 'Ngày đăng ký',
            options: [{ value: '7d', label: '7 ngày qua' }],
          },
        ]}
        searchPlaceholder="Tên hoặc email…"
        getRowId={(row) => row.id}
      />
      <ConfirmReasonDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setSelected(null);
          }
        }}
        title={
          action === 'block'
            ? 'Khóa tài khoản'
            : action === 'unblock'
              ? 'Mở khóa tài khoản'
              : 'Đổi vai trò'
        }
        description={`${selected?.fullName ?? ''} · ${selected?.email ?? ''}. ${action === 'unblock' ? 'Người dùng cần đăng nhập lại; các phiên cũ không được khôi phục.' : 'Các phiên đăng nhập hiện có sẽ bị thu hồi.'}`}
        requireReason={action !== 'unblock'}
        destructive={action === 'block'}
        confirmLabel={
          action === 'block'
            ? 'Khóa tài khoản'
            : action === 'unblock'
              ? 'Mở khóa'
              : 'Lưu vai trò'
        }
        onConfirm={async (reason) => {
          if (action === 'change_role' && role === selected?.role)
            throw new Error('Vui lòng chọn vai trò mới.');
          await mutation.mutateAsync(reason);
        }}
      >
        {action === 'change_role' && (
          <label className="mt-4 block space-y-2 text-sm">
            <span>Vai trò mới</span>
            <select
              aria-label="Vai trò mới"
              value={role}
              disabled={mutation.isPending}
              onChange={(event) => setRole(event.target.value as Role)}
              className="min-h-11 w-full rounded-sm border border-line bg-surface px-3"
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="block text-xs text-muted">
              Vai trò tài khoản không tự cấp hoặc xóa quyền tại từng studio.
            </span>
          </label>
        )}
        {selected?.blockedReason && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
            Lý do khóa trước đó: {selected.blockedReason}
          </p>
        )}
      </ConfirmReasonDialog>
    </div>
  );
}

export const prefetchData = (client: QueryClient, userId: string) =>
  prefetchDefaultTable(client, userId, 'users', fetcher, ['period']);
