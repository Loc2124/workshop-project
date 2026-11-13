import { useEffect, useState } from 'react';
import {
  useSearchParams,
  useNavigate,
  Link,
  useLocation,
} from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';
import { writeActiveStudioId } from '@/lib/studio-dashboard';

interface InvitationInfo {
  id: string;
  email: string | null;
  role: 'staff';
  studioName: string;
  studioSlug?: string;
  invitedByName?: string;
  inviterName?: string;
  expiresAt: string;
}

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptedStudioId, setAcceptedStudioId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Liên kết mời không hợp lệ hoặc thiếu mã xác thực.');
      setLoading(false);
      return;
    }

    let isCancelled = false;
    async function lookup() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch<{ invitation: InvitationInfo }>(
          `/studios/invitations/lookup?token=${encodeURIComponent(token!)}`,
        );
        if (!isCancelled) {
          setInvitation(res.invitation);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Lời mời không tồn tại hoặc đã hết hạn.',
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void lookup();
    return () => {
      isCancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    try {
      setAccepting(true);
      setError(null);
      const res = await apiFetch<{ ok?: boolean; studioId: string }>(
        '/studios/invitations/accept',
        {
          method: 'POST',
          body: JSON.stringify({ token }),
        },
      );
      setAcceptedStudioId(res.studioId);

      if (user?.id) {
        writeActiveStudioId(user.id, res.studioId);
      }

      // Invalidate and refetch studios query immediately
      await queryClient.invalidateQueries({
        queryKey: queryKeys.studios.all(user?.id),
      });
      await queryClient.refetchQueries({
        queryKey: queryKeys.studios.mine(user?.id),
      });

      // Chuyển hướng sau 1 giây
      setTimeout(() => {
        navigate(`/studio/${res.studioId}`);
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể chấp nhận lời mời.',
      );
      setAccepting(false);
    }
  };

  const loginRedirectUrl = `/dang-nhap?redirect=${encodeURIComponent(
    location.pathname + location.search,
  )}`;

  return (
    <div className="mx-auto max-w-lg py-12 px-4 sm:px-6">
      <div className="rounded-xl border border-line bg-card p-6 sm:p-8 shadow-sm">
        {loading || isLoading ? (
          <div className="py-12 text-center text-sm text-muted">
            <p>Đang kiểm tra lời mời tham gia studio...</p>
          </div>
        ) : error && !invitation ? (
          <div className="text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="font-heading text-xl font-semibold text-studio-ink">
              Lời mời không hợp lệ
            </h1>
            <p className="text-sm text-muted">{error}</p>
            <div className="pt-2">
              <Button asChild variant="outline">
                <Link to="/">Về trang chủ</Link>
              </Button>
            </div>
          </div>
        ) : acceptedStudioId ? (
          <div className="text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="font-heading text-xl font-semibold text-studio-ink">
              Tham gia thành công!
            </h1>
            <p className="text-sm text-muted">
              Bạn đã trở thành nhân viên của{' '}
              <strong>{invitation?.studioName}</strong>. Đang chuyển hướng bạn
              đến trang quản lý...
            </p>
            <div className="pt-2">
              <Button
                onClick={() => navigate(`/studio/${acceptedStudioId}`)}
                className="w-full"
              >
                Vào khu vực quản lý ngay
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          </div>
        ) : invitation ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-studio-subtle text-primary">
                <Building2 className="size-6" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-studio-ink">
                Lời mời tham gia Studio
              </h1>
              <p className="text-sm text-muted">
                Bạn nhận được lời mời làm việc tại studio sáng tạo
              </p>
            </div>

            <div className="rounded-lg border border-line bg-studio-subtle/40 p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-line/60">
                <span className="text-muted">Studio:</span>
                <span className="font-semibold text-studio-ink">
                  {invitation.studioName}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-line/60">
                <span className="text-muted">Người mời:</span>
                <span className="font-medium text-studio-ink">
                  {invitation.invitedByName ||
                    invitation.inviterName ||
                    'Chủ studio'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-line/60">
                <span className="text-muted">Vai trò:</span>
                <span className="inline-flex items-center gap-1 font-medium text-studio-ink">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Nhân viên studio (Staff)
                </span>
              </div>
              {invitation.email && (
                <div className="flex justify-between items-center">
                  <span className="text-muted">Email nhận lời mời:</span>
                  <span className="font-mono text-xs">{invitation.email}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!user ? (
              <div className="space-y-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
                  <p>
                    Để gia nhập làm nhân viên của studio, vui lòng đăng ký tài
                    khoản mới hoặc đăng nhập nếu bạn đã có tài khoản.
                  </p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <Button asChild className="w-full">
                    <Link
                      to={`/dang-ky?redirect=${encodeURIComponent(
                        location.pathname + location.search,
                      )}`}
                    >
                      <UserPlus className="size-4 mr-2" />
                      Đăng ký tài khoản nhân viên
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to={loginRedirectUrl}>
                      <LogIn className="size-4 mr-2" />
                      Đã có tài khoản? Đăng nhập
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-md bg-studio-subtle/60 p-3 text-xs text-studio-ink">
                  <UserCheck className="size-4 text-primary shrink-0" />
                  <span>
                    Đang đăng nhập với: <strong>{user.email}</strong>
                  </span>
                </div>

                {invitation.email &&
                  user.email.toLowerCase() !==
                    invitation.email.toLowerCase() && (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                      * Lưu ý: Lời mời này ban đầu gửi đến{' '}
                      <strong>{invitation.email}</strong>. Bạn đang đăng nhập bằng{' '}
                      <strong>{user.email}</strong>, bạn vẫn có thể nhấn tham gia
                      bằng tài khoản hiện tại.
                    </p>
                  )}

                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full"
                >
                  {accepting
                    ? 'Đang kích hoạt...'
                    : 'Chấp nhận lời mời & Gia nhập studio'}
                  {!accepting && <ArrowRight className="size-4 ml-1.5" />}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
