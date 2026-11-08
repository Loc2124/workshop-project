# CLAUDE.md — Nền tảng đặt chỗ workshop

Đọc file này đầu tiên trong mỗi phiên làm việc. Mục lục: [docs/README.md](docs/README.md). Đối chiếu [trạng thái mã](docs/project/current-status.md) và [policy](docs/policy/README.md), không coi đặc tả mục tiêu là tính năng đã có. Đồng bộ 07/11/2026.

## Dự án là gì

Đồ án tốt nghiệp: website để các đơn vị tổ chức đăng workshop thủ công (gốm, nến, vẽ, cắm hoa...) trên toàn Việt Nam; khách tìm, đặt chỗ, thanh toán. MVP hỗ trợ dữ liệu theo tỉnh/thành trên toàn quốc và ra mắt lần lượt từng thành phố. **Phần AI trọng tâm: mô hình xếp hạng workshop theo nhu cầu bằng ngôn ngữ tự nhiên, do sinh viên tự fine-tune** (xem `docs/engineering/05-ranking-spec.md`). Đặt chỗ + thanh toán là môi trường để triển khai và kiểm chứng.

- Giao diện và thông báo: tiếng Việt. Tiền: VND, **số nguyên**, không dùng float.
- Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh` (UTC+7); DB lưu thời điểm bằng `timestamptz`, API chỉ nhận ISO 8601 có độ lệch múi giờ, ngày lọc dùng khoảng nửa mở theo giờ Việt Nam, web định dạng qua helper chung.
- Dữ liệu mẫu là MÔ PHỎNG, luôn ghi rõ như vậy trong báo cáo và UI demo.
- Địa điểm công khai lấy từ danh mục tỉnh/thành trong database; studio có tỉnh/thành bắt buộc và khu vực tùy chọn. Workshop kế thừa địa điểm từ studio; không dùng quận/huyện làm bộ lọc.

## Tech stack (đã chốt — xem `docs/engineering/00-tech-stack.md`)

- **DB:** PostgreSQL qua hai Supabase project riêng: `DATABASE_URL` cho dev/demo và `DATABASE_URL_TEST` chỉ cho test. Không cài PostgreSQL local, không dùng Docker ngoài PostgreSQL service trong CI. **SQL thuần qua `pg`, không ORM.**
- **API:** Node.js + TypeScript + **Express**, `nodemon` theo dõi `src/**/*.ts` và chạy lại qua `tsx` khi phát triển; `zod` (validate qua middleware), `pino-http` (log), `helmet`, `cookie-parser`, `express-rate-limit`. Xác thực tự làm (JWT trong cookie httpOnly). Mọi handler async phải đi qua một wrapper bắt lỗi (hoặc dùng bản Express tự bắt lỗi async), không để lỗi bị nuốt.
- **Web:** React + TypeScript + Vite + Tailwind CSS, React Router, TanStack Query, React Hook Form + `@hookform/resolvers` + Zod. Frontend là SPA độc lập, gọi API Express qua `VITE_API_BASE_URL`; request xác thực gửi kèm `credentials: 'include'`.
- **Test:** Vitest + `supertest` (gọi thẳng app Express, không cần mở cổng) + PostgreSQL thật.
- **AI:** Python (PyTorch, sentence-transformers, rank_bm25, scikit-learn), phục vụ bằng FastAPI.
- **Thanh toán:** PayOS sau interface `PaymentProvider`; `MockProvider` cho test.
- **KHÔNG dùng:** Supabase Auth/RLS làm phân quyền/Edge Functions/client SDK từ trình duyệt, ORM, GraphQL, Redis hoặc message broker bên ngoài. Có hàng đợi DB email_outbox, không đồng nghĩa đã có tích hợp chi trả.

## Cấu trúc thư mục

```
apps/
  api/                       Express API
    src/
      server.ts, app.ts      process entry point và createApp()
      config.ts              validate cấu hình
      db/                    pool PostgreSQL, query, transaction
      errors/                AppError và định dạng lỗi
      middleware/            validate, auth, logging và middleware dùng chung
      modules/<feature>/     routes, schemas, services, repositories theo nghiệp vụ
    tests/
      unit/                  logic cô lập và kiểm tra HTTP không cần DB
      integration/           test với PostgreSQL thật
      helpers/               fixtures và helper dùng chung cho test
  web/                       React + Vite SPA
    src/App.tsx              khai báo route
    src/pages/                màn hình theo route
    src/components/           layout và UI dùng chung/theo nghiệp vụ
    src/hooks/                hook nghiệp vụ và truy vấn TanStack Query
    src/services/             gọi API theo nghiệp vụ
    src/schemas/              schema form bằng Zod
    src/types/                kiểu dữ liệu frontend
    src/constants/             dữ liệu cấu hình giao diện
    src/lib/                  API client và tiện ích thuần
packages/shared/src/         kiểu và schema zod dùng chung
services/ranker/             Python: dữ liệu, baseline, fine-tune, dịch vụ /rank
db/migrations/               SQL đánh số: 001_init.sql, 002_rls_lockdown.sql, 003_...
scripts/                      migrate.ts, guard và seed
data/                         dữ liệu mẫu và nhãn; quy tắc ở docs/engineering/labeling-guideline.md
docs/                         đặc tả
```

Đây là quy ước, không phải danh sách thư mục phải tạo sẵn: chỉ thêm module, feature hoặc thư mục khi bước tương ứng cần. Trong API, routes gọi service rồi repository; SQL nghiệp vụ nằm trong repository. Trong web, dùng cấu trúc React phù hợp với Vite. API đã có CORS/credentials; vẫn cần kiểm chứng cookie và origin đúng ở môi trường triển khai.

### Quy ước module API

- Dùng `apps/api/src/modules/<feature>/` cho `auth`, `studios`, `workshops`, `sessions`, `catalog`, `search`, `bookings`, `payments`, `tickets` và `admin`; chỉ thêm `reviews`/`revenue` khi làm mức 2.
- Mỗi module chỉ tạo các file cần dùng: `<feature>.routes.ts`, `<feature>.schemas.ts`, `<feature>.service.ts`, `<feature>.repository.ts`.
- Chiều phụ thuộc là routes → service → repository → `db`; SQL nghiệp vụ chỉ nằm trong repository.
- Đặt `PaymentProvider`, `MockProvider` và `PayOSProvider` trong `payments/providers/`; dùng chung hàm xử lý thanh toán idempotent cho webhook và thanh toán muộn.
- Các thao tác giữ chỗ và xử lý thanh toán cần nhận transaction hiện tại để có thể gọi trong cùng transaction và kiểm thử trực tiếp.

### Responsive (mobile-first)

- Viết Tailwind theo kiểu mobile-first: kiểu mặc định dành cho 360px, thêm tiền tố `md:` (768px) và `lg:` (1024px) cho màn hình lớn hơn.
- Điều hướng của khách: nút menu trên điện thoại; menu ngang từ 1024px.
- Bộ lọc: ngăn kéo dưới (bottom sheet) dưới 1024px; cột lọc bên trái từ 1024px.
- Khung đặt chỗ: thanh dính ở đáy dưới 1024px; panel dính bên phải từ 1024px. Nội dung phải có khoảng đệm đáy để thanh dính không che.
- Bảng dữ liệu của đơn vị tổ chức và quản trị: chuyển thành danh sách thẻ dưới 768px. Thanh bên của hai khu vực này thu thành menu dưới 1024px.
- Không có thanh cuộn ngang ở 360px. Vùng chạm tối thiểu 44px. Ô nhập có cỡ chữ từ 16px.
- Màn hình có thiết kế riêng cho điện thoại: tìm kiếm, bộ lọc, chi tiết workshop, xác nhận và giữ chỗ, kết quả thanh toán, vé, lịch sử đặt chỗ. Các màn hình còn lại chỉ cần dùng được trên điện thoại.
- Trước khi coi một màn hình là xong: chụp ảnh bằng Playwright ở 360px, 768px và 1280px, mở ảnh ra xem và nêu lỗi bố cục.

### Triển khai

Thực hiện triển khai ban đầu API và web ở Bước 5B để có URL công khai sớm (hướng dẫn tại `docs/operations/deploy.md`). API hiện có cấu hình Render; frontend React/Vite đã có khung và sẽ build thành static site để deploy riêng. Bước 18 hoàn thiện triển khai, dữ liệu demo và checklist trước buổi bảo vệ.

### Giữ cho dễ chuyển nhà cung cấp

Giữ nguyên mục này khi chỉnh sửa `CLAUDE.md`. Hiện dùng Render cho API; web có cấu hình Vercel nhưng môi trường thực tế cần xác minh và có thể đổi sau. Không để code ứng dụng phụ thuộc trực tiếp vào nhà cung cấp. Để việc đổi không đau:

1. Mọi cấu hình nằm trong biến môi trường, không ghi cứng địa chỉ hay khóa vào code. Danh sách đầy đủ các biến ghi ở `docs/operations/deploy.md`.
2. Web là React SPA build tĩnh bằng Vite; không phụ thuộc tính năng riêng của nhà cung cấp hosting.
3. API không dùng ổ đĩa local làm lưu trữ bền vững. Dữ liệu nghiệp vụ ở PostgreSQL, ảnh ở storage được cấu hình qua biến môi trường.
4. Giữ lệnh chuẩn trong package.json (`npm run build`, `npm start`). Không dùng cấu hình chỉ có ở một nhà cung cấp.
5. Frontend đọc URL API từ `VITE_API_BASE_URL`; API giới hạn CORS theo origin web.
6. Mọi thao tác thủ công (nơi đặt biến, đăng ký webhook PayOS, DNS) phải được ghi vào `docs/operations/deploy.md` ngay khi làm.
7. Cấu hình riêng của nhà cung cấp chỉ đặt trong Blueprint/dashboard và tài liệu deploy; không đưa API SDK hoặc dịch vụ lưu trữ riêng của host vào luồng nghiệp vụ nếu chưa được yêu cầu.

## Quy tắc BẮT BUỘC (không được phá, kể cả khi "cho nhanh")

1. **Điều kiện cứng do database lọc** (ngày, giá, tỉnh/thành, khu vực, chỗ trống). Mô hình AI chỉ xếp hạng tập ứng viên đã qua lọc.
2. **Giữ chỗ phải nguyên tử**: một câu `UPDATE ... WHERE seats_held + seats_sold + $qty <= capacity RETURNING ...` trong transaction. Cấm đọc số chỗ rồi ghi lại ở tầng ứng dụng. Mẫu SQL ở `docs/engineering/02-architecture.md`. Không chỉ dựa vào job định kỳ để giải phóng chỗ hết hạn: ngoài job, phải giải phóng chỗ hết hạn của buổi liên quan ở đầu `POST /bookings` trong cùng transaction, trước câu UPDATE giữ chỗ, và trước khi trả danh sách buổi còn chỗ; xem `docs/engineering/02-architecture.md`.
3. **Webhook thanh toán idempotent**: xác thực chữ ký, ghi mọi sự kiện vào `webhook_events` (unique theo khóa chống trùng), nhận lặp không tạo vé hay cộng doanh thu hai lần. Đọc tài liệu chính thức PayOS trước khi code phần chữ ký, không đoán.
4. **Không tin dữ liệu tiền từ client**: giá, tổng tiền tính lại ở server từ `sessions`.
5. **Phân quyền theo studio**: mọi truy vấn quản lý studio lọc theo cặp `studio_id`/`user_id` trong `studio_members`, truyền như tham số bắt buộc. Mỗi endpoint studio có test thành viên studio B không truy cập dữ liệu studio A.
6. **Nhà cung cấp thanh toán nằm sau interface** `PaymentProvider`.
7. **Có dự phòng cho xếp hạng**: ranker lỗi/chậm quá ngưỡng → xếp hạng BM25/văn bản trong API, ghi `search_logs.fallback_used=true`.
8. **Số sao đánh giá KHÔNG dùng làm nhãn huấn luyện**; nhãn theo `docs/engineering/labeling-guideline.md`.
9. **Mọi bảng public phải bật RLS và không có policy** (migration 002 + test). API dùng `DATABASE_URL`; chỉ test và migration test dùng `DATABASE_URL_TEST` sau khi safety guard cho phép. Không kết nối PostgreSQL trực tiếp từ trình duyệt.
10. Secret chỉ ở `.env`, không commit; `.env.example` luôn được cập nhật.
11. Mọi câu SQL dùng tham số (`$1`, `$2`), không nối chuỗi.
12. Không thêm tính năng ngoài phạm vi khi chưa hỏi.

## Phạm vi và mức ưu tiên

- **Mức 1 (lõi):** đăng ký/đăng nhập, vai hệ thống customer/admin và vai thành viên studio owner/staff; duyệt studio, workshop tự công khai/hậu kiểm theo cờ trạng thái; đăng workshop, tạo buổi; bộ lọc cứng; xếp hạng; giữ chỗ có hạn; PayOS; webhook idempotent; mã vé hiển thị; theo dõi booking/webhook; bộ test đồng thời/webhook/phân quyền.
- **Mức 2:** doanh thu; đánh giá sau tham gia.
- **Theo policy mới:** vé/điểm danh từng vé thuộc luồng lõi cần hoàn thiện; trích xuất nhu cầu bằng Gemini ra JSON vẫn là mở rộng, cần bước khách xem lại.
- **P0 bổ sung theo tài liệu 07/11:** đối soát, hoàn tự động và chi trả studio sau buổi; hủy/điểm danh từng vé. Đây là phạm vi cần triển khai, hiện chưa có chi hộ/Bảo Kim/chi trả. Theo policy và roadmap hiện hành.
- **Ngoài phạm vi bản đầu:** chat trực tiếp, app native, mã giảm giá/thành viên, đa ngôn ngữ; chưa hỗ trợ đổi buổi/địa điểm/chuyển tên. Hoàn tự động không còn bị loại khỏi phạm vi.
- **Mốc cắt:** cuối tuần 7, nếu mức 1 chưa xong thì bỏ mức 2 và 3.

## Cách làm việc với Claude

- Làm theo docs/project/roadmap.md và policy hiện hành; roadmap dạng prompt cũ chỉ là lịch sử. Mỗi phần triển khai cần bằng chứng kiểm tra, nêu rõ nhánh chưa chạy/chưa chốt.
- Luôn **lập kế hoạch trước, chưa viết code**, chờ tôi đồng ý.
- Trước khi sửa schema: nói lý do và tạo migration mới, không sửa migration cũ đã chạy.
- Điểm mơ hồ về nghiệp vụ: hỏi lại, không tự đoán. Không xóa test để "cho qua".
- Cuối mỗi bước: liệt kê file đã sửa, lệnh kiểm tra, và những gì CHƯA làm.

## Lệnh

```
npm run migrate          # chạy migration vào DATABASE_URL
npm run migrate:test     # chạy migration vào DATABASE_URL_TEST
npm run dev              # web + api
npm run lint
npm run test             # test API trên DB test
```

Trước khi chạy test hoặc migration test, và trước mọi thao tác reset dữ liệu test, phải gọi `assertSafeTestDatabase()` trong `scripts/assert-safe-test-db.ts`. Guard từ chối nếu `ALLOW_DESTRUCTIVE_TESTS` không đúng chính xác `"true"`, thiếu/không hợp lệ URL DB, hoặc `DATABASE_URL_TEST` có cùng host và username với `DATABASE_URL`. `DATABASE_URL` là Supabase project dev/demo; `DATABASE_URL_TEST` là project Supabase riêng chỉ dành cho test. Chỉ dùng Direct hoặc Session pooler (cổng 5432); không dùng Transaction pooler (cổng 6543) cho API hoặc migration. Máy Windows không cần cài PostgreSQL/Docker; CI dùng PostgreSQL service container riêng.

## Định nghĩa "xong" cho một bước

Chạy được; có test tự động cho nhánh chính và nhánh lỗi; không vi phạm quy tắc bắt buộc; `.env.example`, tài liệu và `CLAUDE.md` đã cập nhật nếu thay đổi.
