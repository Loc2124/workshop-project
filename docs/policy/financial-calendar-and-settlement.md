# Lịch ngày làm việc và quy tắc quyết toán

Cập nhật 08/11/2026. Đây là quyết định sản phẩm đã được xác nhận; tài liệu không khẳng định quy trình chuyển tiền thật đã sẵn sàng.

## Lịch ngày làm việc

- Dùng múi giờ `Asia/Ho_Chi_Minh`.
- Theo lịch nhà nước Việt Nam: mặc định thứ Hai đến thứ Sáu, có ngoại lệ cho ngày nghỉ lễ/nghỉ bù và ngày đi làm bù được công bố chính thức.
- Mỗi ngoại lệ lưu trích dẫn/căn cứ thông báo nhà nước; không tự suy đoán hoặc nhập ngày nghỉ không có nguồn.
- Bỏ qua ngày phát sinh; đếm từ ngày kế tiếp và giữ nguyên giờ địa phương của sự kiện khi xác định hạn.
- Không tự nhập ngày lễ từ phỏng đoán. Quản trị cần khai báo lịch nghỉ từng năm.
- Hoàn khách có hạn 7 ngày làm việc từ lúc hủy; chi trả studio có hạn 3 ngày làm việc sau khi buổi học kết thúc.

## Chi trả và khoản hoàn phát sinh

- Tại hạn chi trả, lập số tiền studio được nhận theo các khoản hoàn đã được ghi nhận đến thời điểm đó.
- Khoản hoàn phát sinh sau khi đã chốt/chi trả do studio chịu, được theo dõi thành khoản studio phải hoàn lại Open Slot.
- Khoản hoàn khách vẫn theo hạn 7 ngày làm việc tính từ lúc hủy. Việc studio trả chậm không gia hạn hạn của khách; Open Slot có thể tạm ứng để trả đúng hạn, sau đó thu hồi riêng từ studio.
- Mọi khoản chuyển ra, gồm hoàn khách, chi studio và tạm ứng, đều phải được quản trị duyệt trong giai đoạn đầu.
- Phí là phí thực tế của nhà cung cấp cho từng lần thu/hoàn/chi trả, studio chịu; không cộng phụ phí Open Slot, được trừ vào khoản chi của chính buổi học (hoặc ghi khoản phải hoàn riêng nếu đã chi xong), và không trừ khỏi số khách được hoàn.

## Trạng thái triển khai

Migration 045 đã áp dụng vào cơ sở dữ liệu hiện cấu hình, lưu ngoại lệ lịch nhà nước (ngày nghỉ và ngày làm bù) có lịch sử thay đổi và hàm tính hạn; ngày Văn hóa Việt Nam 24/11/2026 được nạp theo [thông tin chính thức](https://xaydungchinhsach.chinhphu.vn/ngay-24-11-hang-nam-la-ngay-van-hoa-viet-nam-nguoi-lao-dong-duoc-nghi-huong-nguyen-luong-119260113152642414.htm). Worker định kỳ lập nghĩa vụ hoàn theo từng vé và khoản thu thừa, kèm nghĩa vụ studio hoàn tiền về Open Slot. Giao diện lịch và quản trị giao dịch đã có. Chưa tự đồng bộ thông báo nhà nước, chốt số dư studio tại hạn chi trả, tự tạo khoản thu hồi do tạm ứng, cảnh báo hạn hoặc tích hợp chuyển tiền thật. Cần nhập ngày chính thức cho năm khác và hoàn thiện các luồng còn thiếu.
