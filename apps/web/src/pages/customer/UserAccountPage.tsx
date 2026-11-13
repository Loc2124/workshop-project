import { useState, useEffect, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  User,
  Shield,
  KeyRound,
  Store,
  Calendar,
  Wallet,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  Clock,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth, authQueryKey } from '@/hooks/useAuth';
import { useMyStudios } from '@/hooks/useOwnedStudios';
import { apiFetch } from '@/lib/api-client';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import type { AuthUser } from '@/services/authService';

export function UserAccountPage() {
  const { user, isLoading, logout, isLoggingOut } = useAuth();
  const studiosQuery = useMyStudios();
  const queryClient = useQueryClient();

  // Profile edit state
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName ?? '');
      setPhone(user.phone ?? '');
    }
  }, [user?.id, user?.fullName, user?.phone]);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Active section
  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'studios'
  >('profile');

  if (isLoading) {
    return (
      <LoadingState
        label="Đang tải thông tin tài khoản…"
        variant="page"
      />
    );
  }

  if (!user) {
    return <Navigate to="/dang-nhap?redirect=/tai-khoan" replace />;
  }

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    if (!fullName.trim() || fullName.trim().length < 2) {
      setProfileMessage({
        type: 'error',
        text: 'Họ và tên cần có ít nhất 2 ký tự.',
      });
      return;
    }

    try {
      setIsUpdatingProfile(true);
      const res = await apiFetch<{ user: AuthUser }>('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || null,
        }),
      });

      // Cập nhật lại cache user hiện tại
      queryClient.setQueryData(authQueryKey, res.user);
      setProfileMessage({
        type: 'success',
        text: 'Cập nhật thông tin cá nhân thành công!',
      });
      toast.success('Đã lưu thông tin tài khoản.');
    } catch (err) {
      setProfileMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Không thể cập nhật thông tin. Vui lòng thử lại.',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({
        type: 'error',
        text: 'Vui lòng nhập mật khẩu hiện tại.',
      });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({
        type: 'error',
        text: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: 'Xác nhận mật khẩu mới không khớp.',
      });
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await apiFetch<{ ok: boolean }>('/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      setPasswordMessage({
        type: 'success',
        text: 'Đổi mật khẩu thành công!',
      });
      toast.success('Mật khẩu của bạn đã được thay đổi thành công.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const memberStudios = studiosQuery.data ?? [];
  const roleLabel =
    user.role === 'admin'
      ? 'Quản trị viên hệ thống'
      : memberStudios.some((s) => s.role === 'owner')
        ? 'Chủ sở hữu studio'
        : memberStudios.some((s) => s.role === 'staff')
          ? 'Nhân viên studio'
          : 'Khách hàng';

  return (
    <PageContainer className="py-8 sm:py-12 max-w-5xl">
      {/* Header Profile Summary */}
      <div className="rounded-2xl border border-line bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 sm:size-20 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl sm:text-3xl border-2 border-primary/20">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-studio-ink">
                  {user.fullName || 'Người dùng Open Slot'}
                </h1>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {roleLabel}
                </span>
              </div>
              <p className="text-sm text-muted flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted shrink-0" />
                {user.email}
              </p>
              {user.createdAt && (
                <p className="text-xs text-muted flex items-center gap-1.5 pt-0.5">
                  <Clock className="size-3 text-muted shrink-0" />
                  Tham gia từ {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link to="/me/bookings">
                <Calendar className="size-4 mr-1.5 text-muted" />
                Lịch đặt của tôi
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLoggingOut}
              onClick={() => void logout()}
              className="text-brick hover:bg-brick/10 hover:text-brick justify-start"
            >
              <LogOut className="size-4 mr-1.5" />
              {isLoggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 flex gap-2 border-b border-line overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-studio-ink'
            }`}
          >
            <User className="size-4" />
            Thông tin cá nhân
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-studio-ink'
            }`}
          >
            <Shield className="size-4" />
            Bảo mật & Mật khẩu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('studios')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'studios'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-studio-ink'
            }`}
          >
            <Store className="size-4" />
            Studio của tôi
            {memberStudios.length > 0 && (
              <span className="rounded-full bg-soft px-2 py-0.5 text-xs text-muted">
                {memberStudios.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="mt-6">
        {activeTab === 'profile' && (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 rounded-xl border border-line bg-card p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-semibold font-heading text-studio-ink">
                  Hồ sơ cá nhân
                </h2>
                <p className="text-xs text-muted mt-1">
                  Cập nhật thông tin để studio và hệ thống tiện liên lạc khi cần xác nhận đặt chỗ.
                </p>
              </div>

              {profileMessage && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${
                    profileMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {profileMessage.type === 'success' ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-red-600" />
                  )}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-studio-ink uppercase tracking-wide">
                    Địa chỉ email
                  </label>
                  <Input
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-soft text-muted cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted">
                    Email là mã định danh tài khoản và không thể thay đổi.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-studio-ink uppercase tracking-wide">
                    Họ và tên
                  </label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Nhập họ và tên của bạn"
                    disabled={isUpdatingProfile}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-studio-ink uppercase tracking-wide">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ví dụ: 0912345678"
                      className="pl-9"
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-[11px] text-muted">
                    Dùng để nhận cuộc gọi xác nhận lịch học từ studio khi tham gia workshop.
                  </p>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </Button>
                </div>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-line bg-card p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-studio-ink flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  Tài khoản nhận hoàn tiền
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Thiết lập số tài khoản ngân hàng để tự động nhận tiền hoàn lại khi có sự cố hủy buổi học từ studio.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/me/refund-accounts">
                    Quản lý tài khoản hoàn tiền
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>

              <div className="rounded-xl border border-line bg-card p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-studio-ink flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  Đơn đặt chỗ & Vé tham dự
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Xem lại danh sách tất cả các buổi workshop bạn đã đặt hoặc lưu giữ mã QR vé vào cổng.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/me/bookings">
                    Xem lịch đặt của tôi
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-2xl rounded-xl border border-line bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-semibold font-heading text-studio-ink flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                Đổi mật khẩu
              </h2>
              <p className="text-xs text-muted mt-1">
                Hãy sử dụng mật khẩu an toàn gồm ít nhất 8 ký tự, kết hợp chữ và số để bảo vệ tài khoản.
              </p>
            </div>

            {passwordMessage && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {passwordMessage.type === 'success' ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-red-600" />
                )}
                <span>{passwordMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-studio-ink uppercase tracking-wide">
                  Mật khẩu hiện tại
                </label>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                  disabled={isUpdatingPassword}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-studio-ink uppercase tracking-wide">
                  Mật khẩu mới
                </label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                  required
                  minLength={8}
                  disabled={isUpdatingPassword}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-studio-ink uppercase tracking-wide">
                  Xác nhận mật khẩu mới
                </label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                  minLength={8}
                  disabled={isUpdatingPassword}
                />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'studios' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold font-heading text-studio-ink">
                  Studio & Xưởng sáng tạo
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Các studio bạn đang sở hữu hoặc tham gia làm việc với tư cách nhân viên.
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/dang-ky-studio">
                  <Sparkles className="size-4 mr-1.5" />
                  Mở thêm studio mới
                </Link>
              </Button>
            </div>

            {memberStudios.length === 0 ? (
              <div className="rounded-xl border border-line bg-card p-8 sm:p-12 text-center space-y-4 shadow-sm">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-studio-subtle text-primary">
                  <Building2 className="size-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="font-heading font-semibold text-lg text-studio-ink">
                    Bạn chưa có studio nào
                  </h3>
                  <p className="text-xs text-muted leading-relaxed">
                    Bạn có một không gian làm đồ thủ công, vẽ tranh, gốm sứ hay làm bánh? Hãy mở studio trên Open Slot để bắt đầu tiếp cận hàng nghìn học viên yêu thích trải nghiệm.
                  </p>
                </div>
                <div className="pt-2">
                  <Button asChild>
                    <Link to="/dang-ky-studio">
                      Bắt đầu mở studio ngay
                      <ArrowRight className="size-4 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {memberStudios.map((st) => (
                  <div
                    key={st.id}
                    className="rounded-xl border border-line bg-card p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-lg bg-studio-subtle font-bold text-primary">
                            <Store className="size-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-studio-ink line-clamp-1">
                              {st.isDraft ? 'Hồ sơ nháp studio' : st.name}
                            </h3>
                            <span className="text-xs text-muted">
                              {st.province || st.address || 'Chưa cập nhật địa chỉ'}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${
                            st.role === 'owner'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {st.role === 'owner' ? 'Chủ sở hữu' : 'Nhân viên'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted pt-1">
                        <span>Trạng thái:</span>
                        <span className="font-medium text-studio-ink capitalize">
                          {st.isDraft
                            ? 'Bản nháp'
                            : st.status === 'approved'
                              ? 'Đã duyệt'
                              : st.status === 'pending'
                                ? 'Chờ duyệt'
                                : st.status}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-line flex items-center justify-end">
                      <Button asChild size="sm">
                        <Link to={`/studio/${st.id}`}>
                          Vào quản lý
                          <ArrowRight className="size-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
