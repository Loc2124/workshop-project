# Kế hoạch kiểm tra và bằng chứng

Đồng bộ 07/11/2026. [Mục lục](../README.md) · [Trạng thái kết quả](../project/current-status.md). Có mã test không đồng nghĩa đã chạy hoặc đã phủ hết nghiệp vụ.

## Ma trận nghiệm thu chính

Nguồn: [bảng chuyển trạng thái A–J](../policy/bang-chuyen-trang-thai.md). Mỗi dòng có bằng chứng tiền/chỗ/vé/quyền/API/giao diện. Dòng có đề xuất chưa chốt được đánh dấu blocked-policy, không tự dựng kết quả mong đợi.

| Nhóm                   | Trường hợp bắt buộc                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A tạo đặt chỗ          | none/optional/required × lựa chọn hợp lệ/giả mạo × số người; 1/5/20/50%, 0/51/thiếu/số lẻ; không xác minh; hết chỗ/đóng đăng ký; gửi lại cùng/khác nội dung; miễn sau mốc nhả                                 |
| B giữ/thu              | 15 phút, đúng giây; giao dịch đúng hạn thông báo chậm, trễ thật; đủ/một phần/không chỗ; người khác giữ/đã xác nhận; thiếu/thừa/chuyển thêm; lặp/sai chữ ký/sai đơn; cổng timeout; đệm/tra cứu là phần chưa có |
| C hủy                  | Không trả; cọc; trả đủ; không cọc đã trả; trước/đúng/sau 24 giờ lệch 1 ms; snapshot; hủy từng vé; lặp/đồng thời tiền vào; quyền hoàn đổi khi modal mở                                                         |
| D đổi/hủy studio       | Studio/admin hủy; studio bị khóa; hoàn thành/đang diễn ra; đổi nhiều lần, phiên bản cũ, không phản hồi; chờ cọc; lịch mới sát hạn                                                                             |
| E hoàn                 | Đủ/thiếu tài khoản; thiếu số dư; lỗi/timeout/không rõ kết quả; tra cứu trước thử lại; khóa chống chi lặp; duyệt; ngày nghỉ/hạn; ghi nhận thủ công không phải chuyển tự động                                   |
| F nhắc/tham dự         | 24 giờ/2 giờ; gửi lỗi/lặp; host ngủ; không nhả trước cơ hội phản hồi; xác nhận đồng thời nhả; đã đến/vắng đúng mốc; từng vé; chưa đồng ý lịch mới không tính vắng                                             |
| G nợ/chi trả/khiếu nại | Thu sau điểm danh; thu/miễn/điều chỉnh; chưa trả không tự xóa nợ; chi trả đúng hạn/chưa chốt; khiếu nại trước/sau chi trả; không sửa lịch sử                                                                  |
| H cấu hình             | Owner/staff/studio khác; mất xác minh; kế thừa/ghi đè/xóa ghi đè; lịch sử; không tính lại đơn cũ; mức tối thiểu cổng                                                                                          |
| I giờ/khóa             | Asia/Ho_Chi_Minh; qua nửa đêm; giờ máy lệch; tab ngủ; khóa nhất quán; tải lại không reset; sức chứa cuối khi 50 người cùng đặt/hủy/đổi                                                                        |
| J vận hành ví          | Nạp/đối soát số dư/phí/nghĩa vụ cần chi; cảnh báo thiếu/quá hạn; không tuyên bố ví tự nhận tiền thu                                                                                                           |

Ngoài bảng tiền: đăng nhập/phiên/quyền studio khác/khách khác; lọc tỉnh-khu vực/ngày/giá; workshop hết lịch và nổi bật; lỗi mạng/trạng thái trống; mobile 360/768/1280, modal bàn phím/focus; ảnh và dữ liệu thật. Ranker: tập ứng viên rỗng, câu lạ/dài, timeout/fallback, chia tập/nhãn đúng đặc tả; đánh giá sau tham dự chưa hoàn chỉnh phải ghi chưa có.

## Nhánh bổ sung theo quyết định đã chốt

- Đổi giờ còn trên/đúng/dưới 12 giờ: đúng hoặc dưới phải bị từ chối; trên tính min(báo+48 giờ, giờ mới−12 giờ), hết hạn chưa đồng ý phải hủy/hoàn.
- Chi trả trong 3 ngày làm việc, hoàn trong 7 ngày từ hủy; cuối tuần/lễ; thiếu/sai tài khoản, duyệt chậm, thiếu tiền không đặt lại hạn.
- Thu hồi studio trước hoàn sau chi trả; studio chậm thì tạm ứng giữ hạn, thu hồi sau không hoàn khách lần hai; cả lệnh tạm ứng phải admin duyệt.
- Hàng đợi trộn khoản hoàn/chi trả: xử lý theo due_at đến trước, không ưu tiên một loại; chưa duyệt không được chi.
- Phí thực tế studio, không phụ phí; công bố/tính rõ trước bật cọc; khoản khách nhận không bị trừ phí; thay biểu phí không âm thầm đổi điều kiện cũ.
- Khách vắng chỉ giữ cọc gốc, hoàn phần vượt; không cọc giữ 0; từng vé bảo toàn tổng tiền.
- Thông báo xác nhận chưa gửi/đã gửi lỗi thì không nhả; gửi thành công đủ 2 giờ mới được xét nhả; đúng biên 2 giờ; gửi lại không tự tước thời gian phản hồi; đơn được miễn vẫn giữ miễn.

Đây là ca cần triển khai/chạy, không phải kết quả kiểm tra đã đạt.

## Cách chạy an toàn

```powershell
npm run test --workspace @workshop/web
# Chỉ khi đã có DB test tách biệt và được phép thao tác dữ liệu test:
$env:ALLOW_DESTRUCTIVE_TESTS = "true"
npm run migrate:test
npm run test --workspace @workshop/api
```

Guard phải xác nhận hai URL hợp lệ và host hoặc username khác nhau. Không chạy trên DB dev/demo, không bật cờ chỉ để vượt bảo vệ. Không sửa migration đã áp. Chi tiết env ở deploy; test thật của nhà cung cấp dùng môi trường được cấp, không mặc định dùng tiền thật.

## Kết quả đã ghi nhận

Lịch sử bước 1: toàn web 233/233 đạt trong 48 file với 4 worker; 24 ca tích hợp API liên quan đạt qua các lượt chạy (21 khách, 1 hoàn thủ công lọc riêng, 2 quản trị/migration). DB test đã được xác nhận tách biệt và opt-in từng lệnh; guard không bị bỏ qua. Migration 037 đã áp vào đích kiểm tra và DB ứng dụng đang cấu hình. Chưa chạy toàn bộ API hoặc tiền thật; có một lượt web không giới hạn worker timeout khi chạy cùng build, lượt giới hạn 4 worker đạt mà không tăng timeout.

Mẫu bằng chứng cho mỗi ca: mã ca, phiên bản mã, môi trường/giờ, đầu vào, kết quả mong đợi/thực tế, số tiền/chỗ/vé trước-sau, log/screenshot đã bỏ secret, người chạy và kết luận. Trạng thái: not-implemented / blocked-policy / not-run / passed / failed. Không đánh dấu passed cho cả nhóm khi chỉ một ví dụ đi qua.

Bước 2: toàn web 236/236 đạt trong 49 file với 4 worker; 14 ca API đơn vị/HTTP đạt (3 file). Bộ tích hợp khách có 27 ca: lượt đầu 25 đạt, 2 timeout kèm ECONNRESET; chạy lại riêng đúng 2 ca đạt, không tăng timeout, không bỏ ca khỏi bộ. Bao phủ cùng requestId đồng thời, đổi nội dung bị từ chối, tách khách/lượt đặt mới, replay đơn đã hủy, tiền về trong lúc mở hộp hủy, lịch thay đổi, token giả/hết hạn và mốc đúng 24 giờ. Migration 038 đã áp DB test và DB ứng dụng đang cấu hình. Kịch bản trình duyệt mô phỏng đạt trên desktop/mobile, gồm xác nhận lại báo giá mới và tiêu điểm sau hủy; log interception CDP khi đóng không phải giao dịch thật. API build, TypeScript web và lint phạm vi sửa đạt. Chưa chạy toàn bộ API hoặc xác minh nhà cung cấp/chi tiền thật.

Bước 3: toàn web 237/237 đạt (49 file, 4 worker), API tích hợp khách 34/34 đạt trong lượt hồi quy đầy đủ; trước đó lượt chọn lịch đạt 8 và bỏ qua 26 ca khác. Thêm 15 ca đơn vị đạt qua 2 lượt: 12 về hạn/chữ ký và 3 về gửi email mô phỏng (hết hiệu lực trước gửi/thành công/lỗi). Bao phủ đúng/dưới/trên 12 giờ, hạn 48 giờ hoặc giờ mới−12 giờ, qua nửa đêm, nhiều phiên bản, khách khác, gửi lại đồng ý, hủy chờ cọc, tiền về theo lịch cũ kể cả Hold đã hết hạn, hết hạn đồng thời chấp nhận, hoàn toàn bộ khoản đã trả đủ, nhả chỗ/vô hiệu vé/thông báo một lần, dừng nhắc/thu trong lúc chờ. Ca mốc 12 giờ HTTP lấy giờ DB để tránh lệch đồng hồ máy chạy; schema thiếu phiên bản trả 422 theo hợp đồng hiện có. Lượt ban đầu có hai kỳ vọng kiểm tra chưa đúng này đã được sửa và chạy lại, không nới điều kiện nghiệp vụ. Migration 039 đã áp ở DB test và DB ứng dụng cấu hình; tổng 40 migration. Kịch bản trình duyệt mô phỏng desktop/mobile đạt về giờ cũ/mới/hạn, phiên bản cũ bị từ chối, xác nhận lần hai, hoàn khi đổi giờ, tiêu điểm và tự đồng bộ hết hạn. Build API/TypeScript web/lint đạt. Chưa chạy tất cả file API hoặc kiểm chứng email/tiền thật; log CDP interception lúc đóng được tách khỏi lỗi ứng dụng.

Bước 4.1 ngày 08/11/2026: web 242/242 đạt trong 50 file (4 worker). API hồi quy khách 38/38 đạt; sau đó thêm ca tiền lẻ và bổ sung kiểm tra hoàn nhiều đợt/mã đối chiếu trùng/hủy chưa trả sau điểm danh, lượt lọc 5/5 đạt và 34 ca khác bỏ qua. 24 ca đơn vị đạt trong 2 file (21 chia tiền/hoàn theo vé, 3 HMAC hủy). Phần dư 10.000 đ / 3 vé kiểm tra cả hàm chung và DB thực; đã kiểm tra phiên bản/quyền studio/admin, một vé không đổi vé khác, thiếu thời gian S/S+30, khóa sửa trước/sau khi hoàn, quản trị dừng khoản chưa chuyển/giữ khoản đã chuyển, thu sau vắng, hoàn nhiều đợt không tính lại tổng đã hoàn và không dùng mã đối chiếu cũ. Migration 040 đã áp DB test riêng và DB ứng dụng cấu hình, tổng 41 migration. Build API/TypeScript web/lint đạt. Harness thành phần React/Vite với API mô phỏng được kiểm tra desktop 1440px/mobile 390px, modal/tiêu điểm/Escape/chặn lặp/sai phiên bản/giữ tiền đã hoàn; không coi là toàn trang quản lý/API thật hoặc chuyển tiền thật. Hủy từng chỗ/thay QR chưa triển khai ở bước này.

## Bằng chứng 4.2 — 08/11/2026

15/15 ca tích hợp trong partial-seats.test.ts đã đạt sau sửa nhánh hết hạn của logic cũ (reservation_status cancelled không đồng nghĩa khách đã hủy chỗ). Có: không cọc/cọc; quyền và lựa chọn trùng; hủy đồng thời; giữ hạn gốc; nhận tiền mã cũ; mã cũ/mới đồng thời; chuyển thêm và thông báo lặp; hoàn/thu phần còn lại; cọc 5/20/50% khi đã trả đủ hủy dưới 24 giờ; phục hồi tạo mã lỗi; tạo mã chậm sau lần hủy tiếp; hết hạn có/không đủ chỗ; đóng đăng ký/bắt đầu/studio hủy/khách hủy hết. Dùng DB test riêng và MockProvider, không chứng minh tiền thật hoặc chuyển hoàn tự động. Các kết quả 4.1 ở phần trước là bằng chứng lịch sử.

Bổ sung 2/2 ca đạt ở lượt lọc (15 ca cũ bỏ qua): cọc 10.000 đ chia 3.333/3.333/3.334, hủy lần lượt vẫn giữ cọc 3.334 cho chỗ số 3, tiền mã cũ hoàn đúng dư; cọc phần còn lại dưới mức tối thiểu bị từ chối không mất chỗ, hủy cả nhóm vẫn được. Hồi quy 70/70 đạt trong 5 file: 39 khách, 2 quản trị, 29 đơn vị. Toàn web 243/243 đạt trong 50 file; build API/TypeScript web/ESLint phạm vi thay đổi đạt. Browser dùng trang thật và API mô phỏng đạt desktop/tablet/mobile cho hủy từng chỗ, báo lỗi/thử lại, không gửi lặp, bàn phím/tiêu điểm, QR thay thế, xác nhận từ tiền mã cũ, tiền dư và vé giữ số gốc. Luồng hủy toàn bộ/hết hạn/cọc/đổi giờ cũng đạt. Có log CDP request bị hủy khi điều hướng; không có ReferenceError/TypeError ứng dụng. Chưa chạy toàn bộ API hoặc cổng tiền thật.

## Bằng chứng 4.3 — 08/11/2026

13 ca tích hợp attendance-release và 3 ca đơn vị gửi thư đạt trong một lượt. Bổ sung 2 ca tích hợp đạt trong lượt lọc (13 bỏ qua): đặt chỗ cọc không bị nhả, đổi giờ qua API và đồng ý cần email mới đúng phiên bản. Tổng 15 ca tích hợp khác nhau đã đạt. Sau bổ sung phục hồi ngữ cảnh nhật ký và gửi đồng thời, chạy lại tuần tự 3/3 ca gửi thư/hết hạn/hủy một phần đạt (12 bỏ qua).

Phủ: email chưa cấu hình/đang chờ/chỉ có thông báo trong tài khoản, 503 rồi 202, hai tiến trình gửi cùng khóa không gửi trùng, không đặt lại sent_at, dưới/đủ 2 giờ, lấy mốc cấu hình muộn hơn, email gửi quá sát buổi thì không nhả, xác nhận sau mốc dự kiến nhưng còn hạn thật, gửi lại giữ thời điểm đầu tiên, người khác 404, hết hạn 409 đồng thời commit nhả, worker chạy lặp không nhả/vô hiệu/thông báo lần nữa, sai phiên bản/giờ cũ/chờ đồng ý/đã bắt đầu/buổi hủy/đã trả, hủy một phần nhả đúng phần còn lại, đặt sau mốc nhả được miễn, đặt cọc được bảo vệ và đổi giờ tạo bằng chứng mới.

Hồi quy khách lọc attendance|schedule đạt 17/17 (22 bỏ qua). Toàn web 243/243 đạt; build API/TypeScript web/lint/format phạm vi sửa đạt. Browser dùng trang thật + API mô phỏng đã qua desktop/mobile cho hạn và nút xác nhận lên đầu, gửi lỗi/thử lại/chặn lặp, miễn sau mốc nhả và đồng bộ qua hạn. Không gửi email thật hoặc chạy toàn bộ API.

Các lượt đầu đã phát hiện/sửa việc mất phần microsecond của giờ học khi lưu qua JavaScript và suy kiểu UUID trong nhật ký. Lượt chạy hai bộ dùng chung khóa tác vụ gây bỏ qua worker; đã chạy lại tuần tự, scope fixture trong kiểm tra cũ, không thay cơ chế khóa hoặc bỏ điều kiện nghiệp vụ để kiểm tra đạt. Migration 043 đã áp trên DB test riêng và DB ứng dụng cấu hình.
