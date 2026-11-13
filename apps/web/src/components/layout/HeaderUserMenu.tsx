import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { LoadingState } from '../ui/LoadingState';
import { toast } from 'sonner';
import type { AuthUser } from '@/services/authService';
import type { MemberStudio } from '@/types';

interface HeaderUserMenuProps {
  user: AuthUser;
  studiosQuery: {
    data?: MemberStudio[];
    isPending: boolean;
    error: Error | null;
    refetch: () => Promise<unknown>;
  };
  isLoggingOut: boolean;
  onLogout: () => Promise<void>;
  onCloseAll: () => void;
}

export function HeaderUserMenu({
  user,
  studiosQuery,
  isLoggingOut,
  onLogout,
  onCloseAll,
}: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        accountTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="relative max-[480px]:hidden" ref={accountRef}>
      <button
        ref={accountTriggerRef}
        type="button"
        aria-label="Tài khoản"
        aria-expanded={open}
        aria-controls="account-menu"
        className="inline-grid size-11 place-items-center rounded-lg text-sm hover:bg-soft"
        onClick={() => {
          if (!open) {
            void studiosQuery.refetch();
          }
          setOpen(!open);
        }}
      >
        <UserRound size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          id="account-menu"
          aria-label="Tài khoản của bạn"
          className="absolute right-0 top-full z-60 mt-2 w-72 max-w-[calc(100vw-5rem)] rounded-xl bg-surface p-3 shadow-overlay"
        >
          <div className="rounded-lg bg-soft px-3 py-4">
            <p className="truncate font-semibold">{user.fullName}</p>
            <p className="mt-0.5 break-all text-sm text-muted">{user.email}</p>
          </div>
          <div className="mt-2 space-y-0.5">
            <Link
              to="/me/bookings"
              onClick={() => {
                setOpen(false);
                onCloseAll();
              }}
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm hover:bg-soft"
            >
              Lịch đặt của tôi
            </Link>

            {studiosQuery.isPending && !studiosQuery.data ? (
              <LoadingState
                label="Đang kiểm tra studio…"
                className="px-3 py-2 text-sm text-muted"
              />
            ) : studiosQuery.data?.some(
                (studio) => studio.role === 'owner' || studio.role === 'staff',
              ) ? (
              <Link
                to="/studio"
                onClick={() => {
                  setOpen(false);
                  onCloseAll();
                }}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:bg-soft"
              >
                Quản lý studio
              </Link>
            ) : user.role !== 'admin' ? (
              <Link
                to="/dang-ky-studio"
                onClick={() => {
                  setOpen(false);
                  onCloseAll();
                }}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-soft"
              >
                Mở studio trên Open Slot
              </Link>
            ) : null}

            {studiosQuery.data?.some(
              (studio) => studio.status === 'approved' && !studio.isDraft,
            ) && (
              <Link
                to="/studio/check-in"
                onClick={() => {
                  setOpen(false);
                  onCloseAll();
                }}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-soft"
              >
                Check-in vé
              </Link>
            )}

            {user.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => {
                  setOpen(false);
                  onCloseAll();
                }}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-soft"
              >
                Duyệt nội dung
              </Link>
            )}

            <button
              type="button"
              onClick={() =>
                toast.info('Trang tài khoản sẽ được bổ sung sau.')
              }
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-soft"
            >
              Tài khoản
            </button>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-brick hover:bg-paper disabled:opacity-50"
            >
              <LogOut size={17} aria-hidden="true" />
              {isLoggingOut ? 'Đang thoát…' : 'Đăng xuất'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
