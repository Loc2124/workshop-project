# Đặc tả API (khởi điểm — cập nhật khi triển khai)

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Tiền: VND số nguyên. Thời gian: ISO 8601. Lỗi trả dạng `{ "error": { "code": "...", "message": "..." } }`.

## Trạng thái hợp đồng

Đường dẫn dưới đây không có tiền tố /api ở createApp. Các dòng đánh dấu Mức 2/3, search/ranker, review, revenue, registrations/check-in là mục tiêu nếu chưa có router tương ứng. Không có endpoint chi hộ/hoàn tự động/chi trả trong mã. Nguồn kiểm tra là apps/api/src/app.ts và từng routes.ts.

### API đặt chỗ/cọc đã có

| Method    | Đường dẫn                                          | Body/quyền và kết quả                                                                                                                   |
| --------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| POST      | /bookings                                          | customer; requestId UUID bắt buộc, sessionId, quantity, paymentChoice tùy chế độ; tạo giữ hoặc xác nhận ngay                            |
| GET       | /bookings/:id, /me/bookings, /bookings/:id/tickets | Chỉ khách sở hữu; vé theo xác nhận chỗ, không đòi trả đủ                                                                                |
| GET       | /bookings/:id/cancellation-quote                   | customer sở hữu; quoteToken, paidAmount, refundDueAmount, retainedAmount, expiresAt, serverNow; không cache                             |
| POST      | /bookings/:id/cancel                               | customer sở hữu; body {quoteToken}; kiểm tra điều kiện và số tiền trước khi hủy toàn đặt chỗ                                            |
| POST      | /bookings/:id/confirm-attendance                   | customer; xác nhận sẽ đến, không phải điểm danh; kiểm tra buổi/hạn nhả                                                                  |
| POST      | /bookings/:id/accept-schedule                      | customer sở hữu; body {scheduleVersion} bắt buộc, đúng phiên bản/hạn mới chấp nhận; lệch/hết hạn 409                                    |
| GET / PUT | /studios/:studioId/payment-settings                | GET thành viên; PUT chủ studio; depositMode, depositPercent, releaseIfUnconfirmed, releaseBeforeMinutes; kiểm tra xác minh/rate/lịch sử |
| GET       | /studios/:studioId/bookings                        | thành viên; tối đa 200 gần nhất, chưa phân trang công việc cũ                                                                           |
| POST      | /studios/:studioId/bookings/:id/confirm-payment    | thành viên; expectedAmount đúng phần còn lại; cho confirmed/completed còn hiệu lực, chặn thu lặp/đơn hủy/khoản hoàn; ghi người thu      |
| GET       | /studios/:studioId/attendance                      | thành viên; thống kê đã ghi nhận                                                                                                        |
| POST      | /studios/:studioId/bookings/:id/attendance         | tương thích đặt chỗ một vé; nhóm nhiều vé phải dùng endpoint từng vé                                                                    |
| POST      | /studios/:studioId/bookings/:id/refund             | chủ studio; amount/reference; chỉ ghi nhận chuyển thủ công đã thực hiện, không chuyển tiền                                              |
| POST      | /workshops/:id/schedule-subscription               | customer; lưu đăng ký, chưa gửi khi có lịch mới                                                                                         |

depositPercent bắt buộc số nguyên 1–50 khi optional/required, none dùng null; workshop override cũng 1–50. Giá trị trên 50 bị từ chối với “Mức cọc tối đa là 50%”; sai kiểu trả hướng dẫn nhập số nguyên. PAYMENT_MIN_AMOUNT không có mức tự gán; lệ thuộc cấu hình môi trường.

Cùng customer và requestId với cùng nội dung trả lại đặt chỗ gốc, không tạo payment/hold mới; nội dung khác trả 409 IDEMPOTENCY_KEY_REUSED. Mã mới cho phép một lượt đặt mới có chủ ý. Replay đặt chỗ đã hết hạn/hủy không phục hồi chỗ hoặc trả liên kết thanh toán. Nếu lượt đầu chưa lưu được liên kết, khách vào trang chi tiết để đồng bộ; chưa có truy vấn cổng phục hồi liên kết.

quoteToken có chữ ký và hạn 5 phút, ràng buộc khách/đặt chỗ, lịch, trạng thái và các số tiền hiện tại. API khóa dữ liệu và dùng giờ DB kiểm tra lại khi hủy. Qua mốc làm đổi tiền hoàn, nhận thêm tiền, đổi lịch, token giả/hết hạn: 409 CANCELLATION_QUOTE_CHANGED, chưa hủy/nhả chỗ; khách phải lấy báo giá mới và xác nhận lại. Client không tự gửi lần hai. Tương thích đường gọi cũ: chưa nhận tiền có thể hủy không token; đã nhận tiền luôn bắt buộc token hợp lệ. Đường hủy cũ dưới /me dùng cùng kiểm tra.

### Chưa có hợp đồng triển khai

Tra cứu/đối soát thanh toán chủ động; lệnh chi hoàn và chi trả, số dư/nạp ví; điểm nhận tiền; miễn nợ và khiếu nại tiền. Báo giá hủy có chữ ký đã có, không thay thế phiên bản chấp nhận đổi lịch. Không tự gọi hoặc ghi vào deploy các endpoint/secret chưa được tạo. Mô hình mục tiêu đọc bảng A–J của policy.

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

Access token là JWT trong cookie HttpOnly; refresh token ngẫu nhiên chỉ lưu dạng hash trong `auth_sessions`. Mỗi request bảo vệ kiểm tra session còn hiệu lực và role hiện tại. Logout thu hồi riêng session hiện tại; token refresh đã xoay không dùng lại được. Chưa có API đổi mật khẩu. Quản trị đã có quản lý khóa tài khoản; mọi endpoint bảo vệ kiểm tra phiên/quyền hiện tại.

## Khách hàng

| Method | Đường dẫn             | Mô tả                                                                                                                                            |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | /workshops            | Lọc: `date_from`, `date_to`, `price_min`, `price_max`, `province_id`, `area_ids` (lặp lại để chọn nhiều khu vực), `category`, `level` (`beginner | intermediate | all`), `audience`(một giá trị khớp phần tử trong audience); phân trang`page`, `page_size`(mặc định 1, 20; tối đa 100). Trả`{ items, pagination: { page, pageSize, total } }`. Địa điểm được lọc qua studio của workshop |
| POST   | /search               | Body: Chưa triển khai hoàn chỉnh; hợp đồng mục tiêu { filters, need_text }, lọc cứng rồi xếp hạng                                                |
| GET    | /provinces            | Danh mục tỉnh/thành có studio đang hiển thị; `include_empty=true` trả toàn bộ tỉnh/thành cho form đăng ký studio, kể cả nơi chưa có kết quả      |
| GET    | /provinces/:id/areas  | Khu vực tùy chọn của tỉnh/thành có studio, kèm số lượng kết quả                                                                                  |
| GET    | /studios/:id          | Thông tin studio đã duyệt và workshop có buổi còn chỗ                                                                                            |
| GET    | /workshops/:id        | Chi tiết công khai giữ ảnh/mô tả/đánh giá khi hết lịch; các buổi có ngày kết thúc, hạn đăng ký và trạng thái                                     |
| POST   | /bookings             | Body: `{ sessionId, quantity, paymentChoice? }`; lựa chọn `deposit` hoặc `in_studio`; trả `{ booking, checkoutUrl, checkoutQrCode? }`            |
| GET    | /bookings/:id         | Chỉ chủ đơn                                                                                                                                      |
| GET    | /me/bookings          | Lịch sử                                                                                                                                          |
| GET    | /bookings/:id/tickets | Vé phát khi đặt chỗ được xác nhận, không đòi trả đủ số tiền tại studio                                                                           |
| POST   | /bookings/:id/review  | Mức 2. `{ rating, comment }`                                                                                                                     |

## Thanh toán

| Method | Đường dẫn                        | Mô tả                                                                        |
| ------ | -------------------------------- | ---------------------------------------------------------------------------- |
| POST   | /webhooks/payos                  | Công khai nhưng xác thực chữ ký; idempotent                                  |
| GET    | /payment/return, /payment/cancel | Trang trả về cho khách (chỉ hiển thị; **không** dùng để xác nhận thanh toán) |

Đã có POST /bookings/:id/cancel; chỉ gửi sau khi khách xác nhận hộp hủy. /payment/cancel là route web quay về, không tự xác nhận tiền hoặc tự hủy.

## Studio (mọi truy vấn quản lý phải kiểm tra thành viên theo studio_id + user_id)

Hồ sơ bậc 1 hiện bắt buộc cả `contactPhone`, `contactEmail`, 3–8 `photoIds` đã upload và xác nhận cho đúng studio. Luồng mới: `POST /studios/drafts` cấp ID và owner; `POST /images/upload-url` nhận `{studioId,workshopId?,byteSize}`; frontend PUT WebP vào signed URL rồi gọi `POST /images/:id/complete`; cuối cùng `POST /studios` gửi `draftStudioId` cùng các trường hồ sơ. `GET /images?studioId=...` và `DELETE /images/:id` chỉ dành cho owner; backend kiểm tra cả cặp studio/workshop. `PATCH /studios/:studioId/evidence` bổ sung hồ sơ cũ hoặc gửi bộ ảnh/liên hệ thay thế, đưa về pending và thu hồi xác minh. Draft không xuất hiện trong hàng chờ admin, quản lý thông thường hoặc catalog. `facebookUrl`, `instagramUrl`, `googleMapsUrl` là tùy chọn. Xem `docs/features/studio-images.md` cho hợp đồng và cách dọn file.

Studio có depositMode none/optional/required và depositPercent null hoặc số nguyên 1–50, không có mức mặc định. Workshop có depositModeOverride và depositPercent để kế thừa/ghi đè. Chỉ studio đủ điều kiện xác minh nhận cọc; đặt chỗ lưu bản chụp chế độ/tỷ lệ/số tiền. Luồng thu cọc/webhook đã có, chi trả và hoàn tự động chưa có.

Bậc tin cậy: `trustLevel=unapproved` khi hồ sơ chưa duyệt/bị từ chối; `approved` là bậc 1, `verified` là bậc 2. DTO studio công khai chỉ trả bậc, không trả lịch sử hoặc danh tính người xác minh. `/me/studios` trả bậc hiện tại; `/admin/studios` có thêm `verificationHistory` riêng tư. Admin cấp/thu hồi bằng `PATCH /admin/studios/:id/verification`: `{ verified: true, method: "identity_address" | "business_registration", confirmed: true }` hoặc `{ verified: false, reason: "..." }` (1–500 ký tự). Chỉ áp dụng với studio đã duyệt; thao tác lặp/xung đột trả 409. Đổi trạng thái studio khỏi approved tự thu hồi xác minh và ghi lịch sử. API này không nhận giấy tờ; mất xác minh làm tỷ lệ hiệu lực bằng 0 cho đặt chỗ mới, không tính lại đơn cũ.

`POST /studios` hiện nhận các trường camelCase của hồ sơ (`name`, `description`, `provinceId`, `areaId`, `address`), cùng `categoryIds` cho danh sách loại workshop không rỗng/không trùng. Khi danh sách có `other`, bắt buộc gửi `proposedCategoryName` (2–80 ký tự); đề xuất chỉ được gửi kèm lựa chọn `other`. `categoryId` vẫn được hỗ trợ cho client cũ, mặc định `other` nếu thiếu. Tạo studio, lưu các loại và membership owner trong cùng transaction. API tạo studio, `/me/studios` và DTO admin trả đề xuất riêng tư; DTO công khai không trả. Duyệt studio có đề xuất sẽ đồng thời tạo/dùng lại danh mục active và thay lựa chọn `other` trong cùng transaction; từ chối giữ đề xuất và không tạo danh mục.

| Method | Đường dẫn                                     | Mô tả                                                                                                                                                               |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | /studios                                      | Tạo studio chờ duyệt; tỉnh/thành lấy từ danh mục, khu vực tùy chọn và phải thuộc tỉnh/thành đã chọn                                                                 |
| GET    | /studios/:studioId/workshops                  | Danh sách workshop của studio thành viên                                                                                                                            |
| GET    | /studios/:studioId/sessions                   | Danh sách buổi và workshop tương ứng của studio thành viên                                                                                                          |
| POST   | /studios/:studioId/workshops                  | Owner tạo workshop và đặt giá cơ sở                                                                                                                                 |
| PATCH  | /studios/:studioId/workshops/:id              | Owner/staff sửa nội dung; chỉ owner đổi giá                                                                                                                         |
| POST   | /studios/:studioId/workshops/:id/sessions     | Owner tạo buổi và có thể đặt giá riêng; staff tạo buổi theo giá cơ sở                                                                                               |
| PATCH  | /studios/:studioId/sessions/:id               | Chỉ sửa buổi chưa bắt đầu; giờ mới trên 12 giờ; tăng phiên bản, hủy chờ cọc và đặt hạn phản hồi; khóa đổi giá khi có đặt chỗ; sức chứa không thấp hơn số đã giữ/bán |
| POST   | /studios/:studioId/sessions/:id/cancel        | Hủy buổi; đặt chỗ đang giữ/xác nhận bị hủy; paid_amount > 0 tạo khoản cần hoàn, không suy từ pending/paid đơn thuần                                                 |
| GET    | /studios/:studioId/sessions/:id/registrations | Danh sách đăng ký (triển khai cùng booking)                                                                                                                         |
| GET    | /studios/:studioId/revenue                    | Mức 2                                                                                                                                                               |
| POST   | /studios/:studioId/tickets/check-in           | Mức 3                                                                                                                                                               |

Các endpoint studio trả `404` nếu tài nguyên không tồn tại hoặc người dùng không phải thành viên studio, để không làm lộ dữ liệu của studio khác. Thành viên `staff` được xem danh sách và vận hành nội dung/lịch workshop/session; chỉ `owner` được tạo workshop, đặt hoặc thay đổi giá. Khi staff tạo buổi mà không gửi giá, hệ thống dùng giá cơ sở của workshop. Workshop mới tự công khai theo điều kiện studio và publication_status; sửa nội dung không đưa về hàng chờ duyệt. Quản trị hậu kiểm bằng visibility_status theo migration 031/032.

Buổi `cancelled`, `completed` hoặc đã bắt đầu không được sửa qua API cập nhật lịch hiện tại. Với buổi `scheduled` chưa bắt đầu, owner/staff được sửa lịch và sức chứa; chỉ owner được đổi giá. Giá bị khóa khi có đặt chỗ liên quan; đổi lịch chỉ khi giờ mới còn trên 12 giờ theo giờ DB. Mỗi lần đổi tăng scheduleVersion, hủy Hold cũ, báo khách đã xác nhận và đặt rescheduleDeadline = min(thông báo+48 giờ, giờ mới−12 giờ). Quá hạn tự hủy/nhả chỗ/ghi hoàn toàn bộ; chưa chuyển tiền tự động. Sức chứa không thấp hơn `seats_held + seats_sold`. Không coi quy tắc cập nhật là giới hạn của mọi thao tác hủy/điều chỉnh quản trị; phần đó phải theo policy riêng.

Khi tạo studio, `province_id` phải tồn tại trong danh mục; `area_id` nếu có phải thuộc tỉnh/thành đó. Workshop không nhận địa điểm riêng mà kế thừa địa điểm từ studio. Hồ sơ cũ chưa có tỉnh/thành phải được xác minh và cập nhật trước khi được đưa vào kết quả lọc; không tự suy đoán từ địa chỉ. Dữ liệu phạm vi toàn quốc được ra mắt lần lượt từng thành phố.

## Quản trị

| Method | Đường dẫn                              | Mô tả                                                     |
| ------ | -------------------------------------- | --------------------------------------------------------- |
| GET    | /admin/studios, /admin/workshops       | Lọc theo trạng thái                                       |
| PATCH  | /admin/studios/:id/status              | pending / approved / rejected                             |
| PATCH  | /admin/workshops/:id/status            | Như trên                                                  |
| GET    | /admin/bookings, /admin/webhook-events | Theo dõi; có lọc `refund_needed`, `signature_valid=false` |

## Dịch vụ ranker (nội bộ)

`POST {RANKER_URL}/rank` — xem `docs/engineering/05-ranking-spec.md`.

### Quy ước thời gian

- `date_from` và `date_to` nhận ngày lịch `YYYY-MM-DD`, tính theo `Asia/Ho_Chi_Minh` (UTC+7); khoảng lọc là nửa mở `[date_from 00:00, date_to + 1 ngày 00:00)`.
- API tạo/sửa buổi chỉ nhận thời điểm ISO 8601 có độ lệch múi giờ. DB lưu `timestamptz`; web định dạng qua helper dùng chung đặt `timeZone: 'Asia/Ho_Chi_Minh'`.

### Hợp đồng đổi giờ đã triển khai ở bước 3

GET /bookings/:id trả scheduleVersion hiện tại, acceptedScheduleVersion, proposedScheduleVersion, bookedStartsAt/bookedEndsAt, reschedulePending, rescheduleDeadline và cancelledAt (nếu có). bookedStartsAt/bookedEndsAt giữ lịch đã đặt/đã đồng ý; chỉ cập nhật khi khách đồng ý đúng phiên bản. POST accept-schedule thiếu phiên bản trả 422; sai phiên bản/quá hạn/không còn hiệu lực trả 409; khách khác trả 404. Gửi lại đúng bản đã đồng ý trả 200 và không ghi nhận lần hai. Xác nhận sẽ đến, ghi nhận thu tại studio và điểm danh bị chặn khi đang chờ đồng ý.

Migration 039 tạo baseline cho thay đổi lịch cũ, hạn không muộn hơn giờ mới trừ 12 giờ; trường hợp đã quá hạn được worker/lượt đọc xử lý. Không phát minh thời điểm chấp nhận cũ. cancelled_at của đơn hủy trước migration có thể null; không đặt lại mốc cũ thành thời điểm triển khai.

### Điểm danh từng vé (4.1)

- GET /studios/:studioId/bookings/:id/tickets: thành viên xem từng vé với attendanceStatus/version, paidAmount/depositAmount/refundDueAmount/refundedAmount/refundHistoryLocked, canMark, giờ buổi/giờ DB.
- POST /studios/:studioId/bookings/:id/tickets/:ticketId/attendance: {status: attended|absent, expectedVersion}. Đã đến từ S; vắng từ S+30 phút; sai quyền 404, sai phiên bản/khóa hoàn 409, dữ liệu sai 422. Gửi lại cùng trạng thái không tạo khoản hoàn/thông báo lần nữa.
- GET /admin/bookings/:id/tickets và POST /admin/bookings/:id/tickets/:ticketId/attendance: chỉ admin. POST thêm reason bắt buộc, refundAction preserve|cancel_pending khi sửa vé có lịch sử hoàn thành đã đến. cancel_pending chỉ dùng cho khoản chưa chuyển; đã chuyển trả 409. Dấu khóa studio và lịch sử thu/hoàn không bị xóa. Không tự tạo khoản phải thu mới.
- POST ghi nhận hoàn thủ công dùng amount = refundDueAmount − refundedAmount; lưu booking_refund_receipts, chặn mã đối chiếu đã dùng. Giữ trạng thái các vé/đặt chỗ còn hiệu lực. Đây chỉ là ghi nhận tiền đã chuyển ngoài hệ thống, không phát lệnh chi.
- Hủy từng chỗ/thay mã cọc đã có ở 4.2, hợp đồng bên dưới.

### Hủy từng chỗ và thay mã cọc (4.2)

| Phương thức | Đường dẫn | Nội dung |
| --- | --- | --- |
| GET | /bookings/:id/seats | Chỗ gốc và tiền/điểm danh/quyền hủy từng chỗ; state active/cancelled/expired |
| POST | /bookings/:id/seats/cancellation-quote | {sequences: số nguyên duy nhất 1–10}; báo giá ký 5 phút ràng buộc chỗ/phiên bản/tiền đã hoàn |
| POST | /bookings/:id/seats/cancel | {sequences, quoteToken}; trả ok, remainingQuantity, checkoutState |
| POST | /bookings/:id/deposit-checkout | Khôi phục liên kết cọc hiện tại nếu còn hạn và còn nhận đăng ký |

Các endpoint chỉ khách sở hữu; người khác 404, dữ liệu sai 422, báo giá cũ/chỗ đã hủy hoặc điều kiện đổi 409. Gửi đồng thời chỉ một lần hủy có hiệu lực. Không có tác dụng chuyển tiền hoàn. checkoutState gồm ready/creating/unknown/unavailable/awaiting_confirmation; unknown không đồng nghĩa tạo thất bại chắc chắn.

GET chi tiết thêm originalQuantity/originalTotalAmount/originalDepositAmount, seatRevision, remainingQuantity, receivedAmount, paymentAllowed, checkoutState. payments có orderCode, checkoutRevision, isCurrent. Chỉ trả URL/QR cho mã hiện tại đủ điều kiện; lịch sử giao dịch đã trả vẫn giữ. refundDueAmount/refundedAmount gồm tiền theo chỗ và các khoản thu thừa. paidAmount/totalAmount/depositAmount mô tả phần chỗ còn lại; receivedAmount lưu tổng thực nhận. Hủy hết giữ lịch sử gốc; remainingQuantity bằng 0.

Khóa buổi → đặt chỗ → chỗ/thanh toán; không gọi cổng trong giao dịch DB. Tạo mã có claim, tra cứu trước thử lại nếu kết quả chưa rõ; mã cũ không ghi đè mã mới. Thông báo thanh toán xác minh số tiền theo hóa đơn gốc, áp dụng vào các chỗ gốc còn hiệu lực. source_event_id chống ghi hoàn dư lặp; giao dịch có providerRef khác trên cùng hóa đơn được xử lý riêng trong luồng hủy một phần. Không suy kết quả từ trang quay về hoặc chỉ từ tra cứu liên kết.

### Xác nhận sẽ đến (4.3)

GET /bookings/:id thêm attendanceConfirmationDeadline (ISO hoặc null). Null có thể do chưa gửi được email, không thuộc diện cần xác nhận, đã xác nhận, đổi giờ chưa đồng ý hoặc không đủ khoảng 2 giờ trước buổi; không thay null bằng mốc studio cấu hình.

POST /bookings/:id/confirm-attendance khóa buổi, xử lý nhả đúng hạn thực tế rồi kiểm tra đặt chỗ. Còn hiệu lực thì 200, gửi lại giữ attendance_confirmed_at ban đầu; sau hạn trả 409 và vẫn commit việc nhả; khách khác 404. Không ghi attendance_status hoặc đánh dấu vé đã đến. Hạn lấy từ attendance_confirmation_deadline(uuid): đúng email delivery_type attendance_confirmation, status sent, sent_at không null, schedule_version và reminder_starts_at khớp buổi hiện tại; max(mốc cấu hình, sent_at + 2 giờ) phải còn trước S.

Email có khóa booking:attendance-confirmation:version, unique theo đặt chỗ/phiên bản. 2xx của EMAIL_DELIVERY_URL chỉ được trả khi dịch vụ thực sự chấp nhận thư; không đồng nghĩa đã vào hộp thư đến/đã đọc. Không backfill email cũ thành bằng chứng. Lỗi có thể thử lại tối đa 5 lần, hết lượt vẫn không được nhả nếu chưa có bằng chứng gửi thành công.
