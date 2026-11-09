import { LoadingState } from '../components/ui/LoadingState';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLink } from '../components/ui/auth-link';
import { authHref, authRedirectFromSearch } from '../lib/auth-navigation';
import { Button } from '../components/ui/button';
import { AuthField } from '../components/ui/auth-field';
import { PasswordChecklist } from '../components/ui/password-checklist';
import { ApiError } from '../lib/api-client';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import {
  authFieldErrors,
  registrationFormSchema,
} from '../lib/auth-validation';
import { toast } from 'sonner';

const initialValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = authRedirectFromSearch(location.search);
  const {
    user,
    isLoading,
    authError,
    retryAuth,
    register,
    isRegistering,
    login,
    isLoggingIn,
  } = useAuth();
  const isSubmitting = isRegistering || isLoggingIn;
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [policyNotice, setPolicyNotice] = useState('');
  function update<K extends keyof typeof values>(
    key: K,
    value: (typeof values)[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const parsed = registrationFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(authFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    try {
      const { fullName, email, password } = parsed.data;
      await register({ fullName, email, password });
      try {
        await login({ email, password, rememberMe: false });
        toast.success('Đã tạo tài khoản và đăng nhập thành công.');
        navigate(redirect, { replace: true });
      } catch {
        toast.success('Tài khoản đã được tạo.');
        navigate(authHref('/dang-nhap', redirect), {
          replace: true,
          state: { registrationComplete: true },
        });
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'PASSWORD_COMPROMISED') {
        setErrors((current) => ({ ...current, password: cause.message }));
        return;
      }
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Không thể tạo tài khoản. Vui lòng thử lại.',
      );
    }
  }
  return (
    <AuthLayout>
      {isLoading ? (
        <LoadingState label="Đang kiểm tra phiên đăng nhập…" variant="page" />
      ) : authError ? (
        <div className="space-y-4">
          <h1 className="font-heading text-3xl">Chưa thể kiểm tra tài khoản</h1>
          <p role="alert" className="text-brick">
            {authError.message}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void retryAuth()}
          >
            Thử lại
          </Button>
        </div>
      ) : user ? (
        <div className="space-y-5">
          <h1 className="font-heading text-3xl text-primary">
            Bạn đã có tài khoản
          </h1>
          <p className="break-words text-muted">
            Đang đăng nhập bằng <span className="text-ink">{user.email}</span>.
          </p>
          <Button asChild>
            <Link to="/">Khám phá workshop</Link>
          </Button>
        </div>
      ) : (
        <>
          <h1 className="font-heading text-3xl font-semibold text-primary md:text-4xl">
            Tạo tài khoản
          </h1>
          <p className="mt-2 text-muted">Bắt đầu trải nghiệm cùng Open Slot.</p>
          <form
            noValidate
            className="space-y-4"
            onSubmit={submit}
            aria-busy={isSubmitting}
          >
            <AuthField
              label="Họ và tên"
              id="fullName"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              value={values.fullName}
              error={errors.fullName}
              disabled={isSubmitting}
              onChange={(event) => update('fullName', event.target.value)}
            />
            <AuthField
              label="Email"
              id="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={values.email}
              error={errors.email}
              disabled={isSubmitting}
              onChange={(event) => update('email', event.target.value)}
            />
            <AuthField
              label="Mật khẩu"
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={values.password}
              error={errors.password}
              hint={<PasswordChecklist password={values.password} />}
              disabled={isSubmitting}
              onChange={(event) => update('password', event.target.value)}
            />
            <AuthField
              label="Nhập lại mật khẩu"
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={values.confirmPassword}
              error={errors.confirmPassword}
              disabled={isSubmitting}
              onChange={(event) =>
                update('confirmPassword', event.target.value)
              }
            />
            <div>
              <div className="flex items-start gap-3 text-sm leading-6">
                <input
                  className="mt-1 size-4 shrink-0 accent-primary"
                  type="checkbox"
                  id="acceptedTerms"
                  name="acceptedTerms"
                  required
                  checked={values.acceptedTerms}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.acceptedTerms) || undefined}
                  aria-describedby={
                    errors.acceptedTerms ? 'acceptedTerms-error' : undefined
                  }
                  onChange={(event) =>
                    update('acceptedTerms', event.target.checked)
                  }
                />
                <div>
                  <label htmlFor="acceptedTerms" className="cursor-pointer">
                    Tôi đồng ý với{' '}
                  </label>
                  <button
                    type="button"
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                    onClick={() =>
                      setPolicyNotice(
                        'Điều khoản sử dụng hiện chưa được cung cấp.',
                      )
                    }
                  >
                    Điều khoản
                  </button>{' '}
                  và{' '}
                  <button
                    type="button"
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                    onClick={() =>
                      setPolicyNotice(
                        'Chính sách bảo mật hiện chưa được cung cấp.',
                      )
                    }
                  >
                    Chính sách bảo mật
                  </button>
                </div>
              </div>
              {errors.acceptedTerms && (
                <p
                  id="acceptedTerms-error"
                  role="alert"
                  className="mt-2 text-sm text-brick"
                >
                  {errors.acceptedTerms}
                </p>
              )}
              {policyNotice && (
                <p role="status" className="mt-2 text-sm text-muted">
                  {policyNotice}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="min-h-12 w-full text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
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
          <p className="mt-6 text-center text-sm text-muted">
            Đã có tài khoản?{' '}
            <AuthLink
              to="/dang-nhap"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Đăng nhập
            </AuthLink>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
