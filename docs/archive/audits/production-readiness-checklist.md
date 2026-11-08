# Checklist rà soát và chuẩn bị production — Open Slot

> **LƯU TRỮ — không dùng làm chính sách hoặc trạng thái hiện hành.** Giữ nguyên nội dung như bằng chứng/bản nháp lịch sử. Quy tắc hiện hành, phạm vi đã có và việc còn thiếu được dẫn từ [mục lục tài liệu](../../README.md).

Ngày lập: 01/11/2026. Cơ sở: đọc code và cấu hình hiện tại, kiểm tra TypeScript, ESLint, Prettier và npm audit. Checklist này chưa sửa code ứng dụng hoặc database.

## Cách sử dụng

- Làm lần lượt P0 → P1 → P2 → P3. Các mục chức năng chưa triển khai nằm riêng ở P2; không coi chúng là lỗ hổng đã khai thác được.
- Mỗi mục gồm vị trí cần xem, việc cần sửa, cách sửa đề xuất và tiêu chí hoàn thành. Chỉ đánh dấu hoàn thành sau khi có bằng chứng kiểm tra.
- Ưu tiên commit nhỏ theo từng mã mục. Ghi ngày, commit và kết quả vào bảng theo dõi cuối file.
- Khi đổi schema, tạo migration mới; không sửa migration đã áp dụng. Kiểm tra lại cấu hình và phiên bản thực tế trước khi triển khai vì kết quả rà soát là ảnh chụp tại thời điểm lập.
- Chỉ chạy integration test/reset dữ liệu trên DB test riêng sau khi `assertSafeTestDatabase()` cho phép. Không dùng production để thử nghiệm lỗi, seed hoặc test đồng thời.

## P0 — Chặn phát hành công khai trước khi xử lý

### SEC-01 — Bỏ khóa JWT mặc định và validate cấu hình bảo mật

- [x] Hoàn thành SEC-01.
- **Vị trí:** `apps/api/src/config.ts`, `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/middleware/auth.ts`, `.env.example`, `render.yaml`.
- **Vấn đề:** Khi thiếu `JWT_SECRET`, code dùng khóa biết trước. Có thể giả mạo token mang quyền admin nếu môi trường chạy rơi vào cấu hình này.
- **Cần sửa / đề xuất:**
  - Khai báo `JWT_SECRET` bắt buộc trong config, từ chối giá trị mặc định và secret yếu; dùng secret sinh ngẫu nhiên có đủ entropy.
  - Auth service và middleware lấy cùng một cấu hình đã validate; bỏ mọi fallback secret trong source.
  - Validate `JWT_EXPIRES_IN`, cookie name và các cấu hình liên quan tại startup; chỉ chấp nhận thuật toán JWT chủ đích khi ký/verify.
  - Production bắt buộc cấu hình origin HTTPS hợp lệ của web và cookie an toàn; cập nhật ví dụ cấu hình không chứa secret thật.
  - Nếu từng chạy bằng khóa mặc định, thay khóa và vô hiệu hóa toàn bộ token ký bằng khóa cũ.
- **Xong khi:** Thiếu/khóa yếu làm startup thất bại; token sai khóa, hết hạn, sai thuật toán bị từ chối; đăng nhập bằng cấu hình hợp lệ vẫn hoạt động.

### SEC-02 — Vá dependency có lỗ hổng DoS

- [x] Hoàn thành SEC-02.
- **Vị trí:** `package-lock.json`, `apps/api/package.json`, `apps/api/src/app.ts`.
- **Vấn đề:** Khi rà soát, `express@5.3.0` kéo theo `body-parser@2.3.0`; `express.json()` mặc định nằm trong điều kiện ảnh hưởng của GHSA-27r3-jxmh-p828.
- **Cần sửa / đề xuất:**
  - Cập nhật dependency và lockfile để nhánh runtime dùng `body-parser` đã vá, ít nhất `2.4.0` cho nhánh 2.x; kiểm tra tương thích Express trước khi chốt.
  - Nếu không có nhu cầu nhận request body nén, cân nhắc `inflate: false` và khai báo body-size limit rõ ràng như một biện pháp bổ sung.
  - Kiểm tra riêng cảnh báo dependency dùng cho build/dev; không chạy `npm audit fix --force` rồi chấp nhận mọi thay đổi phiên bản lớn.
- **Xong khi:** `npm ls body-parser express` xác nhận phiên bản đã vá; audit không còn cảnh báo này; API test/build qua. Chỉ kiểm tra request gây crash trong môi trường cô lập.
- **Nguồn:** https://github.com/advisories/GHSA-27r3-jxmh-p828

### DATA-01 — Ngăn dữ liệu mock ghi đè dữ liệu thật

- [x] Hoàn thành DATA-01.
- **Vị trí:** `apps/web/src/pages/WorkshopPage.tsx`, `apps/web/src/pages/StudioPage.tsx`, các hook đang dùng `import.meta.env.DEV`, `apps/web/src/data/`.
- **Vấn đề:** Trang chi tiết tìm mock trước và bỏ gọi API nếu identifier trùng, kể cả production.
- **Đã thực hiện:**
  - `VITE_DATA_MODE` có hai giá trị `api` và `demo`; mặc định `api` ở mọi môi trường.
  - Home, Explore, danh sách tỉnh/khu vực, trang chi tiết workshop/studio và gợi ý dùng chung mode; API lỗi/404 không chuyển sang mock.
  - 404 ở trang chi tiết hiển thị trạng thái không tìm thấy; lỗi API hiển thị trạng thái lỗi và nút thử lại. Demo mock tiếp tục có nhãn mô phỏng; `/demo/ve` giữ riêng.
- **Xong khi:** Với URL trùng mock, production vẫn hiển thị nội dung mới từ API; API 404/lỗi hiện trạng thái tương ứng; demo vẫn dùng được khi bật chủ đích.
- **Bằng chứng:** Browser check với ID `mock-001` xác nhận API mode gửi request và hiển thị 404/500 tương ứng, demo mode hiển thị mock mà không gọi detail API; build API và demo qua.

## P1 — Sửa tính đúng đắn, phân quyền và độ ổn định

### CAT-01 — Đưa tìm kiếm, sắp xếp và phân trang về server

- [x] Hoàn thành CAT-01.
- **Vị trí:** `apps/web/src/pages/ExplorePage.tsx`, `apps/web/src/services/catalogService.ts`, `apps/api/src/modules/catalog/`, `apps/web/src/lib/rankWorkshops.ts`.
- **Vấn đề:** Explore chỉ lấy 100 workshop đầu rồi lọc từ khóa, sắp xếp và tự tính tổng trong trình duyệt. Studio cũng được gom từ tập dữ liệu bị giới hạn này.
- **Cần sửa / đề xuất:**
  - API nhận query/sort/page và tính kết quả trên toàn bộ tập đủ điều kiện, thay vì chỉ sắp xếp một trang.
  - Giữ bộ lọc cứng tại SQL; frontend gửi page thực tế và dùng `pagination.total` của API.
  - Có thứ tự phụ ổn định, ví dụ ID, khi hai kết quả bằng điểm/giá/thời gian.
  - Với view studio, gom nhóm và tính count/starting price trên tập phù hợp đầy đủ rồi mới phân trang; có thể tách endpoint nếu hợp đồng dữ liệu khác.
  - Thống nhất ý nghĩa giá để sắp xếp và giá hiển thị: giá thấp nhất của các buổi phù hợp hay giá buổi gần nhất; ghi nhãn phù hợp.
- **Xong khi:** Fixture hơn 100 workshop vẫn tìm thấy mục ở cuối tập; tổng/trang/sort đúng; chuyển view studio không làm mất kết quả; không hiển thị buổi vi phạm bộ lọc.

### MOD-01 — Khép kín luồng duyệt workshop

- [x] Hoàn thành MOD-01.
- **Vị trí:** `apps/api/src/modules/admin/`, `apps/api/src/modules/workshops/`, các màn hình quản trị tương ứng.
- **Vấn đề:** Workshop mới và workshop đã duyệt sau khi sửa chuyển về `pending`, nhưng chưa có endpoint admin duyệt workshop.
- **Cần sửa / đề xuất:**
  - Thêm danh sách workshop chờ duyệt có phân trang và endpoint đổi trạng thái chỉ dành cho admin.
  - Xác định trạng thái được phép chuyển, thông tin phản hồi khi từ chối và cách xử lý nội dung sửa sau duyệt.
  - Ghi người duyệt, thời điểm và lý do qua migration mới nếu cần lưu lịch sử.
  - Bảo đảm cả studio và workshop phải được duyệt trước khi công khai.
- **Xong khi:** Tạo → duyệt → hiển thị; sửa → chờ duyệt → ẩn → duyệt lại chạy qua API, không cần SQL thủ công; customer/staff không gọi được endpoint admin.

### UI-01 — Validate bộ lọc URL trước khi render

- [x] Hoàn thành UI-01.
- **Vị trí:** `apps/web/src/pages/ExplorePage.tsx`, `apps/web/src/components/ui/date-range-picker.tsx`, `apps/web/src/components/ui/single-date-picker.tsx`.
- **Vấn đề:** Giá trị như `date_from=abc` tạo Invalid Date rồi gây `RangeError` trong formatter.
- **Cần sửa / đề xuất:**
  - Tách schema/parser URL: kiểm tra ngày lịch thực tế, khoảng ngày, giá, page, enum và UUID khu vực.
  - Chuẩn hóa hoặc báo bộ lọc sai theo một quy tắc thống nhất; không đưa giá trị sai xuống date picker.
  - Bảo vệ formatter trước Invalid Date; dùng múi giờ nghiệp vụ Việt Nam khi quyết định ngày hiện tại.
  - Thêm Error Boundary để lỗi render không làm trắng toàn ứng dụng.
- **Xong khi:** URL có ngày rác, ngày không tồn tại, khoảng đảo ngược, giá âm/quá lớn và page sai không gây crash; bộ lọc hợp lệ vẫn round-trip qua URL. Đã thêm parser/schema Zod, chuẩn hóa tham số sai, date-picker an toàn theo ngày Việt Nam, formatter có guard và Error Boundary; 8 unit tests, build/lint/format và kiểm tra responsive ở 360/768/1280px đều qua, không có tràn ngang hay lỗi runtime.

### DTO-01 — Thống nhất chính sách và hợp đồng API

- [x] Hoàn thành DTO-01.
- **Vị trí:** `apps/api/src/modules/catalog/catalog.repository.ts`, `apps/api/src/modules/workshops/`, `apps/web/src/types/workshop.ts`, `apps/web/src/components/details/WorkshopDetails.tsx`, `packages/shared/src/index.ts`.
- **Vấn đề:** DB/API quản lý lưu một `policy`; API public chưa trả chính sách; UI đọc `cancellationPolicy` và `paymentPolicy`.
- **Cần sửa / đề xuất:**
  - Chọn mô hình chính sách chung hoặc tách chính sách hủy/thanh toán theo yêu cầu thực tế, không tự suy diễn nội dung cũ.
  - Trả trường đã thống nhất trong endpoint chi tiết; map dữ liệu rõ ràng nếu có giai đoạn chuyển đổi.
  - Đưa DTO/schema dùng chung vào `packages/shared`; giữ type trình bày riêng ở frontend khi thực sự khác.
  - Phân biệt ngày dạng ISO trên wire với `Date` trong nội bộ nếu có.
- **Xong khi:** Chính sách nhập từ API quản lý xuất hiện đúng trên trang thật; có kiểm tra hợp đồng response; không cần ép kiểu để che lệch trường. Migration `007` đổi tên cột cũ thành `cancellation_policy` (giữ nguyên dữ liệu) và thêm `payment_policy`; shared Zod DTO/schema được dùng ở API, web và integration tests; trang chi tiết hiển thị nhãn riêng. API build, web build, 19 integration tests, 11 web tests, lint và format đều qua; migration đã áp dụng cho DB test và dev/demo.

### DB-01 — Giới hạn phạm vi dọn giữ chỗ và thống nhất thứ tự khóa

- [ ] Hoàn thành DB-01 — đã thống nhất khóa session tăng dần → booking, cleanup theo phạm vi filter/workshop/studio/tỉnh/khu vực, cập nhật luồng hủy và thêm test cleanup-vs-cancel cùng khả dụng địa điểm. Chưa thể kiểm tra cạnh tranh với thao tác giữ chỗ vì API hiện chưa có `POST /bookings`; hoàn tất phần kiểm thử này trong FLOW-02.
- **Vị trí:** `apps/api/src/modules/bookings/bookings.repository.ts`, `apps/api/src/modules/catalog/catalog.repository.ts`, `apps/api/src/modules/sessions/sessions.repository.ts`.
- **Vấn đề:** Mỗi lần đọc catalog/chi tiết có thể dọn booking hết hạn toàn hệ thống. Hủy session khóa session trước, còn dọn hết hạn cập nhật booking trước, có nguy cơ tranh chấp/deadlock.
- **Cần sửa / đề xuất:**
  - Thiết kế một thứ tự khóa chung cho giữ chỗ, hết hạn, hủy và thanh toán; nhiều session phải khóa theo thứ tự ổn định.
  - Dọn đúng session/tập session liên quan trước khi trả chỗ khả dụng; có thể kết hợp job dọn theo batch.
  - Không chỉ dựa vào job định kỳ: giữ yêu cầu dọn hết hạn trong transaction tạo booking trước khi tăng chỗ giữ.
  - Danh sách tỉnh/khu vực cũng phải tính khả dụng sau khi xử lý đúng ảnh hưởng của giữ chỗ hết hạn.
  - Nếu dùng retry cho deadlock, retry toàn transaction với số lần giới hạn và chỉ khi tác vụ an toàn để chạy lại.
- **Xong khi:** Test đồng thời hủy/hết hạn/giữ chỗ không âm hoặc vượt sức chứa, không giải phóng hai lần; query đọc không quét cập nhật toàn hệ thống ngoài chủ đích; tỉnh không bị ẩn vì hold đã hết hạn.

### SES-01 — Kiểm soát sửa session theo trạng thái

- [x] Hoàn thành SES-01 — session chỉ sửa khi scheduled và chưa bắt đầu; lịch/giá bị khóa với booking pending/paid/refund_needed; capacity giữ nguyên invariant; UI chặn số lượng đặt trên 10. Chưa có luồng phát hành vé trong API, nên void vé khi hủy sẽ bổ sung cùng chức năng vé.
- **Vị trí:** `apps/api/src/modules/sessions/sessions.repository.ts`, `sessions.service.ts`, `sessions.schemas.ts`.
- **Vấn đề:** Update chưa chặn sửa session đã hủy/hoàn thành; giới hạn số lượng đặt trên UI chưa khớp constraint booking 1–10.
- **Cần sửa / đề xuất:**
  - Chốt bảng quy tắc trường nào được sửa theo trạng thái và khi có booking pending/paid/refund_needed.
  - Kiểm tra trạng thái trong transaction đã khóa session, trả lỗi nghiệp vụ rõ ràng.
  - Thống nhất giới hạn số lượng đặt với backend; không chỉ giới hạn theo chỗ còn lại.
  - Khi triển khai vé, hủy session phải đồng bộ trạng thái booking/vé và đánh dấu cần hoàn tiền trong cùng luồng phù hợp.
- **Xong khi:** Không thể sửa trái quy tắc session đã đóng; capacity không nhỏ hơn chỗ đã giữ/bán; đổi giá và quyền owner/staff vẫn được bảo vệ khi có request đồng thời.

### AUTH-01 — Thu hồi phiên và cập nhật quyền nhạy cảm

- [x] Hoàn thành AUTH-01 — access JWT 15 phút; refresh opaque 14 ngày, lưu SHA-256 hash và xoay token; logout thu hồi session hiện tại; middleware xác minh session/user/role hiện tại trên DB; CORS Origin test hồi quy. Migration `008_auth_sessions.sql` thêm bảng session với RLS bật, không có policy. Chưa có API đổi mật khẩu hoặc khóa tài khoản; nếu thêm phải thu hồi session.
- **Vị trí:** `apps/api/src/middleware/auth.ts`, `apps/api/src/modules/auth/`, schema user/session nếu bổ sung.
- **Vấn đề:** Quyền admin nằm trong token; hạ quyền hoặc xóa tài khoản chưa lập tức vô hiệu hóa token cũ. Logout hiện chỉ xóa cookie ở trình duyệt.
- **Cần sửa / đề xuất:**
  - Chọn cơ chế phù hợp MVP: kiểm tra user/quyền hiện tại với endpoint nhạy cảm và dùng `tokenVersion` hoặc phiên lưu DB để thu hồi token.
  - Xác định hành vi logout, đổi mật khẩu, hạ quyền và khóa tài khoản; nếu chưa có chức năng nào thì ghi rõ phần chưa hỗ trợ.
  - Rút ngắn thời hạn token nếu phù hợp; không thêm cơ chế refresh phức tạp nếu chưa cần.
  - Giữ kiểm tra Origin cho request thay đổi dữ liệu và thêm test hồi quy cho cookie/CORS. Không coi thiếu CSRF token riêng là bằng chứng tự động có lỗ hổng khi chưa xét cơ chế Origin hiện tại.
- **Xong khi:** Token đã thu hồi không gọi được endpoint được bảo vệ; hạ quyền admin có hiệu lực theo cam kết; logout và đăng nhập lại chạy đúng trong mô hình hosting thực tế.

### API-01 — Validate theo kiểu và giới hạn database

- [x] Hoàn thành API-01.
- **Vị trí:** Schema/routes của studios, workshops, sessions, admin; `apps/api/src/middleware/errors.ts`.
- **Cần sửa / đề xuất:**
  - Validate UUID của ID quản lý trước truy vấn; endpoint public vẫn nhận slug theo hợp đồng riêng.
  - Giới hạn số nguyên theo miền nghiệp vụ và kiểu `integer` PostgreSQL, tối đa kỹ thuật 2.147.483.647; giới hạn thực tế có thể nhỏ hơn.
  - Giới hạn độ dài mô tả, số phần tử audience, chuỗi trong mảng và kích thước request phù hợp.
  - Map lỗi DB có thể dự kiến thành 409/422; không trả nguyên lỗi SQL cho client.
- **Xong khi:** ID rác, số vượt miền, nội dung quá lớn trả 4xx nhất quán; không rơi thành 500 do input đã biết là không hợp lệ.

### AUTH-02 — Xử lý đăng ký trùng email đồng thời

- [x] Hoàn thành AUTH-02.
- **Vị trí:** `apps/api/src/modules/auth/auth.service.ts`, `auth.repository.ts`, constraint email trong DB.
- **Cần sửa / đề xuất:**
  - Giữ unique constraint làm nguồn quyết định; bắt lỗi unique đúng constraint email và trả 409.
  - Thống nhất trim/lowercase email ở mọi luồng, kể cả seed admin; nếu thay ràng buộc không phân biệt hoa thường thì xử lý dữ liệu cũ bằng migration mới.
  - Cân nhắc limiter riêng cho đăng ký vì Argon2 tốn tài nguyên; kiểm tra limiter hoạt động đúng sau proxy.
- **Xong khi:** Hai request cùng email đồng thời tạo đúng một user; request còn lại nhận 409; không lộ hash hoặc chi tiết DB.

### API-02 — Xử lý response 204 và lỗi có cấu trúc

- [x] Hoàn thành API-02.
- **Vị trí:** `apps/web/src/lib/api-client.ts`, service auth khi nối UI.
- **Cần sửa / đề xuất:**
  - Hỗ trợ endpoint không trả body, như logout 204, bằng type/overload rõ ràng.
  - Parse thông báo và mã lỗi API khi response là JSON đúng định dạng; có fallback nếu body không phải JSON.
  - Phân biệt hủy request, lỗi mạng, timeout và lỗi nghiệp vụ; giữ `credentials: 'include'` cho luồng xác thực.
- **Xong khi:** Logout 204 không bị lỗi parse; 401/403/409/422 hiển thị phù hợp; response HTML từ proxy không làm mất khả năng báo lỗi.

## P2 — Hoàn thiện nghiệp vụ trước khi nhận đặt chỗ/thanh toán thật

### FLOW-01 — Nối xác thực và màn hình quản lý

- [x] Hoàn thành FLOW-01.
- **Vị trí:** `apps/web/src/App.tsx`, `apps/web/src/components/layout/SiteHeader.tsx`, các page/service/hook mới theo phạm vi đã chốt.
- **Cần sửa / đề xuất:** Thay `#login` bằng luồng đăng nhập thật; nối `/me` và logout; hoàn thiện màn hình quản lý studio/workshop/session và duyệt admin. UI phản ánh quyền, còn API luôn là nơi quyết định phân quyền.
- **Xong khi:** Đăng nhập lại sau refresh được; customer/owner/staff/admin thấy đúng tác vụ; thành viên studio B không truy cập dữ liệu studio A bằng API dù sửa URL/body.

### FLOW-02 — Triển khai giữ chỗ nguyên tử và hết hạn

- [ ] Hoàn thành FLOW-02.
- **Vị trí:** Module bookings, modules sessions, `WorkshopPage.tsx`, `WorkshopSchedule.tsx`.
- **Cần sửa / đề xuất:**
  - Thêm API booking theo đặc tả; truyền handler thật vào `onBook`.
  - Trong cùng transaction: xử lý hold hết hạn liên quan, kiểm tra buổi còn mở và dùng `UPDATE ... WHERE seats_held + seats_sold + quantity <= capacity RETURNING ...` để giữ chỗ.
  - Lấy giá từ session ở server, tính tổng bằng số nguyên; không tin giá/tổng tiền client.
  - Thiết kế chống tạo booking lặp khi retry; UI phân biệt đã giữ chỗ chờ thanh toán với đã thanh toán/xác nhận.
- **Xong khi:** Test đồng thời không bán quá chỗ; hold hết hạn được giải phóng đúng một lần; retry không tạo đơn ngoài ý muốn; UI hiển thị hạn giữ chỗ và trạng thái đúng.
- **Phụ thuộc:** DB-01, SES-01, DTO-01, API-02.

### FLOW-03 — Triển khai thanh toán, webhook và vé

- [ ] Hoàn thành FLOW-03.
- **Vị trí:** Modules payments/tickets, bảng bookings/payments/webhook_events/tickets, UI vé.
- **Cần sửa / đề xuất:**
  - Dùng interface `PaymentProvider` với mock cho test và provider thật khi phát hành; đọc tài liệu chính thức hiện hành trước khi triển khai chữ ký PayOS.
  - Xác thực webhook, lưu sự kiện và xử lý idempotent trong transaction; webhook trùng không cộng chỗ bán hoặc cấp vé hai lần.
  - Xử lý thanh toán muộn, sai số tiền, session đã hủy và `refund_needed`; không tự chuyển thành paid từ trang redirect client.
  - Thống nhất/adapter enum booking UI và DB; demo `confirmed/completed` không được ép trực tiếp sang enum backend `paid/expired/refund_needed`.
  - Khi hủy, vé không còn được chấp nhận theo quy tắc đã chốt; QR/check-in chỉ làm nếu thuộc phạm vi được duyệt.
- **Xong khi:** Bộ test webhook lặp/sai chữ ký/sai tiền/thanh toán muộn/hủy đồng thời qua; vé chỉ cấp sau xác nhận thanh toán đáng tin cậy; provider mock không hoạt động nhầm trong môi trường nhận tiền thật.
- **Phụ thuộc:** FLOW-02.

### SEARCH-01 — Hoàn thiện xếp hạng theo thiết kế đồ án

- [ ] Hoàn thành SEARCH-01.
- **Vị trí:** Search API/ranker theo roadmap, `apps/web/src/lib/search.ts`, `rankWorkshops.ts`, bảng `search_logs`.
- **Cần sửa / đề xuất:** Lọc điều kiện cứng tại DB trước; ranker chỉ xếp hạng tập ứng viên phù hợp; có timeout và fallback văn bản/BM25 ở API; ghi model version, latency và `fallback_used`. Không dùng sao đánh giá làm nhãn huấn luyện.
- **Xong khi:** Ranker lỗi/chậm vẫn trả kết quả phù hợp điều kiện; log phản ánh fallback; có đánh giá chất lượng trên dữ liệu chia tập theo đặc tả.
- **Phụ thuộc:** CAT-01; triển khai theo roadmap AI hiện có, không gắn nhãn AI cho heuristic frontend.

### DATA-02 — Phân biệt dữ liệu thật và dữ liệu mô phỏng

- [ ] Hoàn thành DATA-02.
- **Vị trí:** `db/migrations/001_init.sql` để tham khảo, migration mới, repository tạo workshop, seed scripts và thành phần hiển thị vé/card.
- **Cần sửa / đề xuất:**
  - Không sửa migration 001; migration mới điều chỉnh default nếu cần, seed luôn ghi cờ mô phỏng chủ đích.
  - API tạo nội dung thật đặt cờ đúng; không cho client tùy tiện đổi nguồn gốc dữ liệu.
  - Không chuyển toàn bộ dữ liệu cũ thành thật; cần xác định nguồn gốc trước khi backfill.
  - Bảo đảm danh sách và trang chi tiết có cách nhận biết dữ liệu demo phù hợp, không chỉ một số màn hình.
- **Xong khi:** Workshop thật không mang nhãn mô phỏng; seed vẫn mang nhãn; môi trường production có quy tắc rõ ràng về việc chứa dữ liệu demo.

### CAT-02 — Thay lọc “mang về trong ngày” bằng dữ liệu có cấu trúc

- [ ] Hoàn thành CAT-02.
- **Vị trí:** `ExplorePage.tsx`, catalog schema/repository, workshop schema và migration mới.
- **Vấn đề:** Regex `ngay|ngày` có thể nhận cả câu “không mang về trong ngày”.
- **Cần sửa / đề xuất:** Chọn boolean/enum biểu diễn khả năng mang về; hỗ trợ chưa xác định nếu dữ liệu cũ không rõ. Lọc tại DB và bỏ suy đoán bằng regex ở production.
- **Xong khi:** Nội dung phủ định không bị chọn sai; giá trị chưa xác định được xử lý nhất quán; kết quả/tổng/phân trang dùng cùng điều kiện.

### STAFF-01 — Quản lý và phân quyền nhân viên theo từng studio

- [ ] Chưa triển khai đầy đủ quản lý nhân viên studio.
- **Hiện có:** `studio_members.role` phân biệt `owner` và `staff`; bảng admin người dùng đã có nhãn “Nhân viên tại n studio”. Vai trò tài khoản vẫn là `customer`, `studio_owner` hoặc `admin`; không dùng `studio_owner` để biểu diễn quyền nhân viên. Một người có thể sở hữu studio A và làm nhân viên tại studio B.
- **Các phần chưa làm:**
  - [ ] Giao diện và API để chủ studio mời/thêm nhân viên; xác nhận lời mời, xử lý lời mời trùng, hết hạn và thu hồi lời mời.
  - [ ] Danh sách nhân viên theo studio; gỡ nhân viên và thu hồi ngay quyền truy cập studio đó, giữ nguyên quyền tại các studio khác.
  - [ ] Chốt ma trận quyền owner/staff cho workshop, lịch/slot, đặt chỗ, hồ sơ studio và các thao tác liên quan tiền/cọc. Áp dụng kiểm tra ở backend và hiển thị đúng nút ở frontend.
  - [ ] Dashboard dành cho nhân viên: cho vào studio có quyền `staff`, chuyển studio trong phạm vi được cấp và giới hạn menu/thao tác theo quyền. Dashboard hiện tại chủ yếu dành cho chủ studio.
  - [ ] Ghi audit log khi mời, thêm, gỡ hoặc đổi quyền nhân viên; thể hiện rõ người thực hiện, studio, thời gian và lý do nếu có.
  - [ ] Kiểm tra truy cập trực tiếp API, truy cập chéo studio, nhân viên đã bị gỡ và tài khoản bị khóa; kiểm tra trường hợp cùng một người là owner ở A và staff ở B.
- **Xong khi:** Chủ studio quản lý được nhân viên của studio mình; nhân viên chỉ thao tác trong studio và phạm vi được cấp. Gỡ thành viên có hiệu lực với cả phiên đang đăng nhập, không phải khóa toàn bộ tài khoản. Đổi vai trò tài khoản không tự cấp/xóa quan hệ thành viên; không cho nhân viên tự nâng quyền thành owner.
- **Tham chiếu:** FR-24 trong `docs/project/overview.md`, `docs/features/admin-users.md`.

## Bảng quy tắc đặt chỗ theo mức cọc

Phần bổ sung theo yêu cầu người dùng, thuộc P2 và cần thực hiện cùng FLOW-02/FLOW-03. Đây là yêu cầu triển khai, chưa phải hành vi hiện có. Giữ nguyên các mục đã hoàn thành phía trên; không sửa migration cũ để bổ sung nghiệp vụ này.

Các con số như 24 giờ, 50%, 2 booking và 2 hoặc 3 lần vi phạm là mặc định gợi ý. Đặt chúng thành hằng số cấu hình có tên, validate ở server và cho phép truyền vào hàm nghiệp vụ khi test. Đồng hồ trong test phải điều khiển được; không hard-code ngưỡng ở nhiều nơi.

### DEP-01 — Quyền chọn mức cọc và trạng thái xác minh studio

- [ ] Hoàn thành DEP-01.

| Studio        | `depositPercent` cho phép | QR thanh toán |
| ------------- | ------------------------- | ------------- |
| Chưa xác minh | Chỉ 0                     | Không có      |
| Đã xác minh   | Số nguyên từ 0 đến 100    | Có khi > 0    |

- **Vị trí cần sửa:** Schema/migration mới cho studio và workshop; API tạo/sửa workshop; API quản lý xác minh; DTO public và form workshop.
- **Cần sửa / đề xuất:**
  - Mặc định workshop mới là 30%; server tự ép về 0 nếu studio chưa xác minh, kể cả client gửi 50%. Không báo lỗi chỉ vì studio chưa xác minh gửi mức cọc khác 0.
  - Validate kiểu/phạm vi phần trăm trước; không âm thầm chấp nhận chuỗi, số âm hoặc giá trị trên 100.
  - Xác minh là trạng thái đáng tin cậy do người có quyền quản lý; không cho owner/staff tự gửi cờ xác minh. Phân biệt xác minh nhận cọc với trạng thái duyệt nội dung `approved`, trừ khi đã chốt chúng là một nghiệp vụ.
  - Khi studio được xác minh, workshop 0% cũ vẫn giữ 0%; studio tự chỉnh mức cọc.
  - Studio chưa xác minh không được tạo yêu cầu thanh toán cọc hoặc QR thanh toán qua API, dù client giả mạo UI. QR này là QR thanh toán, khác QR vé/check-in.
- **Xong khi:** Server áp dụng đúng bảng trên cho cả tạo và sửa; response trả mức cọc đã chuẩn hóa; xác minh studio không tự đổi workshop cũ.

### DEP-02 — Điều kiện đặt không cọc và giới hạn đồng thời

- [ ] Hoàn thành DEP-02.

Điều kiện chung: workshop có `depositPercent = 0`. Tất cả điều kiện sau phải đạt:

| Điều kiện                                                                         | Nếu không đạt                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Đã đăng nhập, có email hoặc số điện thoại đã xác thực                             | Yêu cầu đăng nhập/xác thực trước                       |
| Số booking không cọc đang hoạt động của khách < 2                                 | Từ chối, báo “đang giữ tối đa 2 chỗ chưa thanh toán”   |
| Số chỗ không cọc của buổi chưa đạt 50% sức chứa và yêu cầu mới không vượt hạn mức | Từ chối, báo buổi này chỉ nhận đặt cọc cho chỗ còn lại |
| Khách chưa bị cờ “cần cọc”                                                        | Từ chối đặt không cọc; chỉ cho đặt workshop có cọc     |
| Buổi còn ít nhất 24 giờ                                                           | Từ chối đặt không cọc vì buổi quá gần                  |

- **Vị trí cần sửa:** Schema xác thực email/điện thoại, customer policy, bookings service/repository, session availability và UI đặt chỗ.
- **Cần sửa / đề xuất:**
  - Có bằng chứng xác thực email/điện thoại ở server; không tin cờ `verified` do client gửi. Chốt cơ chế xác thực trước khi mở đặt không cọc.
  - Hai booking là số đơn đang hoạt động; hạn mức 50% tính theo tổng số chỗ (`quantity`), không phải số đơn. Chốt chính xác trạng thái nào tính là đang hoạt động.
  - Kiểm tra cả quantity mới: buổi 10 chỗ đang có 4 chỗ không cọc không được nhận thêm đơn 2 chỗ không cọc.
  - Dùng transaction và cơ chế tuần tự hóa theo user/session theo một thứ tự khóa chung. Chỉ `count` rồi insert ở các request độc lập sẽ không bảo vệ hạn mức 2 đơn và 50% khi đặt đồng thời.
  - Tách hàm thuần đề xuất `canBookWithoutDeposit(customer, session, workshop, policy, now)` để tính lý do từ snapshot; repository vẫn phải đọc/khóa và kiểm tra lại trong transaction. Hàm thuần không thay thế bảo vệ đồng thời tại DB.
  - Dùng giờ server để tính khoảng cách đến buổi; điều kiện đúng tại mốc đủ 24 giờ là được phép nếu các điều kiện khác đạt.
  - Chốt cách làm tròn hạn mức khi capacity lẻ. Đề xuất lấy phần nguyên dưới của `capacity * ratio`, nhưng chỉ áp dụng sau khi chốt.
- **Xong khi:** Không vượt hạn mức user, quota không cọc hoặc tổng sức chứa khi có request đồng thời; API trả mã lỗi và một câu lý do cụ thể; UI thể hiện được lý do đó.

### DEP-03 — Cờ khách cần cọc và lịch sử tham dự

- [ ] Hoàn thành DEP-03.

- **Quy tắc:** Bật cờ khi khách có từ 2 lần `no_show` trong 90 ngày; có thể chọn ngưỡng 3 qua cấu hình. Tắt sau 2 buổi tham dự liên tiếp hoặc do quản trị tắt thủ công.
- **Cần sửa / đề xuất:**
  - Lưu lịch sử tham dự, thời điểm buổi, người đánh dấu và lý do chỉnh sửa; tính cửa sổ 90 ngày nhất quán theo thời điểm đã chốt.
  - Tách attendance (`attended | no_show`) khỏi trạng thái booking và trạng thái thanh toán để không đồng nhất “đã đến” với “đã trả tiền”.
  - Theo bảng điều kiện DEP-02, khách có cờ bị từ chối workshop 0%, còn workshop có cọc vẫn đặt theo luồng thanh toán bình thường. Câu gốc “chỉ ảnh hưởng workshop có cọc” chưa thống nhất với bảng 2; cần chốt lại câu chữ trước triển khai, không âm thầm đảo quy tắc.
  - Chốt cách tính hai buổi liên tiếp, ảnh hưởng của việc sửa attendance và thời hạn hiệu lực khi admin gỡ cờ. Không để job bật lại ngay chỉ vì vẫn thấy lịch sử cũ mà không xét quyết định gỡ cờ.
  - Hủy muộn có thể tính nửa lần `no_show` là tùy chọn chưa chốt. Nếu áp dụng, dùng điểm nguyên, ví dụ no-show = 2 và hủy muộn = 1; không dùng số thực để tích lũy điểm.
- **Xong khi:** Ngưỡng, cửa sổ thời gian và chuỗi tham dự được test tại biên; sửa attendance không cộng lỗi hai lần; chỉ admin có quyền gỡ cờ thủ công và có log.

### DEP-04 — Vòng đời booking không cọc, nhắc lịch và trả chỗ

- [ ] Hoàn thành DEP-04.

```text
đặt chỗ → confirmed → T-24h gửi nhắc → khách bấm “Tôi sẽ đến” → vẫn confirmed
                                   │
                                   └─ chưa xác nhận trước T-12h → theo cấu hình studio:
                                          • chỉ cảnh báo studio, hoặc
                                          • tự hủy và trả chỗ

diễn ra buổi → studio đánh dấu attendance: attended | no_show
```

- **Vị trí cần sửa:** Migration mới và state machine bookings, session capacity, API xác nhận/hủy/attendance, job nhắc lịch và UI lịch sử booking.
- **Cần sửa / đề xuất:**
  - Booking không cọc đi thẳng tới `confirmed`, không có `pending_payment`. Enum DB hiện tại cần được đối chiếu và nâng cấp bằng migration mới; không coi confirmed không cọc là booking paid.
  - Chỗ confirmed không cọc chiếm sức chứa thật. Chốt cách biểu diễn counter để không dùng `seats_sold` như bằng chứng đã thu tiền; mọi nhánh giữ/xác nhận/hủy/hết hạn phải thống nhất công thức khả dụng.
  - Lưu mốc nhắc lịch/xác nhận tham dự và khóa idempotency. Job chạy lại không gửi trùng hoặc trả chỗ hai lần; thao tác “Tôi sẽ đến” chỉ dành cho chủ booking.
  - Tại T-12h, áp dụng chế độ studio đã cấu hình; cảnh báo thì không trả chỗ, tự hủy thì cập nhật trạng thái và trả chỗ nguyên tử. Job phải kiểm tra lại trạng thái/xác nhận trong transaction để tránh hủy booking vừa được khách xác nhận.
  - Khách hủy trước hạn miễn phí: cancelled và trả chỗ. Quá hạn vẫn được hủy nhưng ghi nhận hủy muộn; hạn miễn phí và cách tính điểm hủy muộn cần chốt/cấu hình rõ.
  - Chỉ thành viên studio có quyền mới được đánh dấu attendance cho booking của chính studio; chỉ sau giờ bắt đầu và trong vòng 48 giờ. Chốt chính xác biên 48 giờ và quyền owner/staff.
  - Xử lý việc đổi lịch/hủy session, booking tạo đúng T-24h, job bị trễ và yêu cầu xác nhận đến sau khi đã tự hủy; không tự khôi phục chỗ khi chưa kiểm tra lại sức chứa.
  - Việc chọn kênh gửi nhắc và provider là quyết định triển khai sau; checklist này không thực hiện gửi thông báo thật.
- **Xong khi:** Chuyển trạng thái hợp lệ, chỗ và quota không cọc được hoàn trả đúng một lần; attendance không tự đổi trạng thái thanh toán; nhắc lịch/tự hủy chạy lặp vẫn an toàn.

### DEP-05 — Tính tiền cọc, snapshot và hiển thị đặt chỗ

- [ ] Hoàn thành DEP-05.

| Trường hợp | Dòng thanh toán                            | Nút                   |
| ---------- | ------------------------------------------ | --------------------- |
| 0%         | “Thanh toán tại studio”                    | Đặt chỗ               |
| 1–99%      | “Cần cọc ngay X đ, còn lại Y đ tại studio” | Đặt cọc để giữ chỗ    |
| 100%       | “Thanh toán trước toàn bộ X đ”             | Đặt chỗ và thanh toán |

- **Vị trí cần sửa:** WorkshopSchedule, ticket/card adapters, DTO, booking/payment service và PaymentProvider.
- **Cần sửa / đề xuất:**
  - Khi không đủ điều kiện không cọc, hiển thị một câu lý do cụ thể; không chỉ vô hiệu hóa nút.
  - Server tính tổng, cọc và số còn lại từ giá session, quantity và chính sách cọc; client chỉ hiển thị. Chốt quy tắc làm tròn tiền nguyên VND trước khi viết code.
  - Snapshot phần trăm cọc, tổng tiền, cọc phải trả và số còn lại khi tạo booking; sửa workshop không thay đổi nghĩa vụ của đơn đã tạo.
  - Khi thanh toán cọc thành công, ghi nhận đã trả cọc và số dư còn lại; không coi đã thu đủ toàn bộ giá workshop. Chốt cách ghi nhận thanh toán tại studio và tính doanh thu.
  - Nếu provider có số tiền tối thiểu, xử lý mức cọc quá nhỏ một cách công khai theo chính sách đã chốt, không âm thầm đổi số tiền.
  - QR và checkout chỉ được tạo từ đơn hợp lệ ở server. Quy tắc hủy/hoàn cọc cần chốt; giữ phạm vi hoàn tiền thủ công nếu dự án chưa hỗ trợ tự động.
- **Điểm cần chốt:** Với workshop cố định 0%, sau khi quota 50% đầy thì hiện chưa có mức cọc để bán các chỗ còn lại trên chính workshop đó. Không tự biến booking 0% thành booking có cọc. Nếu muốn cùng một buổi bán cả hai kiểu, cần mở rộng mô hình chính sách và UI; nếu giữ mô hình hiện tại thì gợi ý workshop có cọc khác và điều chỉnh thông báo cho đúng khả năng thực tế.
- **Xong khi:** Số tiền UI khớp snapshot server và webhook; hiển thị đúng cả 0/30/100%; thanh toán cọc không bị ghi thành thu đủ; thay phần trăm sau đặt không sửa đơn cũ.

### DEP-06 — Bộ test mức cọc và tiêu chí nghiệm thu

- [ ] Hoàn thành DEP-06; các case dưới có test tự động phù hợp.

- [ ] Studio chưa xác minh gửi `depositPercent = 50`: server ép về 0, trả giá trị thực tế và không sinh QR; đây là hành vi chọn theo quy tắc mục 1, không dùng phương án báo lỗi trong ví dụ gốc.
- [ ] Workshop mới của studio đã xác minh mặc định 30%; xác minh studio không tự đổi workshop cũ từ 0 lên 30%.
- [ ] Client sửa cờ xác minh hoặc gửi phần trăm ngoài 0–100 không vượt được kiểm tra server.
- [ ] Khách chưa đăng nhập/chưa có email hoặc điện thoại đã xác thực đặt 0%: yêu cầu đăng nhập/xác thực.
- [ ] Khách có 2 booking không cọc đang hoạt động đặt đơn thứ 3 bị từ chối; hủy một đơn thì đặt lại được.
- [ ] Hai request của cùng khách đồng thời không vượt giới hạn 2 booking.
- [ ] Buổi 10 chỗ có 5 chỗ không cọc: không nhận chỗ không cọc thứ 6; khách vẫn có thể đặt workshop có cọc khác nếu còn chỗ và đạt điều kiện. Khả năng trả cọc cho chính buổi 0% cần chốt ở DEP-05.
- [ ] Buổi 10 chỗ có 4 chỗ không cọc, yêu cầu thêm 2 chỗ không cọc bị từ chối; capacity lẻ theo quy tắc làm tròn đã chốt.
- [ ] Buổi còn 23 giờ 59 phút: chặn 0%; còn 24 giờ 01 phút: cho phép nếu điều kiện khác đạt; đúng 24 giờ theo quy tắc “ít nhất”.
- [ ] Hai khách cùng đặt chỗ cuối cùng: chỉ một thành công; đồng thời không vượt quota 50% chỗ không cọc.
- [ ] Khách có cờ cần cọc bị từ chối workshop 0%; được dùng luồng workshop có cọc bình thường.
- [ ] Đủ số no-show trong 90 ngày bật cờ; no-show ngoài cửa sổ không tính; đủ hai buổi liên tiếp hoặc admin gỡ cờ hoạt động đúng quy tắc đã chốt.
- [ ] Đánh dấu no-show trước giờ bắt đầu hoặc sau cửa sổ 48 giờ bị từ chối; kiểm tra thêm hai mốc biên.
- [ ] Studio A đánh dấu attended/no-show cho booking studio B bị từ chối; khách không tự đánh dấu attendance.
- [ ] Nhắc lịch gửi đúng một lần khi job chạy lại; nếu khách đã xác nhận trước lúc gửi thì không gửi lời nhắc xác nhận nữa; phản hồi không đổi booking khỏi confirmed.
- [ ] T-12h chế độ cảnh báo giữ nguyên chỗ; chế độ tự hủy trả chỗ đúng một lần; xác nhận và job chạy đồng thời cho kết quả nhất quán.
- [ ] Hủy trước/sau hạn miễn phí ghi đúng cancelled/hủy muộn; điểm nửa no-show chỉ áp dụng nếu đã bật chính sách tùy chọn.
- [ ] Tiền cọc và tiền còn lại đúng với nhiều quantity, quy tắc làm tròn, mức 0/1/30/99/100%; client không sửa được số tiền và snapshot.
- [ ] Webhook cọc lặp không xác nhận hai lần, thu tiền hai lần hoặc tăng chỗ hai lần; sửa mức cọc workshop không sửa nghĩa vụ booking cũ.

**Thứ tự thực hiện đề xuất:** Chốt các điểm mở về xác minh, quota, cờ và thanh toán → DEP-01 → DEP-02/DEP-03 → DEP-04 cùng FLOW-02 → DEP-05 cùng FLOW-03 → DEP-06. Các mục này phụ thuộc DB-01, SES-01, DTO-01 và cơ chế xác thực liên hệ; chưa coi là hoàn thành khi mới có hàm thuần hoặc UI.

## P3 — Refactor và cải thiện khả năng vận hành

### REF-01 — Tách layout dùng chung

- [ ] Hoàn thành REF-01.
- **Vị trí:** `apps/web/src/App.tsx`, các page public, `components/layout/`.
- **Đề xuất:** Tạo `PublicLayout` chứa `SiteHeader`, `Outlet`, `SiteFooter`. Chỉ đưa breadcrumb/container/padding vào layout nếu các trang thực sự có cùng quy tắc; giữ padding cho thanh đặt chỗ mobile ở nơi thích hợp.
- **Xong khi:** Các trang public không lặp header/footer; điều hướng và padding sticky vẫn đúng; không phát sinh thay đổi giao diện ngoài chủ đích.

### REF-02 — Tách logic Explore khỏi page

- [ ] Hoàn thành REF-02.
- **Vị trí:** `apps/web/src/pages/ExplorePage.tsx`, `hooks/`, `lib/`, `services/`.
- **Đề xuất:** Tách parser/serializer URL thành helper thuần; tách query/filter/view/pagination vào `useExploreCatalog`; tách adapter studio nếu vẫn cần sau CAT-01. Page tập trung ghép UI.
- **Xong khi:** URL có thể kiểm tra round-trip độc lập; back/forward giữ trạng thái đúng; không còn hai nơi tính tổng/sort trái nhau.
- **Phụ thuộc:** CAT-01 và UI-01 để không đóng gói lại logic đang sai.

### REF-03 — Dùng chung lựa chọn tỉnh và định vị

- [ ] Hoàn thành REF-03.
- **Vị trí:** `useHomeCatalog.ts`, `ExplorePage.tsx`, `useProvinces.ts`, `locationService.ts`.
- **Đề xuất:**
  - Hook chung quản lý lựa chọn tỉnh, preference key và hủy yêu cầu định vị; lựa chọn thủ công mới nhất luôn được ưu tiên.
  - Chuyển provinces/areas sang TanStack Query với query key dùng chung, retry và trạng thái lỗi rõ ràng.
  - Bọc truy cập localStorage để việc trình duyệt chặn lưu trữ không làm crash trang.
  - Lưu tọa độ đại diện tỉnh trong catalog/config thay vì search tuần tự từng tỉnh; có timeout, hủy request và thông báo việc gửi tọa độ cho nhà cung cấp bên ngoài.
- **Xong khi:** Home/Explore đồng nhất lựa chọn; request cũ không ghi đè lựa chọn mới; định vị thất bại vẫn chọn tay được; không tải danh sách tỉnh lặp không cần thiết.

### REF-04 — Gộp helper, schema và component thực sự trùng

- [ ] Hoàn thành REF-04.
- **Vị trí:** `lib/search.ts`, `constants/categories.ts`, `hooks/useCategories.ts`, API routes, `components/details/`, `packages/shared/`.
- **Đề xuất:**
  - Dùng một helper chuẩn hóa tiếng Việt, kiểm tra lại semantics trước khi thay mọi chỗ vì slug và tìm kiếm có mục đích khác nhau.
  - Bỏ mutable global `registerCategories()`; component đọc dữ liệu qua query/context có subscription rõ ràng.
  - Dùng helper validate params chung cho routes quản lý workshop/session; giữ kiểm tra quyền studio tại service/repository.
  - Tách `ReviewCard`, `MapLink` khi đã thống nhất props/behavior; dùng lại primitives đang có.
  - Giữ hệ thống `TicketShell`/`TicketCard`/`TicketRow`; không chia nhỏ thêm chỉ để giảm số dòng.
- **Xong khi:** Không còn nguồn danh mục toàn cục bị thay mà thiếu subscription; metadata mới render đúng; helper dùng chung có trách nhiệm rõ, không thêm abstraction chỉ dùng một lần.

### PERF-01 — Không tải toàn bộ catalog để hiện gợi ý

- [ ] Hoàn thành PERF-01.
- **Vị trí:** `hooks/useCategoryCatalog.ts`, `components/layout/HeaderSearch.tsx`, danh mục shortcuts, API catalog/search.
- **Đề xuất:** API thống kê category/count gọn cho chip; endpoint gợi ý có limit, debounce và cancellation khi tìm kiếm. Chỉ tải dữ liệu gợi ý cần thiết, dùng cache thay vì lặp tất cả trang catalog khi header mount.
- **Xong khi:** Mở trang không tải toàn bộ workshop chỉ để tạo gợi ý; dataset lớn vẫn đáp ứng tốt; gợi ý có thể tìm ra workshop ngoài 100 mục đầu.

### OPS-01 — Bổ sung timeout, logging và graceful shutdown

- [ ] Hoàn thành OPS-01.
- **Vị trí:** `apps/api/src/db/pool.ts`, `server.ts`, `middleware/errors.ts`, `app.ts`.
- **Đề xuất:**
  - Đặt connection/query/statement timeout phù hợp; xử lý sự kiện lỗi của pool.
  - Khi SIGTERM/SIGINT: dừng nhận request, chờ tác vụ đang chạy trong thời hạn giới hạn, đóng pool rồi thoát.
  - Log lỗi gốc ở error handler bằng logger cùng request ID, redact dữ liệu nhạy cảm; response client vẫn không chứa stack/SQL/secret.
  - Phân loại JSON sai/body quá lớn thành 400/413 và định dạng lỗi thống nhất, kể cả rate limit.
  - Tách liveness và readiness nếu cần; health check không nên bị vô hiệu vì hết quota limiter chung của người dùng.
- **Xong khi:** Query bị treo có hạn thời gian; DB lỗi có log truy vết; dừng process không cắt tác vụ ngay lập tức; endpoint sức khỏe phản ánh đúng vai trò của nó.

### OPS-02 — Kiểm tra cấu hình triển khai và vận hành thật

- [ ] Hoàn thành OPS-02.
- **Vị trí:** `render.yaml`, `apps/web/vercel.json`, `lib/api-client.ts`, `.env.example`, `docs/operations/deploy.md`.
- **Đề xuất:**
  - Build production từ chối thiếu/sai `VITE_API_BASE_URL`, tránh âm thầm gọi localhost; không đưa secret vào biến `VITE_*`.
  - Kiểm tra cookie/CORS/proxy bằng hai origin HTTPS thực tế; kiểm tra cả trình duyệt hạn chế cookie bên thứ ba, cân nhắc cùng site nếu phù hợp.
  - Xác minh RLS/quyền bảng bằng vai công khai thực tế; phân tách quyền DB runtime/migration theo khả năng vận hành và kiểm tra tương thích RLS trước khi đổi vai.
  - Cấu hình security headers cho static web ở nơi hosting, không giả định Helmet của API bảo vệ HTML frontend.
  - Kiểm tra backup/restore, quy trình migration, giám sát lỗi và quay lại phiên bản ứng dụng tương thích khi deploy lỗi.
  - Đánh giá limiter theo IP, số instance và proxy; cấu hình gateway nếu cần giới hạn chung, không thêm Redis trái stack hiện tại.
- **Xong khi:** Smoke test HTTPS, refresh URL chi tiết, auth, quyền, DB readiness qua; có bằng chứng restore và hướng dẫn deploy cập nhật; xác minh không dùng provider mock để nhận tiền thật.

### QA-01 — Sửa lint và nâng chất lượng CI

- [ ] Hoàn thành QA-01.
- **Vị trí:** `eslint.config.mjs`, `package.json`, `.github/workflows/ci.yml`, `apps/web/package.json`, scripts trong `output/`.
- **Vấn đề lúc rà soát:** Lint toàn workspace báo 264 lỗi trong `output/` chưa được Git theo dõi; Prettier báo 38 file. CI chưa có bước build và web chưa có test script chuẩn.
- **Đề xuất:**
  - Phân loại script output còn dùng: chuyển sang thư mục test/scripts có cấu hình môi trường phù hợp; ignore artifact sinh tự động có chủ đích. Không xóa toàn bộ output hoặc tắt rule toàn dự án để qua lint.
  - Format riêng bằng commit dễ review; không trộn với sửa nghiệp vụ lớn.
  - Thêm build vào CI, giữ lint/test; tích hợp test frontend có giá trị vào lệnh chuẩn.
  - Ưu tiên test quyền chéo studio, race, hơn 100 kết quả, URL sai, nguồn demo/production, policy DTO, 204 và các trạng thái booking/thanh toán.
- **Xong khi:** Clean checkout chạy `npm ci`, lint, build và bộ test phù hợp đều qua; CI thất bại khi có lỗi build/frontend quan trọng; DB test vẫn được safety guard bảo vệ.

### DOC-01 — Đồng bộ tài liệu với trạng thái thực tế

- [ ] Hoàn thành DOC-01.
- **Vị trí:** `README.md`, `CLAUDE.md`, `docs/operations/deploy.md`, đặc tả API và roadmap.
- **Đề xuất:** Bỏ thông tin lỗi thời như frontend chỉ có khung; ghi rõ tính năng đã chạy, đang demo, chưa có API và đã deploy hay chưa; cập nhật biến môi trường, endpoint mới và lệnh kiểm tra chuẩn.
- **Xong khi:** Người mới làm theo tài liệu chạy được dự án mà không cần đoán; không nhầm có schema với đã hoàn thiện chức năng.

## Bằng chứng kiểm tra tại thời điểm lập checklist

| Kiểm tra                                         | Kết quả                                        |
| ------------------------------------------------ | ---------------------------------------------- |
| TypeScript API, `--noEmit`                       | Qua                                            |
| TypeScript web, `--noEmit`                       | Qua                                            |
| ESLint riêng apps/packages/scripts               | Qua                                            |
| Lint toàn workspace                              | Không qua: 264 lỗi ở output chưa tracked       |
| Prettier trong phạm vi lint                      | 38 file chưa đạt                               |
| npm audit --omit=dev                             | 1 dependency mức cao                           |
| npm audit đầy đủ                                 | 1 cao, 12 trung bình; gồm ảnh hưởng dây chuyền |
| Thử formatter với ngày không hợp lệ              | Xác nhận RangeError                            |
| Integration test, migration, seed                | Chưa chạy; không ghi/reset DB                  |
| Production build, trình duyệt và hosting thực tế | Chưa xác minh trong đợt rà soát này            |

Đây là rà soát code và cấu hình, chưa phải kiểm thử xâm nhập hoặc xác nhận an toàn của môi trường production. Cảnh báo dependency cần kiểm tra lại khi thực hiện vì phiên bản và advisory có thể thay đổi.

## Theo dõi tiến độ

Thêm một dòng sau mỗi mục hoàn thành hoặc bị chặn. Checkbox bên trên là trạng thái chính; bảng này lưu bằng chứng.

| Mã mục  | Trạng thái       | Ngày       | Commit/PR   | Bằng chứng kiểm tra / việc còn lại                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------------- | ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —       | Chưa bắt đầu sửa | 01/11/2026 | —           | Chỉ lập checklist từ kết quả rà soát                                                                                                                                                                                                                                                                                                                                                                                                    |
| SEC-01  | Hoàn thành       | 01/11/2026 | Chưa commit | Build API qua; 12 unit test cấu hình/xác thực qua; secret `.env` đạt policy mà không in giá trị. Production secret rotation cần xác nhận trên dashboard nếu ứng dụng từng chạy bằng khóa cũ.                                                                                                                                                                                                                                            |
| SEC-02  | Hoàn thành       | 01/11/2026 | Chưa commit | Runtime dùng `body-parser@2.4.0`; `npm audit --omit=dev` không có vulnerability và advisory GHSA-27r3-jxmh-p828 đã hết. Full audit còn 12 cảnh báo mức trung bình ở dependency dev; build API và 6 unit test parser/API foundation qua; JSON nén bị từ chối, JSON lỗi/quá cỡ trả 400/413.                                                                                                                                               |
| DATA-01 | Hoàn thành       | 01/11/2026 | Chưa commit | API là mode mặc định, demo bật chủ đích bằng `VITE_DATA_MODE=demo`; browser check xác nhận mock ID không lấn dữ liệu API, 404/500 hiển thị đúng trạng thái và demo hoạt động; build cả hai mode, lint/format qua.                                                                                                                                                                                                                       |
| CAT-01  | Hoàn thành       | 01/11/2026 | Chưa commit | API query/sort/page và Explore server-side; endpoint studio aggregate trước phân trang. Test DB đã được đối chiếu với 004/005; bổ sung checksum migration vào `schema_migrations` sau khi xác minh schema, không chạy lại SQL migration. Catalog integration: 9/9 qua (bao gồm 105 workshop, bỏ dấu/OR-token, sort, lọc giá và grouping). Build API/web, ESLint, Prettier qua; browser responsive 360/768/1280 không lỗi JS/tràn ngang. |
| MOD-01  | Hoàn thành       | 01/11/2026 | Chưa commit | Phạm vi API + integration tests theo xác nhận; chưa làm UI admin. Migration 006 tạo lịch sử duyệt có RLS, lý do từ chối bắt buộc; admin chỉ xử lý pending; sửa workshop bị từ chối/đã duyệt đưa về pending. 20 integration tests liên quan (workshops/admin/migrations/catalog) qua; API build, ESLint, Prettier qua.                                                                                                                   |
