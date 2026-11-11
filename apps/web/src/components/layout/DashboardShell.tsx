import { Navigate, useLocation, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  PanelsTopLeft,
  CalendarDays,
  Ticket,
  QrCode,
  Store,
  ClipboardCheck,
  Building2,
  Users,
  Flag,
  ScrollText,
  Settings,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { DashboardLayout, type DashboardMenuItem } from './DashboardLayout';
import { useMyStudios } from '../../hooks/useManagement';
import { studioPage } from '../../lib/studio-dashboard';
import { StudioSwitcher } from './StudioSwitcher';

const STUDIO_SECTIONS = [
  { label: 'Tổng quan', section: '', icon: LayoutDashboard },
  { label: 'Workshop', section: 'workshops', icon: PanelsTopLeft },
  { label: 'Lịch buổi học', section: 'sessions', icon: CalendarDays },
  { label: 'Đặt chỗ', section: 'bookings', icon: Ticket },
  { label: 'Check-in vé', section: 'check-in', icon: QrCode },
  { label: 'Thành viên', section: 'members', icon: Users, ownerOnly: true },
  { label: 'Hồ sơ studio', section: 'profile', icon: Store, ownerOnly: true },
];

export function StudioDashboard() {
  const { user } = useAuth();
  const { studioId } = useParams();
  const { pathname, search } = useLocation();
  const studios = useMyStudios().data ?? [];
  const studio = studios.find((s) => s.id === studioId);
  if (!user) return null;
  if (!studioId) {
    const selected =
      studios.find(
        (s) => s.id === new URLSearchParams(search).get('studioId'),
      ) ?? studios[0];
    const section = pathname.split('/')[2];
    return selected ? (
      <Navigate
        to={studioPage(
          selected.id,
          ['workshops', 'sessions', 'bookings', 'check-in', 'members', 'profile'].includes(section)
            ? section
            : '',
        )}
        replace
      />
    ) : null;
  }
  if (!studio) return <Navigate to="/studio" replace />;
  const isStaff = studio.role === 'staff';
  const locked = studio.status !== 'approved' || studio.isDraft;
  const visibleSections = STUDIO_SECTIONS.filter(
    (item) => !item.ownerOnly || !isStaff,
  );
  const menuItems: DashboardMenuItem[] = visibleSections.map(
    ({ label, section, icon }) => ({
      label,
      icon,
      to: studioPage(studio.id, section),
      locked: Boolean(
        locked && ['sessions', 'bookings', 'check-in', 'members'].includes(section),
      ),
      attention:
        section === 'profile' &&
        ['rejected', 'needs_changes'].includes(studio.status),
    }),
  );
  return (
    <DashboardLayout
      menuItems={menuItems}
      roleLabel={isStaff ? 'Nhân viên studio' : 'Quản lý studio'}
      user={user}
      workspace={{
        name: studio.isDraft ? 'Hồ sơ nháp' : studio.name,
        to: studioPage(studio.id),
      }}
      studioSwitcher={<StudioSwitcher studios={studios} studio={studio} />}
    />
  );
}
export function AdminDashboard() {
  const { user } = useAuth();
  const menuItems: DashboardMenuItem[] = [
    { label: 'Tổng quan', to: '/admin', icon: LayoutDashboard },
    { label: 'Hồ sơ studio', to: '/admin/ho-so-studio', icon: ClipboardCheck },
    { label: 'Tất cả studio', to: '/admin/studios', icon: Building2 },
    { label: 'Nội dung', to: '/admin/noi-dung', icon: PanelsTopLeft },
    { label: 'Mẫu thông báo', to: '/admin/mau-thong-bao', icon: PanelsTopLeft },
    { label: 'Workshop', to: '/admin/workshop', icon: PanelsTopLeft },
    { label: 'Danh mục', to: '/admin/danh-muc', icon: PanelsTopLeft },
    { label: 'Người dùng', to: '/admin/nguoi-dung', icon: Users },
    { label: 'Đặt chỗ', to: '/admin/dat-cho', icon: Ticket },
    { label: 'Tài chính', to: '/admin/tai-chinh', icon: WalletCards },
    { label: 'Báo cáo', to: '/admin/bao-cao', icon: Flag },
    { label: 'Nhật ký', to: '/admin/nhat-ky', icon: ScrollText },
    { label: 'Cài đặt', to: '/admin/cai-dat', icon: Settings },
  ];
  return user ? (
    <DashboardLayout menuItems={menuItems} roleLabel="Quản trị" user={user} />
  ) : null;
}
