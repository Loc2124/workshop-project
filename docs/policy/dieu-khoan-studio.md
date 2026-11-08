# Điều khoản dành cho studio: payout, hoàn tiền, khiếu nại

> **ĐẶC TẢ/BẢN NHÁP, CHƯA PHÁT HÀNH.** [Phân loại quyết định, đề xuất và hiện trạng](README.md) · [Trạng thái mã](../project/current-status.md). Luồng chi hộ/Bảo Kim/chi trả, hủy/điểm danh từng vé, đệm đối soát và hạn đổi lịch mô tả bên dưới chưa có đầy đủ trong mã. Không dùng bản này để khẳng định đã chuyển tiền hoặc đã cung cấp các chức năng đó.

**BẢN NHÁP, CHƯA CÓ GIÁ TRỊ PHÁP LÝ.** Phạm vi đồ án: dùng để mô tả nghiệp vụ. Nếu triển khai thực tế cần luật sư xem trước khi sử dụng. Các mục có dấu **[chờ chốt]** phụ thuộc quyết định chưa có.

Cập nhật 07/11/2026.

## 1. Phạm vi

Điều khoản này áp dụng cho studio nhận đặt chỗ có thanh toán trước trên Open Slot. Phần tiền trả trực tiếp tại studio nằm ngoài dòng tiền của Open Slot.

## 2. Điều kiện bật cọc

- Chỉ studio đủ điều kiện xác minh mới được chọn chế độ cọc tùy chọn hoặc cọc bắt buộc. Studio chưa xác minh chỉ nhận trả tại studio.
- Studio tự nhập mức cọc là số nguyên từ 1% đến 50%; không có tỷ lệ mặc định.
- Mỗi đặt chỗ lưu chế độ, tỷ lệ và số tiền tại lúc tạo. Thay đổi cấu hình chỉ áp dụng cho đặt chỗ mới.
- Open Slot lưu lịch sử thay đổi cấu hình gồm giá trị trước/sau và người thay đổi.
- Khi studio mất điều kiện xác minh, các đặt chỗ mới chỉ nhận trả tại studio; đặt chỗ đã tạo giữ nguyên.

## 3. Thu tiền và giữ tiền

- Tiền cọc do khách thanh toán bằng chuyển khoản/VietQR qua kênh thu payOS (khả năng tài khoản ảo riêng cần nhà cung cấp xác nhận), vào tài khoản ngân hàng liên kết với payOS của bên vận hành Open Slot (đồ án: tài khoản cá nhân của chủ dự án).
- Bên vận hành giữ tiền đến sau buổi học và chi trả cho studio theo mục 4.
- Studio chịu đúng phí thực tế nhà cung cấp cho từng lần thu, hoàn và chi trả, không cộng phụ phí Open Slot. Công bố cách tính và tính rõ cho studio trước khi bật cọc; trừ phí vào khoản chi của chính buổi học; nếu khoản chi đã hoàn tất thì ghi khoản studio phải hoàn riêng cho buổi đó, không chuyển sang buổi khác. Không trừ phí vào khoản khách được hoàn. Lưu điều kiện phí đã được studio đồng ý và đối soát theo từng giao dịch; không gán mức khi chưa có biểu phí nhà cung cấp.

## 4. Payout

- Chi trả trong **3 ngày làm việc** sau khi buổi học kết thúc, bằng lệnh chi vào **tài khoản ngân hàng của studio**. Tên chủ tài khoản phải khớp tên studio/chủ studio đã xác minh.
- Số tiền chi trả được đối soát từ khoản đã nhận, trừ khoản phải hoàn, điều chỉnh và phí studio chịu theo biểu phí đã công bố. Không tính phí hai lần. Cọc gốc giữ lại khi khách hủy dưới 24 giờ hoặc vắng mặt được tính vào khoản của studio.
- Payout vào tài khoản đã đăng ký của studio. Chỉ chủ studio được sửa thông tin tài khoản; mỗi lần đổi cần xác thực lại, được ghi nhật ký và thông báo cho chủ studio.
- Tạm giữ khi đổi tài khoản, khóa studio hoặc có khiếu nại là mục còn cần xác nhận chi tiết; không coi việc duyệt mọi lệnh chi là đã chốt toàn bộ quyền tạm giữ.
- Nếu khiếu nại được chấp nhận sau khi đã chi trả: Thông thường studio trả lại tiền cho Open Slot trước khi nền tảng hoàn khách. Nếu studio chậm khiến khoản hoàn có nguy cơ vượt 7 ngày làm việc từ lúc hủy, Open Slot tạm ứng hoàn khách đúng hạn, rồi tiếp tục thu hồi từ studio; không bắt khách chờ và không tự gia hạn. Phải đối soát khoản thu hồi; không thay bằng tự trừ vào kỳ chi trả kế tiếp.
- Trong giai đoạn đầu, mọi khoản chuyển hoàn/chi trả, kể cả tạm ứng hoàn khách, đều cần quản trị viên duyệt trước khi thực hiện. Phê duyệt không đặt lại hạn hoàn hoặc chi trả.

## 5. Chính sách hủy (cố định, áp dụng cho mọi studio)

| Tình huống                                                        | Kết quả                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| Khách chưa thanh toán hủy                                         | Không phát sinh phí                                       |
| Khách đã thanh toán, hủy trước giờ học ≥ 24 giờ (gồm đúng 24 giờ) | Hoàn toàn bộ cho khách                                    |
| Khách đã thanh toán, hủy < 24 giờ                                 | Studio nhận cọc gốc; hoàn phần vượt cọc cho khách         |
| Không cọc nhưng đã thanh toán                                     | Hoàn toàn bộ                                              |
| Khách vắng mặt (studio đánh dấu từ 30 phút sau giờ bắt đầu)       | Studio nhận cọc gốc; phần vượt cọc xử lý như hủy < 24 giờ |

Studio không tự thay đổi chính sách này ở bản đầu.

## 6. Khi studio hủy hoặc đổi giờ

- **Studio hủy buổi:** hoàn toàn bộ cho tất cả khách đã trả. Studio không nhận payout cho các đặt chỗ này.
- **Đổi giờ:** khách chọn giữ chỗ hoặc hủy và được hoàn toàn bộ, kể cả khi lịch mới còn dưới 24 giờ. Khách không phản hồi trong 48 giờ (hoặc 12 giờ trước giờ mới nếu sát hơn) thì đặt chỗ tự hủy và hoàn toàn bộ.
- Chỉ cho đổi khi giờ học mới còn trên 12 giờ; còn đúng hoặc dưới 12 giờ thì từ chối đổi. Nếu không thể giữ lịch cũ, studio phải hủy. Hạn phản hồi là thời điểm sớm hơn giữa thông báo + 48 giờ và giờ mới − 12 giờ.
- Đặt chỗ đang chờ cọc khi studio đổi giờ bị hủy và khách phải đặt lại với lịch mới.
- Khi Open Slot hủy đặt chỗ hoặc khóa studio: xử lý như studio hủy, hoàn toàn bộ cho khách (ngoại lệ gian lận khách do admin quyết định).
- Studio hủy hoặc đổi giờ thường xuyên có thể bị nhắc nhở, hạn chế bật cọc hoặc tạm ẩn. **[chờ chốt mức độ]**

## 7. Hoàn tiền

- Open Slot hoàn tiền cho khách bằng chuyển khoản vào tài khoản ngân hàng của khách, tối đa **7 ngày làm việc** kể từ lúc đặt chỗ bị hủy theo lịch nhà nước Việt Nam (gồm ngày nghỉ/nghỉ bù và ngày làm bù được công bố chính thức).
- Studio **không** phải chuyển khoản hoàn hay nhập mã đối chiếu.
- Khi nguồn chi không đủ, xử lý theo hạn đến trước, không phân biệt khoản hoàn hay khoản trả studio; mọi lệnh vẫn cần quản trị duyệt và có cảnh báo thiếu tiền.
- Khoản cần hoàn và khoản đã hoàn được ghi riêng; tiền đã nhận không bị xóa khỏi lịch sử.
- Thiếu hoặc sai thông tin nhận hoàn không đặt lại hạn 7 ngày làm việc tính từ lúc hủy; cảnh báo và yêu cầu khách bổ sung ngay.

## 8. Điểm danh và khoản còn nợ

- Studio chịu trách nhiệm đánh dấu đã đến hoặc vắng cho từng vé. Buổi kết thúc không tự động ghi nhận gì.
- Chỉ được đánh dấu vắng từ 30 phút sau giờ bắt đầu.
- Studio quyết định việc nhận khách đến muộn.
- Khách chưa trả đủ phần còn lại: khoản này là khoản phải thu của studio. Studio chọn **thu** hoặc **miễn**; không có thao tác xóa nợ. Mọi lần thu, miễn, điều chỉnh đều có nhật ký.
- Studio cần cho khách xác nhận hoặc điểm danh đúng số vé thực tế; sai sót phải sửa bằng bút toán điều chỉnh.

## 9. Hủy và điểm danh theo từng vé

Khách có thể hủy từng chỗ. Tiền và cọc chia đều theo số vé, phần dư dồn vào vé cuối cùng. Studio điểm danh theo từng vé. Khi một vé đã phát sinh khoản hoàn, studio không tự sửa điểm danh, kể cả khoản hoàn đã xử lý xong. Quản trị điều chỉnh có lý do và giữ lịch sử. Khoản đã chuyển cho khách không bị xóa; việc thu lại, nếu có, cần đối soát riêng.

## 10. Khiếu nại

- Cửa sổ khiếu nại: **7 ngày** sau buổi học, cho cả khách và studio.
- Admin Open Slot là bên quyết định. Mọi chỉnh sửa là bút toán điều chỉnh mới, lịch sử không bị xóa.
- Studio cung cấp bằng chứng điểm danh khi được yêu cầu.

## 11. Nghĩa vụ vận hành của studio

- Cung cấp địa chỉ đầy đủ, số liên hệ hoạt động, nội dung "Bao gồm", thời gian nung/nhận sản phẩm và yêu cầu chuẩn bị đúng với workshop.
- Sử dụng ảnh và logo mà studio có quyền sử dụng.
- Xử lý kịp thời việc điểm danh, thu/miễn khoản còn nợ và phản hồi khiếu nại.

## 12. Những gì chưa hỗ trợ ở bản đầu

Đổi buổi theo yêu cầu khách, đổi địa điểm, chuyển tên người tham gia.

## 13. Điều cần luật sư rà (nếu triển khai thực tế)

1. Mô hình Open Slot nhận tiền và chi trả có thuộc diện dịch vụ trung gian thanh toán hay cần dùng đối tác có phép.
2. Cách diễn đạt quyền tạm giữ và nghĩa vụ studio trả lại tiền sau chi trả; không tự coi trừ vào kỳ sau là phương án đã chốt.
3. Trách nhiệm khi studio ngừng hoạt động trong lúc Open Slot đang giữ tiền.
4. Nghĩa vụ thuế, hóa đơn cho khoản Open Slot thu hộ và phí dịch vụ.
5. Điều khoản bảo vệ người tiêu dùng cho chính sách hủy cố định 24 giờ.
6. Việc tài khoản ngân hàng cá nhân nhận tiền thu hộ cho nhiều studio: thuế, giấy phép trung gian thanh toán, điều khoản ngân hàng và payOS.
7. Người ký điều khoản phía Open Slot là ai (cá nhân, hộ kinh doanh hay công ty) và trách nhiệm hoàn tiền thuộc về bên nào.

## Làm rõ nhả chỗ do chưa xác nhận (08/11/2026)

Chỉ áp dụng cho đặt chỗ không cọc thuộc diện cần xác nhận và chưa thanh toán. Mốc phản hồi bắt đầu khi dịch vụ gửi thư chấp nhận email yêu cầu xác nhận, không phải lúc tạo thông báo trong tài khoản. Hạn nhả là mốc muộn hơn giữa giờ nhả đã cấu hình và 2 giờ sau khi gửi email thành công. Nếu hạn đó chạm hoặc qua giờ bắt đầu buổi học, không nhả vì thiếu xác nhận. Khách đã xác nhận, đặt mới từ mốc nhả trở đi hoặc đã cọc không bị nhả theo quy tắc này. Sau đổi giờ, email lịch cũ không làm căn cứ cho lịch mới.
