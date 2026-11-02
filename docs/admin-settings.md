# Cài đặt hệ thống

`/admin/cai-dat` dùng shadcn Form và ba Card: Hồ sơ studio, Hỗ trợ, Chính sách đặt lịch. Form dùng Zod từ `packages/shared/src/settings.ts`, báo lỗi tại trường, khóa lưu khi chưa đổi/không hợp lệ/đang gửi. Lỗi tải có thử lại; xung đột phiên bản giữ bản đang sửa và cho phép bỏ bản sửa để tải lại.

## Dữ liệu và API

Migration `027_site_settings.sql` tạo đúng một bản ghi `settings(key='site', value jsonb, updated_by, updated_at)`. Mặc định:

| Nhóm | Giá trị |
|---|---|
| Studio | Tối thiểu 3, tối đa 8 ảnh; tối đa 10 MB/ảnh |
| Hỗ trợ | 1900 8889; 8:30–21:00; hotro@openslot.vn |
| Đặt lịch | Hủy trước 24 giờ; tối đa 5 buổi sắp tới mỗi tài khoản |

- `GET /settings`: dữ liệu công khai cần cho form/footer; không có người cập nhật hoặc phiên bản quản trị.
- `GET /admin/cai-dat`: cài đặt, `version`, `updatedAt`; yêu cầu admin.
- `PUT /admin/cai-dat`: `{settings, expectedVersion}`; yêu cầu admin. Xung đột trả 409.

Mỗi lần lưu thành công ghi `settings.updated`, target `settings/site`, JSON trước/sau bằng `writeAuditLog` cùng transaction. Request không hợp lệ hoặc xung đột không ghi log. Các response không được HTTP cache. Frontend giữ cache trong một phút, cập nhật ngay trong phiên admin vừa lưu; backend luôn đọc database khi kiểm tra chính sách.

## Phạm vi áp dụng

Schema hồ sơ studio có factory theo chính sách hiện hành. Form đăng ký, chỉnh sửa minh chứng, bộ đếm ảnh, API gửi hồ sơ, API duyệt và hàm PostgreSQL `studio_profile_complete` cùng đọc chính sách. Bản nháp có thể giữ tối đa 20 ID ảnh để không mất ảnh khi mức cấu hình vượt 8. Tăng số ảnh tối thiểu hoặc giảm tối đa có thể làm hồ sơ hiện tại không còn đủ điều kiện; hệ thống không tự xóa ảnh hoặc đổi trạng thái studio.

Ảnh gốc được frontend kiểm tra dung lượng và nén WebP, cạnh dài tối đa 1600 px. Backend kiểm tra cả dung lượng khai báo và số byte thực khi xác nhận upload. Bộ nén ưu tiên dưới 1 MB để tiết kiệm, nhưng có thể dùng bản lớn hơn nếu vẫn nằm trong giới hạn cấu hình. Bucket có trần hạ tầng 20 MB, WebP, đọc công khai; ứng dụng áp giới hạn thấp hơn theo cài đặt. Chạy `npm run storage:setup` khi triển khai migration để nâng bucket cũ từ 1 MB. Ảnh đính kèm báo cáo vẫn dùng giới hạn riêng 1 MB.

Footer, nội dung popup hỗ trợ/chính sách đặt lịch, trang Giới thiệu và Dành cho nghệ nhân đọc thông tin hỗ trợ chung. Giá trị mặc định ở shared được dùng trong lúc frontend tải cấu hình; form gửi hồ sơ/upload chỉ hoạt động khi tải cấu hình thành công.

## Chính sách đặt lịch

`maxActiveSlots` tính số session khác nhau sắp diễn ra, đang scheduled, có booking pending/confirmed và thanh toán pending/paid. Không tính booking hủy/hoàn tất, session đã qua/hủy hoặc lượt giữ chỗ pending hết hạn. Số người của một booking là giới hạn riêng, không bị đổi bởi cấu hình này.

Trigger database khóa hàng user để chống hai yêu cầu đồng thời vượt giới hạn. Khi giảm mức cấu hình, booking cũ được giữ nguyên; xác nhận/thanh toán booking vốn đang hoạt động không tiêu thêm slot. Vượt mức trả lỗi có mã `BOOKING_SLOT_LIMIT`, được API chuyển thành 409 và thông báo rõ.

`POST /me/bookings/:id/cancel` nhận `{status:'cancelled', expectedStatus, reason}` (lý do 10–1000 ký tự). Chỉ chủ booking được hủy và phải còn trước mốc `cancellationHours`; 0 vẫn yêu cầu buổi chưa bắt đầu. Session được khóa trước booking; trả chỗ, vô hiệu vé, cập nhật trạng thái, thông báo và nhật ký cùng transaction. Booking đã trả tiền chuyển `refund_needed`, không tự khẳng định đã hoàn tiền. Admin có thể hủy ngoài mốc này qua API admin với lý do. Trang đặt lịch hiện vẫn nhận API tạo booking qua `onBook`; chưa có checkout khách hoàn chỉnh, nhưng các lần tạo booking trong database đã chịu giới hạn mới.
