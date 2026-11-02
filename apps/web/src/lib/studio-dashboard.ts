import type {
  MemberStudio,
  StudioSession,
  StudioWorkshop,
} from '../types/management';

export function studioPage(studioId: string, section = '') {
  return `/studio/${encodeURIComponent(studioId)}${section ? `/${section}` : ''}`;
}
export function switchStudioPath(pathname: string, studioId: string) {
  return studioPage(
    studioId,
    pathname.split('/').filter(Boolean).slice(2).join('/'),
  );
}
export function studioDashboardStats(
  workshops: StudioWorkshop[],
  sessions: StudioSession[],
  now = Date.now(),
) {
  const upcoming = sessions.filter(
    (s) => s.status === 'scheduled' && Date.parse(s.startsAt) > now,
  );
  return {
    // The API exposes confirmed seats, not booking records; do not present seats as bookings.
    openWorkshops: workshops.filter(
      (w) =>
        w.status === 'approved' &&
        upcoming.some(
          (s) =>
            s.workshopId === w.id && s.capacity > s.seatsHeld + s.seatsSold,
        ),
    ).length,
    availableSeats: upcoming.reduce(
      (sum, s) => sum + Math.max(0, s.capacity - s.seatsHeld - s.seatsSold),
      0,
    ),
  };
}
export function studioState(studio: Pick<MemberStudio, 'status' | 'isDraft'>) {
  return studio.isDraft ? 'draft' : studio.status;
}
export const studioStates = {
  suspended: {
    label: 'Tạm ngưng',
    className: 'bg-neutral-100 text-neutral-700',
    description:
      'Studio đang tạm ngưng hoạt động công khai. Chỉ quản trị có thể khôi phục hoạt động.',
  },
  needs_changes: {
    label: 'Cần bổ sung',
    className: 'bg-orange-50 text-orange-800',
    description:
      'Open Slot yêu cầu bổ sung hồ sơ. Xem phản hồi bên dưới, cập nhật thông tin và gửi lại.',
  },
  draft: {
    label: 'Nháp',
    className: 'bg-neutral-100 text-neutral-700',
    description:
      'Hồ sơ chưa được gửi. Hoàn thiện thông tin và ảnh thật để gửi xét duyệt.',
  },
  pending: {
    label: 'Chờ duyệt',
    className: 'bg-amber-50 text-amber-800',
    description:
      'Open Slot đang xem xét hồ sơ. Bạn có thể chuẩn bị workshop trong lúc chờ duyệt.',
  },
  approved: {
    label: 'Đã duyệt',
    className: 'bg-emerald-50 text-emerald-800',
    description:
      'Studio đã được duyệt. Tạo workshop và thêm lịch để khách có thể tìm thấy trải nghiệm của bạn.',
  },
  rejected: {
    label: 'Bị từ chối',
    className: 'bg-red-50 text-red-800',
    description:
      'Kiểm tra thông tin, bổ sung hồ sơ và gửi lại để Open Slot xét duyệt.',
  },
} as const;
