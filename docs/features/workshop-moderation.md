# Quản lý hiển thị workshop

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Trang `/admin/workshop` dùng DataTable với phân trang, tìm kiếm, sắp xếp phía server; query URL lưu tab, loại và studio. `/admin/workshops` tiếp tục mở được trang này; hồ sơ xét duyệt cũ nằm ở `/admin/workshop-review`.

Workshop còn trường `status` (`pending/approved/rejected`) để tương thích lịch sử. Migration `018_workshop_moderation.sql` thêm `visibility_status` (`active/hidden/removed`), `hidden_reason`, `moderated_by`, `moderated_at`; migration 031/032 chuyển luồng mới sang tự công khai/hậu kiểm. Không có hàng chờ duyệt riêng cho bài mới hoặc sửa nội dung. “Đang mở” không đồng nghĩa còn buổi đặt được: cần publication công khai, không ẩn/gỡ, studio đủ điều kiện và kiểm tra từng buổi khi đặt.

- `GET /admin/workshop`: `page`, `pageSize`, `sort`, `q`, `status`, `studioId`, `categoryId`, `period=7d`; trả rows, total, statusCounts. Số slot sắp tới đếm slot scheduled trong tương lai. Số đặt chỗ đếm đơn chưa bị hủy/hết hạn, không phải số khách.
- `GET /admin/workshop/:id`: chi tiết, ảnh và lịch slot.
- `GET /admin/workshop-studios?q=...`: tìm studio cho bộ lọc, tối đa 100 kết quả mỗi lần tìm.
- `PATCH /admin/workshop/:id/visibility`: `{status: 'hidden' | 'removed', reason}` hoặc `{status:'active'}`. Lý do trim, dài 10–1000 ký tự. Cùng trạng thái hoặc removed → hidden trả 409; tất cả route admin bắt buộc role admin.

Thay đổi trạng thái, audit log và thông báo đến mọi owner của studio được ghi cùng transaction. Khôi phục xóa lý do hiện tại, audit giữ lý do cũ. Không xóa workshop, lịch hoặc đặt chỗ. Chủ studio không sửa được trạng thái hiển thị thông qua form workshop.

Thông báo trong ứng dụng: `GET /me/notifications`, `PATCH /me/notifications/:id/read` chỉ truy cập thông báo của tài khoản hiện tại. Thông báo chưa đọc hiện ở tổng quan và các trang quản lý studio, tự tải lại mỗi phút. Không gửi email hoặc tin nhắn mạng xã hội.
