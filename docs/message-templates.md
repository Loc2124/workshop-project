# Mẫu thông báo

Trang `/admin/mau-thong-bao` dành cho admin, gồm sáu mẫu cố định: studio được duyệt, cần bổ sung, bị từ chối, bị tạm ngưng; đặt chỗ thành công và bị hủy.

Mỗi mẫu có tiêu đề, nội dung văn bản thuần và danh sách biến cho phép. Chip chèn biến tại vị trí con trỏ trong trường vừa chọn. Xem trước dùng dữ liệu mẫu, không lưu hoặc gửi thông báo. Khôi phục mặc định có xác nhận và lưu ngay. Sửa mẫu chỉ ảnh hưởng thông báo phát sinh sau đó.

## API

- `GET /admin/mau-thong-bao`: sáu mẫu, biến cho phép, người cập nhật, thời gian và phiên bản.
- `PUT /admin/mau-thong-bao/:key`: `subject`, `body`, `expectedVersion`.
- `POST /admin/mau-thong-bao/:key/preview`: `subject`, `body`; trả nội dung đã render và dữ liệu mẫu.
- `POST /admin/mau-thong-bao/:key/reset`: `expectedVersion`.

Các endpoint yêu cầu quyền admin. Lưu hoặc khôi phục ghi audit log; phiên bản không còn hiện hành trả 409 để tránh ghi đè thay đổi của người khác. Tiêu đề tối đa 200 ký tự, nội dung tối đa 5000 ký tự.

## Render và phân phối

Migration `025_message_templates.sql` tạo bảng `message_templates(key, subject, body, updated_by, updated_at)`, gieo sáu mặc định và bổ sung nội dung thông báo đã render vào `studio_notifications`. Khóa mẫu là danh sách cố định; ứng dụng không có chức năng thêm hoặc xóa mẫu.

Renderer ở shared và PostgreSQL dùng cùng danh sách biến theo từng mẫu. Biến lạ hoặc thiếu dữ liệu bị thay bằng chuỗi rỗng. Chỉ render một lượt: giá trị biến chứa cú pháp `{{...}}` không được render lần nữa. Nội dung được hiển thị dưới dạng văn bản thuần; xuống dòng trong tiêu đề được loại bỏ.

Trigger trạng thái studio gửi cho chủ studio khi duyệt, yêu cầu bổ sung, từ chối, tạm ngưng; khôi phục dùng mẫu được duyệt. Trigger đặt chỗ gửi cho khách khi tạo đặt chỗ, xác nhận/thanh toán thành công và hủy. Thông báo cùng transaction với thay đổi nghiệp vụ. Mẫu đặt chỗ có trạng thái xử lý và thanh toán riêng, không khẳng định đã thanh toán khi mới giữ chỗ.

Đây là thông báo trong ứng dụng, đọc qua chuông thông báo ở thanh điều hướng và `/me/notifications`; chưa có kênh email/SMS. Người dùng chỉ đọc và đánh dấu đã đọc thông báo của chính mình. Nội dung đã gửi được lưu cố định, không render lại khi admin sửa mẫu.
