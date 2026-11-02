# Quản lý đặt chỗ

Trang `/admin/dat-cho` dùng DataTable, Sheet chi tiết 640px và ConfirmReasonDialog. `/admin/bookings` vẫn mở được trang mới. Tìm theo mã đơn `order_code`, UUID, tên, email hoặc SĐT khách (`users.phone`, có thể chưa có). Khoảng ngày lọc theo giờ bắt đầu slot, ngày kết thúc tính hết ngày theo múi giờ Việt Nam. Bộ lọc ngày tạo đơn phục vụ liên kết từ Tổng quan.

Migration `019_admin_bookings.sql` bổ sung `users.phone`, `bookings.reservation_status`, `booking_status_history` và trigger audit. Trạng thái thanh toán `bookings.status` giữ nguyên. Dữ liệu cũ: paid → confirmed; expired/cancelled/refund_needed → cancelled; còn lại pending. Lịch sử cũ chỉ ghi trạng thái tại lúc migration, không dựng lại thời điểm hay người thay đổi chưa biết.

Các endpoint yêu cầu admin:

- `GET /admin/dat-cho`: page, pageSize, sort, q, status, studioId, dateFrom, dateTo, period=today|7d; trả rows, total, statusCounts.
- `GET /admin/dat-cho/:id`: thông tin khách/workshop/slot/thanh toán và timeline ai, khi nào, lý do.
- `PATCH /admin/dat-cho/:id/status`: `{status, expectedStatus, reason}`; reason trim 10–1000 ký tự. expectedStatus chống ghi đè thao tác admin khác.

Chuyển trạng thái: pending → confirmed/cancelled; confirmed → completed/cancelled. Cancelled và completed chỉ xem, không mở lại đơn. Chỉ completed khi slot đã kết thúc; không xác nhận giữ chỗ hết hạn hoặc slot bị hủy. Lỗi dữ liệu đầu vào trả 422, xung đột trả 409, hoàn tất sớm trả 400.

Xác nhận xử lý không ghi nhận thu tiền. Đơn chưa thanh toán vẫn chiếm `seats_held`; sau xác nhận không bị job hết hạn tự giải phóng. Đơn đã thanh toán chiếm `seats_sold`. Khi hủy, khóa session trước booking theo cùng thứ tự với xử lý hết hạn/hủy slot, giảm đúng bộ đếm và vô hiệu hóa vé còn valid. Đơn paid chuyển sang refund_needed; đơn chưa thanh toán chuyển cancelled. Không tự thực hiện hoàn tiền qua nhà cung cấp thanh toán.

Trả chỗ, đổi trạng thái, vô hiệu hóa vé, timeline và admin_activity_log cùng transaction. Bộ đếm không đủ thì rollback toàn bộ. Hủy lặp hoặc hai admin cùng thao tác không trả chỗ hai lần. Trigger ghi cả thay đổi từ hệ thống (hết hạn/hủy slot); actor không có dữ liệu được ghi rõ là Hệ thống. Timeline giữ cả trạng thái thanh toán trước/sau.
