# Bộ file chuẩn bị vibe coding: nền tảng đặt chỗ workshop

## Bắt đầu nhanh
1. Tạo hai Supabase project riêng: một cho dev/demo và một chỉ dành cho test.
2. Sao chép `.env.example` thành `.env`, rồi điền `DATABASE_URL` và `DATABASE_URL_TEST` bằng chuỗi kết nối của đúng hai project.
3. Chạy `npm install`, sau đó `npm run dev` để khởi động API và web.
4. Chạy `npm run lint` và `npm run build` để kiểm tra workspace.
5. Trước khi chạy test hoặc thao tác trên database test, bật opt-in trong PowerShell: `$env:ALLOW_DESTRUCTIVE_TESTS = "true"`. Sau đó chạy `npm test` hoặc `npm run migrate:test`. Guard sẽ từ chối nếu biến khác `"true"`, thiếu URL, URL sai định dạng, hoặc host và username của hai URL trùng nhau.
6. `npm run migrate` và `npm run migrate:test` hiện chưa áp migration; migration runner sẽ được triển khai ở Bước 0B.

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
| `docs/04-roadmap-prompts.md` | 19 bước vibe coding kèm prompt, tiêu chí hoàn thành, lỗi hay gặp |
| `docs/05-ranking-spec.md` | Bài toán xếp hạng, dữ liệu, chia tập, mô hình, chỉ số, hợp đồng /rank |
| `docs/06-test-plan.md` | 20 ca kiểm thử làm bằng chứng bảo vệ |
| `db/migrations/001_init.sql` | Schema PostgreSQL |
| `db/migrations/002_rls_lockdown.sql` | Bật RLS không policy cho mọi bảng, thu quyền vai công khai |
| `data/labeling-guideline.md` | Quy tắc gán nhãn thang 0-3 kèm ví dụ |
| `data/workshops.sample.json`, `queries.sample.jsonl`, `labels.sample.jsonl` | Dữ liệu MẪU (mô phỏng) để thấy định dạng |
| `.github/workflows/ci.yml` | CI chạy lint và test trên PostgreSQL service |

## Lưu ý
- Hai file SQL đã được kiểm tra cú pháp bằng trình phân tích PostgreSQL nhưng CHƯA chạy trên PostgreSQL thật; Bước 0B sẽ chạy lần đầu. Nếu lỗi, tạo migration mới để sửa, không sửa file đã chạy lên DB thật.
- Phần chữ ký webhook PayOS không được viết sẵn: Bước 9 yêu cầu dán tài liệu chính thức của PayOS cho AI.
- Dữ liệu mẫu chỉ có vài dòng; cần mở rộng lên 100-200 workshop và hàng trăm câu nhu cầu.
- Hosting (web, API, ranker) và phiên bản thư viện chốt ở Bước 18, sau khi kiểm tra điều kiện hiện hành.
