# Quản lý hiển thị workshop

Trang `/admin/workshop` dùng DataTable với phân trang, tìm kiếm, sắp xếp phía server; query URL lưu tab, loại và studio. `/admin/workshops` tiếp tục mở được trang này; hồ sơ xét duyệt cũ nằm ở `/admin/workshop-review`.

Workshop đã có `status` để xét duyệt (`pending/approved/rejected`). Migration `018_workshop_moderation.sql` giữ nguyên trường này và thêm `visibility_status` (`active/hidden/removed`), `hidden_reason`, `moderated_by`, `moderated_at`. API quản lý mới trả `status` là trạng thái hiển thị, `reviewStatus` là trạng thái xét duyệt. “Đang mở” nghĩa là không bị ẩn/gỡ; chỉ xuất hiện công khai khi workshop và studio đều được duyệt, studio đủ hồ sơ và không phải bản nháp.

- `GET /admin/workshop`: `page`, `pageSize`, `sort`, `q`, `status`, `studioId`, `categoryId`, `period=7d`; trả rows, total, statusCounts. Số slot sắp tới đếm slot scheduled trong tương lai. Số đặt chỗ đếm đơn chưa bị hủy/hết hạn, không phải số khách.
- `GET /admin/workshop/:id`: chi tiết, ảnh và lịch slot.
- `GET /admin/workshop-studios?q=...`: tìm studio cho bộ lọc, tối đa 100 kết quả mỗi lần tìm.
- `PATCH /admin/workshop/:id/visibility`: `{status: 'hidden' | 'removed', reason}` hoặc `{status:'active'}`. Lý do trim, dài 10–1000 ký tự. Cùng trạng thái hoặc removed → hidden trả 409; tất cả route admin bắt buộc role admin.

Thay đổi trạng thái, audit log và thông báo đến mọi owner của studio được ghi cùng transaction. Khôi phục xóa lý do hiện tại, audit giữ lý do cũ. Không xóa workshop, lịch hoặc đặt chỗ. Chủ studio không sửa được trạng thái hiển thị thông qua form workshop.

Thông báo trong ứng dụng: `GET /me/notifications`, `PATCH /me/notifications/:id/read` chỉ truy cập thông báo của tài khoản hiện tại. Thông báo chưa đọc hiện ở tổng quan và các trang quản lý studio, tự tải lại mỗi phút. Không gửi email hoặc tin nhắn mạng xã hội.
