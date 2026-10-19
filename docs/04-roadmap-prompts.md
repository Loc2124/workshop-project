# Lộ trình vibe coding chi tiết: từng bước kèm prompt

Cách dùng: mở dự án trong Claude Code (hoặc công cụ tương tự). Mỗi bước có: **Mục tiêu**, **Đưa cho AI**, **Prompt** (copy-paste), **Kiểm tra hoàn thành**, **Lỗi hay gặp**. Làm xong bước (chạy được + có test) mới sang bước sau.

Cột "Tuần" khớp kế hoạch 12 tuần trong đề cương. Bước AI (12-14) chạy **song song** với các bước web từ tuần 1.

---

## A. Prompt dùng chung

### P-OPEN — mở đầu mỗi phiên

```text
Đọc CLAUDE.md và docs/00-tech-stack.md, rồi đọc các file docs/ và db/ liên quan đến bước hôm nay: [liệt kê].
Tóm tắt lại bằng lời của bạn: (1) mục tiêu bước này, (2) quy tắc bắt buộc trong CLAUDE.md liên quan, (3) kế hoạch từng việc kèm file sẽ tạo/sửa, (4) điều bạn chưa chắc hoặc cần tôi quyết định.
CHƯA viết code. Chờ tôi đồng ý.
```

### P-REVIEW — sau khi AI làm xong, trước khi commit

```text
Đóng vai người review khó tính. Đọc lại toàn bộ thay đổi của bước này và đối chiếu từng quy tắc trong mục "Quy tắc BẮT BUỘC" của CLAUDE.md.
Với mỗi quy tắc liên quan: nói rõ ĐÚNG hay VI PHẠM, kèm file và dòng. Sau đó liệt kê: (a) lỗi logic hoặc bảo mật, (b) trường hợp biên chưa có test, (c) chỗ bạn đã tự ý làm ngoài phạm vi, (d) chỗ bạn đã đoán thay vì hỏi.
Chưa sửa gì; chỉ báo cáo.
```

### P-FIX — khi có test đỏ hoặc lỗi

```text
Test/lỗi sau đang thất bại: [dán nguyên văn thông báo lỗi + lệnh đã chạy].
Trước khi sửa: giải thích nguyên nhân gốc rễ bằng 2-3 câu và chỉ ra bằng chứng trong log/code. Sau đó đề xuất cách sửa nhỏ nhất. KHÔNG xóa hoặc nới lỏng test để cho qua. Nếu bạn nghĩ test sai, giải thích vì sao và chờ tôi đồng ý.
```

### P-RESET — khi phiên quá dài hoặc AI bắt đầu lạc hướng

```text
Dừng. Đọc lại CLAUDE.md. Liệt kê những quy tắc bạn vừa làm trái hoặc suýt làm trái. Sau đó tóm tắt: việc đã xong, việc đang dở, bước tiếp theo, rồi chờ tôi.
```

### P-COMMIT — cuối bước

```text
Chạy lint và toàn bộ test. Nếu xanh: tóm tắt thay đổi trong 5 dòng, đề xuất thông điệp commit, và cập nhật CLAUDE.md/.env.example/docs nếu có thay đổi. Liệt kê rõ những gì CHƯA làm của bước này.
```

**Vòng lặp mỗi bước:** P-OPEN → duyệt kế hoạch → Prompt bước → chạy test tự tay → P-REVIEW → P-FIX nếu cần → P-COMMIT.

---

## B. Nền tảng

### Bước 0A — Khung dự án và công cụ (tuần 2)

**Mục tiêu:** monorepo chạy được, kết nối Supabase dev/test riêng biệt, lint, CI.
**Đưa cho AI:** `CLAUDE.md`, `docs/00-tech-stack.md`, `.env.example`.

```text
Dựng monorepo bằng npm workspaces theo đúng cấu trúc trong CLAUDE.md: apps/web, apps/api, packages/shared, services/ranker (chỉ thư mục, chưa code), scripts, db/migrations (đã có file), data, docs.
- TypeScript strict cho mọi package TS; ESLint + Prettier; .editorconfig; .gitignore (gồm .env, node_modules, .next, .venv, __pycache__, file mô hình lớn, *.pt, *.safetensors).
- Không tạo docker-compose.yml hoặc cài PostgreSQL local; cấu hình `DATABASE_URL` và `DATABASE_URL_TEST` cho hai Supabase project riêng.
- Script gốc: dev, build, lint, test, migrate, migrate:test (migrate sẽ được làm ở bước sau, tạm để placeholder in thông báo).
- GitHub Actions: lint + test, có PostgreSQL service container.
- apps/api: chỉ cần server Express (TypeScript) chạy được với GET /health trả { ok: true }, đọc cấu hình từ biến môi trường bằng zod (lỗi rõ ràng nếu thiếu).
- apps/web: Next.js App Router + Tailwind, trang chủ trống, chưa có logic.
Không viết nghiệp vụ. Cuối cùng liệt kê lệnh để tôi tự kiểm tra từng phần.
```

**Kiểm tra:** kết nối được hai Supabase project riêng; `npm run lint` xanh; `curl localhost:4000/health` trả `ok`; Next.js mở được; workflow CI có PostgreSQL service container.
**Lỗi hay gặp:** AI cài thừa thư viện (ORM, state manager); yêu cầu gỡ. Cổng bị trùng; cố định cổng trong `.env`.

### Bước 0B — Trình chạy migration và kiểm tra schema (tuần 2)

**Mục tiêu:** áp `001_init.sql` và `002_rls_lockdown.sql`, có test bảo vệ schema.
**Đưa cho AI:** `db/migrations/*.sql`, `docs/02-architecture.md`.

```text
Viết scripts/migrate.ts: áp các file db/migrations/*.sql theo thứ tự tên; mỗi file trong một transaction; ghi bảng schema_migrations(filename, checksum, applied_at); bỏ qua file đã áp; nếu file đã áp bị đổi nội dung (checksum khác) thì báo lỗi rõ và dừng. Chọn DB theo flag (--test dùng DATABASE_URL_TEST). Nối vào npm run migrate và migrate:test.
Mọi test và script reset dữ liệu phải gọi scripts/assert-safe-test-db.ts trước khi chạy: từ chối nếu ALLOW_DESTRUCTIVE_TESTS không đúng chính xác "true", nếu URL thiếu/không hợp lệ, hoặc nếu DATABASE_URL_TEST trùng host và username với DATABASE_URL. Báo rõ lý do mà không in chuỗi kết nối.
Đảm bảo bảng schema_migrations cũng được bật RLS (không policy).
Viết test (Vitest, chạy trên DB test):
(1) sau migrate, mọi bảng trong schema public đều có relrowsecurity = true,
(2) ràng buộc chk_capacity tồn tại và INSERT/UPDATE làm seats_held + seats_sold > capacity bị từ chối,
(3) UNIQUE (provider, dedupe_key) của webhook_events và UNIQUE (booking_id, seq) của tickets có hiệu lực,
(4) chạy migrate hai lần liên tiếp không lỗi.
Đọc 001_init.sql trước; nếu thấy chỗ nào có vấn đề thì báo tôi, KHÔNG tự sửa file đã có.
```

**Kiểm tra:** bật ALLOW_DESTRUCTIVE_TESTS=true trong terminal hiện tại; `npm run migrate:test` hai lần liên tiếp OK; test xanh trên PostgreSQL test riêng (`DATABASE_URL_TEST`). Xác nhận guard từ chối khi biến không đúng "true" hoặc URL test dùng cùng host và username với URL dev. CI dùng PostgreSQL service container, không dùng Supabase project cá nhân.
**Lỗi hay gặp:** `security_invoker` cần PostgreSQL 15+; Supabase dùng PostgreSQL được host. Nếu gặp lỗi SQL trong 001, dán lỗi cho AI và tạo migration 003 sửa, đừng sửa 001 sau khi đã chạy lên DB thật.

### Bước 1 — Lõi API: lỗi, validate, log, khung test (tuần 2)

**Mục tiêu:** hạ tầng chung để mọi endpoint sau này nhất quán.

```text
Trong apps/api, dựng hạ tầng chung:
- Pool pg dùng chung; hàm withTransaction(fn) tự rollback khi lỗi; hàm query tham số hóa. Cấm nối chuỗi vào SQL.
- Định dạng lỗi thống nhất { error: { code, message } }; lớp AppError (400/401/403/404/409/422); handler lỗi trung tâm không lộ chi tiết nội bộ ra ngoài.
- Validate đầu vào bằng zod cho mọi endpoint; schema dùng chung đặt ở packages/shared khi web cũng cần.
- Log bằng pino-http có request id; không log mật khẩu, token, chữ ký. Thêm helmet, cookie-parser. Mọi handler async đi qua một wrapper bắt lỗi chuyển cho middleware lỗi trung tâm (hoặc dùng bản Express tự bắt lỗi async; kiểm tra phiên bản và giải thích lựa chọn), để lỗi async không làm treo request hay sập tiến trình.
- Tách việc tạo app Express (createApp) khỏi việc mở cổng (listen) để test gọi trực tiếp bằng supertest. Khung test: dùng DB test thật, có helper làm sạch dữ liệu giữa các test và các factory tạo user/organizer/workshop/session.
Viết 3 test mẫu cho hạ tầng này (lỗi validate, lỗi 404 định dạng đúng, withTransaction rollback đúng).
```

**Kiểm tra:** `npm run test` xanh; thử gọi endpoint sai dữ liệu ra lỗi đúng định dạng.

### Bước 2 — Đăng ký, đăng nhập, ba vai (tuần 2)

**Đưa cho AI:** `docs/01-prd.md` (C1), `docs/03-api-spec.md`.

```text
Cài xác thực theo PRD C1 và API spec:
- POST /auth/register (chỉ tạo role customer), POST /auth/login, POST /auth/logout, GET /me.
- Băm mật khẩu bằng argon2 hoặc bcrypt (chọn một và giải thích vì sao). Email duy nhất, chuẩn hóa chữ thường.
- JWT trong cookie httpOnly, SameSite=Lax, Secure theo biến COOKIE_SECURE; payload gồm sub, role và organizerId nếu có.
- Middleware requireAuth(roles[]) và hàm lấy organizerId cho vai organizer.
- Giới hạn tốc độ cho /auth/login (chống dò mật khẩu).
- Thông báo lỗi đăng nhập không tiết lộ email có tồn tại hay không.
Test: đăng ký trùng email; đăng nhập sai; truy cập endpoint cần quyền khi chưa đăng nhập (401) và sai vai (403); cookie có đúng cờ; token hết hạn.
```

**Kiểm tra:** thử bằng curl hoặc REST client, xem cookie và cờ `HttpOnly`.
**Lỗi hay gặp:** AI lưu token trong localStorage (cấm), hoặc trả `password_hash` trong response.

### Bước 3 — Đơn vị tổ chức và duyệt bằng cờ trạng thái (tuần 3)

```text
Cài theo PRD O1 và A1:
- POST /organizer/profile: user đăng nhập tạo hồ sơ đơn vị (role chuyển sang organizer khi tạo hồ sơ thành công, hoặc cách khác nếu bạn thấy hợp hơn; giải thích lựa chọn trong kế hoạch). Trạng thái ban đầu pending.
- Admin: GET /admin/organizers (lọc status), PATCH /admin/organizers/:id/status.
- scripts/seed-admin.ts tạo admin từ SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD.
Test: customer gọi /admin/* bị 403; organizer pending vẫn đăng nhập được nhưng workshop của họ chưa hiện ở trang công khai (kiểm tra ở bước sau); chuyển trạng thái hợp lệ và không hợp lệ.
```

### Bước 4 — Workshop và buổi của đơn vị tổ chức (tuần 3)

**Đưa cho AI:** `docs/01-prd.md` (O2-O5), `docs/02-architecture.md` (mục Phân quyền).

```text
Cài /organizer/workshops (GET, POST), PATCH /organizer/workshops/:id, POST /organizer/workshops/:id/sessions, PATCH /organizer/sessions/:id.
BẮT BUỘC (CLAUDE.md quy tắc 5): viết repository của organizer sao cho MỌI hàm nhận organizerId và đưa vào WHERE; không có hàm truy vấn organizer nào bỏ qua tham số này.
Quy tắc: sức chứa > 0; không sửa sức chứa xuống dưới seats_held + seats_sold; workshop mới có status pending; sửa workshop đã approved thì đưa về pending (hỏi tôi nếu bạn thấy không hợp lý); không sửa giá buổi đã có booking pending/paid.
Test T11 dạng tham số hóa: với MỖI endpoint organizer, đơn vị B không đọc/sửa/tạo con cho dữ liệu của đơn vị A (trả 403 hoặc 404, thống nhất một kiểu và ghi vào tài liệu); T12: customer không gọi được.
```

**Kiểm tra:** đọc code repository và xác nhận không có truy vấn nào thiếu `organizer_id`.

### Bước 5 — Danh mục công khai: liệt kê, lọc, chi tiết (tuần 3-4)

```text
Cài GET /workshops và GET /workshops/:id (công khai).
Bộ lọc cứng hoàn toàn bằng SQL tham số hóa: date_from, date_to, price_min, price_max, district, category, và chỉ trả workshop approved của organizer approved, buổi scheduled, starts_at > now(), còn chỗ (capacity - seats_held - seats_sold >= 1). Phân trang, sắp xếp mặc định theo starts_at.
Viết hàm findCandidates(filters) dùng lại được cho POST /search ở bước sau, trả cả các trường văn bản cần cho xếp hạng.
Thêm index nếu cần, dựa trên EXPLAIN (chỉ cần chứng minh các truy vấn chính không quét toàn bảng với dữ liệu mẫu vài trăm dòng).
Seed: script nạp data/workshops.sample.json vào DB (đánh dấu is_simulated=true) cùng vài organizer, buổi mẫu.
Test: từng bộ lọc; workshop pending/rejected không hiện; buổi hết chỗ, quá khứ, bị hủy không hiện; không có kết quả thì trả danh sách rỗng.
```

### Bước 5B — Triển khai sớm API và web (tuần 4, sau Bước 5)

**Mục tiêu:** có URL HTTPS sớm để phát hiện lỗi cấu hình khi hệ thống còn nhỏ và dùng URL API cho webhook PayOS ở Bước 9.

**Việc của bạn trước khi prompt:** tạo tài khoản ở nơi host API và web. Điều kiện gói miễn phí thay đổi; kiểm tra giá và giới hạn hiện hành trước khi chọn.

```text
Triển khai bản đầu (chưa có thanh toán thật), không thêm tính năng:
1. Tạo docs/deploy.md, ghi các bước triển khai và biến môi trường cho từng dịch vụ.
2. API: cấu hình build/start, đọc PORT, giữ GET /health, dùng DATABASE_URL; nếu host chỉ có IPv4 thì dùng Session pooler cổng 5432; giới hạn kích thước pool phù hợp gói DB; đặt COOKIE_SECURE=true, WEB_ORIGIN đúng và cấu hình trust proxy khi cần. Giải thích các lựa chọn.
3. Web: build Next.js; NEXT_PUBLIC_* chỉ chứa thông tin công khai; rewrites /api/* trỏ tới URL API đã triển khai.
4. Monorepo: ghi rõ root directory và lệnh build cho từng dịch vụ; bảo đảm packages/shared được build trước khi API/web phụ thuộc vào nó.
5. Chạy migrate thủ công vào DATABASE_URL (dev/demo), rồi xác nhận mọi bảng bật RLS.
6. Smoke test: /health; kiểm tra đăng ký/đăng nhập qua web, cookie Secure và danh sách workshop khi các endpoint tương ứng đã sẵn sàng. Ghi rõ phần nào chưa thể kiểm tra ở bước này.
Liệt kê rõ thao tác tôi phải tự làm trên dashboard của nhà cung cấp. Không đưa secret vào Git.
```

**Kiểm tra:** có URL HTTPS công khai; `/health` hoạt động; ghi nhận rõ hạng mục smoke test chưa sẵn sàng nếu endpoint tương ứng chưa được triển khai.

**Lỗi hay gặp:** host chỉ hỗ trợ IPv4 nên không kết nối được Direct; cần chuyển sang Session pooler. Monorepo có thể cần cấu hình root/build riêng. Cookie có thể không được gửi nếu Secure/SameSite hoặc rewrites cấu hình sai. Gói miễn phí có thể ngủ, nên phải kiểm tra API còn thức trước demo.

---

## C. Giao diện web

### Bước 6 — Khung web, đăng nhập, điều hướng theo vai (tuần 2-3)

```text
Trong apps/web (Next.js App Router + Tailwind + shadcn/ui):
- Cấu hình rewrites để /api/* chuyển tới API (địa chỉ lấy từ biến môi trường).
- Layout chung, thanh điều hướng thay đổi theo vai (khách, đơn vị, admin), toàn bộ chữ tiếng Việt.
- Trang đăng ký, đăng nhập, đăng xuất; middleware bảo vệ các khu vực /organizer và /admin; trang 403/404.
- Client gọi API có kiểu (dùng schema zod của packages/shared), xử lý lỗi thống nhất và hiện thông báo thân thiện.
- Mọi trang có trạng thái đang tải, lỗi, rỗng.
Chưa làm trang nghiệp vụ. Dùng shadcn/ui, không tự viết lại các thành phần có sẵn.
```

**Kiểm tra:** đăng nhập bằng ba vai, thử truy cập trực tiếp URL không có quyền.

### Bước 7A — Trang khách: danh sách và chi tiết (tuần 3-4)

```text
Làm trang danh sách workshop có bộ lọc (ngày, khoảng giá, khu vực, loại) và trang chi tiết dùng MỘT template chung cho mọi workshop (không tạo giao diện riêng cho từng workshop). Chi tiết hiện mô tả, trình độ, đối tượng, sản phẩm mang về, điều kiện, chính sách, danh sách buổi còn chỗ với giá và số chỗ còn. Chưa có nút đặt chỗ hoạt động (để nút vô hiệu, sẽ nối ở bước 11). Responsive, dùng được trên điện thoại. Ghi chú "dữ liệu mô phỏng" ở chân trang bản demo.
```

### Bước 7B — Khu vực đơn vị tổ chức (tuần 3-4)

```text
Làm khu vực /organizer: tạo hồ sơ đơn vị, danh sách workshop của mình kèm trạng thái duyệt, form tạo/sửa workshop (đủ các trường theo PRD O2, có kiểm tra phía client bằng cùng schema zod), tạo buổi (ngày giờ, giá, sức chứa), danh sách đăng ký của từng buổi (khung, dữ liệu sẽ có ở bước 8-10). Hiển thị rõ khi đơn vị đang ở trạng thái chờ duyệt.
```

### Bước 7C — Khu vực quản trị (tuần 4)

```text
Làm khu vực /admin: danh sách đơn vị và workshop có lọc theo trạng thái, nút duyệt/từ chối đổi cờ trạng thái; sau này sẽ thêm danh sách booking và webhook (bước 15). Chỉ admin truy cập được.
```

---

## D. Đặt chỗ và thanh toán

### Bước 8 — Giữ chỗ nguyên tử và hết hạn (tuần 4-5) ⚠ phần quan trọng nhất

**Đưa cho AI:** `docs/02-architecture.md` (Giữ chỗ nguyên tử, Hết hạn giữ chỗ), `docs/06-test-plan.md`.

```text
Cài POST /bookings (chỉ customer) theo ĐÚNG mẫu SQL trong docs/02-architecture.md:
- Trong một transaction: UPDATE sessions có điều kiện để giành chỗ (0 dòng bị ảnh hưởng = hết chỗ, trả 409 với mã lỗi riêng), rồi INSERT booking với giá lấy từ dòng vừa trả về. KHÔNG đọc số chỗ rồi ghi lại ở tầng ứng dụng. KHÔNG nhận giá hay tổng tiền từ client.
- order_code: số nguyên không trùng; kiểm tra giới hạn kích thước mà PayOS cho phép trong tài liệu chính thức (tôi sẽ dán nếu cần); sinh mã rồi thử lại khi vi phạm UNIQUE.
- Giới hạn quantity theo MAX_TICKETS_PER_BOOKING; mỗi khách tối đa N booking pending cùng lúc (đề xuất N và giải thích).
- Hàm releaseExpiredHolds({ sessionId? }) theo mẫu SQL trong tài liệu, gọi định kỳ trong tiến trình API (khoảng EXPIRY_JOB_INTERVAL_SECONDS) có pg_try_advisory_lock để không chạy chồng; hàm này phải test được trực tiếp. BẮT BUỘC gọi thêm theo buổi (a) ở đầu POST /bookings, trong cùng transaction và trước câu UPDATE giữ chỗ, (b) trong GET /workshops/:id trước khi trả danh sách buổi còn chỗ; không dựa riêng vào job vì host có thể ngủ (xem docs/02-architecture.md).
- Cài interface PaymentProvider và MockProvider (createPayment trả checkoutUrl giả; bước 9 mới có PayOS). Tạm thời POST /bookings gọi provider và lưu một dòng payments trạng thái created.
Test (Vitest, PostgreSQL thật, NHIỀU kết nối song song bằng pool riêng, không giả lập):
- T01: buổi capacity 5, bắn 50 yêu cầu đặt 1 chỗ cùng lúc => đúng 5 thành công, 45 nhận hết chỗ, seats_held = 5, không vượt capacity. Lặp lại ít nhất 20 lần để lộ lỗi chạy đua.
- T02: hai khách tranh chỗ cuối.
- T03: booking pending quá hạn => expired và trả đúng seats_held; chạy job hai lần liên tiếp không trả chỗ hai lần; chạy hai job song song cũng không trả hai lần.
- T03b: không chạy job định kỳ; booking pending hết hạn giữ chỗ cuối của buổi, khách khác đặt thì vẫn thành công; job chạy chồng không trả chỗ hai lần.
- T10: client gửi giá/tổng tiền khác => bị bỏ qua.
Báo cáo kết quả test kèm số lần chạy.
```

**Kiểm tra bằng tay:** tự đọc câu SQL giữ chỗ và đối chiếu với mẫu; cố ý phá thử (đổi `<=` thành `<`) xem test có đỏ không.
**Lỗi hay gặp:** AI dùng `SELECT` rồi `UPDATE` tách rời; hoặc test đồng thời chạy tuần tự trong một kết nối nên không chứng minh gì. Hãy yêu cầu AI chỉ ra các kết nối riêng biệt trong test.

### Bước 9 — PayOS và webhook idempotent (tuần 5) ⚠ phần quan trọng thứ hai

**Việc của bạn trước khi prompt:** mở tài liệu chính thức của PayOS (tạo link thanh toán, webhook, xác thực chữ ký), lấy Client ID/API Key/Checksum Key bỏ vào `.env`, dùng URL API đã triển khai ở Bước 5B làm URL webhook. Chỉ dùng tunnel nếu triển khai chưa hoạt động. Dán nội dung tài liệu liên quan cho AI.

```text
Dưới đây là tài liệu chính thức của PayOS về tạo thanh toán, webhook và xác thực chữ ký: [dán].
Cài:
1. PayOSProvider cho interface PaymentProvider (createPayment và verifyWebhook). Nếu có SDK chính thức cho Node thì dùng; nếu không, gọi REST theo tài liệu. KHÔNG đoán định dạng chữ ký; nếu tài liệu thiếu chi tiết, hỏi tôi.
2. POST /webhooks/payos theo mục "Xử lý webhook (idempotent)" trong docs/02-architecture.md:
   - Lấy body THÔ (với Express: đăng ký route webhook với express.raw() hoặc giữ raw body qua tùy chọn verify của express.json(), và đặt TRƯỚC middleware parse JSON chung nếu cần; giải thích cách làm), xác thực chữ ký bằng Checksum Key. Sai chữ ký: lưu webhook_events với signature_valid=false, trả lỗi, KHÔNG xử lý.
   - INSERT webhook_events ... ON CONFLICT (provider, dedupe_key) DO NOTHING; nếu đã có thì trả thành công và outcome='duplicate'.
   - Tìm booking theo order_code; kiểm tra số tiền khớp total_amount; trong MỘT transaction chuyển booking pending -> paid, seats_held -= qty, seats_sold += qty, cấp quantity vé (mã vé ngẫu nhiên khó đoán, UNIQUE (booking_id, seq)), cập nhật payments.
   - Không bao giờ tin trang /payment/return để xác nhận thanh toán; trang đó chỉ hiển thị.
3. Chọn nhà cung cấp theo PAYMENT_PROVIDER (mock | payos).
4. Một helper chỉ dùng trong test để tạo webhook giả có chữ ký đúng bằng PAYOS_CHECKSUM_KEY_TEST và chạy qua CÙNG đường xử lý.
Test: T04 gửi cùng webhook hợp lệ 2 lần (và 10 lần song song) => 1 booking paid, 1 bộ vé, seats_sold tăng đúng một lần, các lần sau là duplicate; T05 chữ ký sai; T06 số tiền sai; T07 thanh toán thất bại/hủy.
```
Trước khi bổ sung tác vụ đối soát thanh toán pending/expired bằng API PayOS, phải đọc tài liệu chính thức và hỏi tôi duyệt phạm vi; nếu được duyệt, dùng cùng đường xử lý idempotent của webhook.

**Kiểm tra thật (bằng tay, ghi vào nhật ký bằng chứng):** dùng API đã triển khai (tunnel chỉ khi cần dự phòng), đặt chỗ, thanh toán một khoản nhỏ thật, xác nhận webhook đến, booking chuyển `paid`, vé được cấp; chụp màn hình và lưu log.
**Lỗi hay gặp:** AI tin trường `success` trong URL return; xử lý webhook ngoài transaction; trả lỗi 500 làm PayOS gọi lại vô hạn.

### Bước 10 — Thanh toán muộn, hủy buổi, vé (tuần 6)

```text
Cài theo docs/02-architecture.md:
- Thanh toán đến muộn: webhook hợp lệ cho booking đã expired => thử giành lại chỗ bằng cùng câu UPDATE giữ chỗ trong transaction; còn chỗ thì paid + cấp vé (outcome late_payment_confirmed); hết chỗ thì refund_needed (late_payment_no_seat).
- POST /organizer/sessions/:id/cancel: buổi => cancelled; booking paid => refund_needed; booking pending => cancelled và trả seats_held; chỉ chủ buổi.
- GET /bookings/:id, GET /me/bookings, GET /bookings/:id/tickets (chỉ chủ đơn, chỉ đơn paid).
Test: T08, T09, T13, T14.
```

### Bước 11 — Giao diện đặt chỗ và vé (tuần 6-7)

```text
Nối nút đặt chỗ ở trang chi tiết: chọn buổi và số người, gọi POST /bookings, hiện đồng hồ đếm ngược thời gian giữ chỗ, chuyển khách tới checkout_url. Trang /payment/return: KHÔNG tự coi là đã thanh toán; hỏi lại GET /bookings/:id (polling có giới hạn) cho tới khi trạng thái là paid/expired/cancelled rồi hiện kết quả. Trang vé hiển thị mã vé từng chỗ. Trang lịch sử đặt chỗ. Xử lý rõ các thông báo: hết chỗ, hết hạn giữ chỗ, thanh toán thất bại, thanh toán đến muộn.
```

---

## E. Phần AI (chạy song song từ tuần 1)

### Bước 12 — Dữ liệu, chia tập, baseline và công cụ đánh giá (tuần 1-5)

**Việc của bạn:** mở rộng `data/workshops.sample.json` lên 100-200 workshop; viết/sinh và tự rà câu nhu cầu; gán nhãn theo `data/labeling-guideline.md`; nhờ một người gán độc lập 20%. Thêm trường `type` cho từng câu nhu cầu (rõ ràng / mơ hồ / nhiều ý / không dấu / mâu thuẫn / mục đích-cảm xúc) để phân tích lỗi sau này.
**Đưa cho AI:** `docs/05-ranking-spec.md`, `data/*`.

```text
Trong services/ranker (Python), viết các công cụ sau, mỗi cái có test nhỏ:
1. validate_data.py: kiểm tra schema workshops/queries/labels (id tồn tại, nhãn trong 0-3, không trùng cặp, mọi query có ít nhất một nhãn 3 hoặc cảnh báo), in thống kê (số cặp theo nhãn, theo type).
2. split.py: chia train/val/test thỏa ĐỒNG THỜI: (a) workshop trong test không xuất hiện ở train/val, (b) các câu cùng query_group nằm cùng một tập. Giải thích thuật toán, in số cặp bị loại do ràng buộc, và có assertion kiểm tra không rò rỉ. Cố định seed. Lưu split ra file.
3. metrics.py: NDCG@5, NDCG@10, MRR, tỷ lệ có nhãn 3 trong top-k; kèm khoảng tin cậy bootstrap theo query. Xử lý trường hợp query không có workshop nhãn dương.
4. baseline_bm25.py: BM25 trên văn bản ghép từ các trường workshop; thử hai kiểu chuẩn hóa tiếng Việt (chữ thường; bỏ dấu) và báo cả hai.
5. baseline_embedding.py: embedding đa ngôn ngữ có sẵn (liệt kê 2-3 mô hình ứng viên nhẹ chạy được trên CPU/Colab và để tôi chọn), cosine.
6. agreement.py: tính Cohen's kappa (có trọng số) giữa hai file nhãn.
7. report.py: chạy tất cả trên tập val/test và xuất bảng CSV + Markdown so sánh các hệ.
Mỗi script đọc đường dẫn từ tham số dòng lệnh. Ghi hạt giống ngẫu nhiên và phiên bản thư viện vào kết quả. Tập test CHỈ được dùng khi có cờ --final.
```

**Kiểm tra:** chạy trên dữ liệu mẫu nhỏ; cố ý đưa vào cặp rò rỉ để thấy assertion bắt được.
**Lỗi hay gặp:** chia ngẫu nhiên theo cặp (rò rỉ); dùng tập test để chọn tham số; câu nhu cầu sinh bằng LLM giống hệt nhau gây điểm đẹp giả.

### Bước 13 — Fine-tune và phân tích lỗi (tuần 6-7)

```text
Dựa trên các công cụ ở bước 12, viết notebook Colab và script tương ứng để fine-tune mô hình xếp hạng:
- Thiết kế A (làm trước): bi-encoder fine-tune từ mô hình embedding đã chọn, dùng cặp (query, workshop) với nhãn có thứ bậc; đề xuất hàm mất mát phù hợp và cách chọn hard negative từ nhãn 0/1; giải thích lựa chọn.
- Thiết kế B (chỉ làm nếu A chưa vượt baseline hoặc giảng viên yêu cầu thêm phần tự train): cross-encoder hoặc bộ xếp hạng nhỏ (Gradient Boosting) train từ đầu trên đặc trưng như điểm cosine, điểm BM25, khớp trình độ/đối tượng/sản phẩm mang về, độ dài.
- Chọn siêu tham số CHỈ bằng tập val; chạy ít nhất 3 hạt giống; lưu cấu hình, seed, phiên bản thư viện, thời gian huấn luyện.
- Đánh giá tập test đúng MỘT lần với --final; xuất bảng so sánh với BM25 và embedding chưa fine-tune kèm khoảng tin cậy.
- error_analysis.py: nhóm lỗi theo type của câu nhu cầu, in 10 ví dụ mô hình xếp sai (query, top-3 mô hình, nhãn đúng) kèm giả thuyết nguyên nhân.
- Lưu mô hình, ghi model_version.
Nếu bản fine-tune không vượt baseline mạnh, ĐỪNG chỉnh để đẹp; báo cáo trung thực và đề xuất bước tiếp theo.
```

### Bước 14 — Dịch vụ ranker, /search, dự phòng, giao diện (tuần 8)

**Đưa cho AI:** `docs/05-ranking-spec.md` (hợp đồng /rank), `docs/02-architecture.md`.

```text
1. services/ranker: FastAPI với POST /rank và GET /health theo đúng hợp đồng trong docs/05-ranking-spec.md. Tải mô hình một lần lúc khởi động; cache vector workshop (key theo workshop_id + hash văn bản); giới hạn kích thước candidates và độ dài need_text; trả model_version.
2. apps/api: POST /search nhận { filters, need_text }: (a) findCandidates(filters) bằng SQL, (b) nếu rỗng trả rỗng và KHÔNG gọi ranker, (c) gọi ranker với timeout RANKER_TIMEOUT_MS, (d) lỗi/chậm => xếp hạng dự phòng BM25 hoặc tìm kiếm văn bản PostgreSQL trên cùng tập ứng viên, (e) ghi search_logs (candidate_ids, ranked_ids, model_version, fallback_used, latency_ms).
3. Web: ô nhập nhu cầu cạnh bộ lọc, hiển thị danh sách đã xếp hạng, và dòng nhỏ báo khi đang dùng xếp hạng dự phòng.
Test T17 (ranker tắt/chậm => vẫn có kết quả, fallback_used=true), T18 (câu rỗng, rất ngắn, rất dài, ký tự lạ), T19 (tập rỗng).
```

---

## F. Hoàn thiện

### Bước 15 — Mức 2: duyệt, doanh thu, đánh giá (tuần 9, CHỈ khi mức 1 đã xong và qua mốc cắt tuần 7)

```text
Cài theo PRD:
- Admin xem booking, giao dịch, buổi bị hủy, booking refund_needed, webhook bị từ chối/duplicate.
- GET /organizer/revenue dùng view v_organizer_revenue; test T15 (khớp tổng booking paid, loại buổi bị hủy).
- POST /bookings/:id/review: chỉ chủ booking paid, buổi đã diễn ra, mỗi booking một đánh giá; test T16. Số sao hiển thị ở trang workshop nhưng KHÔNG dùng làm nhãn huấn luyện.
Cập nhật giao diện tương ứng.
```

### Bước 16 — Mức 3 (tuần 10, chỉ khi còn thời gian)

```text
Chọn MỘT trong hai (hỏi tôi trước):
(a) Vé QR: mã hóa mã vé thành QR ở trang vé; POST /organizer/tickets/check-in nhận mã, chỉ chấp nhận vé valid của buổi thuộc đơn vị mình, đổi sang used; quét hai lần bị từ chối; test.
(b) Trích xuất nhu cầu bằng Gemini ra JSON (số người, ngân sách, thời gian, khu vực): lược đồ JSON cố định, kiểm tra kết quả bằng zod, KHÔNG tin mù; hiển thị các điều kiện đã hiểu cho khách sửa trước khi lọc; lỗi/quota thì quay về form bộ lọc thường. Đo độ chính xác trên khoảng 50 câu có đáp án.
```

### Bước 17 — Rà soát bảo mật và độ bền (tuần 10)

```text
Rà soát toàn bộ dự án theo danh sách và báo cáo (chưa sửa ngay):
1. SQL: tìm mọi chỗ nối chuỗi vào câu SQL.
2. Phân quyền: lập bảng mọi endpoint x vai x kiểm tra sở hữu; chỉ ra endpoint thiếu test.
3. Cookie/JWT: cờ HttpOnly/Secure/SameSite, thời hạn, thu hồi khi đăng xuất.
4. Giới hạn tốc độ cho đăng nhập, đăng ký, /search, /bookings.
5. Webhook: xác thực chữ ký, replay, kích thước body, trả mã đúng.
6. Dữ liệu nhạy cảm trong log; biến môi trường lộ ra client (Next.js chỉ NEXT_PUBLIC_).
7. Phụ thuộc: chạy npm audit và pip-audit, liệt kê lỗ hổng cần xử lý.
8. RLS: xác nhận mọi bảng public bật RLS, test còn xanh.
9. Xử lý lỗi: mọi lỗi 500 tiềm tàng.
Sau khi tôi duyệt danh sách, sửa từng mục kèm test.
```

### Bước 18 — Triển khai và dữ liệu demo (tuần 10-11)

```text
Chuẩn bị triển khai: (1) Supabase: chạy migrate với chuỗi Direct hoặc Session pooler (cổng 5432), xác nhận mọi bảng bật RLS không policy; không dùng Transaction pooler (cổng 6543) cho API hoặc migration; (2) API ở nơi có URL công khai, cấu hình PAYOS_WEBHOOK_URL và đăng ký URL webhook ở PayOS; (3) web trỏ rewrites tới API triển khai; (4) ranker triển khai với mô hình nhỏ và dự phòng BM25 trong API; (5) script seed dữ liệu demo (ghi rõ mô phỏng) và tài khoản demo cho ba vai; (6) chế độ MockProvider có thể bật bằng biến môi trường để demo khi mạng/PayOS lỗi; (7) checklist trước buổi demo: dự án Supabase còn chạy, webhook còn hoạt động, thanh toán thật số tiền nhỏ chạy được.
Cập nhật docs/deploy.md đã tạo ở Bước 5B với toàn bộ dịch vụ, biến môi trường và checklist demo.
```

### Bước 19 — Gom bằng chứng và hỗ trợ báo cáo (tuần 11-12)

```text
1. Chạy toàn bộ docs/06-test-plan.md; xuất log và bảng kết quả (T01-T20: đạt/không, ngày chạy, lệnh chạy); liệt kê test nào chưa tự động hóa và vì sao.
2. Xuất bảng so sánh mô hình (BM25, embedding chưa fine-tune, fine-tune) kèm khoảng tin cậy, kappa, và thống kê dữ liệu thành các file CSV/Markdown để dán vào báo cáo.
3. Gom ảnh chụp giao diện của luồng chính và nhật ký giao dịch thật.
4. Soạn danh sách "hạn chế đã biết" trung thực (dữ liệu mô phỏng, quy mô nhỏ, hoàn tiền thủ công, chia tiền ngoài phạm vi).
Không bịa số liệu: chỉ dùng kết quả có file log kèm theo.
```

---

## G. Mẹo giữ chất lượng khi vibe code

- Mỗi bước dán cho AI **đúng các file đặc tả của bước đó**, không dán cả dự án.
- Ba chỗ phải tự đọc diff từng dòng: **giữ chỗ (bước 8), webhook (bước 9), phân quyền organizer (bước 4)**. Sai ở đây mất điểm nhiều nhất.
- Thử phá có chủ đích: đổi `<=` thành `<` trong câu giữ chỗ, bỏ `organizer_id` khỏi một truy vấn, tắt kiểm tra chữ ký; test phải đỏ. Test không đỏ nghĩa là test chưa bảo vệ gì.
- Nếu AI đề xuất bỏ quy tắc bắt buộc "cho đơn giản", từ chối và nhắc CLAUDE.md.
- Nếu kẹt hơn nửa ngày ở một bước: thu nhỏ phạm vi, hoặc hạ mức ưu tiên; áp dụng mốc cắt cuối tuần 7.
- Mỗi tuần viết báo cáo chương tương ứng ngay sau khi xong bước; log và ảnh chụp lưu cùng lúc.
- Commit nhỏ sau mỗi bước xanh; tạo nhánh trước khi thử việc rủi ro.

## H. Bảng đối chiếu bước ↔ tuần ↔ test

| Bước | Tuần | Test liên quan |
|---|---|---|
| 0A, 0B, 1 | 2 | schema, RLS, hạ tầng |
| 2, 3, 4 | 2-3 | T11, T12 |
| 5, 5B, 6, 7A-C | 3-4 | lọc, hiển thị, smoke test triển khai |
| 8 | 4-5 | T01, T02, T03, T03b, T10 |
| 9 | 5 | T04-T07 + thanh toán thật |
| 10, 11 | 6-7 | T08, T09, T13, T14 |
| 12 | 1-5 | dữ liệu, baseline |
| 13 | 6-7 | đánh giá mô hình |
| 14 | 8 | T17-T19 |
| 15, 16 | 9-10 | T15, T16 (mức 2, 3) |
| 17, 18 | 10-11 | rà soát, triển khai |
| 19 | 11-12 | T20, gom bằng chứng |
