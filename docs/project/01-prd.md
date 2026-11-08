# PRD — Open Slot

Đặc tả đồng bộ 07/11/2026. [Tổng quan](overview.md) · [Trạng thái hiện tại](current-status.md) · [Chính sách](../policy/README.md). P0 là ưu tiên triển khai, không có nghĩa đã hoàn thành.

## Vai trò và thuật ngữ

Giao diện gọi hành động là đặt chỗ, sự kiện có ngày giờ là buổi học, địa điểm là studio và người hướng dẫn là nghệ nhân. Mã dùng workshops/sessions/bookings. Vai hệ thống hiện có customer/studio_owner/admin, quyền studio owner/staff kiểm tra theo membership.

## Yêu cầu và nghiệm thu

| Nhóm                | Yêu cầu/điều kiện nghiệm thu                                                                                                                       | Trạng thái                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Khám phá P0         | Lọc cứng SQL theo giờ Việt Nam, giá, tỉnh/khu vực/loại/chỗ; không đưa dữ liệu mô phỏng ra công khai                                                | Có luồng; kiểm tra lại dữ liệu thực                                     |
| Chi tiết P0         | Workshop không mất trang khi hết lịch; không gắn hết chỗ cho buổi đã kết thúc; nổi bật chỉ buổi đặt được                                           | Có mã và kiểm tra thời gian riêng                                       |
| Cấu hình cọc P0     | none/optional/required; chỉ studio xác minh có cọc; tỷ lệ nguyên 1–50, không mặc định; ghi đè/lịch sử/snapshot                                     | Có mã; thiếu kiểm chứng toàn bộ API/DB                                  |
| Đặt chỗ P0          | Tiền tính tại API; giữ nguyên tử; cọc giữ 15 phút; trả tại studio xác nhận ngay; gửi lại không tạo trùng                                           | Đã khóa cùng mã yêu cầu; còn phục hồi liên kết/đối soát cổng            |
| Nhận tiền P0        | Xác minh giao dịch, chống thông báo trùng, phân biệt chuyển thêm; đối soát khi cổng chậm/mất thông báo                                             | Có webhook cơ bản; còn thiếu đối soát và sổ giao dịch đầy đủ            |
| Hủy P0              | Trước/đúng 24 giờ hoàn toàn bộ; dưới 24 giờ giữ cọc gốc, hoàn phần vượt; không cọc hoàn toàn bộ; hủy từng vé                                       | Công thức/toàn đơn có; từng vé chưa có                                  |
| Đổi lịch P0         | Chỉ đổi khi giờ mới trên 12 giờ; hạn min(báo+48 giờ, giờ mới−12 giờ); phiên bản đồng ý; không phản hồi tự hủy/hoàn                                 | Đã có phiên bản/hạn/tự hủy và khoản cần hoàn; chưa chi hoàn tự động     |
| Hoàn/chi trả P0 mới | Chi trả trong 3 ngày làm việc; hoàn 7 ngày làm việc từ lúc hủy; mọi khoản admin duyệt/theo hạn; phí thực tế studio; tạm ứng giữ hạn; chống chi lặp | Mục tiêu; hiện chỉ ghi nhận hoàn studio thủ công                        |
| Vé/tham dự P0       | Vé khi xác nhận, chỉ chủ đặt chỗ xem; hủy vô hiệu đúng vé; điểm danh từng vé, không tự suy từ hết giờ                                                  | Đã điểm danh từng vé/S+30/khóa sửa khi có khoản hoàn; hủy từng chỗ và thay mã cọc đã có ở 4.2 |
| Thu và khoản nợ P0  | Thu thực tế, không đổi theo thứ tự điểm danh; miễn/điều chỉnh có lý do, không xóa lịch sử                                                          | Đã sửa thu sau completed; chưa miễn/điều chỉnh đầy đủ                   |
| Nhắc P0             | Nhắc 24 giờ/2 giờ; ít nhất 2 giờ từ email được dịch vụ chấp nhận mới nhả; gửi lỗi không nhả; miễn sau mốc nhả                                                | Đã có khoảng phản hồi và đúng phiên bản lịch (4.3); cần nghiệm thu email thật |
| Quản trị P0         | Quyền admin, nội dung/tài khoản/đặt chỗ/audit; đường hủy đồng bộ cùng chính sách tiền                                                              | Có module; đường hoàn quản trị còn lệch                                 |
| Xếp hạng đồ án      | Lọc cứng trước ranker; baseline/fallback; đánh giá mô hình bằng nhãn riêng                                                                         | Đặc tả, chưa hoàn chỉnh trong luồng sản phẩm                            |
| Đánh giá            | Chỉ sau tham dự hợp lệ, không lấy paid đơn thuần làm bằng chứng đã đến; dữ liệu đánh giá không làm nhãn relevance                                  | Có dữ liệu/đọc; luồng tạo và nghiệm thu còn thiếu                       |

## Ma trận thanh toán bắt buộc

| Chế độ   | Bộ chọn                    | Nút đặt chỗ                   | Sau khi đặt                                   |
| -------- | -------------------------- | ----------------------------- | --------------------------------------------- |
| none     | Ẩn, ghi Trả tại studio     | Đặt chỗ · Trả tại studio      | Xác nhận ngay, không QR/đồng hồ               |
| optional | Cọc trước / Trả tại studio | Theo lựa chọn và số tiền động | Cọc → giữ 15 phút; tại studio → xác nhận ngay |
| required | Ẩn, ghi cần cọc            | Đặt chỗ · Cọc số tiền         | Giữ 15 phút, QR và xác minh tiền              |

Mức cọc thử 1/5/20/50; 51 phải bị từ chối. Các phần đệm 3 phút, chi hộ, VietQR Pro, hạn 48 giờ/12 giờ, vắng S+30 phút và phí đều đọc theo trạng thái tại policy; không tự coi là mã đã có.

## Ngoài phạm vi bản đầu

Ứng dụng native, chat, mã giảm giá/thành viên, đa ngôn ngữ; chưa hỗ trợ đổi buổi/địa điểm/chuyển tên. **Không còn loại hoàn tự động hoặc chi trả khỏi phạm vi:** đó là P0 mới cần triển khai. Các quyết định chưa chốt không được biến thành mặc định.

## Cập nhật phạm vi 4.2 (08/11/2026)

Đã bổ sung hủy từng chỗ và thay mã cọc theo số chỗ gốc còn lại, giữ nguyên hạn giữ chỗ. Lưu lịch sử số chỗ/tổng tiền/cọc ban đầu; chỉ vô hiệu vé đã chọn. Tiền về mã cũ hoặc mã mới được xác minh và áp dụng một lần, phần dư hoặc không thể xác nhận được ghi cần hoàn. Chưa có chi hoàn tự động hoặc đối soát cổng toàn hệ thống. Chi tiết triển khai và bằng chứng kiểm tra tại [trạng thái hiện tại](../project/current-status.md) và [API](../engineering/03-api-spec.md).
