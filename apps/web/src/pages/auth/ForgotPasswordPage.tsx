import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/button';
import { AuthField } from '../../components/ui/auth-field';
import { AuthLink } from '../../components/ui/auth-link';
import { apiFetch } from '../../lib/api-client';
import {
  authFieldErrors,
  forgotPasswordFormSchema,
} from '../../lib/auth-validation';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearField(field: string) {
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const parsed = forgotPasswordFormSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(authFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSending(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: parsed.data.email }),
      });
      setSent(true);
      toast.success('Đã gửi yêu cầu đặt lại mật khẩu.');
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Chưa gửi được yêu cầu. Vui lòng thử lại.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-heading text-3xl font-semibold text-primary md:text-4xl">
        Quên mật khẩu?
      </h1>
      <p className="mt-2 text-muted">
        Nhập email tài khoản, Open Slot sẽ gửi liên kết đặt lại mật khẩu nếu địa
        chỉ này đã đăng ký.
      </p>
      {sent ? (
        <div role="status" className="mt-5 space-y-4">
          <p className="rounded-lg bg-soft px-4 py-3 text-sm leading-6">
            Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp
            thư. Hãy kiểm tra cả thư mục spam.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full text-base"
            onClick={() => setSent(false)}
          >
            Gửi lại bằng email khác
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => void handleSubmit(event)}
          aria-busy={sending}
        >
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            error={errors.email}
            disabled={sending}
            onChange={(event) => {
              setEmail(event.target.value);
              clearField('email');
            }}
          />
          <Button
            type="submit"
            className="min-h-12 w-full text-base"
            disabled={sending}
          >
            {sending ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
          </Button>
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
