# Open Slot — nền tảng khám phá và đặt chỗ workshop

Cập nhật theo mã nguồn ngày 03/11/2026. Tiến độ dưới đây phản ánh mã trong repository; chưa xác nhận deployment production hoặc toàn bộ luồng mua vé.

## Bắt đầu nhanh

1. Tạo hai Supabase project riêng: một cho dev/demo và một chỉ dành cho test.
2. Sao chép `.env.example` thành `.env`, rồi điền `DATABASE_URL` và `DATABASE_URL_TEST` bằng chuỗi kết nối của đúng hai project.
3. Chạy `npm install`, sau đó `npm run dev` để khởi động API và web.
4. Chạy `npm run lint` và `npm run build` để kiểm tra workspace.
5. Trước khi chạy test hoặc thao tác trên database test, bật opt-in trong PowerShell: `$env:ALLOW_DESTRUCTIVE_TESTS = "true"`. Sau đó chạy `npm test` hoặc `npm run migrate:test`. Guard sẽ từ chối nếu biến khác `"true"`, thiếu URL, URL sai định dạng, hoặc host và username của hai URL trùng nhau.
6. `npm run migrate` áp các file SQL trong `db/migrations` lên project dev/demo; `npm run migrate:test` áp chúng lên project test sau khi guard an toàn thông qua. Runner ghi checksum, từ chối migration đã bị sửa và bật RLS cho bảng `schema_migrations`.
7. Xem `docs/deploy.md` để triển khai: API có cấu hình Render, frontend có cấu hình Vercel. Xác minh URL công khai, biến môi trường và migration thực tế trước khi phát hành.

API mặc định ở `http://localhost:4000` (`GET /health`). Web React/Vite dùng cổng hiển thị khi chạy dev server (mặc định `5173`). Điền đầy đủ cấu hình bắt buộc trong `.env.example`, bao gồm JWT secret và API URL cho web. Catalog chỉ dùng API; dữ liệu mô phỏng không được đưa vào luồng công khai.

## Kết nối Supabase

Trong từng project, mở **Connect** trên Supabase Dashboard để lấy chuỗi kết nối. Đặt URL của project dev/demo vào `DATABASE_URL`, còn URL của project test riêng biệt vào `DATABASE_URL_TEST`. Không đưa password thật vào Git.

- **Direct connection** dùng cổng `5432`; lấy nguyên chuỗi Direct trong Dashboard.
- **Session pooler** cũng dùng cổng `5432`; chọn chuỗi Session pooler trong Dashboard nếu máy Windows hoặc mạng không truy cập được host Direct. Username pooler thường có dạng `postgres.<project-ref>`.
- **Không dùng Transaction pooler** (cổng `6543`) cho API hoặc migration.

Test và script thao tác dữ liệu test dùng chung guard tại `scripts/assert-safe-test-db.ts`. Mọi script reset dữ liệu được thêm sau này phải gọi `assertSafeTestDatabase()` trước khi kết nối hoặc sửa dữ liệu.

## Danh sách file

| File                                                                        | Nội dung                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CLAUDE.md`                                                                 | Bối cảnh dự án, tech stack, quy tắc bắt buộc, phạm vi, cách làm việc với AI             |
| `.env.example`                                                              | Mẫu biến môi trường (không commit giá trị thật)                                         |
| `docs/00-tech-stack.md`                                                     | Tech stack, quy ước múi giờ và những thứ cố ý không dùng                                |
| `docs/01-prd.md`                                                            | Chức năng theo vai, mức ưu tiên, tiêu chí chấp nhận                                     |
| `docs/02-architecture.md`                                                   | Luồng, trạng thái booking, SQL giữ chỗ, webhook idempotent, thanh toán muộn, phân quyền |
| `docs/03-api-spec.md`                                                       | Danh sách endpoint                                                                      |
| `docs/04-roadmap-prompts.md`                                                | 19 bước chính và Bước 5B triển khai sớm, kèm prompt, tiêu chí hoàn thành, lỗi hay gặp   |
| `docs/deploy.md`                                                            | Cấu hình triển khai monorepo, biến môi trường, migration và smoke test                  |
| `docs/05-ranking-spec.md`                                                   | Bài toán xếp hạng, dữ liệu, chia tập, mô hình, chỉ số, hợp đồng /rank                   |
| `docs/06-test-plan.md`                                                      | 21 ca kiểm thử làm bằng chứng bảo vệ, gồm T03b                                          |
| `db/migrations/001_init.sql`                                                | Schema PostgreSQL ban đầu                                                               |
| `db/migrations/002_rls_lockdown.sql`                                        | Bật RLS không policy cho mọi bảng, thu quyền vai công khai                              |
| `db/migrations/003_geography_catalog.sql`                                   | Danh mục địa lý và chuyển studios/membership                                            |
| `data/labeling-guideline.md`                                                | Quy tắc gán nhãn thang 0-3 kèm ví dụ                                                    |
| `data/workshops.sample.json`, `queries.sample.jsonl`, `labels.sample.jsonl` | Dữ liệu MẪU (mô phỏng) để thấy định dạng                                                |
| `.github/workflows/ci.yml`                                                  | CI chạy lint và test trên PostgreSQL service                                            |

## Trạng thái tiến độ roadmap

- Bước 1: nền tảng API/test/schema — hoàn thành.
- Bước 2: đăng ký, đăng nhập, JWT cookie, refresh token xoay vòng và thu hồi phiên; vai hệ thống `customer|studio_owner|admin` — đã triển khai.
- Bước 3: hồ sơ studio, vai thành viên `owner|staff` và duyệt admin (`pending|approved|rejected`) — đã triển khai.
- Bước 4: tạo/xem/sửa workshop và buổi, kiểm soát membership theo studio; owner tạo workshop/đặt giá, staff tạo buổi theo giá cơ sở và không tự đặt giá — đã triển khai.
- Bước 5: danh mục workshop công khai, lọc cứng, chi tiết và seed mẫu — đã triển khai; kiểm thử tích hợp liên quan đã qua.
- Frontend React/Vite: trang chủ, khám phá/lọc, chi tiết workshop/studio, giới thiệu, trang nghệ nhân, đăng ký/đăng nhập và đăng ký studio.
- Không gian studio: hồ sơ/minh chứng, workshop, lịch tổ chức và danh sách đặt chỗ; kiểm soát quyền theo studio.
- Admin: tổng quan, duyệt studio/workshop, người dùng, danh mục và đề xuất danh mục, đặt chỗ, báo cáo nội dung, nội dung nổi bật, mẫu thông báo, cấu hình và nhật ký thao tác. Xem các tài liệu nghiệp vụ trong `docs/`.
- Ảnh: upload, nén phía trình duyệt, thumbnail và biến thể kích thước vừa; có migration `029` và `030`. Cần áp migration đúng môi trường trước khi dùng tính năng liên quan.
- Hiệu năng: tải trang/thành phần theo nhu cầu, cache phiên và query, font tự host, ảnh responsive và ngân sách bundle. Số đo và giới hạn phép đo nằm trong [web-performance](docs/web-performance.md) và [mobile-performance](docs/mobile-performance.md).
- Kiểm thử: có unit/integration test API và test frontend. Có mã kiểm thử không đồng nghĩa tất cả đã chạy qua ở môi trường hiện tại.

## Phần cần hoàn thiện hoặc xác minh

- Luồng khách hàng gồm đặt chỗ nguyên tử, hold hết hạn, tiền cọc PayOS cho studio đủ điều kiện, thanh toán tại studio, webhook chống trùng, hủy/hoàn tiền thủ công, lịch sử đặt và vé QR đã có phần triển khai trong API/web; cần chạy migration `034` đúng môi trường và kiểm chứng bằng bộ test trước khi deploy. Check-in/QR scan chưa triển khai.
- Dịch vụ xếp hạng/gợi ý theo `docs/05-ranking-spec.md` chưa được triển khai thành luồng sử dụng hoàn chỉnh.
- Xác minh deployment thực tế, cookie/CORS, migration, storage và smoke test trên HTTPS. Theo dõi [checklist production](docs/production-readiness-checklist.md); kết quả rà soát cũ là bằng chứng tại thời điểm ghi nhận.

## Lưu ý

- Theo xác nhận, migration `001_init.sql`, `002_rls_lockdown.sql` và `003_geography_catalog.sql` đã chạy trên cả database dev/demo và database test riêng. Migration đã chạy không được sửa; nếu cần thay đổi schema, tạo migration mới.
- Chữ ký webhook PayOS được xác thực theo tài liệu chính thức; trạng thái thực tế cần xác minh trên cấu hình webhook môi trường trước khi ra mắt.
- Dữ liệu mẫu chỉ có vài dòng; cần mở rộng lên 100-200 workshop và hàng trăm câu nhu cầu.
- Bước 5B: có cấu hình Render cho API; web có trang khám phá/catalog bằng React + Vite + Tailwind CSS. URL công khai và cấu hình production vẫn cần xác nhận.
- Theo dõi hướng dẫn tại `docs/deploy.md`; cấu hình hosting và API CORS/secrets, rồi kiểm tra URL HTTPS và smoke test.
- Hoàn tất triển khai ban đầu API/web ở Bước 5B; hoàn thiện cấu hình ranker, dữ liệu demo và checklist ở Bước 18.
