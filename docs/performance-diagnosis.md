# Open Slot — Chẩn đoán hiệu năng, bước 1

Ngày đo: 05/11/2026. Trong bước này không sửa source ứng dụng, UI, API, validation, phân quyền hoặc dữ liệu nghiệp vụ. Các thay đổi UI/test đã có trong working tree từ trước được giữ nguyên. Chỉ tạo báo cáo, script đo và artifact build.

## 1. Kết luận và mức độ chắc chắn

| Ưu tiên | Phát hiện                                                      | Bằng chứng                                                                                                                                               | Giới hạn kết luận                                                                                                                               |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| P0      | API có một lần khởi động rất chậm, ảnh hưởng cả ba khu vực     | GET Render `/health` đầu tiên 32.571 ms, lần kế tiếp 98 ms; `render.yaml:5-6` khai báo Singapore/free                                                    | Rất phù hợp cold start; chưa có log/dashboard Render để xác nhận lần đó chính xác là spin-up, cũng chưa xác nhận plan/region thực tế ngoài repo |
| P0      | Refresh phiên thất bại xóa cả cache công khai, gây request lặp | `api-client.ts:62`, `session-cache.ts:43-47,62`; trace Vercel ghi nhận `/home/featured`, `/categories`, `/settings` mỗi endpoint 2 lần ở lượt mở ẩn danh | Đã tái hiện trên production, không chỉ suy đoán từ code                                                                                         |
| P1      | Danh sách tỉnh không dùng Query cache                          | `useProvinces.ts:8` dùng effect/fetch riêng; quay lại trang chủ vẫn GET `/provinces` mất 406 ms                                                          | Các dữ liệu Query khác đã dùng lại cache trong lần quay lại này; không kết luận mọi trang đều tải lại toàn bộ                                   |
| P1      | Nhiều round trip DB nối tiếp trên đường tải dữ liệu            | Pooler trong `.env` hiện tại là Tokyo; `SELECT 1` mất 101–104 ms; catalog chạy transaction, cleanup, count, list nối tiếp                                | DB đang cấu hình local đã đo trực tiếp; region DB production chưa xác minh từ dashboard                                                         |
| P1      | JS dùng chung vẫn đáng kể; browser cache asset chưa tối ưu     | Build: 668.072 byte raw / 206.041 byte gzip; asset JS hash trên Vercel trả `max-age=0, must-revalidate`                                                  | Vercel vẫn có CDN; browser cache và CDN cache là hai lớp khác nhau                                                                              |
| P2      | Có N+1 và tải dữ liệu lớn hơn nhu cầu                          | `/me/studios`: 1 query danh sách + 2 query ảnh mỗi studio, kể cả mảng ID rỗng; tìm kiếm header tải tuần tự toàn bộ catalog                               | Chưa chứng minh đây là tác nhân lớn nhất ở DB hiện tại có ít dữ liệu                                                                            |

## 2. Stack và vị trí hạ tầng

- Frontend: React 19, React Router 7, Vite 6, Tailwind 4, TanStack Query 5, Zod 4; TypeScript. SPA tĩnh trên Vercel.
- Backend: Node.js/Express 5, `pg` kết nối PostgreSQL, Zod, JWT, cookie-parser, Helmet, pino-http. Không dùng Supabase Auth; auth do API quản lý.
- DB và ảnh: Supabase PostgreSQL và Supabase Storage bucket `studio-images`. Pool dùng Session pooler cổng 5432, `DB_POOL_MAX=5`. Không có Redis/cache store trong code hiện tại.
- Repo Render khai báo `region: singapore`, `plan: free`. Vị trí/gói live cần đối chiếu dashboard; không suy ra chắc chắn chỉ từ YAML.
- `.env` đang dùng pooler `aws-0-ap-northeast-1.pooler.supabase.com`: Tokyo. Cả kết nối DB thường và DB test có host vùng này; không xuất credential.
- Vercel phục vụ static qua CDN toàn cầu; không có cấu hình function region trong `apps/web/vercel.json`. POP trả HTML không đồng nghĩa vị trí máy API/DB.
- Nếu production cũng là Render Singapore + DB Tokyo, nên ưu tiên đưa API và DB cùng Singapore, hoặc đo phương án API gần DB trước khi chọn. [Supabase liệt kê vùng](https://supabase.com/docs/guides/platform/regions); đổi vùng cần [project mới và migration](https://supabase.com/kb/troubleshooting/change-project-region-eWJo5Z). [Render cũng cần service mới để đổi vùng](https://render.com/docs/regions). Chưa di chuyển/nâng gói trong bước này.

Render Free ngủ sau 15 phút không có traffic; tài liệu mô tả khởi động lại có thể khoảng một phút. Muốn mục tiêu lần đầu dưới 2 giây ổn định phải xử lý máy ngủ; frontend cache không giải quyết lượt truy cập đầu sau thời gian dài không hoạt động. Nâng sang instance luôn chạy là phương án cần cân nhắc ở bước hạ tầng; không tự triển khai ping hoặc đổi gói. [Nguồn Render](https://render.com/docs/free).

## 3. Xác thực, quyền và cache

- `main.tsx:12-20`: một QueryClient dùng chung, `staleTime=30s`, tắt refetch khi focus. Chưa khai báo `gcTime`; thư viện mặc định giữ query không được sử dụng 5 phút. [TanStack defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).
- `useAuth.ts:19-28`: `/me` có chung key `['auth','me']`, `staleTime=Infinity`. Nhiều component gọi hook không tự tạo một request `/me` cho mỗi lần chuyển route. Không có bằng chứng cần viết lại auth bootstrap từ đầu.
- Session/refresh là cookie HttpOnly; access JWT 15 phút, refresh phiên trong DB 14 ngày, refresh token được hash/xoay. Frontend gửi `credentials: 'include'`.
- `RequireRole.tsx:12-64`: admin chờ session đã có; studio chờ session rồi `/me/studios` để kiểm tra quyền sở hữu. Guard dùng `isPending`, không dùng `isFetching` để che dữ liệu cache. `RequireCustomer` tương tự cho khách.
- Studio lần tải mới có chuỗi phụ thuộc: `/me` → `/me/studios` → các query của workspace. Hai query workshop/session chạy song song sau khi studio đã biết. Đây là waterfall cần giảm độ sâu, nhưng không bỏ kiểm tra quyền sở hữu.
- Backend mỗi request riêng tư xác minh JWT và query session/user trong DB (`middleware/auth.ts:67`, `auth.repository.ts:136`). Quyền lấy theo DB hiện tại, không chỉ tin role cũ trong JWT. `/me` sau đó còn đọc user lần nữa ở `me.routes.ts:96`.
- Khi refresh thất bại, sự kiện `expired` gọi `synchronizeSession(..., force=true)`, hủy mọi query và `client.clear()`. Điều này cần thu hẹp vào dữ liệu riêng tư nhưng vẫn phải chống lộ cache khi đổi tài khoản/đăng xuất. `query-keys.ts` đã có tiền tố `private/userId` để tận dụng.
- Cache Query hiện nằm trong bộ nhớ, không persist qua F5, đóng tab hoặc mở tab mới. Cần tách yêu cầu “quay lại route SPA” khỏi “reload ứng dụng”. Không chuyển JWT/refresh token từ cookie HttpOnly sang localStorage để tối ưu. User/profile lưu cục bộ, nếu có, chỉ là gợi ý UI; không phải căn cứ cấp quyền.
- Admin DataTable đã có `keepPreviousData`, count query riêng chạy song song, phân trang mặc định 20 và prefetch trang kế (`DataTable.tsx:134-165`). Phần lớn màn hình chỉ hiện loading khi chưa có cache.
- Mutation đã invalidate theo nhóm key và cập nhật cache một số chi tiết; không thấy cơ chế reload toàn trang dùng chung sau mutation. Không áp optimistic update mù cho thanh toán, duyệt hồ sơ hay giữ chỗ.
- Chưa có TTL cache server cho catalog/settings/categories. `/home/featured` và `/settings` chủ động `no-store`; response catalog khác chưa có public TTL rõ ràng.

## 4. Bản đồ request theo trang

Quy ước: đây là request ứng dụng theo source, không cộng JS/CSS/font/ảnh, không cộng request mutation chỉ chạy khi thao tác. Cache có thể giảm số request thực tế. Mọi route hiện gọi `useCategories()` từ App; request được deduplicate khi còn cache. PublicShell bổ sung `/settings` qua footer, bootstrap `/me`; nếu đăng nhập còn `/me/studios` và `/me/notifications` chạy trì hoãn/poll 60s. Refresh chỉ phát sinh khi gặp 401.

| Khu vực/trang                          | API dữ liệu chính ngoài lớp dùng chung                                                          | Thứ tự/điểm chờ                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Khách `/`                              | `/home/featured`, `/provinces`                                                                  | Độc lập, không cần đợi `/me`; `/provinces` chưa cache                                                                         |
| `/kham-pha`, `/explore`                | `/workshops?page=…&page_size=12&…` **hoặc** `/catalog/studios?…`; `/provinces`                  | List và provinces độc lập; khi URL tỉnh được resolve có thể đổi key và gọi list thêm; có prefetch trang kế                    |
| Bộ lọc khu vực                         | `/provinces/:id/areas` khi chọn tỉnh                                                            | Phụ thuộc tỉnh, gọi ở components/effect, cần đưa về Query                                                                     |
| Header search khi mở                   | `/workshops?page=N&page_size=100`                                                               | `useCategoryCatalog.ts:12` duyệt toàn bộ các trang **tuần tự**, dù UI chỉ cần gợi ý                                           |
| `/workshop/:slug`, `/workshops/:id`    | `/workshops/:identifier` → `/workshops/:id/reviews` và `/workshops?page=1&page_size=100`        | Reviews và related bị chặn sau detail; reviews endpoint đã nhận được slug nên có cơ hội chạy sớm; related tải tới 100 bản ghi |
| `/studios/:slug`                       | `/studios/:identifier`                                                                          | Một endpoint đã gộp workshop/ảnh, server bên trong còn nhiều query nối tiếp                                                   |
| `/ve-open-slot`, `/danh-cho-nghe-nhan` | Không có API page-specific bắt buộc ngoài settings/shared                                       | Ảnh/font/code là phần cần đo                                                                                                  |
| `/dang-nhap`, `/dang-ky`               | `/me` từ useAuth khi bootstrap; POST auth chỉ khi submit                                        | Không gọi POST khi chỉ mở trang                                                                                               |
| `/dang-ky-studio`                      | `/settings`, `/categories`, `/me/studios`, `/provinces?include_empty=true`; ảnh khi chỉnh draft | Settings/categories có thể chạy trước auth; dữ liệu riêng tư chờ auth                                                         |
| `/me/bookings`                         | `/me/bookings`                                                                                  | Chờ RequireCustomer/session; list chưa có phân trang API                                                                      |
| `/me/bookings/:id`                     | `/bookings/:id` và `/bookings/:id/tickets`                                                      | **Promise.all**; poll mỗi 5s khi reservation pending, hiện mỗi lượt poll lấy cả vé                                            |
| `/payment/return`, `/payment/cancel`   | Không có request riêng                                                                          | Redirect về chi tiết booking                                                                                                  |
| `/payment/mock`                        | Không có GET page-specific                                                                      | Chỉ dev; POST khi xác nhận                                                                                                    |
| Studio Tổng quan                       | `/studios/:id/workshops`, `/studios/:id/sessions`                                               | Song song sau `/me/studios`; thêm notification dùng chung key                                                                 |
| Studio Workshop                        | `/studios/:id/workshops`                                                                        | Sau quyền studio; categories dùng lại cache                                                                                   |
| Studio Lịch và slot                    | `/studios/:id/workshops` và `/studios/:id/sessions`                                             | Song song; trang chờ cả hai query lần đầu                                                                                     |
| Studio Đặt chỗ                         | `/studios/:id/bookings`                                                                         | Chờ studio approved; API list chưa phân trang                                                                                 |
| Studio Hồ sơ                           | `/settings`; `/images?studioId=…` khi mount editor/fields                                       | `/me/studios` đã trả profile/ảnh; cần tránh đọc ảnh trùng và settings fetch ngoài cache khi upload                            |
| Admin Tổng quan                        | `/admin/overview`                                                                               | Sau auth admin; SQL overview đã gộp một query; Recharts lazy                                                                  |
| Admin Hồ sơ/Tất cả studio              | `/admin/studios?…` và `/admin/studios/counts?…`; `/settings`                                    | List/count/settings song song; `/admin/studios/:id` chỉ khi chọn chi tiết                                                     |
| Admin Workshop                         | `/admin/workshop?…` và `/admin/workshop/counts?…`; `/categories`                                | List/count song song; studio options tìm kiếm khi dùng filter; detail khi chọn dòng. Loader duyệt cũ còn `/admin/workshops`   |
| Admin Đặt chỗ                          | `/admin/dat-cho?…` và `/admin/dat-cho/counts?…`                                                 | Song song; `/admin/dat-cho/:id` chỉ mở detail; studio options khi tìm kiếm                                                    |
| Admin Người dùng                       | `/admin/nguoi-dung?…` và `/admin/nguoi-dung/counts?…`                                           | Song song                                                                                                                     |
| Admin Báo cáo                          | `/admin/bao-cao?…` và `/admin/bao-cao/counts?…`                                                 | Song song; detail theo lựa chọn                                                                                               |
| Admin Nhật ký                          | `/admin/nhat-ky?…`, `/admin/nhat-ky/filters`                                                    | Song song; fetcher tắt counts; detail theo lựa chọn                                                                           |
| Admin Danh mục                         | `/admin/danh-muc?page=N&pageSize=100&sort=sortOrder:asc`                                        | Lấy mọi trang tuần tự để reorder; cần giữ nguyên semantics sắp xếp toàn bộ                                                    |
| Admin Nội dung                         | `/admin/noi-dung`                                                                               | Search options khi tìm kiếm; preview là thao tác chủ động                                                                     |
| Admin Mẫu thông báo                    | `/admin/mau-thong-bao`                                                                          | Preview chỉ khi thao tác                                                                                                      |
| Admin Cài đặt                          | `/admin/cai-dat`                                                                                | Một query; không cache công khai dữ liệu admin                                                                                |

Các alias legacy redirect về cùng trang nên không có tập API riêng. Nguồn: `App.tsx`, `hooks/useCatalog.ts`, `useHomeCatalog.ts`, `services/catalogService.ts`, `customerBookingService.ts`, `adminTableService.ts`, `pages/Admin*.tsx`, `StudioWorkspacePage.tsx`.

## 5. Build và bundle

Đã chạy `$env:ANALYZE='true'; npm run build` với analyzer có sẵn `rollup-plugin-visualizer`. API và web build production thành công. Chỉ có cảnh báo annotation của Zod; không có lỗi build. Không cài thêm dependency.

- Entry riêng: **250.935 byte raw / 72.897 byte gzip**.
- Entry + static dependencies: **668.072 byte raw / 206.041 byte gzip**.
- Toàn bộ JS, gồm lazy chunks và worker: **1.818.595 byte raw / 603.220 byte gzip**.
- Gzip trong bảng là phép nén zlib level 9 trên chunk tại hook analyzer; log Vite cuối có thể lệch nhẹ do sửa preload/minify. kB bên dưới = 1.000 byte.

Năm file JS nặng nhất:

| File/nhóm                          | Raw kB | Gzip kB | Khi nào tải                                         |
| ---------------------------------- | -----: | ------: | --------------------------------------------------- |
| `admin-charts` / Recharts          |  356,8 |   104,3 | Biểu đồ admin; đã tách khỏi initial/customer/studio |
| Entry `index-CzBrGMp_`             |  250,9 |    72,9 | Mọi khu vực                                         |
| `react-vendor`                     |  223,6 |    69,3 | Mọi khu vực                                         |
| `ui-vendor` / Radix + Floating UI  |   99,8 |    32,2 | Đang nằm trong graph initial                        |
| Worker `browser-image-compression` |   57,1 |    20,6 | Khi nén ảnh upload; không phải initial load         |

Thư viện nặng nhất theo phần code visualizer trước lần minify cuối: Recharts ~674kB, react-dom ~654kB, Zod ~264kB, react-day-picker ~151kB, date-fns ~135kB. Không cộng thẳng các số này vào bảng chunk đã minify.

Entry chứa Zod, tailwind-merge, Sonner và header/footer. Hướng tối ưu là hoãn code chỉ cần khi thao tác/đăng nhập, hoãn validation theo route nhưng giữ đủ validation. Không bỏ React hoặc đổi thư viện chỉ vì tên xuất hiện trong top 5. Chart, table, DnD không rò vào initial/customer/studio theo kiểm tra build hiện có.

Route đã `React.lazy`; sidebar hover/focus mới prefetch **chunk**, chưa prefetch data (`dashboard-routes.ts:102-119`). Các mục public chưa có một cơ chế prefetch data thống nhất. Gói `StudioWorkspacePage` đang chứa cả 4 bộ quản lý tĩnh; đây là chỗ có thể tách tiếp mà không đổi routing.

Artifact: `output/performance/bundle-analysis-baseline.html`, `bundle-baseline.json`, `bundle-contributors.json`. Live Vercel có hash entry khác working tree; không đồng nhất bundle local vừa build với chính xác phiên bản đang live.

## 6. Ảnh, file tĩnh và nén

- `Img.tsx:25-45`: lazy mặc định, decode async, ảnh ưu tiên eager/high, hỗ trợ width/height, srcset/sizes.
- `image-sources.ts:14-46`: ảnh tĩnh có manifest WebP; bản 480/960/original, ảnh upload dùng thumbnail/medium nếu có. Ảnh cũ thiếu variant vẫn rơi về original, thiếu intrinsic dimensions thì CSS giữ tỷ lệ 4:3 dự phòng, không phải kích thước thật.
- Upload đã nén WebP và dùng worker lazy, có cache-control một năm (`imageService.ts:19,27`). Có migrations thumbnail/medium. Không thấy pipeline AVIF hay blur placeholder dùng chung cho mọi ảnh.
- Supabase Storage public URL đã tách khỏi API; cần thống kê ảnh cũ thiếu thumbnail trước khi backfill. Không chuyển ảnh riêng tư/report attachment thành public để lấy cache.
- Production API đã trả **`Content-Encoding: br`**; JS Vercel lớn cũng được Brotli. Express local chưa có middleware nén, nhưng không được kết luận production thiếu nén.
- Browser trace live cho JS asset đã hash thấy `Cache-Control: public, max-age=0, must-revalidate`; Vercel CDN vẫn cache asset, nhưng browser phải revalidate sau reload. `vercel.json` hiện chỉ đặt immutable cho `/fonts/*`, chưa đặt rõ cho `/assets/*` và ảnh tĩnh có version.

## 7. Kết quả đo thực tế

### Endpoint

Hai vòng GET tuần tự từ máy phát triển; bảng dùng vòng 2 sau khi làm nóng, không phải p95 và không phải latency người dùng toàn Việt Nam. Không gửi dữ liệu đăng nhập.

| Endpoint                               | Render tổng ms | Local API + DB cấu hình hiện tại ms |
| -------------------------------------- | -------------: | ----------------------------------: |
| `/health`                              |             98 |                                  18 |
| `/categories`                          |            176 |                                 118 |
| `/settings`                            |            180 |                                 124 |
| `/home/featured`                       |            457 |                                 542 |
| `/provinces`                           |            398 |                                 417 |
| `/workshops?page=1&page_size=12`       |            452 |                                 548 |
| `/catalog/studios?page=1&page_size=12` |            450 |                                 546 |

Lượt Render `/health` đầu: **32.571 ms**. Bảng catalog trả danh sách rỗng chỉ 60 byte, `/provinces` 16 byte; tải ảnh/JSON lớn không giải thích được khoảng chờ này. `/home/featured` 1.323 byte. Không lấy tình trạng dataset nhỏ làm bằng chứng hiệu năng khi dữ liệu lớn.

### DB đọc trực tiếp

Chạy kết nối mới với transaction **READ ONLY**, chỉ `SELECT`, metadata index và `EXPLAIN (ANALYZE, BUFFERS)` cho SELECT kiểm tra điều kiện công khai, sau đó ROLLBACK:

- Kết nối mới 429 ms.
- `SELECT 1` trên cùng connection: **104 / 101 / 103 / 102 ms**.
- SELECT điều kiện công khai mẫu execution trong PostgreSQL: **1,137 ms**. Đây không phải EXPLAIN của toàn bộ endpoint catalog.
- Đã thấy 36 index trên nhóm bảng chính, gồm sessions(workshop_id, starts_at), bookings(user_id, created_at), bookings(session_id, status), index giữ chỗ pending, slug, studio_members và index moderation. Chưa có căn cứ đổ lỗi chủ yếu cho thiếu index ở dataset hiện tại.
- Catalog `findCandidates` phải BEGIN → tìm hold hết hạn → COUNT → page SELECT → COMMIT, chưa kể lấy cover. Với RTT hiện tại, nhiều lượt đi-về có thể chiếm phần lớn thời gian ngay cả SQL chạy nhanh.
- `/home/featured` BEGIN → featured selection → chọn session → cleanup/lock session → dữ liệu → COMMIT. `releaseExpiredHolds` có `FOR UPDATE` (`bookings.repository.ts:42`), nên không đơn giản bỏ cleanup/cache tùy tiện: phải giữ semantics tồn chỗ, thanh toán và expiry.
- `/me/studios` có 1 + 2N query ảnh (`studios.service.ts:31-46`, `images.repository.ts:116` không bỏ qua ID rỗng). Sessions list còn kiểm tra membership ở service rồi repository rồi JOIN, cộng auth session query; cần gộp an toàn trong bước server.

Chưa đo lock wait, pool waiting và query plan toàn bộ trên DB production; các mục này vẫn cần trace/metrics thực tế. Thêm index phải dựa vào plan và cardinality, không thêm hàng loạt theo cảm tính.

### Trình duyệt production trang khách

Chromium riêng, 390×844, 1,6 Mbps download / latency giả lập 150ms / CPU ×4. API đã warm sau probe. Đây là phép đo CDP **không phải Lighthouse**, một mẫu, không có score giả lập.

| Tình huống                  | Tổng request quan sát |      API request |  JS qua mạng | Ảnh qua mạng |
| --------------------------- | --------------------: | ---------------: | -----------: | -----------: |
| Mở `/` mới                  |                    47 |                9 | 254.385 byte |  23.095 byte |
| Chuyển sang `/kham-pha`     |                     8 |                2 |  13.223 byte |       0 byte |
| Quay lại `/` trong cùng SPA |                     1 | 1 (`/provinces`) |       0 byte |       0 byte |

- Document TTFB ~193 ms; FCP **3.640 ms**; LCP **4.756 ms**.
- Các số JS/ảnh là `encodedDataLength` quan sát trên mạng, gồm overhead, không phải gzip tổng bundle và không đại diện toàn trang sau cuộn.
- Lần đầu `/me` 401 → `/auth/refresh` 401; `/settings`, `/categories`, `/home/featured` bị gọi lặp do reset cache. Không có pageerror JS trong lượt đo.
- Window quan sát chuyển trang 2,5 giây; không lấy 2,5 giây này làm thời gian render route. Chưa instrument riêng thời điểm nội dung cache xuất hiện.
- Authenticated admin/studio, Lighthouse, p50/p95 và 4G trên dữ liệu đầy đủ **chưa đo**; không dùng redirect về trang chủ/fixture làm điểm đo dashboard thật. Cần phiên thử nghiệm đúng quyền để lấy baseline và so sánh bước 4. Không tạo/sửa tài khoản production trong bước chẩn đoán.

## 8. Endpoint cần instrument tiếp

1. `/health`: thời gian sau idle so với warm, log startup/instance và uptime Render.
2. `/me`, `/auth/refresh`: bootstrap, JWT/session lookup, refresh transaction; đếm gọi mỗi SPA session.
3. `/me/studios`: session query, list membership, batch ảnh, tổng payload.
4. `/home/featured`, `/provinces`, `/workshops`, `/catalog/studios`, public detail: pool acquire, mỗi SQL round trip, cleanup/lock, count, page, image metadata.
5. `/admin/overview`, list/count studio/workshop/booking/user/report/audit: auth overhead, SQL/COUNT time, rows/response bytes; đo list và count đồng thời với pool 5.
6. `/studios/:id/workshops`, `/sessions`, `/bookings`: quyền/membership lặp, full-list size và pagination.
7. `/bookings/:id`, `/tickets`: tác động của polling pending mỗi 5s.

Tách network/TTFB khỏi thời gian thực thi SQL; dùng Server-Timing hoặc structured log không chứa token/cookie/credential. Lấy ít nhất nhiều lượt warm và lượt sau idle, trên cùng tập dữ liệu và cấu hình mạng trước/sau.

## 9. Thứ tự sửa đề xuất sau khi báo cáo

**Client:** bảo toàn cache công khai khi reset phiên; giữ xóa dữ liệu private đúng tài khoản; chuyển provinces/areas về Query; đặt rõ stale/gc; prefetch data cùng key với page; khởi chạy request độc lập sớm; giảm tải toàn catalog/search/related nhưng giữ kết quả nghiệp vụ; lazy phần UI/validation chưa cần trên initial path; giữ cache khi background fetch. Đo lại từng thay đổi.

**Server/hạ tầng:** xác minh live region/plan; xử lý cold start bằng cấu hình instance phù hợp; gộp query membership/ảnh và loại N+1; tối ưu read path cleanup giữ chỗ mà không thay đổi nghiệp vụ; chỉ thêm index sau EXPLAIN; public metadata/featured cache TTL có invalidation moderation; tồn chỗ và thanh toán vẫn kiểm tra ở server. Đặt immutable cho asset hash, không cache public response riêng tư.

**Rủi ro:** cache sai phạm vi có thể lộ dữ liệu giữa tài khoản; cache catalog sai có thể hiện nội dung đã ẩn hoặc chỗ không còn trống; bỏ DB authorization sẽ làm chậm thu hồi quyền; pagination/search thay đổi không thận trọng có thể đổi kết quả; đổi region/plan cần migration, kiểm tra và chi phí. Chưa thực hiện các thay đổi này.

**Kiểm tra bước này:** production build API+web với analyzer; 28 GET endpoint (2 target × 2 vòng × 7 endpoint) sau khi cấp quyền network; DB READ ONLY; browser live public + 2 lần điều hướng. Chỉ dùng GET/đọc DB, không mutation nghiệp vụ. Không chạy integration suite có ghi DB vì đây là chẩn đoán.

Artifact dùng lại: `output/performance/diagnose-api.mjs`, `diagnose-db.mjs`, `diagnose-browser.mjs`, `api-baseline.json`, `db-baseline.json`, `browser-baseline.json`, ảnh baseline, HTML visualizer và JSON bundle. Không coi các báo cáo hiệu năng cũ trong repo là số đo mới của lượt này.
