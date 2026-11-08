# Kiến trúc đặt chỗ và dòng tiền

Đồng bộ 07/11/2026. [Mục lục](../README.md) · [Chính sách](../policy/README.md) · [Trạng thái mã](../project/current-status.md).

## Thành phần hiện có

React/Vite SPA → Express 5/TypeScript → PostgreSQL qua pg. API kết nối payOS qua PaymentProvider/MockProvider. Worker hết hạn và nhắc lịch chạy trong tiến trình API, dùng khóa/chống gửi lặp và email_outbox. Chưa có dịch vụ chi hộ/Bảo Kim hoặc ranker hoàn chỉnh. Không có Redis/message broker; hàng đợi DB không có nghĩa đã dùng queue bên ngoài.

Routes/schema/service/repository là quy ước phân lớp; một số route mới còn SQL trực tiếp, cần tách khi hoàn thiện. API là biên phân quyền, DB có RLS không policy với vai công khai; không kết nối PostgreSQL từ trình duyệt.

## Mô hình hiện tại

- Workshop là nội dung, session là buổi có starts_at/ends_at/registration_deadline/capacity/seats_held/seats_sold. is_discontinued là cờ workshop riêng.
- Studio deposit_mode/percent; workshop override hoặc kế thừa; studio không đủ xác minh không được nhận cọc mới. Bookings lưu giá/chế độ/tỷ lệ/cọc tại lúc tạo.
- Đặt chỗ: reservation_status pending/confirmed/cancelled/completed. Tiền tổng hợp: bookings.status pending/paid/expired/cancelled/refund_needed; số tiền thực từ paid_amount và payments. Completed không có nghĩa đã thu đủ.
- Hoàn hiện tại: refund_due_amount và refund_status not_applicable/pending/forfeited/refunded; có mã ghi nhận thủ công. Một khoản vừa giữ cọc vừa hoàn phần vượt vẫn có refund_status pending.
- Tickets mỗi chỗ một vé, có trạng thái điểm danh/phiên bản/tiền và dấu khóa hoàn riêng ở 4.1; attendance_status của booking là tổng hợp. Chưa hủy từng chỗ.

## Giữ chỗ và khóa

Giá và số tiền từ API, không lấy client. Trong transaction: khóa studio/buổi, giải phóng hold hết hạn của buổi, đọc điều kiện công khai/đăng ký, cập nhật nguyên tử rồi tạo đơn/payment/vé/thông báo.

Trước khóa sức chứa, yêu cầu tạo có requestId UUID bắt buộc qua HTTP. booking_requests khóa theo (user_id, request_id), so sánh SHA-256 nội dung và lưu booking_id trong cùng transaction tạo. Cùng mã/cùng nội dung trả kết quả cũ; khác nội dung trả 409. Client giữ mã qua lỗi mạng/5xx/tải lại, tách theo tài khoản/lượt đặt/lựa chọn. Không gọi lại createPayment khi replay; chưa có cơ chế truy vấn cổng phục hồi liên kết nếu lượt đầu có kết quả không rõ. Migration 038 bật RLS và chặn truy cập công khai.

```sql
UPDATE sessions
SET seats_held = seats_held + $1
WHERE id = $2 AND status = 'scheduled'
  AND starts_at > now()
  AND COALESCE(registration_deadline, starts_at) > now()
  AND seats_held + seats_sold + $1 <= capacity
RETURNING price;
```

Trả tại studio tăng seats_sold và xác nhận ngay; cọc tăng seats_held, hạn now()+15 phút. Hết hạn hiện kiểm tra hold_expires_at <= now(), chưa có đệm 3 phút hoặc tra cứu cổng trước nhả.

Cleanup khi đọc giới hạn theo workshop/studio/bộ lọc, không dọn toàn DB bằng mỗi truy vấn catalog. Worker định kỳ có advisory lock; cleanup chạy lặp không được trừ chỗ hai lần. Khóa buổi rồi booking ở hủy/webhook; tạo đặt chỗ còn khóa studio trước buổi, sửa buổi có thể khóa ngược. **Thứ tự khóa chưa thống nhất**; mục I2 trong bảng trạng thái là yêu cầu cần sửa/kiểm tra đồng thời, không phải bảo đảm hiện tại.

## Xác minh thanh toán hiện tại

Lưu webhook_events với chống trùng, kiểm tra chữ ký/đơn/đúng số cọc; transaction khóa buổi và booking/payment. Cọc thành công chuyển held→sold, tăng paid_amount, phát vé một lần. Còn tiền tại studio thì bookings.status vẫn pending dù reservation_status đã confirmed.

Hết hạn rồi có tiền: chỉ giành lại khi buổi còn scheduled, chưa bắt đầu, chưa đóng đăng ký và còn đủ chỗ; không được thì refund_needed. Đã hủy không tự khôi phục. Đang thiếu kiểm tra toàn bộ trạng thái công khai/đối soát và giờ giao dịch xác minh; thông báo chậm không tương đương tiền thực sự trả muộn.

Sai số tiền hiện chỉ ghi outcome amount_mismatch; chưa có sổ xử lý tiền thiếu/thừa. Payment đã paid thì sự kiện mới có thể bị coi trùng; cần phân biệt mã giao dịch mới với thông báo lặp. Nút kiểm tra chỉ đọc DB; PaymentProvider hiện chỉ createPayment/verifyWebhook, chưa có query/cancel/payout. Tham chiếu trực tiếp interface trong mã trước khi tích hợp.

## Hủy và tham dự

Đọc tiền đã nhận/cọc snapshot trong khóa; trước/đúng 24 giờ hoặc khách từ chối lịch studio đổi thì hoàn toàn bộ. Dưới 24 giờ hoàn max(0, đã nhận−cọc gốc), không cọc hoàn toàn bộ. Trả đúng held/sold, vô hiệu vé và payment chưa nhận; không xóa lịch sử paid_amount. Hiện thực hiện toàn đơn.

Hộp hủy lấy báo giá API với giờ DB, số tiền và token HMAC 5 phút, ràng buộc khách/đặt chỗ/lịch/trạng thái. Khi POST hủy, tính lại trong cùng khóa; nếu fingerprint hoặc hạn token không khớp thì 409, chưa sửa tiền/chỗ/vé. Client lấy báo giá mới và chờ khách xác nhận lần nữa. Cơ chế này bảo vệ sự đồng ý hủy, không thay thế schedule_version cho việc chấp nhận đổi lịch. Có tiền mới về trước khóa hủy sẽ làm báo giá cũ vô hiệu; tiền về sau hủy đi qua nhánh đối soát/hoàn hiện có.

Đặt mới từ mốc nhả trở đi lưu release_if_unconfirmed=false; dùng thời điểm tạo DB. Đặt chỗ đã có giữ cấu hình snapshot. Worker không nhả đặt chỗ có cọc/đã trả hoặc miễn xác nhận. Đổi giờ có phiên bản/hạn đã có; điểm danh vắng theo từng vé ở 4.1; nhả sau email được dịch vụ chấp nhận ít nhất 2 giờ đã có ở 4.3. Cần nghiệm thu kênh email thật.

## Kiến trúc mục tiêu cần thêm

1. Khóa yêu cầu tạo đã có; còn sổ giao dịch tiền và điều chỉnh bất biến, snapshot địa điểm/chính sách. Lịch/phiên bản và lịch sử đồng ý đã có qua migration 039.
2. Đối soát thu dùng timestamp xác minh; đệm trước nhả, xử lý người thanh toán đúng hạn nhưng thông báo chậm. Không lấy việc tăng H thêm 3 phút làm quyền thanh toán muộn.
3. Tiền/cọc gốc theo vé và điểm danh đã có; 4.2 bổ sung hủy một phần, phân bổ theo chỗ gốc bất biến khi số chỗ thay đổi và phiên bản mã cọc.
4. Khoản hoàn giữ hạn 7 ngày làm việc từ lúc hủy kể cả thiếu tài khoản; chi trả trong 3 ngày làm việc. Mọi khoản chuyển đều có quản trị duyệt, khóa số tiền/đích theo phê duyệt, ghi trước/gọi sau, tra cứu trước thử lại; xử lý theo hạn đến trước không phân loại ưu tiên hoàn.
5. Sau chi trả, thường thu hồi studio trước hoàn; nếu chậm gây nguy cơ quá hạn thì nền tảng tạm ứng đúng hạn và theo dõi phải thu studio. Studio chịu phí thực tế nhà cung cấp, không phụ phí Open Slot, công bố trước bật cọc. Tách tiền thu/phí/hoàn/chi trả/tạm ứng/thu hồi, không thu phí hoặc hoàn hai lần.

Toàn bộ nhóm mục tiêu là P0 cần triển khai theo cập nhật tài liệu. Chưa tự định nghĩa endpoint/biến môi trường nhà cung cấp không có trong mã. Chi tiết A–J ở [bảng trạng thái](../policy/bang-chuyen-trang-thai.md) và [vận hành tiền](../operations/payment-operations.md).

## Đổi giờ hiện tại (bước 3)

sessions.schedule_version tăng trong khóa buổi; bookings lưu phiên bản đã đồng ý, phiên bản đang đề xuất, lịch snapshot và hạn phản hồi. session_schedule_history giữ từng lần đổi, booking_schedule_acceptances giữ ai đồng ý giờ nào theo phiên bản. API từ chối giờ mới không còn trên 12 giờ; hạn min(thông báo+48 giờ, giờ mới−12 giờ). Lần đổi mới thay đề xuất, giữ nguyên lịch đã đồng ý và yêu cầu khách xác nhận lại. HMAC báo giá hủy cũng ràng buộc phiên bản buổi.

Hủy Hold khi studio đổi giờ và tự hủy vì hết hạn phản hồi dùng cùng helper nguyên tử: khóa buổi trước booking, kiểm tra chỗ, ghi hoàn toàn bộ paid_amount, giữ lịch sử tiền, vô hiệu vé/payment chưa thu và thông báo. Worker có advisory lock; từng lượt đọc/đặt/thanh toán/hủy kiểm tra trong khóa nên không phụ thuộc riêng worker. Chấp nhận quá hạn trả lỗi sau khi giao dịch hủy đã commit, không rollback việc hết hạn. Các lần hủy mới lưu cancelled_at; không suy đoán thời điểm hủy cũ.

Email đổi giờ có delivery_type/schedule_version, chỉ lấy phiên bản còn chờ và còn hạn. Nhắc học/nhả/điểm danh/thu tại studio bị chặn trong lúc chờ đồng ý. Tích hợp gửi thật, đệm/đối soát cổng trước nhả và chuyển hoàn vẫn là phần chưa đầy đủ.

## Tiền và điểm danh từng vé hiện tại

Migration 040 lưu tiền/cọc gốc theo số thứ tự vé, phần dư vào vé cuối; đồng bộ tiền nhận khi booking nhận cọc/thu tại studio, ghi hoàn phần vượt cọc cho vé vắng. tickets.version chặn cập nhật theo dữ liệu cũ; refund_history_locked giữ quyền sửa thuộc quản trị sau khi có khoản hoàn. Chỉ tính completed khi mọi vé còn hiệu lực đã được ghi đã đến; nhóm trộn giữ trạng thái xác nhận và xem từng vé.

booking_refund_receipts là biên nhận hoàn thủ công theo từng đợt; bookings.refund_due_amount và refunded_amount là lũy kế. Không coi bảng này là sổ giao dịch/chi hộ đã hoàn chỉnh. Các điểm danh/điều chỉnh có audit, giữ lịch sử tiền thật; không tự thu lại khi quản trị sửa vé đã hoàn. SQL/API khóa session → booking → ticket.

4.2 đã thêm booking_seats để giữ phân bổ từ lúc tạo, cấp vé theo số chỗ gốc còn hiệu lực, phiên bản mã thanh toán và booking_extra_refunds để ghi tiền thừa/không áp dụng. Các API hủy từng chỗ và khôi phục mã cọc đã có; giữ nguyên hạn ban đầu, không tự khôi phục chỗ khách hủy. Đối soát ngân hàng toàn hệ thống và lệnh chi hoàn vẫn chưa có.

## Cập nhật phạm vi 4.2 (08/11/2026)

Đã bổ sung hủy từng chỗ và thay mã cọc theo số chỗ gốc còn lại, giữ nguyên hạn giữ chỗ. Lưu lịch sử số chỗ/tổng tiền/cọc ban đầu; chỉ vô hiệu vé đã chọn. Tiền về mã cũ hoặc mã mới được xác minh và áp dụng một lần, phần dư hoặc không thể xác nhận được ghi cần hoàn. Chưa có chi hoàn tự động hoặc đối soát cổng toàn hệ thống. Chi tiết triển khai và bằng chứng kiểm tra tại [trạng thái hiện tại](../project/current-status.md) và [API](../engineering/03-api-spec.md).

## Nhả chỗ có bằng chứng gửi (4.3)

Migration 043 thêm loại email yêu cầu xác nhận, giờ học chính xác và unique theo phiên bản; hàm SQL attendance_confirmation_deadline dùng chung cho đọc chi tiết và nhả. attendance-confirmation.ts chỉ chạy khi đã khóa buổi, giảm đúng số chỗ đang giữ, hủy vé/thu chưa thực hiện và ghi nhật ký. Không có bằng chứng gửi thành công hoặc không đủ 2 giờ trước S thì không nhả. cleanup releaseExpiredHolds gọi cùng nhánh để đọc/đặt mới không phụ thuộc worker. Xác nhận và worker dùng cùng thứ tự khóa, tránh xác nhận đồng thời nhả làm sai bộ đếm.
