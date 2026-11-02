# Nhật ký quản trị

Trang `/admin/nhat-ky` dùng DataTable chung, chỉ dành cho admin. Các cột: thời gian, người thực hiện, hành động, đối tượng có liên kết và lý do. Tìm kiếm debounce 300 ms; lọc người thực hiện, hành động, từ ngày/đến ngày. Phân trang và sắp xếp phía server; query đồng bộ lên URL. Sheet 640 px tải riêng bản chụp trước/sau dưới dạng JSON, có loading và thử lại.

## API chỉ đọc

- `GET /admin/nhat-ky`: `page`, `pageSize`, `sort`, `q`, `actorId`, `action`, `dateFrom`, `dateTo`, `status=all`.
- `GET /admin/nhat-ky/filters?q=`: người thực hiện có tìm kiếm (tối đa 50 người mỗi lần), các hành động đã ghi nhận. Giá trị `system` lọc sự kiện không có tài khoản thực hiện.
- `GET /admin/nhat-ky/:id`: metadata và JSON `before`/`after`.

Ngày lọc bao gồm trọn ngày theo Asia/Ho_Chi_Minh. Kiểm tra định dạng ngày, khoảng ngày, ID và danh sách cột sắp xếp; mọi giá trị lọc được parameterize. Response dùng `Cache-Control: no-store`. Không cung cấp API sửa hoặc xóa nhật ký.

## Ghi nhận thay đổi

Migration `026_audit_logs.sql` tạo `audit_logs` với các trường yêu cầu và thêm `actor_name`, `target_name` để tên tại thời điểm ghi nhận vẫn tồn tại khi dữ liệu tài khoản/đối tượng thay đổi. `target_id` là text vì khóa danh mục và mẫu thông báo không phải UUID. Actor không có FK để giữ nguyên danh tính lịch sử khi tài khoản bị xóa.

`writeAuditLog(client, event)` trong `apps/api/src/modules/admin/audit-log.ts` nhận transaction hiện tại, không tự commit. Các thao tác khóa/mở khóa/đổi vai trò, ẩn/gỡ/khôi phục nội dung, xử lý báo cáo, sửa danh mục/thứ tự, nội dung trang chủ và mẫu thông báo dùng helper này. Không ghi log cho xem trước, truy vấn hay yêu cầu thất bại.

Helper giữ tương thích `admin_activity_log` để trang Tổng quan và các timeline hiện có tiếp tục hoạt động. Trigger chuyển từng sự kiện sang hàm PostgreSQL `write_audit_log()`. Các API duyệt/từ chối/tạm ngưng/xác minh studio, xét duyệt workshop và đổi trạng thái đặt chỗ vốn ghi sự kiện bằng trigger cũng đi qua cùng hàm này; không ghi thêm lần hai ở API.

Bản chụp lấy từ OLD/NEW của row trigger, giữ trong cấu hình transaction, rồi được gắn vào sự kiện tương ứng. Một chuỗi cập nhật cùng đối tượng giữ trạng thái đầu tiên và cuối cùng trước khi ghi sự kiện. Không tồn tại bảng snapshot trung gian. JSON người dùng chỉ chứa danh tính, email, vai trò và thông tin khóa; không chứa password hash hoặc token phiên đăng nhập. Sắp xếp danh mục và sửa nội dung nổi bật truyền bản chụp cả danh sách; thêm ghi chú lưu ghi chú vừa thêm.

Ghi log và thay đổi nghiệp vụ cùng transaction: rollback không để lại nhật ký. Thêm API thay đổi cài đặt trong tương lai cần gọi `writeAuditLog` trong transaction đó, truyền `before`/`after` nếu đối tượng chưa có trigger snapshot.

## Bảo toàn lịch sử

Log cũ được chuyển từ `admin_activity_log`; chỉ phục hồi trạng thái trước/sau đã lưu, không suy đoán toàn bộ đối tượng lịch sử. Những trường không có dữ liệu giữ NULL. Snapshot mới được lưu cố định, không truy vấn bản hiện tại để giả lập lịch sử.

Bảng bật RLS, thu hồi quyền anon/authenticated/PUBLIC; các hàm ghi chỉ cho backend. Trigger chặn UPDATE, DELETE và TRUNCATE trên `audit_logs`. Tài khoản sở hữu database vẫn có khả năng thay đổi DDL; cơ chế này bảo vệ luồng ứng dụng và các thao tác sửa/xóa thông thường, không thay thế hệ thống lưu trữ bất biến bên ngoài database.
