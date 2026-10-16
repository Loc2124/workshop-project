# PRD — Nền tảng đặt chỗ workshop

Tham chiếu mức ưu tiên trong `CLAUDE.md`. Mỗi mục có tiêu chí chấp nhận (AC) để kiểm thử.

## Vai trò
- **Khách hàng (customer)**, **Đơn vị tổ chức (organizer)**, **Quản trị (admin)**. Một website, ba khu vực chức năng, dùng chung bộ thành phần giao diện.
- Mỗi workshop không có giao diện riêng: nội dung khác nhau là dữ liệu, trang chi tiết dùng chung một template.

## Khách hàng
| ID | Chức năng | Mức | Tiêu chí chấp nhận |
|---|---|---|---|
| C1 | Đăng ký, đăng nhập | 1 | Email duy nhất; mật khẩu băm; phiên đăng nhập hết hạn theo cấu hình |
| C2 | Tìm và lọc workshop | 1 | Lọc theo ngày, khoảng giá, khu vực, loại; chỉ hiện workshop `approved` và buổi `scheduled` còn chỗ |
| C3 | Nhập nhu cầu bằng một câu để xếp hạng | 1 | Kết quả là tập đã qua lọc cứng, sắp theo mức phù hợp; ranker lỗi thì tự dùng xếp hạng dự phòng |
| C4 | Xem chi tiết workshop và các buổi | 1 | Hiện số chỗ còn, giá, chính sách |
| C5 | Chọn buổi, số người, giữ chỗ | 1 | Giữ chỗ nguyên tử; hết hạn thì tự giải phóng |
| C6 | Thanh toán qua PayOS | 1 | Tổng tiền tính ở server; trạng thái cập nhật chỉ khi webhook hợp lệ |
| C7 | Xem vé và lịch sử | 1 | Mỗi chỗ một mã vé; chỉ chủ đơn xem được |
| C8 | Đánh giá sau tham gia | 2 | Chỉ booking `paid` của buổi đã diễn ra; mỗi booking một đánh giá |

## Đơn vị tổ chức
| ID | Chức năng | Mức | Tiêu chí chấp nhận |
|---|---|---|---|
| O1 | Tạo hồ sơ đơn vị | 1 | Trạng thái ban đầu `pending` |
| O2 | Tạo workshop | 1 | Đủ các trường: mô tả, trình độ, đối tượng, sản phẩm mang về, thời lượng, điều kiện, chính sách, khu vực |
| O3 | Tạo buổi (ngày giờ, giá, sức chứa) | 1 | Sức chứa > 0; không sửa sức chứa xuống dưới số chỗ đã giữ/bán |
| O4 | Xem danh sách đăng ký của mình | 1 | Chỉ thấy dữ liệu của đơn vị mình |
| O5 | Hủy buổi | 1 | Buổi `cancelled`; các booking liên quan đánh dấu `refund_needed` (hoàn tiền thủ công, ngoài phạm vi) |
| O6 | Doanh thu đơn giản | 2 | Khớp tổng booking `paid`, loại buổi bị hủy |
| O7 | Quét vé điểm danh | 3 | Vé chỉ dùng được một lần |

## Quản trị
| ID | Chức năng | Mức | Tiêu chí chấp nhận |
|---|---|---|---|
| A1 | Duyệt đơn vị và workshop bằng cờ trạng thái | 2 | `pending` / `approved` / `rejected`; chỉ `approved` mới hiện cho khách |
| A2 | Theo dõi đơn, giao dịch, buổi bị hủy | 1 | Danh sách có lọc; hiện cả booking `refund_needed` và webhook bị từ chối |

## Quy tắc nghiệp vụ chính
- Một booking gắn một buổi, quantity 1-10.
- Thời gian giữ chỗ: `HOLD_MINUTES` (mặc định 15).
- Thanh toán đến sau khi hết hạn giữ: xem `docs/02-architecture.md` mục "Thanh toán đến muộn".
- Chính sách hủy của khách: ngoài phạm vi; hiển thị văn bản chính sách của workshop, không tự động hoàn tiền.
