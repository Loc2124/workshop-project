# Nội dung nổi bật trên trang chủ

Trang `/admin/noi-dung` có hai tab Studio nổi bật (tối đa 6) và Workshop nổi bật (tối đa 8). Combobox tìm theo tên, workshop tìm thêm tên studio; chỉ trả mục đủ điều kiện công khai. Danh sách kéo thả bằng chuột, cảm ứng hoặc bàn phím, có nút gỡ. Mọi chỉnh sửa chỉ nằm trong bản nháp đến khi bấm Lưu thay đổi; chưa đổi thì nút bị khóa. Bỏ thay đổi và tải lại có xác nhận.

Migration `024_featured_items.sql` tạo bảng `featured_items(type,target_id,sort_order)` với khóa chính chống trùng theo loại/đối tượng và unique theo loại/thứ tự. Constraint thứ tự giới hạn số mục 6/8. Bật RLS, không cấp quyền anon/authenticated truy cập trực tiếp. Lưu cả hai danh sách trong cùng transaction; ghi audit `featured.updated` với danh sách trước/sau.

- `GET /admin/noi-dung`: cấu hình đã lưu và metadata các mục, bao gồm cờ eligible. Mục đã ẩn/xóa/tạm ngưng vẫn được hiển thị trong cấu hình với nhãn Không còn công khai để admin có thể gỡ.
- `GET /admin/noi-dung/search?type=studio|workshop&q=...`: tìm tối đa 30 lựa chọn đủ điều kiện.
- `PUT /admin/noi-dung`: studioIds/workshopIds và expected (hai danh sách đã tải ban đầu). Trùng/quá giới hạn trả 422; mục không còn hợp lệ trả 400, không thay đổi cấu hình; cấu hình đã được admin khác sửa trả 409.
- `POST /admin/noi-dung/preview`: nhận hai danh sách và trả dữ liệu trang chủ đã lọc/bù, không lưu cấu hình. Cả bốn endpoint yêu cầu admin.
- `GET /home/featured`: công khai, studio/workshop theo thứ tự đã chọn, tối đa 6/8. Nội dung mới nhất đủ điều kiện tự bù chỗ thiếu và không trùng mục đã chọn; nếu tổng nội dung đủ điều kiện ít hơn thì trả đúng số thực tế.

Studio phải approved, không phải bản nháp, không bị ẩn và đủ hồ sơ. Workshop phải approved + visibility active và studio của workshop cũng đạt điều kiện trên. Workshop chưa có slot vẫn có thể được giới thiệu; thẻ và trang chi tiết thể hiện lịch thực tế. Session trả về chỉ gồm slot tương lai scheduled còn chỗ, đã giải phóng giữ chỗ hết hạn theo logic booking có sẵn.

Nút Xem trước trang chủ mở tab mới chứa `featuredPreview=<uuid>`. Bản nháp ID được lưu trong localStorage cùng origin và hạn 15 phút, endpoint xem trước vẫn kiểm tra admin. Query cache bản xem trước tách khỏi bản công khai. Bản nháp không được gửi vào cấu hình featured_items và không làm thay đổi nội dung công khai. Sau Lưu thay đổi, cache catalog được invalidate.

Trang chủ dùng endpoint nổi bật cho cả hai khu, không lấy thứ tự từ danh sách cố định hoặc tự xếp hạng trong trình duyệt. Tỉnh/thành trên hero tiếp tục dùng cho tìm kiếm; danh sách nổi bật là cấu hình chung toàn trang chủ. Module quản trị và dnd-kit được lazy-load, không đưa mã kéo thả vào bundle trang khách.
