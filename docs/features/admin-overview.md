# Tổng quan admin

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

`/admin` hiển thị Tổng quan, được bảo vệ bởi `RequireRole('admin')`. Frontend gọi một endpoint `GET /admin/overview` để lấy số liệu, việc cần làm, 10 hoạt động mới nhất và chuỗi đặt chỗ 30 ngày.

- Hồ sơ chờ duyệt: studio đã gửi, không phải nháp, trạng thái `pending`.
- Workshop mới và người dùng mới: bản ghi được tạo trong 7 × 24 giờ gần nhất, gồm mọi trạng thái/vai trò. Các thẻ mở danh sách có `filter.period=7d`.
- Đặt chỗ hôm nay: số đơn được tạo trong ngày Việt Nam, gồm mọi trạng thái; không phải số ghế hay số đơn đã thanh toán. Thẻ mở `/admin/bookings?tab=all&filter.period=today`.
- Biểu đồ: đủ 30 ngày lịch tính đến hôm nay theo `Asia/Ho_Chi_Minh`, ngày không có đơn trả `0`.
- Hồ sơ quá 48 giờ: tính từ `submitted_at` mới nhất, mở bộ lọc `reviewQueue=overdue`.
- Studio gửi lại bổ sung: trước đó là `needs_changes`, đã gửi lại và đang `pending`, mở bộ lọc `reviewQueue=resubmitted`.
- Báo cáo chưa xử lý: `content_reports.status='pending'`, mở danh sách Báo cáo.

Migration `016_admin_overview.sql` thêm thời gian gửi/gửi lại hồ sơ, bảng `content_reports` và nhật ký `admin_activity_log`. Hồ sơ đã gửi từ trước lấy `created_at` làm mốc gửi ban đầu vì chưa có thông tin chính xác hơn.

Trigger ghi nhật ký cùng transaction khi gửi hồ sơ, gửi lại hồ sơ, quyết định duyệt studio/workshop và thay đổi xác minh. Nhật ký lưu tên người thực hiện và tên nội dung tại thời điểm hành động. Migration đưa các quyết định đã được lưu trước đây vào nhật ký; không tạo hoạt động giả cho dữ liệu không có lịch sử.

Các trang Người dùng, Đặt chỗ và Báo cáo có API danh sách và hành động quản trị riêng, không chỉ đọc. Trang Tổng quan dẫn tới các màn hình đó, không thay thế nghiệp vụ xử lý; xem admin-users, admin-bookings và content-reports.

Số liệu được lưu cache 30 giây, có nút Làm mới và được invalidate sau các quyết định admin liên quan. Biểu đồ Recharts tải riêng khi mở Tổng quan, dùng màu primary; có Skeleton, thông báo lỗi và trạng thái chưa có hoạt động/đặt chỗ.
