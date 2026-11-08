# Đăng workshop và hậu kiểm

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Studio phải có trạng thái `approved` để tạo hoặc cập nhật workshop. Xác minh không phải điều kiện đăng bài. Mọi workshop mới và lần sửa đều có `status=approved` ngay; không có bước admin duyệt workshop, kể cả bài có cọc hoặc thay đổi tỷ lệ cọc. Quyền ẩn/gỡ của admin độc lập với trạng thái này.

Chủ studio chọn `publicationStatus: draft | published`. API trả `hidden` nếu admin đã ẩn/gỡ bài. Quyền ẩn của admin (`visibility_status`) độc lập với lựa chọn của studio; sửa bài không khôi phục nội dung bị ẩn. Catalog, chi tiết, nội dung nổi bật, đánh giá và xác thực đối tượng báo cáo đều loại bản nháp. Để xuất hiện trong catalog, workshop vẫn cần buổi tổ chức còn chỗ và hồ sơ studio hợp lệ.

Mỗi lần tạo/sửa workshop thành công ghi một sự kiện `workshop.created` hoặc `workshop.updated` trong cùng transaction. Nhật ký giữ snapshot trước/sau. Khách báo cáo từ trang workshop; admin xử lý trong `/admin/bao-cao`, có thể ẩn nội dung mà không xóa dữ liệu.

Thay đổi tên studio, địa chỉ, ảnh bìa (ảnh đầu tiên) hoặc QR nhận tiền đưa studio về `pending` và thu hồi xác minh. Studio tạm ngưng không được tự nộp hồ sơ để bỏ trạng thái đình chỉ. Thay đổi liên hệ và ảnh bổ sung giữ trạng thái duyệt và xác minh. QR là ảnh đã xác nhận, thuộc studio và do chủ studio tải lên; ảnh đang gắn không được xóa hoặc dọn tự động. Admin xem ảnh QR trong chi tiết hồ sơ trước khi duyệt. Ảnh QR hồ sơ không phải QR thanh toán từng đơn. Đã có thu cọc qua cổng; chưa có đối soát chủ động/chi trả hoặc xác minh tài khoản nhận chi.

Giữ quy tắc nhận cọc hiện tại: chỉ studio đã xác minh với hồ sơ đầy đủ được cấu hình cọc dương. Quy tắc này không tạo hàng chờ duyệt workshop. Bài không nhận cọc của studio đã duyệt được đăng bình thường. Đề xuất danh mục mới được xét riêng; bài thuộc nhóm Khác vẫn được đăng ngay.

Studio xác minh có huy hiệu và được ưu tiên trong sắp xếp đề xuất khi độ liên quan tìm kiếm bằng nhau, trước thời gian buổi gần nhất. Lọc, thứ tự theo giá và thứ tự theo thời gian vẫn theo lựa chọn của khách.

Áp migrations `031` và `032` trước khi chạy phiên bản này. `032_remove_workshop_preapproval.sql` chuyển bài chờ duyệt cũ sang tự đăng, đặt mặc định database là approved, giữ nguyên bản nháp và các quyết định ẩn/gỡ. Bài bị từ chối theo quy trình cũ được chuyển sang ẩn; có nhật ký chuyển đổi. Admin dùng trang hậu kiểm `/admin/workshop`; đường dẫn duyệt cũ chuyển về trang này. Nhãn và bộ lọc admin phân biệt công khai, bản nháp, studio chưa công khai và ẩn/gỡ.
