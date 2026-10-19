# Bộ file chuẩn bị vibe coding: nền tảng đặt chỗ workshop

## Bắt đầu nhanh
1. Tạo hai Supabase project riêng: một cho dev/demo và một chỉ dành cho test.
2. Sao chép `.env.example` thành `.env`, rồi điền `DATABASE_URL` và `DATABASE_URL_TEST` bằng chuỗi kết nối của đúng hai project.
3. Chạy `npm install`, sau đó `npm run dev` để khởi động API và web.
4. Chạy `npm run lint` và `npm run build` để kiểm tra workspace.
5. Trước khi chạy test hoặc thao tác trên database test, bật opt-in trong PowerShell: `$env:ALLOW_DESTRUCTIVE_TESTS = "true"`. Sau đó chạy `npm test` hoặc `npm run migrate:test`. Guard sẽ từ chối nếu biến khác `"true"`, thiếu URL, URL sai định dạng, hoặc host và username của hai URL trùng nhau.
6. `npm run migrate` áp các file SQL trong `db/migrations` lên project dev/demo; `npm run migrate:test` áp chúng lên project test sau khi guard an toàn thông qua. Runner ghi checksum, từ chối migration đã bị sửa và bật RLS cho bảng `schema_migrations`.

API mặc định ở `http://localhost:4000` (`GET /health`); web ở `http://localhost:3000`.

## Kết nối Supabase
Trong từng project, mở **Connect** trên Supabase Dashboard để lấy chuỗi kết nối. Đặt URL của project dev/demo vào `DATABASE_URL`, còn URL của project test riêng biệt vào `DATABASE_URL_TEST`. Không đưa password thật vào Git.

- **Direct connection** dùng cổng `5432`; lấy nguyên chuỗi Direct trong Dashboard.
- **Session pooler** cũng dùng cổng `5432`; chọn chuỗi Session pooler trong Dashboard nếu máy Windows hoặc mạng không truy cập được host Direct. Username pooler thường có dạng `postgres.<project-ref>`.
- **Không dùng Transaction pooler** (cổng `6543`) cho API hoặc migration.

Test và script thao tác dữ liệu test dùng chung guard tại `scripts/assert-safe-test-db.ts`. Mọi script reset dữ liệu được thêm sau này phải gọi `assertSafeTestDatabase()` trước khi kết nối hoặc sửa dữ liệu.

## Danh sách file
| File | Nội dung |
|---|---|
| `CLAUDE.md` | Bối cảnh dự án, tech stack, quy tắc bắt buộc, phạm vi, cách làm việc với AI |
| `.env.example` | Mẫu biến môi trường (không commit giá trị thật) |
| `docs/00-tech-stack.md` | Tech stack đã chốt và lý do, những thứ cố ý không dùng |
| `docs/01-prd.md` | Chức năng theo vai, mức ưu tiên, tiêu chí chấp nhận |
| `docs/02-architecture.md` | Luồng, trạng thái booking, SQL giữ chỗ, webhook idempotent, thanh toán muộn, phân quyền |
| `docs/03-api-spec.md` | Danh sách endpoint |
| `docs/04-roadmap-prompts.md` | 19 bước chính và Bước 5B triển khai sớm, kèm prompt, tiêu chí hoàn thành, lỗi hay gặp |
| `docs/05-ranking-spec.md` | Bài toán xếp hạng, dữ liệu, chia tập, mô hình, chỉ số, hợp đồng /rank |
| `docs/06-test-plan.md` | 21 ca kiểm thử làm bằng chứng bảo vệ, gồm T03b |
| `db/migrations/001_init.sql` | Schema PostgreSQL |
| `db/migrations/002_rls_lockdown.sql` | Bật RLS không policy cho mọi bảng, thu quyền vai công khai |
| `data/labeling-guideline.md` | Quy tắc gán nhãn thang 0-3 kèm ví dụ |
| `data/workshops.sample.json`, `queries.sample.jsonl`, `labels.sample.jsonl` | Dữ liệu MẪU (mô phỏng) để thấy định dạng |
| `.github/workflows/ci.yml` | CI chạy lint và test trên PostgreSQL service |

## Trạng thái tiến độ roadmap
- Bước 1: nền tảng API/test/schema — hoàn thành.
- Bước 2: đăng ký, đăng nhập, JWT cookie, vai `customer|organizer|admin` — hoàn thành.
- Bước 3: hồ sơ organizer và duyệt admin (`pending|approved|rejected`) — hoàn thành.
- Bước 4: tạo/xem/sửa workshop và buổi, kiểm soát ownership và hủy buổi — hoàn thành. Danh sách đăng ký của organizer sẽ được nối khi triển khai booking.
- Tiếp theo: Bước 5, danh mục workshop công khai, lọc cứng và chi tiết.

## Lưu ý
- Hai migration `001_init.sql` và `002_rls_lockdown.sql` đã được áp dụng và kiểm tra trên database test PostgreSQL riêng. Chưa xác nhận migration trên database dev/demo; trước khi chạy migrate vào đó, kiểm tra lại URL đích. Migration đã chạy không được sửa; nếu cần thay đổi, tạo migration mới.
- Phần chữ ký webhook PayOS không được viết sẵn: Bước 9 yêu cầu dán tài liệu chính thức của PayOS cho AI.
- Dữ liệu mẫu chỉ có vài dòng; cần mở rộng lên 100-200 workshop và hàng trăm câu nhu cầu.
- Chọn nơi host và triển khai ban đầu API/web ở Bước 5B; hoàn thiện cấu hình ranker, dữ liệu demo và checklist ở Bước 18. Kiểm tra điều kiện hiện hành trước khi chọn nhà cung cấp.
