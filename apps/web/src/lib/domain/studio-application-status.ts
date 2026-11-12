export const studioApplicationStatus = {
  suspended: {
    label: 'Tạm ngưng',
    title: 'Studio đang tạm ngưng',
    description:
      'Studio đang tạm ngưng hoạt động công khai. Liên hệ Open Slot để được hỗ trợ.',
  },
  needs_changes: {
    label: 'Cần bổ sung',
    title: 'Hồ sơ cần bổ sung',
    description:
      'Open Slot đã phản hồi thông tin cần bổ sung. Chỉnh sửa và gửi lại để tiếp tục xét duyệt.',
  },
  pending: {
    label: 'Chờ duyệt',
    title: 'Hồ sơ đang chờ duyệt',
    description:
      'Open Slot đang xem xét hồ sơ. Bạn có thể chuẩn bị nội dung workshop; studio chỉ hiển thị công khai sau khi được duyệt.',
  },
  approved: {
    label: 'Đã duyệt',
    title: 'Studio đã được duyệt',
    description:
      'Bạn có thể chia sẻ trang studio và quản lý lịch trải nghiệm. Workshop cần được duyệt và có lịch sắp tới để khách tìm thấy trên trang Khám phá.',
  },
  rejected: {
    label: 'Chưa được duyệt',
    title: 'Hồ sơ chưa được duyệt',
    description:
      'Studio hiện chưa hiển thị công khai. Liên hệ Open Slot để xác nhận thông tin cần bổ sung.',
  },
} as const;
