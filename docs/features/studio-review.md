# Xét duyệt hồ sơ studio

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Trang `/admin/ho-so-studio` có bốn Tabs: Chờ duyệt, Cần bổ sung, Đã duyệt và Từ chối. Số đếm tính từ danh sách hồ sơ đã gửi; hồ sơ nháp không thuộc hàng đợi admin. Các đường dẫn hồ sơ cũ chuyển tiếp về trang này.

Danh sách dùng Table, mở Sheet chi tiết bằng chuột hoặc bàn phím. Sheet có ảnh thật, loại workshop, thông tin liên hệ, liên kết và phản hồi trước đó. Nút Duyệt khóa nếu thiếu SĐT hợp lệ, email hợp lệ hoặc ba ảnh đã tải lên và gắn với studio. API kiểm tra lại điều kiện trong transaction có khóa hàng studio.

## API

`PATCH /admin/studios/:id/status` yêu cầu đăng nhập admin:

```json
{ "status": "approved" }
```

```json
{
  "status": "needs_changes",
  "reason": "Bổ sung ảnh mặt tiền rõ biển hiệu studio."
}
```

```json
{ "status": "rejected", "reason": "Thông tin địa điểm studio chưa rõ ràng." }
```

Lý do được trim, bắt buộc từ 10 đến 1000 ký tự cho `needs_changes` và `rejected`. Request không hợp lệ trả 422. Duyệt hồ sơ thiếu điều kiện trả **400 BAD_REQUEST** và không ghi thay đổi. Không tìm thấy hồ sơ đã gửi trả 404; tài khoản không phải admin trả 403.

Mỗi quyết định ghi `reviewed_by`, `reviewed_at`, `rejection_reason` vào `studios`. Khi duyệt, lý do đặt lại thành `null`. Khi gỡ trạng thái Đã duyệt, xác minh hiện tại và khả năng nhận cọc bị thu hồi theo cơ chế có sẵn. Duyệt loại workshop đề xuất vẫn thực hiện cùng transaction.

`GET /admin/studios` và `GET /me/studios` trả thêm `reviewedBy`, `reviewedAt`, `rejectionReason`; danh sách admin trả `categoryIds`. Có thể lọc `GET /admin/studios?status=needs_changes`. Bộ lọc workshop không nhận trạng thái mới này.

## Chủ studio

Migration `017_studio_suspension_history.sql` bổ sung `suspended` và lịch sử trạng thái. Admin mở chi tiết qua `GET /admin/studios/:id`, gồm `submittedAt`, ảnh và `statusHistory` (người thực hiện, trạng thái trước/sau, thời gian, lý do).

Các chuyển trạng thái được phép: `pending` → `approved | needs_changes | rejected`, `approved` → `suspended`, `suspended` → `approved`. Thao tác sai trạng thái trả 409. Tạm ngưng bắt buộc lý do 10–1000 ký tự; khôi phục vẫn kiểm tra hồ sơ đầy đủ. Mỗi quyết định cập nhật người duyệt/thời gian/lý do và ghi `studio_status_history`, `admin_activity_log` trong cùng transaction. Nhật ký cũ chỉ khôi phục thông tin đã lưu, không suy đoán người hay lý do.

Studio tạm ngưng bị ẩn khỏi danh mục công khai; chủ studio thấy lý do và không được tự gửi lại hồ sơ. Khôi phục đưa studio về Đã duyệt, không tự cấp lại xác minh bậc 2 hoặc quyền nhận cọc.

Tổng quan và trang Hồ sơ studio hiển thị phản hồi khi trạng thái là Cần bổ sung hoặc Từ chối. Chỉnh sửa và gửi lại mở form liên hệ/hình ảnh. Gửi thành công qua `PATCH /studios/:id/evidence` đưa hồ sơ về `pending`, đóng form và bỏ query `edit`. Quyết định mới sau đó cập nhật thông tin xét duyệt.

Migration `015_studio_review_decisions.sql` thêm enum `needs_changes` và ba cột xét duyệt. Nháp tiếp tục dùng `is_draft` để giữ riêng tư; không đổi cách lưu nháp hay trạng thái workshop.
