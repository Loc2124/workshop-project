# Chính sách đã chốt sau rà soát luồng

> **LƯU TRỮ — không dùng làm chính sách hoặc trạng thái hiện hành.** Giữ nguyên nội dung như bằng chứng/bản nháp lịch sử. Quy tắc hiện hành, phạm vi đã có và việc còn thiếu được dẫn từ [mục lục tài liệu](../../README.md).

Ngày cập nhật: 07/11/2026. Tài liệu này cập nhật các điểm còn chờ trong `open-slot-flow-audit.md`; không có nghĩa mọi luồng trong báo cáo đã được sửa hoặc kiểm chứng.

| Tình huống                                              | Quyết định                                                                                                                          | Triển khai hiện tại                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Cọc về sau hạn giữ chỗ                                  | Xác nhận lại khi buổi còn nhận đăng ký và còn đủ chỗ cho toàn bộ đặt chỗ; ngược lại hoàn tiền. Khách đã hủy thì không tự khôi phục. | Nhánh còn chỗ/không còn chỗ đã có; còn cần đối soát thông báo đến chậm và giao dịch thiếu/thừa theo báo cáo.                     |
| Studio đổi giờ, khách không đồng ý trước giờ mới        | Tự hủy và hoàn toàn bộ khoản đã trả.                                                                                                | Quyết định đã chốt; công việc tự hủy, phiên bản lịch và xử lý chờ cọc còn cần triển khai.                                        |
| Thời hạn hoàn                                           | Tối đa 7 ngày làm việc.                                                                                                             | Đã hiển thị trong hộp hủy, thông báo và khoản cần hoàn; chưa có bộ tính hạn theo lịch làm việc/ngày nghỉ và cảnh báo quá hạn.    |
| Hủy/điểm danh nhóm                                      | Cho hủy từng chỗ và điểm danh từng vé.                                                                                              | Quyết định đã chốt; hủy và điểm danh hiện vẫn theo toàn đặt chỗ, cần triển khai phân bổ tiền từng vé.                            |
| Có cọc, đã trả đủ hoặc trả thêm rồi hủy còn dưới 24 giờ | Chỉ giữ khoản cọc tại lúc đặt, hoàn phần tiền đã trả vượt cọc.                                                                      | Đã áp dụng trong quy tắc dùng chung, API hủy, hộp xác nhận và số tiền cần hoàn.                                                  |
| Không cọc nhưng đã trả tiền rồi hủy                     | Hoàn toàn bộ số tiền đã trả, kể cả còn dưới 24 giờ.                                                                                 | Đã áp dụng với số cọc lưu trong đặt chỗ bằng 0.                                                                                  |
| Đặt mới sau mốc nhả chỗ                                 | Xác nhận ngay với trả tại studio, không yêu cầu xác nhận sẽ đến; vẫn phải còn chỗ và trong hạn đăng ký.                             | Đã lưu miễn xác nhận vào đặt chỗ mới, bỏ nút/lời nhắc yêu cầu xác nhận và không áp dụng công việc nhả cho các đặt chỗ được miễn. |

## Chi tiết hai quy tắc vừa triển khai

Tiền cần hoàn khi hủy:

- Chưa trả: 0, không phát sinh phí.
- Trước giờ học ít nhất 24 giờ hoặc studio đổi giờ mà khách không giữ chỗ: hoàn toàn bộ tiền đã nhận.
- Dưới 24 giờ: tiền cần hoàn = tối đa(0, tiền đã nhận − tiền cọc đã lưu trong đặt chỗ). Không dùng tỷ lệ studio hiện tại để tính lại.
- Không cọc: tiền cọc bằng 0 nên hoàn toàn bộ tiền đã nhận.
- Ví dụ: đã trả 200.000 đ, cọc gốc 10.000 đ → hoàn 190.000 đ; cọc gốc 40.000 đ → hoàn 160.000 đ.
- Khoản cọc không hoàn được hiển thị riêng kể cả khi vẫn có phần tiền khác đang cần hoàn. Ghi nhận hoàn không xóa lịch sử tiền đã nhận.

Miễn xác nhận sẽ đến:

- Buổi lúc 14:00, mốc nhả 12:00: tạo đặt chỗ từ 12:00 trở đi được miễn; tạo trước 12:00 vẫn theo cấu hình studio.
- Dùng thời điểm tạo từ giao dịch cơ sở dữ liệu. Không cộng thêm khoảng miễn 15 phút trước mốc nhả như mã cũ.
- Đây là miễn một thao tác xác nhận, không phải tự ghi nhận khách đã tham dự.
- Đặt chỗ đã tạo giữ nguyên cấu hình đã lưu; không tự sửa hàng loạt lịch sử.

## File và kiểm tra

- `packages/shared/src/deposit-policy.ts`: tính hoàn theo số cọc gốc; quy tắc miễn xác nhận theo mốc giờ.
- `apps/api/src/modules/payments/payments.repository.ts`: đọc số cọc của đặt chỗ, ghi đúng tiền cần hoàn, thông báo số tiền và 7 ngày làm việc.
- `apps/api/src/modules/bookings/bookings.repository.ts`: lưu điều kiện xác nhận theo giờ tạo từ cơ sở dữ liệu.
- `apps/api/src/modules/bookings/attendance-job.ts`: không nhắc xác nhận cho đặt chỗ được miễn.
- `apps/web/src/pages/CustomerBookingDetailPage.tsx`: hộp hủy hiển thị phần giữ/phần hoàn; không có nút xác nhận sẽ đến cho đặt chỗ được miễn; phân biệt tiền hoàn với cọc không hoàn.
- `StudioRefundPanel.tsx`: dùng nhãn khoản tiền cần hoàn, bao gồm cả phần đã trả ngoài cọc.
- 31 kiểm tra chuyên biệt đã qua (quy tắc cọc/hủy, trạng thái chi tiết đặt chỗ, ma trận thanh toán workshop), gồm đúng 24 giờ và lệch 1 ms, phần trăm cọc 5/20/50, không cọc và mốc nhả trước/đúng/sau.
- Thêm 6 trường hợp tích hợp API: hoàn đúng theo 0/5/20/50% sau thu đủ, không tính lại theo chính sách mới; đặt trước/sau mốc nhả và chạy công việc lặp. Chưa chạy vì `ALLOW_DESTRUCTIVE_TESTS` chưa bật; không tự vượt cơ chế bảo vệ.
- Chưa cần migration cho hai quy tắc này: dùng số cọc và cấu hình đã lưu sẵn.
