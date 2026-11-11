import { defaultSiteSettings } from '@workshop/shared';
export const siteContact = defaultSiteSettings.support;

export const footerInformation = [
  {
    id: 'chinh-sach-dat-lich',
    label: 'Chính sách đặt chỗ',
    text: 'Kiểm tra ngày, giờ, giá, số chỗ và cách nhận thành phẩm trên trang workshop trước khi đặt. Liên hệ studio để xác nhận hình thức thanh toán và điều kiện thay đổi lịch của buổi bạn chọn.',
  },
  {
    id: 'dieu-khoan-dich-vu',
    label: 'Điều khoản dịch vụ',
    text: 'Thông tin buổi trải nghiệm do studio tổ chức cung cấp. Đọc kỹ yêu cầu tham gia và cung cấp thông tin liên hệ chính xác khi đặt chỗ. Các điều kiện cụ thể của buổi học cần được xác nhận với studio trước khi đăng ký.',
  },
  {
    id: 'chinh-sach-bao-mat',
    label: 'Chính sách bảo mật',
    text: 'Cam kết bảo mật dữ liệu học viên, mã hóa giao dịch và không chia sẻ thông tin cho bên thứ ba vì mục đích thương mại trái phép.',
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
