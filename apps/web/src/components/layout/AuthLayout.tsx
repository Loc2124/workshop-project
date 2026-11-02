import type { ReactNode } from 'react';
import { PageContainer } from './PageContainer';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';

export function AuthLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-svh flex-col bg-paper text-ink">
      <div className="relative flex min-h-24 items-center justify-center px-4 pb-4 pt-16 sm:min-h-24 sm:py-6">
        <button
          type="button"
          className="absolute left-4 top-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-primary hover:bg-soft sm:left-6 sm:top-6"
          onClick={() => {
            if (
              typeof window.history.state?.idx === 'number' &&
              window.history.state.idx > 0
            )
              navigate(-1);
            else navigate('/', { replace: true });
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Quay lại
        </button>
        <Link
          to="/"
          aria-label="Open Slot, về trang chủ"
          className="inline-flex min-h-11 items-center"
        >
          <Logo className="w-32 sm:w-36" />
        </Link>
      </div>
      <main className="flex flex-1 items-center py-10 md:py-14">
        <PageContainer>
          <section className="auth-form mx-auto w-full max-w-[420px]">
            {children}
          </section>
        </PageContainer>
      </main>
    </div>
  );
}
