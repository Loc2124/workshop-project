# Kế hoạch kiểm thử (bằng chứng bảo vệ)

Mỗi mục có test tự động nếu có thể; chạy và lưu log kết quả để đưa vào báo cáo.

| ID | Nhóm | Tình huống | Kết quả mong đợi |
|---|---|---|---|
| T01 | Đồng thời | N yêu cầu (ví dụ 50) cùng đặt những chỗ cuối của một buổi | Tổng chỗ giữ + bán không vượt sức chứa; số booking thành công bằng số chỗ còn |
| T02 | Đồng thời | Hai khách cùng đặt chỗ cuối | Đúng một người thành công, người kia nhận lỗi hết chỗ |
| T03 | Giữ chỗ | Booking `pending` quá `hold_expires_at` | Job chuyển `expired` và trả đúng `seats_held`; chạy job hai lần không trả chỗ hai lần |
| T04 | Webhook | Gửi cùng một webhook hợp lệ hai lần | Một booking `paid`, một bộ vé, `seats_sold` tăng một lần, sự kiện thứ hai là `duplicate` |
| T05 | Webhook | Chữ ký sai | Bị từ chối, lưu `signature_valid=false`, booking không đổi |
| T06 | Webhook | Số tiền không khớp `total_amount` | Không xác nhận, ghi nhận để kiểm tra |
| T07 | Webhook | Thanh toán thất bại/hủy | Booking không thành `paid`; chỗ được giải phóng đúng cách |
| T08 | Thanh toán muộn | Webhook đến sau khi booking `expired`, còn chỗ | Booking `paid`, cấp vé |
| T09 | Thanh toán muộn | Như T08 nhưng hết chỗ | Booking `refund_needed`, không cấp vé |
| T10 | Tiền | Client gửi giá/tổng tiền khác | Server bỏ qua, tính lại từ `sessions` |
| T11 | Phân quyền | Đơn vị B đọc/sửa workshop, buổi, đăng ký của đơn vị A | 403/404 trên mọi endpoint organizer |
| T12 | Phân quyền | Khách gọi endpoint organizer/admin | 403 |
| T13 | Phân quyền | Khách xem booking/vé của người khác | 403/404 |
| T14 | Hủy buổi | Đơn vị hủy buổi đã có booking | Booking `paid` → `refund_needed`; `pending` → `cancelled`, trả chỗ giữ; doanh thu loại buổi hủy |
| T15 | Doanh thu | Tổng doanh thu so với tổng booking `paid` | Khớp |
| T16 | Đánh giá | Người chưa có vé / buổi chưa diễn ra / đánh giá lần hai | Bị từ chối |
| T17 | AI | Ranker lỗi hoặc chậm quá ngưỡng | Vẫn trả kết quả bằng xếp hạng dự phòng; `fallback_used=true` |
| T18 | AI | Câu nhu cầu rỗng, rất ngắn, rất dài, có ký tự lạ | Không lỗi 500; xử lý hợp lý |
| T19 | AI | Tập ứng viên rỗng sau lọc cứng | Trả danh sách rỗng, không gọi ranker vô ích |
| T20 | Người dùng | 5-10 người thử tìm, đặt, xem vé | Ghi tỷ lệ hoàn thành, lỗi, phản hồi |

## Ghi chú
- Test đồng thời chạy trên PostgreSQL thật (không giả lập), dùng nhiều kết nối song song.
- Webhook test dùng `MockProvider` và một vài lần thử thật với số tiền nhỏ qua PayOS.
- Đánh giá người dùng là đánh giá bản thử nghiệm, không phải chứng minh thành công ngoài thị trường.
