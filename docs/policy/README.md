# Chính sách: nguồn, quyết định và phần còn mở

Đồng bộ 08/11/2026. [Mục lục dự án](../README.md) · [Trạng thái mã](../project/current-status.md).

## Ba tài liệu trong bộ policy

- [Chính sách khách](chinh-sach-dat-cho-khach.md): bản nội dung hướng khách, chưa phát hành.
- [Điều khoản studio](dieu-khoan-studio.md): thu/hoàn/chi trả, trách nhiệm studio; bản nháp chưa dùng làm điều khoản hiệu lực.
- [Bảng chuyển trạng thái](bang-chuyen-trang-thai.md): đặc tả mục tiêu A–J, không phải schema hay API đã tồn tại.

Đã đọc và tích hợp [bản yêu cầu cập nhật tài liệu](../archive/changes/cap-nhat-tai-lieu-du-an.md) vào [tổng quan dự án](../project/overview.md). Bản nguồn được lưu để truy nguyên, không còn dùng thao tác “dán đè” lần nữa.

## Quyết định chủ sản phẩm đã xác nhận

| Quy tắc                    | Nội dung                                                                                                                                                               | Mã hiện tại                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Chế độ cọc                 | none/optional/required; studio chưa xác minh chỉ none; tự nhập số nguyên 1–50%, không gán tỷ lệ mặc định                                                               | Đã có; cần kiểm tra tích hợp đầy đủ                                            |
| Giá/chính sách tại lúc đặt | Lưu chế độ/tỷ lệ/tiền cọc; cấu hình mới không tính lại đặt chỗ cũ                                                                                                      | Đã có; bản chụp lịch/địa điểm/điều khoản chưa đủ                               |
| Giữ chỗ                    | Cọc giữ 15 phút; trả tại studio xác nhận ngay, không QR/đồng hồ                                                                                                        | Đã có; đệm/đối soát là yêu cầu bổ sung chưa có                                 |
| Khách hủy                  | Chưa trả luôn miễn phí; từ đúng 24 giờ trước buổi trở về trước hoàn toàn bộ; dưới 24 giờ chỉ giữ cọc gốc, hoàn phần đã trả vượt cọc                                    | Công thức/API/modal đã cập nhật; chưa hủy từng vé                              |
| Không cọc nhưng đã trả     | Hoàn toàn bộ khi hủy, kể cả dưới 24 giờ                                                                                                                                | Đã có theo cọc gốc bằng 0                                                      |
| Tiền về muộn               | Còn đủ chỗ cho toàn nhóm và buổi còn nhận đăng ký thì xác nhận lại; nếu không thì hoàn; khách đã hủy không tự khôi phục                                                | Có nhánh cơ bản; chưa đối soát trực tiếp cổng hoặc dùng giờ giao dịch xác minh |
| Studio hủy/đổi giờ         | Studio hủy hoàn toàn bộ; đổi giờ khách chọn giữ/hủy; chưa đồng ý trước hạn min(báo + 48 giờ, giờ mới − 12 giờ) thì tự hủy và hoàn; chỉ đổi khi giờ mới còn trên 12 giờ | Đã có phiên bản/hạn/tự hủy/ghi hoàn toàn bộ; chưa chi hoàn tự động             |
| Thời hạn hoàn              | Tối đa 7 ngày làm việc                                                                                                                                                 | Đã có copy; chưa có lịch ngày nghỉ, hạn lưu riêng và cảnh báo quá hạn          |
| Nhóm nhiều người           | Hủy từng chỗ, điểm danh từng vé                                                                                                                                        | Đã điểm danh từng vé và hủy từng chỗ/thay QR (4.2)                             |
| Đặt sau mốc nhả            | Đặt mới từ mốc nhả trở đi, còn chỗ/trong hạn thì xác nhận ngay với trả tại studio; miễn xác nhận sẽ đến                                                                | Đã có; không tự điểm danh đã đến                                               |

## Chín quyết định bổ sung đã chốt

Chủ sản phẩm đã xác nhận cả chín nhóm và ba điểm làm rõ: tạm ứng giữ hạn hoàn; phí thực tế không phụ phí; chỉ đổi khi giờ mới còn trên 12 giờ. Đây là yêu cầu nghiệp vụ, không phải báo cáo đã triển khai.

| Nhóm                   | Quyết định                                                                                                                                                                                                                                                                 | Trạng thái mã                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Đổi giờ                | Chỉ cho đổi khi giờ học mới còn trên 12 giờ; còn đúng hoặc dưới 12 giờ thì từ chối đổi. Nếu không thể giữ lịch cũ, studio phải hủy. Hạn phản hồi là thời điểm sớm hơn giữa thông báo + 48 giờ và giờ mới − 12 giờ.                                                         | Đã triển khai ở bước 3; chưa kiểm chứng email/chi hoàn thật                 |
| Chi trả studio         | Trong 3 ngày làm việc sau khi buổi kết thúc.                                                                                                                                                                                                                               | Chưa có payout/lịch làm việc                                                |
| Khiếu nại sau chi trả  | Thông thường studio trả lại tiền cho Open Slot trước khi nền tảng hoàn khách. Nếu studio chậm khiến khoản hoàn có nguy cơ vượt 7 ngày làm việc từ lúc hủy, Open Slot tạm ứng hoàn khách đúng hạn, rồi tiếp tục thu hồi từ studio; không bắt khách chờ và không tự gia hạn. | Chưa có thu hồi/tạm ứng/sổ phải thu studio; không tự trừ vào payout kế tiếp |
| Hạn hoàn               | 7 ngày làm việc từ lúc hủy; thiếu/sai tài khoản không đặt lại hạn. Cảnh báo và yêu cầu bổ sung ngay.                                                                                                                                                                       | Copy đã có; chưa có hạn lưu riêng/cảnh báo/lịch nghỉ                        |
| Vắng mặt               | Chỉ giữ cọc gốc; hoàn phần đã trả vượt cọc. Không cọc thì phần giữ bằng 0.                                                                                                                                                                                                 | Đã ghi khoản cần hoàn theo từng vé vắng; chưa chuyển hoàn tự động           |
| Thứ tự chi             | Khoản nào đến hạn trước xử lý trước, không phân biệt hoàn khách hay chi trả studio.                                                                                                                                                                                        | Chưa có hàng đợi lệnh chi/số dư                                             |
| Phí                    | Studio chịu đúng phí thực tế nhà cung cấp cho từng lần thu, hoàn và chi trả, không cộng phụ phí Open Slot. Công bố cách tính và tính rõ cho studio trước khi bật cọc; trừ phí vào khoản chi của chính buổi học; nếu khoản chi đã hoàn tất thì ghi khoản studio phải hoàn riêng cho buổi đó, không chuyển sang buổi khác. Không trừ phí vào khoản khách được hoàn.                                                         | Đã có sổ ghi phí thu theo từng giao dịch; khoản chi cùng buổi trừ phí thực tế, phần chưa trừ được ghi phải thu riêng gắn với buổi đó. Cần cấu hình biểu phí thực tế trước khi bật cọc    |
| Duyệt lệnh chi         | Mọi khoản chuyển, gồm khoản tạm ứng hoàn khách, đều cần quản trị duyệt trong giai đoạn đầu. Bước duyệt không đặt lại hạn.                                                                                                                                                  | Chưa có quy trình duyệt/lệnh chi                                            |
| Cơ hội xác nhận sẽ đến | Ít nhất 2 giờ sau thông báo yêu cầu xác nhận gửi thành công. Chưa gửi được thì không nhả do thiếu xác nhận.                                                                                                                                                                | Đã kiểm tra email được dịch vụ chấp nhận, đúng phiên bản lịch, tối thiểu 2 giờ (4.3)                         |

## Đặc tả bổ sung từ bốn file đầu vào — chưa phải tính năng đã có

- Nền tảng thu cọc qua payOS; mục tiêu chi hoàn/chi trả studio qua chi hộ, nguồn số dư ví Bảo Kim. Hiện mới có thu cọc và hoàn thủ công do studio ghi nhận, **chưa có tích hợp ví/lệnh chi/chi trả**.
- Giờ trả đúng hạn lấy theo giao dịch được xác minh; đệm 3 phút rồi đối soát trước nhả. Ưu tiên người trả đúng hạn khi người khác mới giữ chỗ là yêu cầu cần thiết kế, chưa có trong mã.
- Chuyển thiếu hoàn riêng, không cộng dồn; thừa hoàn phần thừa; chuyển thêm sau khi đã cọc cần hoàn riêng. Chưa có sổ tiền và quy trình đối soát này.
- Hạn 48 giờ/12 giờ, điều kiện giờ mới trên 12 giờ, phiên bản đồng ý và hủy chờ cọc khi đổi giờ đã có ở bước 3. Hoàn vẫn mới ghi khoản cần xử lý, chưa chi tiền tự động.
- Phân bổ tiền theo vé, dư vào vé cuối; đã đến sau giờ bắt đầu, vắng từ S + 30 phút; khoản nợ studio có thể thu/miễn; khiếu nại trong 7 ngày sau buổi. Những nhánh này chưa triển khai đầy đủ.
- Chi trả trong 3 ngày làm việc, studio chịu phí và mọi lệnh chi cần quản trị duyệt đã chốt; chưa có quy trình thực thi hoặc kiểm chứng nhà cung cấp.

## Các điểm còn cần chốt/xác minh

Không còn treo chín quyết định và ba điểm làm rõ ở trên. Không hỏi lại hoặc giữ phương án cũ như thể chưa chốt.

Các chi tiết vận hành chưa được mặc định:

1. Đã chốt cách 1: dịch vụ gửi thư chấp nhận email mới bắt đầu tính 2 giờ; thông báo trong tài khoản chưa đủ. Hạn = max(mốc nhả đã cấu hình, email gửi thành công + 2 giờ). Nếu hạn chạm/qua giờ bắt đầu, không nhả vì thiếu xác nhận. Còn cần cấu hình và nghiệm thu kênh gửi thư thật; chấp nhận email không đồng nghĩa khách đã đọc hoặc email đã vào hộp thư đến.
2. Mức phí thực tế/biểu phí và hành vi nhà cung cấp cần xác minh, không phải câu hỏi chọn bên chịu phí nữa. Xác minh loại kênh VietQR Pro, timestamp/tài khoản đối ứng, thiếu/thừa/chuyển lần hai/sau hạn, số dư/nạp ví/hạn mức/chữ ký/tra cứu và thông báo lệnh chi.
3. Quyền tạm giữ khi studio bị khóa/đổi tài khoản; chế tài studio hủy thường xuyên; N ngày dự báo nhu cầu nạp ví; lịch nghỉ làm việc. Không tự gán ngưỡng hoặc quyền khấu trừ kỳ sau chưa được chấp nhận.
4. Nguồn tiền dự phòng/tạm ứng và người phụ trách phải được chuẩn bị để giữ hạn, mọi lệnh quản trị duyệt. Chưa có hạn mức/quy trình thu hồi studio trong mã; khoản studio phải trả được theo dõi riêng, không làm khách chờ quá hạn.
5. Tên bên vận hành/nhận tiền và nội dung được phép phát hành; danh sách cần rà trong điều khoản studio là câu hỏi chuyên môn, không phải kết luận pháp lý.

Không đăng công khai ba bản nháp trước khi đồng bộ khả năng thực tế, biểu phí, mục còn mở và thông tin bên vận hành. Lịch sử trước quyết định này nằm ở [lưu trữ thay đổi](../archive/README.md).

## Quyết định bổ sung ngày 08/11/2026

Các quyết định về lịch ngày làm việc Việt Nam, hạn hoàn/chi trả và khoản hoàn phát sinh sau khi chi được ghi tại [Lịch ngày làm việc và quyết toán](financial-calendar-and-settlement.md). Đây là quyết định đã chốt ngày 08/11/2026; tài liệu vận hành mô tả mức triển khai thực tế.

- Hủy bớt nhóm đang chờ cọc: đổi mã theo số chỗ còn lại, giữ nguyên hạn giữ chỗ ban đầu. Không tạo lại đồng hồ 15 phút. Đã triển khai ở 4.2; khoản hoàn chưa có lệnh chuyển tiền tự động.
- Ví dụ QR cũ 30.000 đ, QR mới 20.000 đ: nếu tiền về mã cũ và các chỗ còn lại đủ điều kiện, dùng 20.000 đ xác nhận, hoàn dư 10.000 đ; không khôi phục chỗ đã hủy. Nếu mã mới đã được thanh toán hoặc không thể xác nhận thì hoàn toàn bộ khoản về thêm. Đã chốt cách 1 sau khi làm rõ, không hoàn toàn bộ rồi buộc chuyển lại khi vẫn có thể áp dụng đúng phần tiền.
- Vé đã phát sinh khoản hoàn: studio không tự sửa điểm danh, kể cả khoản hoàn đã xong hoặc đã được quản trị dừng. Chỉ quản trị xử lý có lý do và lịch sử. Tiền đã chuyển không bị xóa; nếu cần thu lại thì đối soát riêng. Phần khóa/điều chỉnh đã có ở 4.1.

## Quyết định kênh xác nhận và triển khai 4.3

Đã chốt cách 1 ngày 08/11/2026: chỉ tính 2 giờ từ email được dịch vụ gửi thư chấp nhận. Thông báo trong tài khoản không thay thế bằng chứng này. Không gửi được hoặc không còn đủ 2 giờ trước buổi thì không nhả vì thiếu xác nhận. Worker, API xác nhận và lượt đọc/đặt chỗ dùng chung điều kiện; khách vẫn được xác nhận sau mốc nhả dự kiến khi hạn thực tế chưa tới. Không suy điểm danh từ nút xác nhận sẽ đến. Phạm vi kiểm chứng cập nhật ở current-status.
