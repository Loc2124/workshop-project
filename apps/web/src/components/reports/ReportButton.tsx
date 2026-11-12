import { lazy, Suspense, useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authHref } from '@/lib/auth-navigation';
import { Button } from '../ui/button';
const ReportDialog = lazy(() =>
  import('./ReportDialog').then((module) => ({ default: module.ReportButton })),
);
export function ReportButton(props: {
  targetType: 'studio' | 'workshop';
  targetId: string;
}) {
  const [requested, setRequested] = useState(false);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    if (user && location.hash === '#report') setRequested(true);
  }, [user, location.hash]);
  const trigger = (
    <Button
      variant="ghost"
      className="text-sm text-muted"
      disabled={isLoading}
      onClick={() => {
        if (!user) {
          navigate(
            authHref(
              '/dang-nhap',
              location.pathname + location.search + '#report',
            ),
          );
          return;
        }
        setRequested(true);
      }}
    >
      <Flag size={15} />
      Báo cáo
    </Button>
  );
  return requested ? (
    <Suspense fallback={trigger}>
      <ReportDialog {...props} initialOpen />
    </Suspense>
  ) : (
    trigger
  );
}
