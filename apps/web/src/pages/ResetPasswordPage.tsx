import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '../components/layout/AuthLayout';
import { AuthField } from '../components/ui/auth-field';
import { AuthLink } from '../components/ui/auth-link';
import { Button } from '../components/ui/button';
import { PasswordChecklist } from '../components/ui/password-checklist';
import { ApiError, apiFetch } from '../lib/api-client';
import {
  authFieldErrors,
  resetPasswordFormSchema,
} from '../lib/auth-validation';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') ?? '');
  useEffect(() => {
    if (token)
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname,
      );
  }, [token]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function clearField(field: string) {
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const parsed = resetPasswordFormSchema.safeParse({
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setErrors(authFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: parsed.data.password }),
      });
      setDone(true);
      toast.success('Đặt lại mật khẩu thành công.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'PASSWORD_COMPROMISED') {
        setErrors((current) => ({ ...current, password: cause.message }));
        return;
      }
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Không thể đặt lại mật khẩu. Vui lòng thử lại.',
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
      <p className="mt-2 text-muted">
        Nhập mật khẩu mới cho tài khoản Open Slot của bạn.
      </p>
      {!token ? (
        <div className="mt-5 space-y-4">
          <p
            role="alert"
            className="rounded-lg bg-soft px-4 py-3 text-sm text-brick"
          >
            Liên kết này thiếu mã đặt lại mật khẩu hoặc không còn hợp lệ.
          </p>
          <Button asChild className="min-h-12 w-full text-base">
            <AuthLink to="/quen-mat-khau">Yêu cầu liên kết mới</AuthLink>
          </Button>
        </div>
      ) : done ? (
        <div role="status" className="mt-5 space-y-4">
          <p className="rounded-lg bg-soft px-4 py-3 text-sm leading-6">
            Mật khẩu đã được thay đổi. Các phiên đăng nhập cũ đã kết thúc.
          </p>
          <Button asChild className="min-h-12 w-full text-base">
            <AuthLink to="/dang-nhap">Đăng nhập</AuthLink>
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => void handleSubmit(event)}
          aria-busy={saving}
        >
          <AuthField
            id="password"
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            error={errors.password}
            hint={<PasswordChecklist password={password} />}
            disabled={saving}
            onChange={(event) => {
              setPassword(event.target.value);
              clearField('password');
            }}
          />
          <AuthField
            id="confirmPassword"
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirmPassword}
            error={errors.confirmPassword}
            disabled={saving}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearField('confirmPassword');
            }}
          />
          <Button
            type="submit"
            className="min-h-12 w-full text-base"
            disabled={saving}
          >
            {saving ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </Button>
          <p className="text-xs text-muted">
            Kiểm tra mật khẩu bị lộ bằng{' '}
            <a
              className="underline underline-offset-4"
              href="https://haveibeenpwned.com/Passwords"
              target="_blank"
              rel="noreferrer"
            >
              Have I Been Pwned
            </a>
            .
          </p>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Đã nhớ mật khẩu?{' '}
        <AuthLink
          className="font-semibold text-primary underline-offset-4 hover:underline"
          to="/dang-nhap"
        >
          Đăng nhập
        </AuthLink>
      </p>
    </AuthLayout>
  );
}
