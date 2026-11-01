export const siteContact: { hotline?: string; workingHours?: string } = {
  hotline: '1900 8889',
  workingHours: '8:30–21:00',
};

export const footerInformation = [
  {
    id: 'chinh-sach-dat-lich',
    label: 'Chính sách đặt lịch',
    text: 'Kiểm tra ngày, giờ, giá, số chỗ và cách nhận thành phẩm trên trang workshop trước khi đặt. Liên hệ xưởng để xác nhận hình thức thanh toán và điều kiện thay đổi lịch của buổi bạn chọn.',
  },
  {
    id: 'dieu-khoan-dich-vu',
    label: 'Điều khoản dịch vụ',
    text: 'Thông tin buổi trải nghiệm do xưởng tổ chức cung cấp. Đọc kỹ yêu cầu tham gia và cung cấp thông tin liên hệ chính xác khi đặt chỗ. Các điều kiện cụ thể của buổi học cần được xác nhận với xưởng trước khi đăng ký.',
  },
  {
    id: 'ho-tro',
    label: 'Hỗ trợ',
    text: [
      'Cần hỗ trợ tìm workshop hoặc kiểm tra thông tin buổi học?',
      siteContact.hotline
        ? `Liên hệ hotline ${siteContact.hotline}${siteContact.workingHours ? ` trong khung giờ ${siteContact.workingHours}` : ''}.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  },
];
