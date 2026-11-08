# Trạng thái mã nguồn Open Slot

Cập nhật tài liệu 08/11/2026, đối chiếu mã đang có trong workspace (gồm thay đổi chưa commit). Đây không phải xác nhận production. [Mục lục](../README.md) · [Chính sách](../policy/README.md) · [Roadmap](roadmap.md).

## Đã tìm thấy triển khai

- Tài chính: migration 044–054 đã áp thành công vào DB hiện cấu hình. Có sổ nghĩa vụ/giao dịch, duyệt bắt buộc, worker tạo nghĩa vụ hoàn theo vé/khoản thu thừa, luồng studio gửi khoản chuyển về Open Slot, chặn hoàn khách vượt nguồn đã nhận trừ tạm ứng được duyệt, và giao diện quản trị tài chính/lịch nhà nước/đối soát số liệu chốt chi. Worker tạo cảnh báo trong ứng dụng cho quản trị khi khoản có hạn còn trong 24 giờ hoặc đã quá hạn, chống gửi lặp theo từng mốc. Phí thực tế được trừ vào khoản chi cùng buổi; phần dư sau khi chốt chi thành khoản studio phải hoàn riêng. Migration 045 thêm ngày 24/11/2026 theo thông báo chính thức; giao dịch thật vẫn do quản trị chuyển/đối soát thủ công. Tài khoản hoàn gắn riêng từng khoản hoàn, mã hóa số đầy đủ, chỉ admin mở xem có nhật ký; worker xóa chi tiết sau khi hoàn thành và qua 7 ngày dương lịch. Khách có thể tự chọn lưu tài khoản cho lần hoàn sau (mặc định tắt) và tự xóa; bản lưu dùng lại giữ đến khi khách xóa.

- Trang chủ/khám phá, chi tiết workshop/studio; workshop và từng buổi tách biệt; trạng thái theo giờ/hạn đăng ký, giữ trang khi hết lịch; mục nổi bật chỉ lấy buổi còn đặt được.
- Đăng ký/đăng nhập, JWT cookie/refresh session và quyền hệ thống customer/studio_owner/admin; owner/staff qua studio_members. Có quản trị tài khoản/nội dung/danh mục/studio/cấu hình/audit.
- Studio: hồ sơ/ảnh/xác minh, workshop/buổi, ba chế độ cọc, mức 1–50% tự nhập, ghi đè workshop và lịch sử cấu hình.
- Đặt chỗ: tính tiền phía API, khóa sức chứa, bản chụp cọc, giữ 15 phút hoặc xác nhận ngay tại studio/miễn phí, webhook có xác minh/chống lặp, vé và lịch sử.
- Gửi lại cùng requestId và cùng nội dung trả đặt chỗ gốc; mã được lưu ở trình duyệt qua mất mạng/tải lại. Hộp hủy dùng báo giá có chữ ký từ API; nhận thêm tiền, đổi lịch, qua mốc thay đổi quyền hoàn hoặc token hết hạn đều phải xác nhận lại.
- Hủy: công thức theo cọc gốc; trước đúng 24 giờ hoàn toàn bộ; dưới 24 giờ giữ cọc và hoàn phần vượt; không cọc hoàn toàn bộ. Có modal và ghi nhận hoàn thủ công, chưa chuyển tiền tự động.
- Đặt mới từ mốc nhả chỗ: miễn xác nhận sẽ đến, không tự điểm danh đã đến. Có nhắc 24 giờ/2 giờ và email_outbox. Điểm danh theo từng vé: đã đến từ giờ bắt đầu, vắng từ S+30 phút; không tự ghi từ đồng hồ.
- Đổi giờ có phiên bản, lịch đã đồng ý và hạn phản hồi; quá hạn tự hủy/nhả chỗ/ghi khoản hoàn toàn bộ. Chờ đồng ý thì tạm dừng nhắc, nhả do chưa xác nhận sẽ đến, điểm danh và thu tại studio.
- Có lưu đăng ký nhận lịch mới; chưa có bước gửi khi công bố buổi. Có tối ưu ảnh/font/bundle; số đo cũ lưu riêng.
- Có **55 file migration** trong workspace. 044–054 thêm sổ tài chính, lịch nhà nước, tài khoản hoàn theo từng khoản và tài khoản lưu dùng lại theo lựa chọn của khách; đã áp trên DB ứng dụng hiện cấu hình. Không suy ra các môi trường khác đã áp.

## Chưa có hoặc chưa đầy đủ

Hoàn tự động, chi trả studio, ví Bảo Kim/chi hộ/sổ tiền, đã có tài khoản nhận chi studio/nhận hoàn khách với mã hóa, xác nhận lại mật khẩu và quản trị đối chiếu thủ công; đệm 3 phút/đối soát cổng trước nhả; thiếu/thừa/chuyển thêm ngoài phạm vi hủy một phần; thời điểm giao dịch xác minh và phục hồi liên kết toàn hệ thống; hạn làm việc/cảnh báo hoàn; miễn khoản phải thu; luồng khiếu nại tiền. Ranker và luồng tạo đánh giá chưa hoàn chỉnh.

Bước 1 đã sửa thu tiền sau completed, ghi khoản hoàn khi quản trị hủy, thông báo và nhật ký; cho admin hủy completed theo quyền và sửa metadata hoàn cũ bằng migration 037. Bước 2 xử lý F08/F11/F24: gửi lại yêu cầu, thông báo mức cọc và xác nhận lại điều kiện hủy. Còn thiếu phân trang việc còn nợ/cần hoàn. Chi tiết lịch sử F01–F24 ở audit lưu trữ; roadmap là danh sách công việc hiện hành.

## Quyết định nghiệp vụ mới đã chốt — còn cần triển khai một phần

Đổi lịch trên 12 giờ và hạn min(báo+48 giờ, giờ mới−12 giờ) đã có ở bước 3. Phần còn thiếu: Chi trả studio trong 3 ngày làm việc; hoàn 7 ngày làm việc từ hủy kể cả thiếu tài khoản. Studio chịu phí thực tế không phụ phí, công bố trước bật cọc. Mọi lệnh chi (kể cả tạm ứng) quản trị duyệt, xử lý theo hạn đến trước. Vắng chỉ giữ cọc/ghi hoàn phần vượt đã có theo từng vé ở 4.1; chi hoàn thật chưa có. Sau chi trả thu hồi studio trước; nếu chậm ảnh hưởng hạn, nền tảng tạm ứng đúng hạn và tiếp tục thu hồi. Nhả do chưa xác nhận chỉ sau ít nhất 2 giờ từ thông báo gửi thành công. Những phần này cần triển khai/kiểm chứng, không thay đổi kết quả test cũ.

## Bước 1 triển khai — đã kiểm tra

- Thu phần còn lại sau điểm danh vẫn giữ completed và tham dự, không cấp/nhả vé/chỗ lại; chặn sai số tiền, khoản hoàn, đơn hủy và ghi nhận lặp. Có nhật ký người thu.
- Quản trị hủy: ghi đủ khoản cần hoàn từ tiền đã nhận, trả đúng held/sold, vô hiệu vé/payment chưa thu, báo khách; hủy lặp hoặc lỗi số chỗ rollback toàn giao dịch. API/UI cho hủy completed; không tự đánh dấu đã hoàn tiền.
- Migration 037 bổ sung khoản hoàn cũ còn thiếu đúng một lần, giữ nguyên paid_amount và quyết định hoàn/giữ cọc đã có; có nhật ký sửa.
- Sửa kiểu UUID trong thông báo hủy quản trị, ghi nhận hoàn thủ công và nhả chỗ. Luồng chuyển hoàn vẫn thủ công, chưa thực hiện chi tiền tự động.

## Bước 2 triển khai — đã kiểm tra

- Migration 038 thêm booking_requests theo khách + requestId, khóa giao dịch và dấu vân tay nội dung; gửi đồng thời chỉ giữ chỗ/phát sinh thanh toán một lần. Gửi lại đơn hủy/hết hạn không phục hồi quyền thanh toán hoặc thời gian giữ chỗ.
- GET cancellation-quote dùng giờ DB và số tiền thực tế; token HMAC có hạn 5 phút. Khi xác nhận hủy, khóa buổi/đặt chỗ và kiểm tra lại. Đã nhận tiền bắt buộc có token; đường hủy cũ không bỏ qua kiểm tra này. Trước/đúng 24 giờ vẫn được hoàn toàn bộ.
- Modal chờ báo giá, chặn gửi lặp, giữ nguyên khi lỗi và không tự xác nhận sau thay đổi. Sửa giữ nút mở trong lúc đồng bộ hủy thành công để trả tiêu điểm ổn định.
- Middleware giữ thông báo kiểm tra mức cọc, gồm “Mức cọc tối đa là 50%” cho cấu hình studio và ghi đè workshop.

## Bước 3 triển khai — đã kiểm tra

- Migration 039 thêm phiên bản buổi, lịch snapshot từng đặt chỗ, hạn/thời điểm thông báo, lịch sử đồng ý và cancelled_at cho các lần hủy mới. Dữ liệu đổi giờ cũ dùng mốc phiên bản ban đầu; không suy đoán lịch sử đồng ý đã thiếu.
- API đổi giờ dùng giờ DB, tăng phiên bản trong cùng giao dịch với hủy Hold cũ/thông báo/hàng đợi email. Khách gửi phiên bản đang xem; lệch hoặc hết hạn trả 409, không tự chấp nhận bản khác. Gửi lại bản đã đồng ý trả thành công, không ghi lịch sử lần hai.
- Worker hết hạn và các thao tác đọc/đặt/thanh toán/hủy có khóa xử lý phản hồi quá hạn, ghi hoàn toàn bộ tiền đã nhận, trả đúng số chỗ, vô hiệu vé và thông báo đúng một lần. Tiền về theo phiên bản Hold cũ không tự xác nhận giờ mới, kể cả Hold đã hết hạn trước khi đổi.
- UI giữ màu kem/xanh olive; giờ cũ/mới/hạn và hành động ở đầu cột thanh toán trên mobile, chặn bấm lặp, tự đồng bộ mỗi 10 giây/khi quay lại tab/qua hạn. Studio thấy nhãn chờ khách đồng ý và chưa được ghi nhận thu.
- Email đổi giờ có phiên bản riêng; lịch cũ không còn được lấy gửi khi đang chờ. Chưa kiểm chứng email thật/điều kiện vận hành của nhà cung cấp. Hoàn tiền vẫn là ghi khoản cần hoàn, chưa chi tự động.

## Bước 4.1 — điểm danh từng vé

- tickets giữ số thứ tự và tiền/cọc gốc, phần dư thuộc vé cuối; lưu tiền đã nhận, khoản cần hoàn/đã hoàn, phiên bản, người/thời điểm điểm danh và dấu khóa lịch sử hoàn. Legacy chỉ lấy điểm danh đã được studio ghi, không suy từ giờ hay tự nhận khách đã đến.
- Studio ghi từng vé, từ chối trước giờ bắt đầu/vắng trước S+30 phút, sai phiên bản/quyền, buổi hủy/chờ đồng ý giờ mới. Một vé đã đến không tự hoàn thành cả nhóm; các vé còn lại không đổi.
- Đã phát sinh khoản hoàn thì studio không sửa kể cả khoản hoàn đã xong hoặc quản trị dừng khoản chưa chuyển. Quản trị sửa có lý do; tiền đã chuyển không thể xóa, chỉ giữ lịch sử và đối soát riêng.
- Vắng giữ cọc gốc/ghi hoàn phần đã trả vượt cọc. Thu tiền sau khi đánh dấu vắng vẫn giữ biên nhận, bổ sung đúng khoản hoàn của vé vắng. Hoàn nhiều đợt chỉ ghi phần còn thiếu, chặn dùng lại mã đối chiếu; không tự hủy các vé còn hiệu lực.
- Tại bước 4.1 chưa bật hủy từng chỗ; bước 4.2 bên dưới đã bổ sung. Vé đã đến hoặc đã nhận tiền và điểm danh vẫn qua đối soát; khách chưa trả/chưa đến vẫn được hủy, lịch sử vắng không bị xóa khỏi thống kê.
- File chính: packages/shared/src/seat-allocation.ts; apps/api/src/modules/bookings/ticket-attendance.ts, attendance.routes.ts, payments/refunds.routes.ts; web TicketAttendanceEditor, StudioAttendancePanel, StudioRefundPanel, AdminBookingsPage, CustomerBookingDetailPage; migration 040.

## Bằng chứng bước 4.1 (lượt trước)

| Phạm vi                               | Kết quả                                                                                                                                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toàn web                              | 242 kiểm tra đạt trong 50 file, lệnh npm run test --workspace @workshop/web -- --maxWorkers=4                                                                                                                                                                     |
| API luồng khách                       | Lượt hồi quy 38/38 đạt; sau đó bổ sung ca tiền lẻ/hoàn nhiều đợt và kiểm tra 5/5 ca điểm danh đạt, 34 ca khác bỏ qua ở lượt lọc (39 ca khác nhau đã đi qua các lượt)                                                                                              |
| API quản trị/migration sửa khoản hoàn | 2 kiểm tra tích hợp đạt: hủy đồng thời/rollback/quyền/số tiền, và sửa metadata chạy lặp/không ghi đè quyết định                                                                                                                                                   |
| Biên dịch và lint                     | Build API, TypeScript web, ESLint phạm vi thay đổi đạt; 24 ca đơn vị đạt trong 2 file: 21 phân bổ tiền và 3 chữ ký báo giá hủy                                                                                                                                    |
| Cơ sở dữ liệu                         | Đã xác nhận DB test khác đích DB ứng dụng trước khi bật opt-in theo từng lệnh; guard giữ nguyên. Migration 037/038/039/040 đã áp ở DB test và DB ứng dụng đang cấu hình                                                                                           |
| Trình duyệt                           | Harness thành phần điểm danh dùng React/Vite thật và API mô phỏng đạt desktop/mobile: từng vé, xác nhận khoản hoàn, Escape/tiêu điểm, sai phiên bản cần xác nhận lại, khóa studio sửa, quản trị không xóa tiền đã hoàn. Chưa chạy trọn trang quản lý với API thật |
| Giới hạn                              | Không chạy toàn bộ bộ kiểm tra API hoặc kiểm chứng tiền/email thật. Một lượt web không giới hạn worker bị timeout prefetch 5 giây khi chạy đồng thời build; chạy lại toàn bộ với 4 worker đạt, không tăng timeout hoặc bỏ ca                                      |

Kết quả cũ 213/219 web và 31 kiểm tra riêng được thay bằng bằng chứng mới ở trên; bản lịch sử vẫn trong archive. Các kiểm tra mới không chứng minh chi hộ/Bảo Kim/chi trả/tạm ứng đã có. Các phần được liệt kê là còn thiếu vẫn cần triển khai và kiểm chứng theo roadmap.

## Bước 4.2 — hủy từng chỗ và thay mã cọc

- Khách chọn các chỗ gốc, xem khoản hoàn trước khi xác nhận; kiểm tra quyền/phiên bản/số tiền trong giao dịch khóa buổi. Nhả đúng số chỗ, vô hiệu đúng vé, giữ số vé và lịch sử tiền của các chỗ khác.
- Hủy bớt khi chờ cọc tạo mã cho phần cọc gốc còn lại, không đặt lại hạn giữ chỗ. Nếu còn dưới mức tối thiểu cổng đã cấu hình, từ chối rõ ràng thay vì tự tăng cọc hoặc đổi phương thức.
- Tiền về mã cũ áp dụng đúng phần cần cho chỗ còn lại nếu vẫn đủ điều kiện; phần dư hoặc khoản về thêm sau xác nhận được ghi cần hoàn. Sau hết hạn chỉ giành lại toàn bộ chỗ còn lại nếu đủ sức chứa và còn nhận đăng ký; không khôi phục chỗ khách đã hủy. Lặp thông báo không ghi nhận tiền/vé lần nữa.
- Liên kết tạo lỗi/chậm có trạng thái khôi phục. Cùng mã được tra cứu trước khi thử lại; kết quả cũ không ghi đè mã mới. Cổng báo đã trả vẫn chờ thông báo được xác minh để xác nhận chỗ. Đây chưa phải đối soát toàn bộ giao dịch ngân hàng.
- Lưu original_quantity/total/deposit và tiền theo từng chỗ; tổng tiền đã nhận và khoản hoàn gồm tiền thừa. Khoản hoàn vẫn chỉ ghi nhận, chưa chuyển tiền tự động.
- File chính: partial-seats.repository.ts, partial-checkout.service.ts, partial-seats.routes.ts; bookings/payments/refunds repositories; BookingSeatCancellation, CustomerBookingDetailPage; migration 041/042.
- Đã đạt 15/15 kiểm tra tích hợp mới, sau đó 2/2 ca tiền lẻ/mức tối thiểu đạt ở lượt lọc (15 ca cũ bỏ qua, không chạy lại). Migration 041/042 đã áp trên DB test và DB ứng dụng đang cấu hình. 042 chỉ sửa danh sách chỗ của lượt giữ cũ đã hết hạn để đối soát, không thay đổi số chỗ giữ/bán hoặc tiền. Các bằng chứng 4.1 ở trên là lượt trước, không thay cho kiểm tra 4.2.

| Phạm vi kiểm tra 4.2 | Kết quả |
| --- | --- |
| Hồi quy API + đơn vị | 70/70 đạt trong một lượt: 39 khách, 2 quản trị, 29 đơn vị (21 phân bổ, 4 báo giá, 4 chữ ký/tra cứu cổng) |
| Hủy từng chỗ | 15/15 đạt; bổ sung 2/2 biên tiền đạt ở lượt lọc, 15 bỏ qua |
| Web | 243/243 đạt, 50 file, 4 worker |
| Biên dịch/chất lượng | Build API, TypeScript web và ESLint phạm vi thay đổi đạt |
| Trình duyệt | Trang đặt chỗ React/Vite thật với API mô phỏng: hủy từng chỗ/lỗi/thử lại/chặn lặp/Escape/trả tiêu điểm/mã mới/tiền về mã cũ/vé 1 và 3; desktop 1440, tablet 768, mobile 390; đã xem ảnh modal và trang. Luồng hủy toàn bộ/hết hạn/cọc/đổi giờ cũng đạt hồi quy. Log interception khi hủy request không phải lỗi ứng dụng |
| Tài liệu | 61 Markdown, 259 liên kết nội bộ, 50 ánh xạ di chuyển; 0 lỗi |
| Giới hạn | Không chạy toàn bộ API, không kiểm chứng tiền/email thật hoặc toàn trang quản trị với API thật. Tạo/tra cứu/hủy mã cổng đã thử bằng phản hồi mô phỏng; cần nghiệm thu tài khoản thật |

Nhả chỗ sau tối thiểu 2 giờ đã được bổ sung ở bước 4.3 dưới đây. Tiếp theo là sổ chi/hoàn/chi trả có quản trị duyệt và hạn ngày làm việc.

## Bước 4.3 — xác nhận sẽ đến và nhả chỗ

- Quyết định mới: email được dịch vụ gửi thư chấp nhận mới bắt đầu tính 2 giờ. Thông báo trong tài khoản, email đang chờ/gửi lỗi hoặc bằng chứng lịch cũ đều không đủ.
- Hạn = max(mốc nhả cấu hình, thời điểm email được chấp nhận + 2 giờ). Hạn phải còn trước giờ bắt đầu, nếu không thì không nhả do thiếu xác nhận. Chỉ đặt chỗ không cọc, chưa thanh toán, chưa xác nhận, đúng lịch hiện tại và còn hiệu lực mới thuộc diện nhả.
- Worker, API xác nhận và cleanup khi đọc/đặt mới dùng chung điều kiện, khóa theo buổi; nhả đúng số chỗ còn lại sau hủy một phần, vô hiệu vé còn lại, ghi thông báo/nhật ký một lần. Xác nhận sau mốc dự kiến vẫn được khi chưa đến hạn thực tế; gửi lại giữ thời điểm xác nhận đầu tiên.
- Email yêu cầu xác nhận có khóa cố định theo đặt chỗ/phiên bản lịch; chỉ ghi sent_at sau phản hồi thành công, thử lại không đặt lại mốc. Giờ học của email lấy trực tiếp từ DB để giữ nguyên độ chính xác. Email nhắc 24 giờ được gộp vào yêu cầu xác nhận khi phù hợp, tránh gửi hai thư cùng lượt; nhắc 2 giờ vẫn có.
- Giao diện hiển thị hạn thật khi đã có; chưa có bằng chứng gửi thì giải thích điều kiện. Tự đồng bộ khi qua hạn/quay lại tab, nút xử lý lỗi/thử lại/chặn bấm lặp và trạng thái đã xác nhận. Không biến xác nhận sẽ đến thành điểm danh.
- File chính: attendance-confirmation.ts, attendance-job.ts, customer-actions.routes.ts, bookings.repository.ts; CustomerBookingDetailPage/customerBookingService; migration 043. Chưa cấu hình/kiểm chứng gửi thư thật trong lần triển khai này.

| Kiểm tra 4.3 | Kết quả |
| --- | --- |
| API mới | 13 ca tích hợp + 3 ca đơn vị gửi thư đạt trong một lượt; bổ sung 2/2 ca cọc/đổi giờ thực tế đạt ở lượt lọc (13 bỏ qua). Tổng 15 ca tích hợp khác nhau đã đạt |
| Xác minh thay đổi cuối | 3/3 ca gửi đồng thời/hết hạn/hủy một phần đạt khi chạy tuần tự (12 bỏ qua); không đổi điều kiện chống chạy trùng để làm kiểm tra qua |
| Hồi quy API | 17/17 ca điểm danh/đổi giờ/xác nhận đạt; 22 ca khác bỏ qua, không phải toàn bộ API |
| Web và biên dịch | 243/243 ca đạt trong 50 file; build API, TypeScript web, ESLint/Prettier phạm vi sửa đạt |
| Trình duyệt | Trang React/Vite thật với API mô phỏng đạt desktop/mobile: chưa gửi email, hạn thật, lỗi/thử lại, chặn bấm lặp, trạng thái xác nhận, miễn sau mốc nhả, tự cập nhật khi qua hạn. Hạn/nút xác nhận đã đưa lên đầu khối hành động; đã xem ảnh mobile |
| DB/tài liệu | Migration 043 đã áp DB test và DB ứng dụng đang cấu hình; 61 Markdown, 259 liên kết nội bộ, 0 lỗi |
| Giới hạn và lỗi đã xử lý | Chưa gửi thư thật/đo hộp thư đến, chưa chạy toàn bộ API. Đã sửa mất độ chính xác giờ học khi đi qua JavaScript và kiểu UUID trong nhật ký. Một lượt kiểm tra chạy song song dùng chung khóa tác vụ bị bỏ qua; đã chạy lại tuần tự và giới hạn tác vụ vào buổi của fixture, không nới timeout hoặc thay cơ chế khóa |

## Check-in bằng QR vé — cập nhật 09/11/2026

- Mã vé tham gia ngẫu nhiên 144 bit, mỗi chỗ một vé; QR vé có tiền tố `OS-TICKET:` để phân biệt với QR thanh toán. Mã cũ không có tiền tố vẫn được tra cứu.
- Nhân viên là thành viên studio đã đăng nhập có thể quét bằng camera khi trình duyệt hỗ trợ BarcodeDetector, hoặc nhập mã. API chỉ trả thông tin vé sau khi xác nhận mã thuộc studio của nhân viên; studio khác nhận 404, không thấy tên khách. Mở vé không ghi điểm danh.
- Trang Check-in hiển thị workshop, giờ học, tên khách, số chỗ, số người đã đến và khoản còn phải thu. Ghi nhận thu tiền và xác nhận check-in là hai thao tác riêng. Check-in dùng phiên bản vé và khóa giao dịch; vé đã dùng, hủy, sai lịch hoặc chưa đến giờ bắt đầu không được xác nhận lại. Thời gian và nhân viên điểm danh được lưu bởi luồng điểm danh từng vé hiện có.
- Đã qua 1 ca tích hợp DB test gồm quyền studio, mã sai/QR thanh toán, trước giờ học, check-in một trong hai vé, quét lặp, vé hủy và tiền không đổi khi check-in. Build và lint đạt. Trình duyệt React/Vite với API mô phỏng đã xem desktop/mobile và xác nhận hai thao tác độc lập. Chưa kiểm chứng camera vật lý hoặc toàn bộ API với thay đổi này.
