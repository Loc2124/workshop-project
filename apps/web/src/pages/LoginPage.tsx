import { LoadingState } from '../components/ui/LoadingState';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { AuthField } from '../components/ui/auth-field';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { authFieldErrors, loginFormSchema } from '../lib/auth-validation';
import {
  authRedirectFromSearch,
  postLoginDestination,
} from '../lib/auth-navigation';
import { AuthLink } from '../components/ui/auth-link';
import { toast } from 'sonner';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = authRedirectFromSearch(location.search);
  const { user, isLoading, authError, retryAuth, login, isLoggingIn } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const registrationComplete = location.state?.registrationComplete === true;

  function clearField(field: string) {
    setErrors((current) => ({ ...current, [field]: '' }));
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoggingIn) return;
    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(authFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    try {
      const authenticatedUser = await login({ ...parsed.data, rememberMe });
      toast.success('Đăng nhập thành công.');
      navigate(postLoginDestination(authenticatedUser, redirect), {
        replace: true,
      });
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Không thể đăng nhập. Vui lòng thử lại.',
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
          <Button type="button" onClick={() => void retryAuth()}>
            Thử lại
          </Button>
        </div>
      ) : user ? (
        <Navigate to={postLoginDestination(user, redirect)} replace />
      ) : (
        <>
          <h1 className="font-heading text-3xl font-semibold text-primary md:text-4xl">
            Đăng nhập
          </h1>
          <p className="mt-2 text-muted">
            Chào mừng bạn trở lại với Open Slot.
          </p>
          {registrationComplete && (
            <p
              className="mt-5 rounded-lg bg-soft px-4 py-3 text-sm"
              role="status"
            >
              Tài khoản đã được tạo. Đăng nhập để tiếp tục.
            </p>
          )}
          <form
            noValidate
            className="space-y-5"
            onSubmit={handleSubmit}
            aria-busy={isLoggingIn}
          >
            <AuthField
              label="Email"
              id="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              error={errors.email}
              disabled={isLoggingIn}
              onChange={(event) => {
                setEmail(event.target.value);
                clearField('email');
              }}
            />
            <AuthField
              label="Mật khẩu"
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              error={errors.password}
              disabled={isLoggingIn}
              onChange={(event) => {
                setPassword(event.target.value);
                clearField('password');
              }}
              labelAction={
                <AuthLink
                  className="text-sm text-primary underline-offset-4 hover:underline"
                  to="/quen-mat-khau"
                >
                  Quên mật khẩu?
                </AuthLink>
              }
            />
            <label
              className="flex min-h-8 cursor-pointer items-center gap-3 text-sm"
              htmlFor="rememberMe"
            >
              <input
                className="size-4 shrink-0 accent-primary"
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                checked={rememberMe}
                disabled={isLoggingIn}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Ghi nhớ đăng nhập
            </label>
            <Button
              type="submit"
              className="min-h-12 w-full text-base"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            Chưa có tài khoản?{' '}
            <AuthLink
              to="/dang-ky"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Tạo tài khoản
            </AuthLink>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
