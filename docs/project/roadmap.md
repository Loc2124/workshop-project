# Roadmap hiện hành

Cập nhật 08/11/2026. [Mục lục](../README.md) · [Chính sách](../policy/README.md) · [Trạng thái mã](current-status.md). Đây là kế hoạch, không phải báo cáo hoàn thành.

## Tiến độ theo từng bước

**Bước 1 đã hoàn thành:** thu sau điểm danh; hủy quản trị đầy đủ tiền/chỗ/vé/thông báo; nhật ký người thu; migration 037 sửa khoản hoàn cũ; sửa thông báo hoàn thủ công và phục hồi bộ kiểm tra web. Bằng chứng: 233 ca web và 24 ca API tích hợp liên quan qua các lượt chạy, xem trạng thái mã.

**Bước 2 đã hoàn thành:** mã yêu cầu tạo đặt chỗ được giữ qua gửi lại/mất mạng/tải lại; API trả lại cùng đặt chỗ và không giữ thêm chỗ. Hộp hủy lấy số tiền từ API, kiểm tra lại khi xác nhận; nếu qua mốc 24 giờ, có tiền mới nhận hoặc lịch thay đổi thì phải xem lại và xác nhận lần nữa. API trả đúng thông báo mức cọc tối đa 50%. Chi tiết bằng chứng và giới hạn ở trạng thái mã.

**Bước 3 đã hoàn thành:** đổi giờ tăng phiên bản, lưu lịch đã đồng ý và lịch sử chấp nhận; hạn phản hồi min(thông báo + 48 giờ, giờ mới − 12 giờ), chỉ đổi khi giờ mới còn trên 12 giờ. Chỗ chờ cọc cũ bị hủy; chưa phản hồi đúng hạn thì tự hủy/nhả chỗ/ghi hoàn toàn bộ, chưa chuyển tiền tự động. Tạm dừng nhắc/nhả/điểm danh/thu tại studio khi chờ đồng ý.

**Bước 4.1 đã hoàn thành:** điểm danh từng vé, ghi khoản hoàn do vắng theo cọc gốc, giữ lịch sử các lần hoàn và khóa studio sửa khi đã phát sinh khoản hoàn. Quản trị phải ghi lý do/chọn giữ khoản hoàn hoặc dừng khoản chưa chuyển; khoản đã chuyển không bị xóa. Có nền tảng chia tiền phần dư vào vé cuối.

**Bước 4.2 đã triển khai:** hủy từng chỗ và thay mã cọc, giữ nguyên hạn giữ chỗ. Đã chốt tiền về mã cũ: dùng phần cần để xác nhận các chỗ còn lại đủ điều kiện, hoàn phần dư; không phục hồi chỗ đã hủy. Nếu đã nhận cọc theo mã mới hoặc không thể xác nhận thì hoàn toàn bộ khoản về thêm. Có hủy/nhả từng chỗ, thay mã cùng hạn, xử lý tiền về mã cũ/mới và khôi phục liên kết lỗi. Đã đạt 15 ca tích hợp mới; xem current-status để phân biệt phạm vi đã kiểm chứng. 4.3 bổ sung nhắc/nhả sau email thành công đủ 2 giờ; tiếp theo sổ chi/hoàn/chi trả.

## Danh sách công việc tổng thể

| Thứ tự | Nhóm việc                                            | Điều kiện hoàn thành                                                                                                                                                                           |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Hoàn thiện chi tiết vận hành theo chính sách đã chốt | Chín nhóm và ba điểm làm rõ đã chốt; xác minh biểu phí/kênh gửi/ngân hàng/ví/lịch nghỉ/nguồn dự phòng, không mở lại quyết định đã có                                                           |
| 2      | Sửa sai lệch luồng đang có                           | Đã sửa thu sau điểm danh/hủy quản trị ở bước 1 và thông báo tỷ lệ cọc ở bước 2; còn phân trang việc cần xử lý                                                                                  |
| 3      | Đặt chỗ và nhận tiền an toàn                         | Đã chống gửi lại cùng yêu cầu ở bước 2; còn đối soát trước nhả, giờ giao dịch, phục hồi liên kết chưa rõ và phân biệt thông báo lặp với chuyển thêm                                            |
| 4      | Hủy/điểm danh từng vé, đổi giờ có phiên bản          | Đổi giờ/đồng ý phiên bản/hết hạn đã có ở bước 3; điểm danh/khóa sửa/ghi hoàn vắng đã có ở 4.1; hủy/nhả từng chỗ và thay QR đã có ở 4.2; còn nghiệm thu cổng thật                                                           |
| 5      | Hoàn tự động và chi trả nền tảng — P0 mới            | Sổ tiền, mọi lệnh quản trị duyệt, chi theo hạn đến trước; 3 ngày làm việc chi trả/7 ngày làm việc hoàn từ lúc hủy; studio chịu phí thực tế; thu hồi và tạm ứng giữ hạn; chống chi lặp/đối soát |
| 6      | Nhắc lịch và vận hành                                | Gửi email thật, theo dõi lỗi; không nhắc lịch cũ; chỉ nhả sau ít nhất 2 giờ từ thông báo gửi thành công; gửi lịch mới cho người đã đăng ký                                                     |
| 7      | Ranker và đánh giá/nghiên cứu                        | Lọc cứng trước xếp hạng; baseline/fallback; dữ liệu và đánh giá đúng phương pháp; không dùng sao làm nhãn                                                                                      |
| 8      | Nghiệm thu phát hành                                 | Qua ma trận chính sách, API/DB đồng thời, trình duyệt/mobile, thử nhà cung cấp; giám sát và quy trình xử lý sự cố                                                                              |

Roadmap dạng 19 prompt cũ được [lưu trữ](../archive/planning/04-roadmap-prompts.md), không còn là thứ tự triển khai bắt buộc vì phạm vi hoàn/chi trả đã thay đổi. Các hạn chế ngoài phạm vi còn giữ: ứng dụng native, chat trực tiếp, mã giảm giá/thành viên, đa ngôn ngữ; bản đầu chưa hỗ trợ đổi buổi/địa điểm/chuyển tên.

## Bước 5 — lịch hạn và sổ nghĩa vụ tài chính (đang triển khai)

Tiếp theo sau khi chốt lịch nghỉ nhà nước: đã thêm worker định kỳ tạo nghĩa vụ hoàn theo vé/khoản thu thừa và khoản studio hoàn tiền nguồn về Open Slot. API chỉ cho chuyển khoản hoàn khách trong phạm vi nguồn studio đã nhận hoặc khoản tạm ứng quản trị duyệt; khoản studio trả về cũng phải được duyệt và đối soát trước khi được tính là nguồn đã nhận. Chi thật chưa kết nối.

Đã chốt theo lịch nhà nước Việt Nam (`Asia/Ho_Chi_Minh`), mặc định thứ Hai–thứ Sáu, có ngày nghỉ và ngày làm bù theo thông báo chính thức; đếm từ ngày tiếp theo và giữ giờ địa phương. Hạn hoàn là 7 ngày làm việc từ lúc hủy; chi studio là 3 ngày làm việc sau khi buổi kết thúc. Chi trả studio chốt theo khoản hoàn đã ghi nhận đến thời điểm đó; phát sinh sau hạn chi do studio chịu và theo dõi thành khoản thu hồi riêng.

Migration 044–054 đã áp dụng vào DB hiện cấu hình. Có worker lập nghĩa vụ hoàn theo vé/khoản thu thừa, liên kết khoản studio hoàn nguồn, API studio gửi bằng chứng chuyển tiền về Open Slot, API quản trị duyệt/ghi nhận giao dịch và giao diện quản trị lịch/nghĩa vụ/giao dịch. Chưa có giao diện quản trị xử lý đối soát nâng cao, cảnh báo qua kênh ngoài ứng dụng hoặc tích hợp chuyển tiền thật.

## Bước 4.3

Đã bổ sung điều kiện email được dịch vụ gửi thư chấp nhận, đúng lịch và có ít nhất 2 giờ trước nhả. Chưa có kênh email thật được nghiệm thu. Tiếp theo: nền tảng sổ khoản phải hoàn/chi trả và quản trị duyệt; cần chốt lịch ngày làm việc và dữ liệu nguồn chi trước triển khai chuyển tiền thật.
