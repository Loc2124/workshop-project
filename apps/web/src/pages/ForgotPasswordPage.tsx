import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/button';
import { AuthField } from '../components/ui/auth-field';
import { apiFetch } from '../lib/api-client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-heading text-3xl font-semibold text-primary md:text-4xl">Quên mật khẩu?</h1>
      <p className="mt-2 text-muted">Nhập email tài khoản, Open Slot sẽ gửi liên kết đặt lại mật khẩu nếu địa chỉ này đã đăng ký.</p>
      {sent ? (
        <p role="status" className="mt-6 rounded-xl border border-[#DDD6C4] bg-white p-4 text-sm leading-6 text-ink">
          Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư. Hãy kiểm tra cả thư mục spam.
        </p>
      ) : (
        <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)} aria-busy={sending}>
          <AuthField id="email" label="Email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={sending} onChange={(event) => setEmail(event.target.value)} />
          {error && <p role="alert" className="text-sm text-brick">{error}</p>}
          <Button type="submit" className="min-h-12 w-full" disabled={sending || !email.trim()}>{sending ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}</Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted"><Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/dang-nhap">Quay lại đăng nhập</Link></p>
    </AuthLayout>
  );
}
