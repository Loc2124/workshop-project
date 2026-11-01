# Đặc tả API (khởi điểm — cập nhật khi triển khai)

Tiền: VND số nguyên. Thời gian: ISO 8601. Lỗi trả dạng `{ "error": { "code": "...", "message": "..." } }`.

## Xác thực

| Method | Đường dẫn      | Vai       | Ghi chú      |
| ------ | -------------- | --------- | ------------ |
| POST   | /auth/register | công khai | Tạo customer |
| POST   | /auth/login    | công khai | Trả token    |
| GET    | /me            | đăng nhập |              |

## Khách hàng

| Method | Đường dẫn             | Mô tả                                                                                                                                            |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | /workshops            | Lọc: `date_from`, `date_to`, `price_min`, `price_max`, `province_id`, `area_ids` (lặp lại để chọn nhiều khu vực), `category`, `level` (`beginner | intermediate | all`), `audience`(một giá trị khớp phần tử trong audience); phân trang`page`, `page_size`(mặc định 1, 20; tối đa 100). Trả`{ items, pagination: { page, pageSize, total } }`. Địa điểm được lọc qua studio của workshop |
| POST   | /search               | Body: `{ filters, need_text }` → danh sách đã lọc cứng rồi xếp hạng; ghi `search_logs`                                                           |
| GET    | /provinces            | Danh mục tỉnh/thành có xưởng đang hiển thị, kèm số lượng kết quả                                                                                 |
| GET    | /provinces/:id/areas  | Khu vực tùy chọn của tỉnh/thành có xưởng, kèm số lượng kết quả                                                                                   |
| GET    | /studios/:id          | Thông tin xưởng đã duyệt và workshop có buổi còn chỗ                                                                                             |
| GET    | /workshops/:id        | Chi tiết workshop đã duyệt của studio đã duyệt + các buổi `scheduled` tương lai còn chỗ                                                          |
| POST   | /bookings             | Body: `{ session_id, quantity }` → giữ chỗ + tạo thanh toán; trả `{ booking, checkout_url }`                                                     |
| GET    | /bookings/:id         | Chỉ chủ đơn                                                                                                                                      |
| GET    | /me/bookings          | Lịch sử                                                                                                                                          |
| GET    | /bookings/:id/tickets | Vé của đơn đã `paid`                                                                                                                             |
| POST   | /bookings/:id/review  | Mức 2. `{ rating, comment }`                                                                                                                     |

## Thanh toán

| Method | Đường dẫn                        | Mô tả                                                                        |
| ------ | -------------------------------- | ---------------------------------------------------------------------------- |
| POST   | /webhooks/payos                  | Công khai nhưng xác thực chữ ký; idempotent                                  |
| GET    | /payment/return, /payment/cancel | Trang trả về cho khách (chỉ hiển thị; **không** dùng để xác nhận thanh toán) |

Không có endpoint để khách chủ động hủy booking trong phạm vi hiện tại. `GET /payment/cancel` chỉ là trang quay về từ checkout; booking `pending` vẫn được giải phóng theo thời hạn giữ chỗ, trừ khi webhook hợp lệ xác nhận thanh toán thất bại/hủy.

## Studio (mọi truy vấn quản lý phải kiểm tra thành viên theo studio_id + user_id)

| Method | Đường dẫn                                     | Mô tả                                                                                                      |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| POST   | /studios                                      | Tạo studio chờ duyệt; tỉnh/thành lấy từ danh mục, khu vực tùy chọn và phải thuộc tỉnh/thành đã chọn        |
| GET    | /studios/:studioId/workshops                  | Danh sách workshop của studio thành viên                                                                   |
| POST   | /studios/:studioId/workshops                  | Owner tạo workshop và đặt giá cơ sở                                                                        |
| PATCH  | /studios/:studioId/workshops/:id              | Owner/staff sửa nội dung; chỉ owner đổi giá                                                                |
| POST   | /studios/:studioId/workshops/:id/sessions     | Owner tạo buổi và có thể đặt giá riêng; staff tạo buổi theo giá cơ sở                                      |
| PATCH  | /studios/:studioId/sessions/:id               | Sửa lịch/giá/sức chứa; không giảm sức chứa dưới số đã giữ/bán hoặc đổi giá khi có booking `pending`/`paid` |
| POST   | /studios/:studioId/sessions/:id/cancel        | Hủy buổi; booking `pending` chuyển `cancelled`, booking `paid` chuyển `refund_needed`                      |
| GET    | /studios/:studioId/sessions/:id/registrations | Danh sách đăng ký (triển khai cùng booking)                                                                |
| GET    | /studios/:studioId/revenue                    | Mức 2                                                                                                      |
| POST   | /studios/:studioId/tickets/check-in           | Mức 3                                                                                                      |

Các endpoint studio trả `404` nếu tài nguyên không tồn tại hoặc người dùng không phải thành viên studio, để không làm lộ dữ liệu của studio khác. Thành viên `staff` được xem danh sách và vận hành nội dung/lịch workshop/session; chỉ `owner` được tạo workshop, đặt hoặc thay đổi giá. Khi staff tạo buổi mà không gửi giá, hệ thống dùng giá cơ sở của workshop. Workshop mới có trạng thái `pending`; sửa workshop đã duyệt đưa trạng thái về `pending` để admin duyệt lại.

Khi tạo studio, `province_id` phải tồn tại trong danh mục; `area_id` nếu có phải thuộc tỉnh/thành đó. Workshop không nhận địa điểm riêng mà kế thừa địa điểm từ studio. Hồ sơ cũ chưa có tỉnh/thành phải được xác minh và cập nhật trước khi được đưa vào kết quả lọc; không tự suy đoán từ địa chỉ. Dữ liệu phạm vi toàn quốc được ra mắt lần lượt từng thành phố.

## Quản trị

| Method | Đường dẫn                              | Mô tả                                                     |
| ------ | -------------------------------------- | --------------------------------------------------------- |
| GET    | /admin/studios, /admin/workshops       | Lọc theo trạng thái                                       |
| PATCH  | /admin/studios/:id/status              | `pending                                                  | approved | rejected` |
| PATCH  | /admin/workshops/:id/status            | Như trên                                                  |
| GET    | /admin/bookings, /admin/webhook-events | Theo dõi; có lọc `refund_needed`, `signature_valid=false` |

## Dịch vụ ranker (nội bộ)

`POST {RANKER_URL}/rank` — xem `docs/05-ranking-spec.md`.

### Quy ước thời gian

- `date_from` và `date_to` nhận ngày lịch `YYYY-MM-DD`, tính theo `Asia/Ho_Chi_Minh` (UTC+7); khoảng lọc là nửa mở `[date_from 00:00, date_to + 1 ngày 00:00)`.
- API tạo/sửa buổi chỉ nhận thời điểm ISO 8601 có độ lệch múi giờ. DB lưu `timestamptz`; web định dạng qua helper dùng chung đặt `timeZone: 'Asia/Ho_Chi_Minh'`.
