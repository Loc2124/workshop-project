import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Skeleton } from '../../components/ui/skeleton';

const LoginPage = lazy(() =>
  import('../../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('../../pages/auth/RegisterPage').then((m) => ({
    default: m.RegisterPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import('../../pages/auth/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('../../pages/auth/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
);

function AuthFallback() {
  return (
    <AuthLayout>
      <div className="min-h-[520px] space-y-5" role="status">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </AuthLayout>
  );
}

export function renderAuthRoutes() {
  return [
    <Route
      key="dang-nhap"
      path="/dang-nhap"
      element={
        <Suspense fallback={<AuthFallback />}>
          <LoginPage />
        </Suspense>
      }
    />,
    <Route
      key="dang-ky"
      path="/dang-ky"
      element={
        <Suspense fallback={<AuthFallback />}>
          <RegisterPage />
        </Suspense>
      }
    />,
    <Route
      key="quen-mat-khau"
      path="/quen-mat-khau"
      element={
        <Suspense fallback={<AuthFallback />}>
          <ForgotPasswordPage />
        </Suspense>
      }
    />,
    <Route
      key="dat-lai-mat-khau"
      path="/dat-lai-mat-khau"
      element={
        <Suspense fallback={<AuthFallback />}>
          <ResetPasswordPage />
        </Suspense>
      }
    />,
  ];
}
