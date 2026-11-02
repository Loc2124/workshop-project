# Đặc tả API (khởi điểm — cập nhật khi triển khai)

Tiền: VND số nguyên. Thời gian: ISO 8601. Lỗi trả dạng `{ "error": { "code": "...", "message": "..." } }`.

## Xác thực

Đăng ký yêu cầu mật khẩu 12–128 ký tự, có chữ hoa, chữ thường, chữ số và ký tự đặc biệt (dấu câu hoặc ký hiệu; khoảng trắng không tính). Web và API dùng chung schema, chặn mật khẩu phổ biến và mật khẩu chứa email/tên đăng nhập/họ tên. Quy tắc mới không áp dụng cho đăng nhập tài khoản cũ.

Trước khi tạo tài khoản, API kiểm tra mật khẩu bị lộ qua [Have I Been Pwned range API](https://haveibeenpwned.com/API/v3#SearchingPwnedPasswordsByRange), chỉ gửi 5 ký tự đầu của SHA-1 kèm padding; không gửi mật khẩu gốc hoặc toàn bộ hash. Mật khẩu vẫn được lưu bằng Argon2. Mật khẩu đã lộ trả `422 PASSWORD_COMPROMISED`; khi dịch vụ lỗi, timeout 5 giây hoặc trả dữ liệu không hợp lệ, trả `503 SERVICE_UNAVAILABLE` và không tạo tài khoản. Môi trường triển khai cần cho phép HTTPS đến `api.pwnedpasswords.com`.

| Method | Đường dẫn      | Vai            | Ghi chú                                                               |
| ------ | -------------- | -------------- | --------------------------------------------------------------------- |
| POST   | /auth/register | công khai      | Tạo customer                                                          |
| POST   | /auth/login    | công khai      | Set access cookie 15 phút và refresh cookie 14 ngày                   |
| POST   | /auth/refresh  | refresh cookie | Xoay refresh token và cấp access token mới                            |
| POST   | /auth/logout   | công khai      | Thu hồi phiên theo cookie và xóa cả hai cookie; trả 204               |
| GET    | /me            | đăng nhập      | Trả role hiện tại từ database                                         |
| GET    | /me/studios    | đăng nhập      | Danh sách studio user hiện tại là thành viên, kèm vai trò theo studio |

Access token là JWT trong cookie HttpOnly; refresh token ngẫu nhiên chỉ lưu dạng hash trong `auth_sessions`. Mỗi request bảo vệ kiểm tra session còn hiệu lực và role hiện tại. Logout thu hồi riêng session hiện tại; token refresh đã xoay không dùng lại được. Chưa có API đổi mật khẩu hoặc khóa tài khoản; nếu thêm, phải thu hồi session hiện hành theo chính sách tương ứng.

## Khách hàng

| Method | Đường dẫn             | Mô tả                                                                                                                                            |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | /workshops            | Lọc: `date_from`, `date_to`, `price_min`, `price_max`, `province_id`, `area_ids` (lặp lại để chọn nhiều khu vực), `category`, `level` (`beginner | intermediate | all`), `audience`(một giá trị khớp phần tử trong audience); phân trang`page`, `page_size`(mặc định 1, 20; tối đa 100). Trả`{ items, pagination: { page, pageSize, total } }`. Địa điểm được lọc qua studio của workshop |
| POST   | /search               | Body: `{ filters, need_text }` → danh sách đã lọc cứng rồi xếp hạng; ghi `search_logs`                                                           |
| GET    | /provinces            | Danh mục tỉnh/thành có studio đang hiển thị; `include_empty=true` trả toàn bộ tỉnh/thành cho form đăng ký studio, kể cả nơi chưa có kết quả      |
| GET    | /provinces/:id/areas  | Khu vực tùy chọn của tỉnh/thành có studio, kèm số lượng kết quả                                                                                  |
| GET    | /studios/:id          | Thông tin studio đã duyệt và workshop có buổi còn chỗ                                                                                            |
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

Hồ sơ bậc 1 hiện bắt buộc cả `contactPhone`, `contactEmail`, 3–8 `photoIds` đã upload và xác nhận cho đúng studio. Luồng mới: `POST /studios/drafts` cấp ID và owner; `POST /images/upload-url` nhận `{studioId,workshopId?,byteSize}`; frontend PUT WebP vào signed URL rồi gọi `POST /images/:id/complete`; cuối cùng `POST /studios` gửi `draftStudioId` cùng các trường hồ sơ. `GET /images?studioId=...` và `DELETE /images/:id` chỉ dành cho owner; backend kiểm tra cả cặp studio/workshop. `PATCH /studios/:studioId/evidence` bổ sung hồ sơ cũ hoặc gửi bộ ảnh/liên hệ thay thế, đưa về pending và thu hồi xác minh. Draft không xuất hiện trong hàng chờ admin, quản lý thông thường hoặc catalog. `facebookUrl`, `instagramUrl`, `googleMapsUrl` là tùy chọn. Xem `docs/studio-images.md` cho hợp đồng và cách dọn file.

Workshop nhận thêm `depositPercent` là số nguyên 0–30, chỉ owner được chỉnh; mức lớn hơn 0 chỉ hợp lệ khi studio bậc 2 và hồ sơ đầy đủ. Bỏ qua trường này khi tạo mới: server dùng 20 nếu đủ điều kiện, ngược lại 0. DTO quản lý có tỷ lệ cấu hình và `effectiveDepositPercent`; DTO công khai chỉ dùng tỷ lệ có hiệu lực, bằng 0 khi mất điều kiện. Luồng thanh toán thực tế chưa triển khai.

Bậc tin cậy: `trustLevel=unapproved` khi hồ sơ chưa duyệt/bị từ chối; `approved` là bậc 1, `verified` là bậc 2. DTO studio công khai chỉ trả bậc, không trả lịch sử hoặc danh tính người xác minh. `/me/studios` trả bậc hiện tại; `/admin/studios` có thêm `verificationHistory` riêng tư. Admin cấp/thu hồi bằng `PATCH /admin/studios/:id/verification`: `{ verified: true, method: "identity_address" | "business_registration", confirmed: true }` hoặc `{ verified: false, reason: "..." }` (1–500 ký tự). Chỉ áp dụng với studio đã duyệt; thao tác lặp/xung đột trả 409. Đổi trạng thái studio khỏi approved tự thu hồi xác minh và ghi lịch sử. API này không nhận giấy tờ, không thay chính sách cọc hoặc thứ hạng tìm kiếm.

`POST /studios` hiện nhận các trường camelCase của hồ sơ (`name`, `description`, `provinceId`, `areaId`, `address`), cùng `categoryIds` cho danh sách loại workshop không rỗng/không trùng. Khi danh sách có `other`, bắt buộc gửi `proposedCategoryName` (2–80 ký tự); đề xuất chỉ được gửi kèm lựa chọn `other`. `categoryId` vẫn được hỗ trợ cho client cũ, mặc định `other` nếu thiếu. Tạo studio, lưu các loại và membership owner trong cùng transaction. API tạo studio, `/me/studios` và DTO admin trả đề xuất riêng tư; DTO công khai không trả. Duyệt studio có đề xuất sẽ đồng thời tạo/dùng lại danh mục active và thay lựa chọn `other` trong cùng transaction; từ chối giữ đề xuất và không tạo danh mục.

| Method | Đường dẫn                                     | Mô tả                                                                                                                                            |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | /studios                                      | Tạo studio chờ duyệt; tỉnh/thành lấy từ danh mục, khu vực tùy chọn và phải thuộc tỉnh/thành đã chọn                                              |
| GET    | /studios/:studioId/workshops                  | Danh sách workshop của studio thành viên                                                                                                         |
| GET    | /studios/:studioId/sessions                   | Danh sách buổi và workshop tương ứng của studio thành viên                                                                                       |
| POST   | /studios/:studioId/workshops                  | Owner tạo workshop và đặt giá cơ sở                                                                                                              |
| PATCH  | /studios/:studioId/workshops/:id              | Owner/staff sửa nội dung; chỉ owner đổi giá                                                                                                      |
| POST   | /studios/:studioId/workshops/:id/sessions     | Owner tạo buổi và có thể đặt giá riêng; staff tạo buổi theo giá cơ sở                                                                            |
| PATCH  | /studios/:studioId/sessions/:id               | Chỉ sửa buổi `scheduled` chưa bắt đầu; không đổi lịch/giá khi có booking `pending`/`paid`/`refund_needed`; sức chứa không thấp hơn số đã giữ/bán |
| POST   | /studios/:studioId/sessions/:id/cancel        | Hủy buổi; booking `pending` chuyển `cancelled`, booking `paid` chuyển `refund_needed`                                                            |
| GET    | /studios/:studioId/sessions/:id/registrations | Danh sách đăng ký (triển khai cùng booking)                                                                                                      |
| GET    | /studios/:studioId/revenue                    | Mức 2                                                                                                                                            |
| POST   | /studios/:studioId/tickets/check-in           | Mức 3                                                                                                                                            |

Các endpoint studio trả `404` nếu tài nguyên không tồn tại hoặc người dùng không phải thành viên studio, để không làm lộ dữ liệu của studio khác. Thành viên `staff` được xem danh sách và vận hành nội dung/lịch workshop/session; chỉ `owner` được tạo workshop, đặt hoặc thay đổi giá. Khi staff tạo buổi mà không gửi giá, hệ thống dùng giá cơ sở của workshop. Workshop mới có trạng thái `pending`; sửa workshop đã duyệt đưa trạng thái về `pending` để admin duyệt lại.

Session `cancelled`, `completed` hoặc đã bắt đầu là bất biến. Với session `scheduled` chưa bắt đầu, owner/staff được sửa lịch và sức chứa; chỉ owner được đổi giá. Lịch/giá bị khóa khi có booking `pending`, `paid` hoặc `refund_needed`; capacity có thể tăng/giảm nhưng không thấp hơn `seats_held + seats_sold`. Kiểm tra trạng thái, booking và cập nhật chạy trong transaction sau khi khóa session.

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
