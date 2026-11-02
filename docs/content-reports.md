# Báo cáo nội dung

Trang `/admin/bao-cao` (alias `/admin/reports`) dùng DataTable, mặc định Mới; có các tab Tất cả/Mới/Đang xử lý/Đã xử lý/Bỏ qua và lọc studio/workshop/đánh giá. Sheet 640px có nội dung, bằng chứng, liên kết đối tượng và ghi chú nội bộ nối tiếp, kèm người viết/thời gian.

Migration `023_content_reports.sql` chuyển dữ liệu `content_reports` sang bảng `reports`, đổi reporter_id/handled_by/handled_at, bổ sung target_type/target_id/detail và trạng thái new/in_progress/resolved/dismissed. Giữ view đọc tương thích `content_reports`; Tổng quan đếm new và in_progress từ bảng mới. UNIQUE(reporter_id,target_type,target_id) chặn báo cáo trùng kể cả đồng thời; không cho báo cáo lại sau khi đã xử lý/bỏ qua.

Khách phải đăng nhập để dùng nút Báo cáo ở trang studio/workshop. Sau đăng nhập quay lại đúng trang và mở Dialog bằng hash `#report`. Lý do chọn từ danh sách, mô tả 10–2000 ký tự, tối đa 4 ảnh. API cũng hỗ trợ target_type review; hiện chưa thêm nút gửi báo cáo riêng trên từng đánh giá. Chỉ cho gửi đối tượng còn hiển thị công khai.

API khách (tài khoản bị khóa bị chặn qua xác thực có sẵn):

- `POST /reports`: targetType, targetId, reason, detail, attachmentIds; trả id/status, không trả ghi chú nội bộ. Trùng trả 409, dữ liệu sai trả 422, đối tượng không công khai trả 404.
- `POST /reports/attachments/upload-url`: byteSize, tạo reservation riêng của người dùng và signed upload URL.
- `POST /reports/attachments/:id/confirm`: kiểm tra ownership, WebP thực tế, kích thước tối đa 1 MB và cạnh dài tối đa 1600px.
- `DELETE /reports/attachments/:id`: chỉ xóa ảnh chưa gắn báo cáo của chính người dùng; xóa cả object thật và bản ghi.

Bucket `report-attachments` là private, khác với studio-images công khai. Frontend resize/nén bằng helper có sẵn rồi upload trực tiếp; service role chỉ ở backend. Ảnh chỉ được gắn khi ready, thuộc người báo cáo và còn hạn. Admin lấy signed read URL 5 phút; Sheet làm mới sau 4 phút. Không tạo policy anon đọc/ghi, không dùng public URL cho bằng chứng. Route dữ liệu báo cáo đặt Cache-Control no-store. Cấu hình bucket: `npx tsx scripts/report-storage-setup.ts`. Dọn ảnh bỏ dở trên 24 giờ: `npx tsx scripts/report-images-cleanup.ts`; cần lên lịch vận hành riêng, script không xóa ảnh đã gắn báo cáo.

API admin yêu cầu role admin:

- `GET /admin/bao-cao`: page/pageSize/sort/q/status/targetType; rows/total/statusCounts.
- `GET /admin/bao-cao/:id`: thông tin đối tượng/người gửi, ảnh ký và ghi chú nội bộ.
- `POST /admin/bao-cao/:id/notes`: body 2–3000 ký tự; ghi chú và audit cùng transaction, không có API công khai đọc.
- `PATCH /admin/bao-cao/:id/action`: action start/hide/suspend/dismiss/resolve, expectedStatus và reason 10–1000 ký tự. Dialog bắt buộc nhập lý do cho hide/suspend/dismiss; start/resolve ghi lý do mặc định rõ ràng.

Start chuyển new → in_progress. Hide/suspend/resolve kết thúc ở resolved, dismiss kết thúc ở dismissed. Đã kết thúc chỉ bổ sung ghi chú, không lặp hành động; dữ liệu cũ trả 409. Thay đổi đối tượng, trạng thái báo cáo, handled_by/handled_at, ghi chú và audit nằm trong cùng transaction. Lỗi thao tác thì rollback toàn bộ.

Ẩn workshop dùng visibility_status có sẵn; ẩn đánh giá đặt reviews.is_hidden và loại khỏi API `/workshops/:id/reviews`. Ẩn studio dùng studios.is_hidden, giữ riêng trạng thái duyệt. Mọi truy vấn danh mục/chi tiết công khai đều loại studio bị ẩn, kể cả workshop của studio đó. Admin có thể hiện lại nội dung studio từ Sheet Hồ sơ studio qua `/admin/studios/:id/visibility`.

Tạm ngưng dùng luồng studio suspended hiện có (chỉ studio approved hoặc đã suspended); cập nhật người duyệt/thời gian/lý do, thu hồi xác minh theo quy tắc cũ và thông báo cho chủ studio. Khôi phục studio thực hiện ở quản lý studio; kết thúc báo cáo không tự khôi phục nội dung.
