import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { passwordRequirements, newPasswordSchema } from '@workshop/shared';
import { AuthLayout } from '../components/layout/AuthLayout';
import { AuthField } from '../components/ui/auth-field';
import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/api-client';

const requirementLabels = [
  ['length', '12–128 ký tự'],
  ['letters', 'Có chữ hoa và chữ thường'],
  ['digit', 'Có ít nhất một chữ số'],
  ['special', 'Có ít nhất một ký tự đặc biệt'],
] as const;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  useEffect(() => {
    if (token)
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname,
      );
  }, [token]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const requirements = passwordRequirements(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const parsed = newPasswordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Mật khẩu chưa đạt yêu cầu.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể đặt lại mật khẩu.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-heading text-3xl font-semibold text-primary md:text-4xl">
        Đặt lại mật khẩu
      </h1>
      {!token ? (
        <p role="alert" className="mt-4 text-sm text-brick">
          Liên kết này thiếu mã đặt lại mật khẩu.
        </p>
      ) : done ? (
        <div role="status" className="mt-5 space-y-4">
          <p className="rounded-xl border border-[#DDD6C4] bg-white p-4 text-sm leading-6">
            Mật khẩu đã được thay đổi. Các phiên đăng nhập cũ đã kết thúc.
          </p>
          <Link
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-5 font-semibold text-white hover:bg-primary-hover"
            to="/dang-nhap"
          >
            Đăng nhập
          </Link>
        </div>
      ) : (
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => void submit(event)}
          aria-busy={saving}
        >
          <AuthField
            id="password"
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            value={password}
            disabled={saving}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
          />
          <ul
            aria-label="Yêu cầu mật khẩu"
            className="grid gap-1 text-xs text-muted sm:grid-cols-2"
          >
            {requirementLabels.map(([key, label]) => (
              <li key={key} className={requirements[key] ? 'text-primary' : ''}>
                {requirements[key] ? '✓' : '○'} {label}
              </li>
            ))}
          </ul>
          <AuthField
            id="confirm-password"
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            required
            maxLength={128}
            value={confirm}
            disabled={saving}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError('');
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-brick">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="min-h-12 w-full"
            disabled={saving || !password || !confirm}
          >
            {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted">
        <Link
          className="font-semibold text-primary underline-offset-4 hover:underline"
          to="/dang-nhap"
        >
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
