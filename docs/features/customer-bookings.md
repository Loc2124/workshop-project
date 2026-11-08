# Đặt chỗ, thanh toán và hủy — hợp đồng hiện tại

Đồng bộ 07/11/2026. [Mục lục](../README.md) · [Policy mục tiêu](../policy/README.md) · [API](../engineering/03-api-spec.md). Phân biệt khả năng hiện tại với dòng tiền nền tảng cần triển khai.

## Đã có

- POST /bookings nhận requestId UUID bắt buộc, sessionId, quantity 1–10, paymentChoice tùy chế độ. Không nhận giá/tiền hay thông tin liên hệ giả từ client; lấy thông tin tài khoản và lưu vào đặt chỗ.
- Trình duyệt giữ mã yêu cầu theo tài khoản, lượt đặt và lựa chọn qua lỗi mạng/5xx/tải lại. API khóa cùng mã, trả đặt chỗ gốc thay vì giữ chỗ lần nữa; thay nội dung cùng mã bị từ chối. Chỉ xóa mã khi nhận kết quả hợp lệ hoặc lỗi dứt khoát; lượt đặt mới có chủ ý dùng mã mới. Nếu không lưu được mã ở trình duyệt thì báo rõ và chưa gửi yêu cầu.
- Studio none: xác nhận ngay tại studio; optional: khách chọn deposit/in_studio; required: chỉ deposit. Không xác minh thì không cọc. Cọc nguyên 1–50%, làm tròn VND; lưu chế độ/tỷ lệ/số tiền tại lúc tạo. Miễn phí phát vé ngay.
- Buổi phải chưa bắt đầu, chưa đóng đăng ký, chưa hủy, còn đủ chỗ và workshop/studio còn công khai hợp lệ. SQL giữ chỗ trong transaction; cleanup hold hết hạn trước giành chỗ, không chỉ dựa worker.
- Cọc giữ đúng 15 phút đã lưu; QR và liên kết thanh toán. Hết hạn ẩn thanh toán; tải lại không bắt đầu bộ đếm mới. Webhook xác minh chữ ký/đúng số cọc mới xác nhận/phát vé. Trang return/cancel không phải bằng chứng tiền.
- Chờ cọc kiểm tra dữ liệu mỗi 5 giây và khi quay lại tab. Nút kiểm tra hiện chỉ đọc DB, chưa tra cứu cổng trực tiếp.
- Hủy sau modal: tiền chưa nhận không tính là cọc; trước/đúng 24 giờ hoàn toàn bộ; dưới 24 giờ chỉ giữ cọc gốc, hoàn phần đã trả thêm; không cọc hoàn toàn bộ. Đơn cũ không bị tính lại theo cấu hình studio mới. Hộp hủy lấy số tiền và token 5 phút từ API, khóa xác nhận khi đang tải/lỗi. Khi điều kiện thay đổi hoặc token hết hạn, API từ chối; hộp mở lại số tiền mới và yêu cầu khách bấm xác nhận lần nữa, không tự hủy.
- Miễn xác nhận sẽ đến nếu đặt mới từ mốc nhả trở đi, theo giờ tạo DB; không áp dụng nhả do chưa xác nhận cho đơn được miễn. Không tự điểm danh.
- GET /me/bookings tối đa 100 gần nhất; studio tối đa 200; chưa có phân trang riêng cho khoản cũ cần xử lý.
- Có QR vé, lịch/địa chỉ/bản đồ, thêm lịch, sao chép mã, liên hệ studio và modal keyboard/focus/mobile. Buổi kết thúc không tự ghi nhận tiền/tham dự.

## Hoàn hiện tại và mục tiêu

API hủy tạo khoản cần hoàn. Hiện chủ studio tự chuyển rồi ghi mã đối chiếu qua POST /studios/:studioId/bookings/:id/refund, không có lệnh chuyển tiền. Copy hiển thị tối đa 7 ngày làm việc nhưng chưa có bộ tính ngày nghỉ/nhắc quá hạn.

Mục tiêu mới: Open Slot thực hiện hoàn/chi trả qua kênh chi hộ và nguồn ví dự kiến Bảo Kim. Không giao studio tự hoàn trong luồng mục tiêu. Chưa có tích hợp chi, chưa biết tài khoản nhận hoàn và chưa có quy trình chuyển đổi; xem [vận hành tiền](../operations/payment-operations.md).

## Những việc còn thiếu

Đối soát/đệm trước nhả, timestamp giao dịch, đối soát toàn bộ liên kết/giao dịch chưa rõ, thiếu/thừa/chuyển thêm ngoài phạm vi hủy một phần; miễn nợ/khiếu nại; phân trang. Chống tạo trùng đã có theo cùng mã yêu cầu, không cấm các lượt đặt riêng có chủ ý. Có lưu đăng ký lịch mới nhưng chưa gửi khi công bố.

## Cấu hình/kiểm tra

PAYMENT_PROVIDER=mock chỉ local/test; production payos. PAYOS_CLIENT_ID/API_KEY/CHECKSUM_KEY và URL webhook/return/cancel ở API, không đưa vào VITE_*. PAYMENT_MIN_AMOUNT cần số thực tế của nhà cung cấp, không tự đặt mặc định. EMAIL_DELIVERY_URL/TOKEN dùng adapter gửi thư, chưa cấu hình thì chưa gửi email thật. Chi tiết ở deploy.

Migration liên quan: 034_customer_booking_payments, 035_payment_qr_code, 035_session_registration_deadline, 036_studio_deposit_and_attendance, 037_repair_missing_refund_metadata, 038_booking_request_idempotency, 039_versioned_schedule_changes, 040_ticket_attendance_and_refund_receipts, 041_partial_seats_and_checkout_revisions, 042_repair_legacy_expired_seat_baseline và 043_delivered_attendance_confirmation. Không sửa migration đã chạy. Kết quả kiểm tra tích hợp mới và ma trận nghiệm thu ở [kế hoạch kiểm tra](../engineering/06-test-plan.md), không suy có file test là đã đạt.

## Đổi giờ có phiên bản và hạn phản hồi

- Chỉ đổi giờ nếu giờ bắt đầu mới còn trên 12 giờ theo DB; đúng/dưới 12 giờ bị từ chối. Đổi giờ kết thúc cũng cần khách đồng ý. Hạn là mốc sớm hơn giữa lúc thông báo+48 giờ và bắt đầu mới−12 giờ.
- Mỗi thay đổi tăng phiên bản. Khách đã xác nhận giữ chỗ, xem giờ cũ/giờ mới/hạn, chọn giữ hoặc mở hộp hủy với toàn bộ tiền đã nhận được hoàn. Phiên bản cũ trả 409, tải lại và chờ khách tự xác nhận lần nữa. Đồng ý xong mới cập nhật lịch snapshot.
- Chỗ đang chờ cọc bị hủy, QR hết hiệu lực trong ứng dụng và chỗ được nhả. Tiền về theo phiên bản cũ được ghi hoàn toàn bộ, không tự xác nhận giờ mới, kể cả Hold đã hết hạn. Chưa có API khóa liên kết ở nhà cung cấp nên chuyển tiền ngoài ứng dụng vẫn đi qua nhánh hoàn/đối soát.
- Hết hạn chưa trả lời: hủy toàn đặt chỗ, ghi thời điểm hủy, trả chỗ, vô hiệu vé, ghi khoản cần hoàn và thông báo một lần. Worker chạy cùng chu kỳ hết hạn giữ chỗ; đọc chi tiết/đặt mới/thanh toán/hủy cũng kiểm tra khi giữ khóa buổi. Luồng chi hoàn thật và hạn ngày làm việc vẫn chưa có.
- Khi chờ đồng ý: tạm dừng nhắc học/nhả do chưa xác nhận sẽ đến/điểm danh/ghi nhận thu tại studio. Hàng đợi email đổi giờ tách khỏi nhắc học và chỉ lấy đúng phiên bản còn chờ, còn hạn. Kênh email thật cần cấu hình và kiểm chứng.
- Trên mobile hành động được đưa lên đầu. UI đồng bộ mỗi 10 giây khi chờ, khi quay lại tab và qua hạn; không tự gửi chấp nhận/hủy từ trình duyệt khi hết hạn.

## Điểm danh và hoàn theo vé (4.1)

Studio mở từng nhóm để điểm danh từng vé từ giờ bắt đầu; vắng từ 30 phút sau giờ bắt đầu. Một vé đã đến không làm các vé khác thành đã đến. Thống kê đếm từng vé được ghi nhận, giữ lịch sử vắng khi khách chưa trả/chưa đến hủy; không suy tham dự từ giờ kết thúc. Khách thấy trạng thái từng vé cùng khoản hoàn đang chờ hoặc đã ghi nhận chuyển.

Vắng giữ đúng cọc gốc của vé, hoàn phần đã trả vượt cọc; không tự xóa nợ. Sau khi phát sinh khoản hoàn, studio không sửa điểm danh kể cả hoàn đã xong. Quản trị phải ghi lý do, giữ khoản hoàn hoặc dừng khoản chưa chuyển. Không xóa tiền đã chuyển; đối soát/thu lại là thao tác riêng.

Khoản hoàn tổng là lũy kế; phần còn cần hoàn bằng tổng được hoàn trừ tổng đã ghi nhận chuyển. Mỗi lần ghi nhận có mã đối chiếu/actor/time riêng, không dùng lại mã cũ cho đợt mới. Hoàn tiền do một vé vắng không tự hủy cả nhóm. Chuyển hoàn tự động vẫn chưa có.

Hủy từng chỗ và thay QR đã có ở 4.2. Quy tắc: thay mã theo số chỗ còn lại, giữ nguyên hạn; tiền về QR cũ dùng phần cần xác nhận chỗ còn lại đủ điều kiện và hoàn dư. Nếu mã mới đã được thanh toán hoặc không còn xác nhận được thì hoàn toàn bộ khoản về thêm; không phục hồi chỗ đã hủy.

Khách mở “Xem và hủy từng chỗ”, chọn số chỗ gốc và xác nhận sau khi xem khoản hoàn. Hộp không tự gửi lại khi lỗi. Tiền theo chỗ gốc không chia lại sau mỗi lần hủy; vé khác giữ nguyên mã. Với cọc còn thấp hơn mức tối thiểu cổng đã cấu hình, báo rõ và chưa hủy, không âm thầm đổi chính sách. Hủy toàn bộ vẫn được theo điều kiện hiện hành.

Mã cọc mới chỉ hiển thị nếu còn nhận đăng ký và còn hạn gốc. Nếu tạo mã lỗi/chậm, có nút thử khôi phục cùng mã; không giữ thêm 15 phút. Mã cũ được vô hiệu trong ứng dụng ngay, hủy ở nhà cung cấp là cố gắng bổ sung; tiền chuyển về mã cũ vẫn được đối soát theo quy tắc trên. Liên kết khôi phục có thể không có QR nếu nhà cung cấp không trả lại dữ liệu QR, vẫn có trang thanh toán.

| File/thành phần | Trước | Sau 4.2 |
| --- | --- | --- |
| db/migrations/041, 042 | Chủ yếu nhóm và tiền theo vé đã cấp | Chỗ gốc từ khi tạo, phiên bản mã cọc, khoản thu dư; sửa baseline hết hạn cũ |
| partial-seats.repository/routes | Chưa có hủy một phần | Báo giá có chữ ký, hủy/nhả đúng chỗ, giữ lịch sử và tiền theo chỗ gốc |
| partial-checkout.service; payments/providers | Chưa khôi phục mã thay thế | Tạo/tra cứu cùng mã, giữ hạn, không ghi đè từ kết quả cũ; hủy liên kết cũ bổ sung |
| payments.repository; refunds.routes | Chưa xử lý hai mã sau hủy một phần | Tiền cũ/mới được đối chiếu, ghi hoàn dư một lần; ghi nhận hoàn/thu còn lại đúng số tiền |
| BookingSeatCancellation; CustomerBookingDetailPage | Chỉ hộp hủy cả nhóm | Chọn từng chỗ, khoản hoàn trước xác nhận, lỗi/thử lại/bàn phím; mã hiện tại và số tiền/lịch sử rõ ràng |
| StudioBookingManager; AdminBookingsPage | Tiền và số người chủ yếu theo nhóm hiện tại | Giữ thông tin gốc/tổng thực nhận, khoản còn cần hoàn; không chặn thu phần còn lại vì khoản hoàn của chỗ khác |

GET chi tiết trả số chỗ/tổng ban đầu, số chỗ còn lại, tổng đã nhận, khoản hoàn lũy kế và đã hoàn. Đặt chỗ hết hạn hiển thị số chỗ còn hiệu lực bằng 0; dữ liệu đối soát không tự giữ lại sức chứa. Số tiền chuyển vào mã đã trả thêm lần nữa được ghi nhận riêng nếu thông báo có mã giao dịch khác; chưa kiểm chứng bằng tiền thật.

## Xác nhận sẽ đến và nhả chỗ (4.3)

“Xác nhận tôi sẽ đến” là lời xác nhận trước buổi học, không phải điểm danh. Chỉ email yêu cầu xác nhận được dịch vụ gửi thư chấp nhận mới bắt đầu tính 2 giờ; thông báo trong tài khoản chưa đủ. Hạn nhả thực tế là mốc muộn hơn giữa mốc cấu hình và email gửi thành công + 2 giờ. Nếu không còn đủ 2 giờ trước buổi, không nhả vì thiếu xác nhận.

Khách chưa xác nhận, chưa trả tiền, không cọc và thuộc diện nhả mới bị xử lý; khách đặt mới từ mốc nhả được miễn theo snapshot. Khách có thể xác nhận sau mốc cấu hình nếu hạn thực tế chưa tới. API khóa buổi, kiểm tra lại hạn, giữ thời điểm xác nhận đầu tiên khi gửi lại; hết hạn thì xử lý nhả và trả 409. Lượt đọc và đặt mới cũng dọn chỗ đến hạn, không chỉ chờ worker. Nhả sau hủy một phần chỉ nhả số chỗ đang còn, không tính lại các chỗ đã hủy.

Trang chi tiết dùng attendanceConfirmationDeadline từ API, tự đọc lại mỗi 10 giây khi cần xác nhận, khi quay lại tab và qua hạn; không tự kết luận nhả từ đồng hồ phía khách. Nút có trạng thái đang xử lý, chống bấm lặp, lỗi và thử lại. Nếu đã xác nhận, hiện trạng thái rõ ràng. Đổi giờ yêu cầu bằng chứng email mới đúng phiên bản sau khi khách đồng ý; không tái sử dụng thư lịch cũ.

| File/thành phần 4.3 | Trước | Sau |
| --- | --- | --- |
| migration 043 | Chưa có bằng chứng email riêng cho xác nhận | Loại thư/phiên bản/giờ học chính xác, khóa duy nhất và hàm hạn thực tế; không suy email cũ là đã gửi yêu cầu |
| attendance-confirmation.ts; attendance-job.ts | Nhả chỉ theo mốc cấu hình, có thể chưa gửi email | Nhả sau email thành công ít nhất 2 giờ, chỉ trước giờ học, đúng phiên bản; ghi nhận một lần và giữ số chỗ sau hủy một phần |
| customer-actions.routes.ts; bookings.repository.ts | Hết mốc dự kiến là chặn xác nhận | Dùng hạn thật, kiểm tra ở API/đọc/đặt mới; gửi lại giữ mốc xác nhận đầu tiên, không điểm danh |
| CustomerBookingDetailPage; customerBookingService | Hiển thị mốc dự kiến, nút ở thông tin chi tiết | Hạn từ API, nút ở đầu khối hành động, chặn bấm lặp/lỗi/thử lại, đồng bộ qua hạn |
| .env.example; deploy/policy | Chưa chốt bằng chứng kênh gửi | Ghi rõ 2xx phải là chấp nhận thư, thông báo trong tài khoản chưa đủ; chưa nghiệm thu gửi thật |
