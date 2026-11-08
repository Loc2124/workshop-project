# Vận hành thu tiền, hoàn và chi trả studio

Đồng bộ 07/11/2026. [Mục lục](../README.md) · [Chính sách](../policy/README.md) · [Trạng thái mã](../project/current-status.md).

## Mã hiện tại

Thu cọc dùng một kênh payOS của nền tảng; MockProvider chỉ dành phát triển/kiểm tra. Chỉ kết quả được xác minh mới ghi nhận tiền. Phần còn lại khách trả trực tiếp cho studio.

Khi có khoản hoàn, API hủy ghi refund_due_amount/refund_status. Hiện chủ studio tự chuyển tiền rồi nhập số tiền khớp và mã đối chiếu tại POST /studios/:studioId/bookings/:id/refund. Đây chỉ là **ghi nhận thủ công**, không chuyển khoản. Giữ bằng chứng và xác nhận người có quyền; không bấm ghi nhận khi mới yêu cầu hoàn.

Chưa có cấu hình ví Bảo Kim, sổ nạp ví, số dư ví, API chi hộ, chi trả studio, xác minh tài khoản tự động qua ngân hàng hoặc worker tự chuyển khoản hoàn đúng hạn. Không tự điền biến môi trường hay chỉ dẫn gọi lệnh chi chưa được triển khai.

## Nền tảng sổ tài chính (bước 5, đang triển khai)

Migration 044 thêm `financial_obligations`, `financial_transfers` và nhật ký sự kiện giao dịch. Worker định kỳ lập nghĩa vụ hoàn theo từng vé và khoản thu thừa; mỗi khoản có nghĩa vụ khách nhận tiền và nghĩa vụ studio hoàn tiền về Open Slot, với hạn tính theo lịch nhà nước. Worker không chuyển tiền. Quản trị có thể lập giao dịch inbound/outbound chờ duyệt, duyệt riêng, rồi ghi nhận kết quả sau khi kiểm tra thủ công. Mọi giao dịch chỉ được ghi nhận thành công sau duyệt, có mã đối chiếu, nhà cung cấp và phí thực tế. Phí được trừ vào khoản chi studio của chính buổi; phần vượt khoản chi chưa cam kết thành khoản studio phải hoàn riêng cho buổi đó. Hoàn khách bị chặn đến khi studio đã chuyển đủ khoản tương ứng, trừ khoản tạm ứng do quản trị duyệt. Không được coi đã duyệt là đã chuyển.

Giao diện quản trị tại `/admin/tai-chinh` có danh sách nghĩa vụ, giao dịch, duyệt/ghi nhận kết quả và cập nhật lịch nhà nước. Studio có thể gửi khoản hoàn về Open Slot từ mục quản lý đặt chỗ; khoản gửi chỉ được tính là tiền đã nhận sau khi quản trị duyệt và đối soát. Luồng studio hoàn thẳng cho khách đã bị khóa. Còn thiếu giao diện đối soát nâng cao, worker cảnh báo hạn, kiểm tra nguồn chi và tích hợp chuyển tiền thật.

### Lịch ngày làm việc Việt Nam

Đã chốt theo lịch nghỉ nhà nước tại Việt Nam, dùng múi giờ `Asia/Ho_Chi_Minh`. Ngoài thứ Hai–thứ Sáu mặc định, lịch lưu cả ngày nghỉ và ngày đi làm bù theo thông báo chính thức. Mỗi ngày ngoại lệ phải kèm căn cứ/văn bản nhà nước; không tự suy đoán hoặc tự tải lịch không có nguồn.

Migration 045 đã áp dụng vào cơ sở dữ liệu hiện cấu hình, tạo bảng ngoại lệ lịch nhà nước có lịch sử và hàm tính hạn 3/7 ngày; lịch đã có ngày 24/11/2026 theo thông tin chính thức về Ngày Văn hóa Việt Nam. Quản trị có thể xem `/admin/tai-chinh/lich-nghi?year=2027`, thêm ngày nghỉ hoặc ngày làm bù bằng `POST /admin/tai-chinh/lich-nghi` với `{ "date": "2027-01-01", "type": "non_working", "label": "Tết Dương lịch", "officialReference": "Thông báo ..." }`, và ngừng áp dụng ngày bằng `DELETE /admin/tai-chinh/lich-nghi/2027-01-01`. Ngày làm bù dùng `type: "working"`. Giao diện quản trị lịch đã được thêm; dữ liệu cho năm khác phải nhập theo thông báo chính thức.

### Hạn chi trả và khoản hoàn phát sinh muộn

Studio được chi đúng hạn theo các khoản hoàn đã được ghi nhận đến thời điểm lập nghĩa vụ chi. Khoản hoàn phát sinh sau đó thuộc trách nhiệm studio và được lập thành nghĩa vụ thu hồi riêng; không sửa lịch sử giao dịch chi đã hoàn tất. Mọi khoản chi khách, chi studio hoặc tạm ứng vẫn cần quản trị duyệt. Đã lưu thời điểm và số liệu chốt cho khoản chi dương, bằng 0 hoặc âm. Chưa có cơ chế tự tạo khoản thu hồi cho studio. Không dùng quy tắc này để trì hoãn khoản hoàn khách có hạn 7 ngày.

## Dòng tiền mục tiêu theo tài liệu cập nhật

### Tài khoản nhận tiền trước khi chi

- Chủ studio nhập hoặc đổi tài khoản nhận chi trả sau khi xác nhận lại mật khẩu. Khách tự nhập mã ngân hàng, số tài khoản và tên chủ tài khoản riêng cho từng khoản hoàn đang chờ và cũng xác nhận lại mật khẩu.
- Số tài khoản được mã hóa bằng khóa riêng `FINANCIAL_ACCOUNT_ENCRYPTION_KEY`; giao diện của chủ tài khoản chỉ xem bốn số cuối. Khóa phải được lưu an toàn và sao lưu theo quy trình vận hành; mất khóa sẽ không giải mã được các tài khoản đã lưu. Môi trường chưa cấu hình khóa sẽ khóa chức năng lưu tài khoản.
- Quản trị đối chiếu tài khoản với chứng từ bên ngoài, ghi mã chứng từ và kết quả trước khi duyệt. Lệnh hoàn khách và chi studio chỉ được duyệt khi tài khoản nhận hiện tại đã xác minh. Lệnh đã duyệt giữ bản ghi tài khoản gốc; nếu người nhận đổi tài khoản trước khi chi, phải xử lý lệnh cũ rồi lập lệnh mới.
- Tài khoản nhận hoàn gắn với từng `refund_id`, mặc định không dùng lại cho khoản hoàn hoặc đặt chỗ khác. Khách có thể chủ động chọn lưu tài khoản cho các lần hoàn sau; ô chọn mặc định tắt. Khi dùng lại, khách chọn tài khoản đã lưu và xác nhận mật khẩu, hệ thống tạo bản gắn riêng với khoản hoàn mới để quản trị đối chiếu lại. Nguồn hiện dùng là `customer_input` hoặc `saved_account`; `payment_source` là trường dự phòng, chưa có luồng lấy dữ liệu từ cổng thu.
- Khách xem danh sách số đã che và xóa tài khoản dùng lại bất cứ lúc nào tại `/me/refund-accounts`. Xóa làm mất ngay số đầy đủ, mã ngân hàng và tên chủ trên bản lưu dùng lại. Bản đã gắn với khoản hoàn đang xử lý được giữ riêng theo thời hạn đối soát của khoản đó, không tự xóa theo thao tác xóa bản dùng lại. Tài khoản lưu dùng lại được giữ đến khi khách xóa; giao diện giải thích rõ mục đích chỉ để hoàn tiền và thời gian giữ.
- Admin chỉ thấy số đã che trong danh sách; mỗi lần mở số đầy đủ qua API riêng đều ghi nhật ký người xem và thời điểm. Studio không có quyền xem số tài khoản khách. Không ghi số đầy đủ trong URL, thông báo hoặc nhật ký lỗi.
- Sau khi khoản hoàn đã chi thành công và qua 7 ngày dương lịch để khiếu nại, worker xóa số đầy đủ, mã ngân hàng và tên chủ tài khoản; giữ bốn số cuối cùng bản ghi lệnh chi, thời gian, số tiền, mã đối chiếu. Tài khoản bị từ chối hoặc bị thay thế mà chưa gắn lệnh chi được xóa sớm hơn. Lệnh chưa rõ kết quả vẫn giữ dữ liệu để tra cứu và đối soát.
- Đây là đối chiếu thủ công trong ứng dụng. Chưa có xác minh tên chủ tài khoản qua ngân hàng hay API chuyển tiền thật. Không đánh dấu đã chi chỉ vì tài khoản đã được duyệt.
- Khi kết quả chuyển chưa rõ, quản trị ghi lý do và chuyển giao dịch sang `manual_review`; số tiền vẫn được giữ trong hạn mức, không lập giao dịch thay thế. Sau khi đối chiếu ngân hàng, quản trị ghi nhận thành công với mã đối chiếu và phí thực tế hoặc xác nhận thất bại với lý do. Chỉ giao dịch đã xác nhận thất bại mới giải phóng hạn mức để lập giao dịch mới; khoản hoàn trên trang khách hiển thị trạng thái đang đối chiếu hoặc chuyển thất bại, không báo đã hoàn trước khi ghi nhận thành công.
- Khi giao dịch hoàn đã được duyệt, đang chuyển hoặc chưa rõ kết quả, khách không thể đổi tài khoản nhận tiền của khoản hoàn đó. Xóa tài khoản lưu dùng lại không xóa bản đã gắn riêng với khoản hoàn đang xử lý. Nếu chuyển thất bại, khách có thể cập nhật tài khoản sau khi quản trị ghi nhận kết quả thất bại.
- Trang tài chính quản trị có hàng chờ riêng cho giao dịch chờ duyệt, đã duyệt, chưa rõ kết quả và chuyển thất bại; ưu tiên hạn xử lý sớm, lọc quá hạn/sắp đến hạn/trạng thái. Mỗi giao dịch hiển thị mã đối chiếu, tài khoản nhận đã che và lịch sử người xử lý, lý do, thời điểm và phí thực tế. Danh sách nghĩa vụ sắp hoặc đã quá hạn cũng xuất hiện trong hàng chờ. Theo quyết định đã chốt, chứng từ đối chiếu chỉ dùng mã giao dịch và ghi chú, không lưu tệp đính kèm.
- Kiểm tra tích hợp `refund-settlement-flow.test.ts` đã đạt trên DB test riêng: lưu mặc định tắt, lưu/dùng lại/xóa, giữ bản gắn với khoản hoàn, khóa đổi tài khoản lúc đối soát, khóa chi trùng, xử lý thất bại và hoàn một phần, chỉ ghi thành công một lần, giữ số đầy đủ ở ngày thứ 6 và xóa sau ngày thứ 7. Đây là kiểm tra ứng dụng với ghi nhận chuyển tiền mô phỏng bởi quản trị, chưa xác minh giao dịch ngân hàng thật.

```text
Khách → kênh thu payOS → tài khoản ngân hàng bên vận hành
                             ↓ nạp ví theo quy trình cần xác nhận
                         nguồn tiền chi
                      ↙                 ↘
           tài khoản khách hoàn      tài khoản studio nhận chi trả
```

Tên nhà cung cấp nguồn chi dự kiến là Bảo Kim qua kênh chi hộ payOS. Sự kết nối, loại kênh và khả năng API phải xác minh bằng hợp đồng/tài liệu chính thức và môi trường của bên vận hành. Không suy từ việc có API thu rằng đã có API chi hoặc số tiền thu tự động vào ví.

## Cần triển khai trước khi dùng luồng chi

1. Lưu từng giao dịch nhận tiền riêng biệt; tiền thừa/thiếu/chuyển thêm vào hồ sơ đối soát, không mất dấu hoặc gộp sai.
2. Tài khoản nhận hoàn/chi trả có kiểm tra và phân quyền. Chỉ chủ studio đổi tài khoản, có xác thực lại và lịch sử; quy tắc tạm giữ còn chờ chốt.
3. Tạo bản ghi lệnh chi trước khi gọi nhà cung cấp, khóa chống lặp cố định; khi không rõ kết quả phải tra cứu, không tạo lệnh khác.
4. Lưu chuyển trạng thái awaiting_destination/queued/awaiting_funds/submitting/processing/succeeded/failed/manual_review là **đề xuất mô hình**, chưa phải enum DB/API hiện tại.
5. Kiểm tra số dư cộng phí; có sổ nạp ví, đối soát thu − hoàn − chi trả − phí với ngân hàng/nguồn chi; phí thực tế được trừ vào khoản chi của đúng buổi, nếu khoản chi xong thì ghi khoản studio phải hoàn riêng cho buổi đó; không trừ hai lần hoặc chuyển sang buổi khác. Thiếu tiền không tự gia hạn. Theo dõi riêng khoản tạm ứng và phải thu studio để không tính tiền dự phòng thành doanh thu hoặc thu cọc.
6. Tính 7 ngày làm việc từ lúc hủy bằng lịch cấu hình được xác nhận, không cộng 7 ngày dương lịch và không đặt lại hạn khi thiếu tài khoản. Theo bản nháp dùng thứ Hai–Sáu trừ lễ; không dựng lịch lễ bằng phỏng đoán. Cảnh báo và yêu cầu bổ sung ngay, cảnh báo trước hạn/quá hạn.
7. Chi trả studio trong 3 ngày làm việc; khiếu nại trong 7 ngày. Thông thường studio trả lại tiền cho Open Slot trước khi nền tảng hoàn khách. Nếu studio chậm khiến khoản hoàn có nguy cơ vượt 7 ngày làm việc từ lúc hủy, Open Slot tạm ứng hoàn khách đúng hạn, rồi tiếp tục thu hồi từ studio; không bắt khách chờ và không tự gia hạn. Studio chịu phí thực tế của nhà cung cấp, không phụ phí Open Slot. Trừ phí vào khoản chi của chính buổi học; nếu đã chi xong thì studio chuyển bù riêng cho buổi đó, không chuyển sang buổi khác. Công bố/tính rõ trước bật cọc. Mọi lệnh chi (kể cả tạm ứng) phải quản trị duyệt; xử lý theo hạn đến trước không phân biệt loại.
8. Khi chuyển từ ghi nhận hoàn thủ công sang nền tảng chi tự động, cần kế hoạch đối soát và khóa đường chi lặp; không để studio và nền tảng cùng chuyển cho một khoản.

## Quy trình sự cố cần có

Mất thông báo thu; giao dịch đúng hạn báo chậm; tài khoản nhận sai; timeout lệnh chi; hết tiền nguồn chi; khiếu nại sau chi trả; sửa nhầm ghi nhận thu/hoàn. Mọi xử lý giữ nguyên lịch sử và thêm điều chỉnh, có người phụ trách, lý do và kết quả. Không coi đã gửi lệnh là đã hoàn thành chuyển tiền.

## Phạm vi bổ sung 4.2

Có booking_seats giữ số chỗ gốc và tiền theo chỗ, booking_extra_refunds giữ các khoản thu không áp dụng/thu dư sau hủy một phần, booking_refund_receipts giữ khoản đã ghi nhận chuyển. Chỉ ghi nhận tiền vào/tiền cần hoàn, không có lệnh chuyển tiền ra tự động. Không coi tổng tiền phần chỗ còn lại là tổng tiền đã nhận.

Tra cứu/hủy liên kết thu payOS được dùng khi thay mã sau hủy bớt chỗ. Tạo kết quả chưa rõ phải tra cứu cùng mã trước thử lại; chỉ 404 được coi là chưa tồn tại, phản hồi không xác minh được giữ trạng thái cần khôi phục. Nhà cung cấp báo PAID vẫn chờ webhook đã xác minh. Hủy mã cũ là best-effort; không bỏ qua tiền thực chuyển về mã cũ. Cần thử tài khoản thật cho chữ ký tra cứu, QR có thể không được trả lại, thời hạn, thông báo đến chậm và nhiều lần chuyển trên một hóa đơn. Chưa có polling cổng toàn hệ thống hoặc đối soát ngân hàng.

041 đã bổ sung nền tảng; 042 chỉ sửa baseline chỗ của lượt giữ đã hết hạn theo logic cũ, không đổi bộ đếm chỗ hoặc lịch sử tiền. Migration đã áp không được sửa nội dung.

## Nhả chỗ không cọc (4.3)

Không phát sinh khoản thu hoặc lệnh hoàn từ việc nhả do thiếu xác nhận: chỉ nhả đặt chỗ không cọc, chưa trả tiền, còn hiệu lực, sau hạn thực tế dựa trên email đã được dịch vụ chấp nhận ít nhất 2 giờ. Không nhả buổi đã bắt đầu. Đây tách biệt với hết hạn giữ chỗ 15 phút của luồng cọc; không lấy thời điểm gửi email để gia hạn giữ chỗ cọc.
