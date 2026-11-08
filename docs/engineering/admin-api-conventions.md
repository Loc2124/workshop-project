# Quy ước API admin

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Toàn bộ `/admin` được bảo vệ ở router bởi `requireAuth()` rồi `requireRole('admin')`, bao gồm các URL và HTTP method chưa khai báo. Người chưa đăng nhập nhận 401; phiên hợp lệ nhưng không phải admin nhận 403, mã `FORBIDDEN`, thông báo rõ chỉ quản trị viên được truy cập. Vai trò lấy từ phiên đang hoạt động trong database, không tin role cũ trong JWT. Admin truy cập route không tồn tại nhận 404. Response admin dùng `Cache-Control: no-store`.

Giới hạn chống lạm dụng chung: 600 request/phút/IP. Admin có thêm hạn mức riêng 300 request/phút/tài khoản sau khi xác thực quyền; đăng nhập sai vẫn giữ giới hạn riêng 5 lần/15 phút. Khi vượt mức, API trả JSON `RATE_LIMITED` và `Retry-After`; CORS cho frontend đọc header này. Query frontend không tự retry lỗi 4xx/429, hiển thị số giây cần chờ; lỗi mạng/5xx chỉ tự thử lại tối đa một lần. Điều này thay giới hạn cũ 100 request/15 phút vốn quá thấp cho nhiều bảng/số đếm/thông báo cùng dùng dashboard.

## Danh sách

```http
GET /admin/studios?page=1&pageSize=20&sort=createdAt:desc&q=gom&status=all
```

```json
{ "items": [], "total": 0 }
```

- `page`: số nguyên từ 1, mặc định 1, tối đa 1.000.000.
- `pageSize`: số nguyên 1–100, mặc định 20. Không nhận `page_size`.
- `sort`: `field:asc` hoặc `field:desc`, theo allowlist riêng của tài nguyên; thường mặc định `createdAt:desc`.
- `q`: trim, tối đa 200 ký tự; `%`, `_`, dấu gạch chéo được xử lý như ký tự tìm kiếm thông thường.
- `status`: enum theo tài nguyên. Bộ lọc riêng như studio/tỉnh/loại/khoảng ngày vẫn được hỗ trợ.

`total` là tổng số bản ghi khớp toàn bộ bộ lọc, bao gồm trạng thái, trước LIMIT/OFFSET. Danh sách rỗng trả `items: []`, `total: 0`. Ngày, trạng thái, sort, phân trang hoặc query không hợp lệ trả 422. Các khóa sort được ánh xạ sang cột SQL cố định; giá trị tìm kiếm/lọc dùng bind parameters.

Áp dụng cho `studios`, `workshops` (xét duyệt), `workshop` (quản lý hiển thị), `nguoi-dung`, `dat-cho`, `bao-cao`, `nhat-ky`, `danh-muc`, `mau-thong-bao`; cả các danh sách cũ `users`, `bookings`, `reports`, bộ chọn `workshop-studios` và `noi-dung/search` (cần thêm `type=studio|workshop`).

Danh mục mặc định `sortOrder:asc`, trạng thái `all|visible|hidden`; “Khác” luôn cuối. Mẫu thông báo mặc định `key:asc`, chỉ có `status=all`, tổng cộng sáu mẫu cố định. Bộ chọn studio mặc định `name:asc`. Các response cấu hình tổng hợp (`overview`, `cai-dat`, `noi-dung`), chi tiết và metadata bộ lọc không phải endpoint danh sách; giữ cấu trúc theo nghiệp vụ. Response mutation của danh mục/mẫu thông báo giữ payload editor hiện có.

## Đếm tab

```http
GET /admin/studios/counts?q=gom&provinceId=ha-noi
```

```json
{
  "counts": {
    "all": 12,
    "pending": 4,
    "needs_changes": 2,
    "approved": 5,
    "rejected": 1,
    "suspended": 0
  }
}
```

Endpoint `/counts` có ở `studios`, `workshops`, `workshop`, `nguoi-dung`, `dat-cho`, `bao-cao`, `danh-muc`, `users`, `bookings`, `reports`. Giữ cùng phạm vi tìm kiếm/bộ lọc, bỏ qua lựa chọn tab và phân trang khi tính số đếm. Endpoint chỉ chạy truy vấn tổng hợp, không đọc danh sách, ảnh hoặc lịch sử từng bản ghi. Số đếm vai trò và tab tài khoản bị khóa có thể chồng lắp: một khách bị khóa thuộc cả hai tab, nhưng chỉ tính một lần trong `all`.

Frontend dùng factory `createAdminTableFetcher`: GET danh sách đọc `items/total`, GET đếm đọc `counts`. DataTable cache số đếm theo `q` và bộ lọc; chuyển trang, pageSize, sort hoặc tab không tạo bộ đếm mới. Mutation vẫn invalidate query prefix `management`, vì vậy cả bảng và số đếm được làm mới. Lỗi đếm có nút thử lại riêng và không làm mất bảng đã tải được. Nhật ký và các editor không có tab trạng thái không gọi `/counts`.

Editor sắp xếp danh mục lấy các trang 100 bản ghi để đủ tập thứ tự trước khi kéo thả; không dùng danh sách để tính số đếm tab.

## Không xóa cứng

Các tài nguyên nghiệp vụ admin đã dùng trạng thái: studio tạm ngưng/ẩn, workshop ẩn/gỡ, tài khoản bị khóa, danh mục bị ẩn, báo cáo xử lý/bỏ qua, đặt chỗ hủy. Không thêm API xóa vật lý các tài nguyên này; DELETE danh mục tiếp tục bị từ chối với hướng dẫn dùng ẩn. Nhật ký bất biến, không có API sửa/xóa.

Migration `028_admin_soft_selections.sql` bổ sung `deleted_at` cho `featured_items` và `studio_categories`. Gỡ mục nổi bật hoặc bỏ lựa chọn “Khác” khi duyệt đề xuất chỉ đánh dấu thời gian; đọc/lọc công khai và admin chỉ lấy quan hệ còn hiệu lực. Chọn lại cùng đối tượng khôi phục hàng cũ bằng UPSERT, không tạo bản trùng. Thứ tự nổi bật chỉ unique trong tập chưa xóa mềm. Việc thay lựa chọn vẫn cùng transaction và audit với hành động gốc.

Đây là thay đổi hợp đồng GET danh sách: client cũ đọc `rows`, `studios`, `workshops`, `categories`, `templates`, `pagination` hay `statusCounts` cần chuyển sang `items/total` và `/counts`. Frontend trong cùng repository đã được cập nhật.
