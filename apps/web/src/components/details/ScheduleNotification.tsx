import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiFetch } from '../../lib/api-client';
import { useAuth } from '../../hooks/useAuth';

export function ScheduleNotification({ workshopId }: { workshopId: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle',
  );
  const buttonClass =
    'inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white';
  if (!user)
    return (
      <Link
        className={buttonClass}
        to={`/dang-nhap?redirect=${encodeURIComponent(location.pathname + location.search)}`}
      >
        Nhận thông báo khi có lịch
      </Link>
    );
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={buttonClass}
        disabled={state === 'pending' || state === 'success'}
        onClick={async () => {
          setState('pending');
          try {
            await apiFetch(`/workshops/${workshopId}/schedule-subscription`, {
              method: 'POST',
            });
            setState('success');
          } catch {
            setState('error');
          }
        }}
      >
        {state === 'pending'
          ? 'Đang lưu…'
          : state === 'success'
            ? 'Đã đăng ký nhận thông báo'
            : 'Nhận thông báo khi có lịch'}
      </button>
      {state === 'success' && (
        <p role="status" className="text-sm text-primary">
          Đã lưu đăng ký. Chúng tôi sẽ thông báo khi studio có lịch mới.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="text-sm text-brick">
          Chưa lưu được đăng ký. Vui lòng thử lại.
        </p>
      )}
    </div>
  );
}
