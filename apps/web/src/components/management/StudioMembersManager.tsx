import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  Trash2,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  StudioCard,
  StudioBadge,
} from './StudioPrimitives';
import type { MemberStudio } from '../../types/management';

interface StudioMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: 'owner' | 'staff';
  joinedAt: string;
}

interface StudioInvitation {
  id: string;
  email: string;
  role: 'staff';
  status: 'pending';
  expiresAt: string;
  createdAt: string;
  invitedByName: string;
}

interface MembersData {
  members: StudioMember[];
  invitations?: StudioInvitation[];
  pendingInvitations?: StudioInvitation[];
}

export function StudioMembersManager({ studio }: { studio: MemberStudio }) {
  const [data, setData] = useState<MembersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Action states
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<MembersData>(`/studios/${studio.id}/members`);
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tải danh sách thành viên.',
      );
    } finally {
      setLoading(false);
    }
  }, [studio.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;

    try {
      setInviting(true);
      setInviteError(null);
      setInviteSuccessLink(null);

      const res = await apiFetch<{
        invitation: StudioInvitation;
        invitationLink: string;
      }>(`/studios/${studio.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, role: 'staff' }),
      });

      const fullLink = `${window.location.origin}${res.invitationLink}`;
      setInviteSuccessLink(fullLink);
      setEmail('');
      void loadMembers();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Không thể tạo lời mời. Vui lòng thử lại.',
      );
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteSuccessLink) return;
    try {
      await navigator.clipboard.writeText(inviteSuccessLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi lời mời này?')) return;
    try {
      setRevokingId(invitationId);
      await apiFetch(`/studios/${studio.id}/invitations/${invitationId}`, {
        method: 'DELETE',
        responseType: 'void',
      });
      void loadMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể thu hồi lời mời.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRemoveMember = async (member: StudioMember) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn gỡ quyền nhân viên của "${member.fullName || member.email}" khỏi studio?`,
      )
    ) {
      return;
    }

    try {
      setRemovingId(member.userId);
      await apiFetch(`/studios/${studio.id}/members/${member.userId}`, {
        method: 'DELETE',
        responseType: 'void',
      });
      void loadMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể gỡ thành viên.');
    } finally {
      setRemovingId(null);
    }
  };

  const invitations = data?.invitations ?? data?.pendingInvitations ?? [];
  const members = data?.members ?? [];

  return (
    <div className="space-y-6">
      {/* Intro info banner */}
      <div className="rounded-lg border border-line/60 bg-studio-subtle/50 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="size-5 shrink-0 text-studio-ink mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-studio-ink">Phân quyền nhân viên studio</p>
            <p className="text-muted">
              Nhân viên được mời sẽ có quyền truy cập vào bảng quản lý của studio để xem lịch
              buổi học, danh sách đặt chỗ và thực hiện soát vé (check-in) cho khách. Nhân viên
              sẽ <strong>không thể</strong> can thiệp vào tài khoản ngân hàng nhận tiền hay xóa studio.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Form */}
      <StudioCard>
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <UserPlus className="size-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">Mời nhân viên mới</h2>
        </div>

        <form onSubmit={handleInvite} className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
              <Input
                type="email"
                placeholder="Nhập địa chỉ email của nhân viên (ví dụ: nhanvien@gmail.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
                disabled={inviting}
              />
            </div>
            <Button type="submit" disabled={inviting || !email.trim()}>
              {inviting ? 'Đang tạo lời mời...' : 'Tạo liên kết mời'}
            </Button>
          </div>

          {inviteError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
              <AlertCircle className="size-4 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {inviteSuccessLink && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm">
                <Check className="size-4" />
                <span>Đã tạo liên kết mời thành công! Hãy gửi liên kết này cho nhân viên của bạn:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteSuccessLink}
                  className="flex-1 rounded-md border border-emerald-300 bg-white px-3 py-2 text-xs font-mono text-studio-ink select-all focus:outline-none"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 bg-white hover:bg-emerald-100/50"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 mr-1 text-emerald-600" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 mr-1" />
                      <span>Sao chép</span>
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-emerald-700">
                * Liên kết mời có hiệu lực trong vòng 7 ngày. Nhân viên chỉ cần mở liên kết và đăng nhập bằng tài khoản của họ để tham gia.
              </p>
            </div>
          )}
        </form>
      </StudioCard>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <StudioCard>
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Clock className="size-5 text-amber-600" />
            <h2 className="font-heading text-lg font-semibold">Lời mời đang chờ ({invitations.length})</h2>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-muted bg-studio-subtle/30">
                <tr>
                  <th className="py-2.5 px-3">Email nhận lời mời</th>
                  <th className="py-2.5 px-3">Vai trò</th>
                  <th className="py-2.5 px-3">Ngày tạo</th>
                  <th className="py-2.5 px-3">Hạn chót</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-studio-subtle/20">
                    <td className="py-3 px-3 font-medium">{inv.email}</td>
                    <td className="py-3 px-3">
                      <StudioBadge tone="neutral">Nhân viên</StudioBadge>
                    </td>
                    <td className="py-3 px-3 text-muted text-xs">
                      {new Date(inv.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-muted text-xs">
                      {new Date(inv.expiresAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={revokingId === inv.id}
                        onClick={() => handleRevokeInvitation(inv.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8 px-2.5"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        {revokingId === inv.id ? 'Đang hủy...' : 'Thu hồi'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StudioCard>
      )}

      {/* Active Members */}
      <StudioCard>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-studio-ink" />
            <h2 className="font-heading text-lg font-semibold">
              Danh sách thành viên ({members.length})
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadMembers}
            disabled={loading}
          >
            Làm mới
          </Button>
        </div>

        {loading && !data && (
          <div className="py-12 text-center text-sm text-muted">
            Đang tải danh sách thành viên...
          </div>
        )}

        {error && (
          <div className="py-6 text-center text-sm text-red-600 space-y-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadMembers}>
              Thử lại
            </Button>
          </div>
        )}

        {data && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-muted bg-studio-subtle/30">
                <tr>
                  <th className="py-2.5 px-3">Thành viên</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Vai trò</th>
                  <th className="py-2.5 px-3">Ngày tham gia</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-studio-subtle/20">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt=""
                            className="size-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex size-8 items-center justify-center rounded-full bg-studio-subtle font-semibold text-xs text-studio-ink">
                            {member.fullName ? member.fullName.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-studio-ink">
                            {member.fullName || 'Chưa đặt tên'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted">{member.email}</td>
                    <td className="py-3 px-3">
                      {member.role === 'owner' ? (
                        <StudioBadge tone="success">Chủ studio</StudioBadge>
                      ) : (
                        <StudioBadge tone="neutral">Nhân viên</StudioBadge>
                      )}
                    </td>
                    <td className="py-3 px-3 text-muted text-xs">
                      {new Date(member.joinedAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {member.role === 'staff' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={removingId === member.userId}
                          onClick={() => handleRemoveMember(member)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8 px-2.5"
                        >
                          <Trash2 className="size-3.5 mr-1" />
                          {removingId === member.userId ? 'Đang gỡ...' : 'Gỡ quyền'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted italic">Mặc định</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StudioCard>
    </div>
  );
}
