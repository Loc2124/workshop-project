# Quản lý danh mục workshop

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Trang `/admin/danh-muc` dùng bảng shadcn và dnd-kit; hỗ trợ chuột, cảm ứng và bàn phím (Space chọn, mũi tên di chuyển, Space thả, Escape hủy). “Khác” có ID cố định `other`, luôn cuối và không được ẩn/đổi tên/đổi slug. Mục đang kéo được lưu tự động; lỗi thì tải lại thứ tự từ server.

Migration `022_category_management.sql` thêm `categories.is_visible`, giữ riêng trạng thái xét duyệt `active/pending`. Danh mục mặc định vẫn là Gốm, Nến, Tranh, Hoa, Nước hoa, Phụ kiện, Khắc dấu, Xà phòng, Terrazzo, Khác từ DB. Không reseed hoặc ghi đè loại do admin tạo. ID không thay đổi khi sửa tên/slug; slug mới tự sinh không dấu trên form và cho sửa, slug trùng trả 409.

- `GET /admin/danh-muc`: toàn bộ loại, trạng thái hiển thị, thứ tự và số workshop tham chiếu (tất cả trạng thái workshop).
- `POST /admin/danh-muc`: tên và slug; tạo ID riêng, trạng thái active, thêm trước Khác.
- `PATCH /admin/danh-muc/:id`: sửa tên/slug, giữ tham chiếu studio/workshop.
- `PATCH /admin/danh-muc/:id/visibility`: `{visible:boolean}`; hiện lại loại pending đồng thời xác nhận loại đó thành active.
- `PATCH /admin/danh-muc/order`: `{ids,expectedIds}` chứa đủ ID, không trùng, Khác ở cuối. Transaction khóa chung với các thao tác tạo/sửa/hiện/ẩn và duyệt đề xuất; danh sách cũ trả 409, thứ tự sai trả 400.
- Không hỗ trợ xóa vật lý; `DELETE` trả 400 hướng dẫn ẩn, kể cả loại chưa có workshop. FK giữ nguyên mọi tham chiếu.

`GET /categories` đọc cùng bảng, trả metadata các loại active và Khác theo thứ tự admin; có `isVisible`. Metadata của loại bị ẩn vẫn trả để hiển thị đúng tên/ảnh cho workshop đã gắn loại. Các lựa chọn đăng ký studio và lọc Khám phá chỉ lấy `isVisible !== false`; không dùng danh sách cố định dự phòng khi API lỗi, có tải lại. Khác luôn cuối. API chặn chọn loại ẩn cho studio/workshop mới; workshop cũ được giữ loại ẩn khi chỉnh sửa chính workshop đó.

Form đăng ký và bộ lọc Khám phá đều bắt buộc tải API ngay cả ở chế độ dữ liệu demo. Khám phá không còn tải toàn bộ workshop để dựng danh mục. Cache metadata riêng giữ nhãn cho dữ liệu đã tồn tại; danh sách lựa chọn và slug URL chỉ nhận loại đang hiện. Cache danh mục/catalog được invalidate sau thao tác admin; module kéo thả được lazy-load ở route admin.

Các thao tác admin ghi audit cùng transaction. Vì ID danh mục là text, audit dùng UUID ổn định từ MD5 của ID và lưu ID gốc trong reason; hoạt động danh mục trên Tổng quan dẫn về `/admin/danh-muc`.
