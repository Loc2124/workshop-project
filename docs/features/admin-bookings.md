# Quản lý đặt chỗ

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Trang `/admin/dat-cho` dùng DataTable, Sheet chi tiết 640px và ConfirmReasonDialog. `/admin/bookings` vẫn mở được trang mới. Tìm theo mã đơn `order_code`, UUID, tên, email hoặc SĐT khách (`users.phone`, có thể chưa có). Khoảng ngày lọc theo giờ bắt đầu slot, ngày kết thúc tính hết ngày theo múi giờ Việt Nam. Bộ lọc ngày tạo đơn phục vụ liên kết từ Tổng quan.

Migration `019_admin_bookings.sql` bổ sung `users.phone`, `bookings.reservation_status`, `booking_status_history` và trigger audit. Trạng thái thanh toán `bookings.status` giữ nguyên. Dữ liệu cũ: paid → confirmed; expired/cancelled/refund_needed → cancelled; còn lại pending. Lịch sử cũ chỉ ghi trạng thái tại lúc migration, không dựng lại thời điểm hay người thay đổi chưa biết.

Các endpoint yêu cầu admin:

- `GET /admin/dat-cho`: page, pageSize, sort, q, status, studioId, dateFrom, dateTo, period=today|7d; trả rows, total, statusCounts.
- `GET /admin/dat-cho/:id`: thông tin khách/workshop/slot/thanh toán và timeline ai, khi nào, lý do.
- `PATCH /admin/dat-cho/:id/status`: `{status, expectedStatus, reason}`; reason trim 10–1000 ký tự. expectedStatus chống ghi đè thao tác admin khác.

Chuyển trạng thái: pending → confirmed/cancelled; confirmed → completed/cancelled. Cancelled chỉ xem, không mở lại. Admin có thể hủy completed với lý do; không được đổi completed thành confirmed hoặc pending. Chỉ completed khi slot đã kết thúc; không xác nhận giữ chỗ hết hạn hoặc slot bị hủy. Lỗi dữ liệu đầu vào trả 422, xung đột trả 409, hoàn tất sớm trả 400.

Xác nhận xử lý không ghi nhận thu tiền. Đơn chờ cọc chiếm `seats_held`; đơn xác nhận chiếm `seats_sold`, kể cả còn phải thanh toán tại studio. Admin không được xác nhận đơn cọc mới khi chưa nhận đủ cọc. Khi hủy, khóa session trước booking theo cùng thứ tự với xử lý hết hạn/hủy slot, giảm đúng bộ đếm và vô hiệu hóa vé còn valid. Đơn đã thu tiền chuyển sang `refund_needed`; đơn chưa thu tiền chuyển `cancelled`. Không tự thực hiện hoàn tiền qua nhà cung cấp thanh toán.

Trả chỗ, đổi trạng thái, vô hiệu hóa vé, timeline và admin_activity_log cùng transaction. Bộ đếm không đủ thì rollback toàn bộ. Hủy lặp hoặc hai admin cùng thao tác không trả chỗ hai lần. Trigger ghi cả thay đổi từ hệ thống (hết hạn/hủy slot); actor không có dữ liệu được ghi rõ là Hệ thống. Timeline giữ cả trạng thái thanh toán trước/sau.

## Sai lệch cần sửa theo policy mới

Đã sửa đường hủy quản trị điền refund_due_amount/refund_status từ paid_amount; chưa nhận tiền thì không tạo khoản hoàn. Migration 037 sửa các bản ghi cũ refund_needed còn thiếu metadata, không ghi đè quyết định đã có. Có kiểm tra DB đồng thời/rollback/thông báo/nhật ký. Chính sách mục tiêu coi hủy do nền tảng/khóa studio như studio hủy, nhưng nhánh gian lận và quyền điều chỉnh phải theo quyết định đã chốt, không tự suy. Chưa có hoàn/chi trả tự động; xem trạng thái và roadmap.
