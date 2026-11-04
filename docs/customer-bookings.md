# Đặt chỗ và thanh toán

- Migration: `034_customer_booking_payments.sql`.
- Khách đăng nhập, chọn buổi và số người; trang đặt chỗ không có ô nhập họ tên/SĐT. API lấy họ tên, SĐT và email từ tài khoản đăng nhập, lưu bản chụp thông tin liên hệ vào đơn. Tài khoản chưa có SĐT vẫn đặt được, dùng email để liên hệ. API chỉ nhận `sessionId` và `quantity`, từ chối thông tin liên hệ tự gửi từ trình duyệt. Giá, mức cọc và số chỗ được kiểm tra tại API trong transaction có khóa buổi.
- Studio đủ điều kiện thu cọc: giữ chỗ đến hạn, chuyển khách tới payOS; chỉ webhook có chữ ký hợp lệ và đúng số tiền mới xác nhận chỗ, phát vé và chuyển chỗ giữ sang chỗ bán.
- Không thu cọc: xác nhận chỗ ngay, thu tiền tại studio. Buổi miễn phí phát vé ngay.
- Khách xem đơn và QR vé tại `/me/bookings`; chi tiết tự cập nhật mỗi 5 giây khi chờ cọc.
- Chủ studio xem tối đa 200 đơn gần nhất tại `/studio/:studioId/bookings`, kiểm tra số tiền còn lại và xác nhận đã thu. API kiểm tra thành viên studio, số tiền và trạng thái dưới khóa để tránh thu trùng.
- Worker giải phóng chỗ hết hạn. Tiền về muộn chỉ xác nhận lại khi buổi chưa bắt đầu và còn chỗ; các trường hợp khác chuyển `refund_needed` để hoàn thủ công.
- Hủy tuân theo thời hạn trong cài đặt; trả chỗ và vô hiệu hóa vé cùng transaction.

## Cấu hình

Local dùng `PAYMENT_PROVIDER=mock`. Production dùng `payos`, cấu hình `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, URL return/cancel của web và đăng ký `PAYOS_WEBHOOK_URL` trỏ đến `/webhooks/payos`. Không xác nhận tiền từ tham số URL trình duyệt.

1. Tạo kênh thanh toán payOS gắn với tài khoản ngân hàng nhận tiền, lấy Client ID, API Key và Checksum Key. Chỉ lưu các khóa ở môi trường API.
2. Cấu hình API (thay tên miền ví dụ bằng tên miền thực tế):

   ```dotenv
   PAYMENT_PROVIDER=payos
   PAYOS_CLIENT_ID=<client-id>
   PAYOS_API_KEY=<api-key>
   PAYOS_CHECKSUM_KEY=<checksum-key>
   PAYOS_RETURN_URL=https://web.example.com/payment/return
   PAYOS_CANCEL_URL=https://web.example.com/payment/cancel
   PAYOS_WEBHOOK_URL=https://api.example.com/webhooks/payos
   HOLD_MINUTES=15
   ```

3. Đăng ký URL webhook HTTPS công khai trên payOS hoặc qua API `confirm-webhook`. Chỉ khai báo biến môi trường không tự đăng ký webhook. Local muốn nhận webhook thật cần tunnel HTTPS tới API.
4. Chạy `npm run migrate`, khởi động lại API. Studio cần được duyệt, xác minh và hoàn thiện hồ sơ; workshop có `deposit_percent > 0` mới thu cọc. Nếu không đủ điều kiện thì đơn thu tiền tại studio, buổi giá 0 miễn phí.
5. Kiểm tra một đơn thực tế: thanh toán cọc, đợi webhook xác nhận và phát vé, kiểm tra số tiền còn lại tại studio. Tiền thật chưa được kiểm thử tự động. Cấu hình hiện tại dùng một kênh payOS chung cho nền tảng; không tự chia tiền về từng studio.

Tài liệu payOS: https://payos.vn/docs/api/

Cách tạo chữ ký payment-requests: https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/

## Kiểm tra

`npm run test --workspace @workshop/api -- tests/integration/customer-bookings.test.ts tests/unit/payment-signature.test.ts`

Lệnh cần database test riêng và `ALLOW_DESTRUCTIVE_TESTS=true`; bộ bảo vệ từ chối database trùng ứng dụng. Chưa thực hiện giao dịch tiền thật.
