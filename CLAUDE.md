# CLAUDE.md — Nền tảng đặt chỗ workshop

Đọc file này đầu tiên trong mỗi phiên làm việc. Chi tiết nằm trong `docs/`.

## Dự án là gì
Đồ án tốt nghiệp: website để các đơn vị tổ chức đăng workshop thủ công (gốm, nến, vẽ, cắm hoa...) tại một thành phố; khách tìm, đặt chỗ, thanh toán. **Phần AI trọng tâm: mô hình xếp hạng workshop theo nhu cầu bằng ngôn ngữ tự nhiên, do sinh viên tự fine-tune** (xem `docs/05-ranking-spec.md`). Đặt chỗ + thanh toán là môi trường để triển khai và kiểm chứng.

- Giao diện và thông báo: tiếng Việt. Tiền: VND, **số nguyên**, không dùng float.
- Dữ liệu mẫu là MÔ PHỎNG, luôn ghi rõ như vậy trong báo cáo và UI demo.

## Tech stack (đã chốt — xem `docs/00-tech-stack.md`)
- **DB:** PostgreSQL qua hai Supabase project riêng: `DATABASE_URL` cho dev/demo và `DATABASE_URL_TEST` chỉ cho test. Không cài PostgreSQL local, không dùng Docker ngoài PostgreSQL service trong CI. **SQL thuần qua `pg`, không ORM.**
- **API:** Node.js + TypeScript + **Express**, `zod` (validate qua middleware), `pino-http` (log), `helmet`, `cookie-parser`, `express-rate-limit`. Xác thực tự làm (JWT trong cookie httpOnly). Mọi handler async phải đi qua một wrapper bắt lỗi (hoặc dùng bản Express tự bắt lỗi async), không để lỗi bị nuốt.
- **Web:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. Gọi API qua rewrites `/api/*`.
- **Test:** Vitest + `supertest` (gọi thẳng app Express, không cần mở cổng) + PostgreSQL thật.
- **AI:** Python (PyTorch, sentence-transformers, rank_bm25, scikit-learn), phục vụ bằng FastAPI.
- **Thanh toán:** PayOS sau interface `PaymentProvider`; `MockProvider` cho test.
- **KHÔNG dùng:** Supabase Auth/RLS làm phân quyền/Edge Functions/client SDK từ trình duyệt, ORM, GraphQL, Redis, queue.

## Cấu trúc thư mục
```
apps/web          Next.js
apps/api          Express API
  src/app.ts, server.ts  app composition and process entry point
  src/db, errors, middleware  shared API infrastructure
  src/modules/<feature>  feature routes, schemas, services, repositories (add as needed)
  tests/unit, integration, helpers  tests grouped by scope and reusable fixtures
packages/shared   kiểu và schema zod dùng chung
services/ranker   Python: dữ liệu, baseline, fine-tune, dịch vụ /rank
db/migrations     SQL đánh số: 001_init.sql, 002_rls_lockdown.sql, 003_...
scripts           migrate.ts, seed
data              dữ liệu mẫu, nhãn, quy tắc gán nhãn
docs              đặc tả
```

Trong web, `src/app` dành cho routing/layout của Next.js; thêm `features`, `components` hoặc `lib` khi có nghiệp vụ cần dùng, không tạo thư mục rỗng trước.

## Quy tắc BẮT BUỘC (không được phá, kể cả khi "cho nhanh")
1. **Điều kiện cứng do database lọc** (ngày, giá, khu vực, chỗ trống). Mô hình AI chỉ xếp hạng tập ứng viên đã qua lọc.
2. **Giữ chỗ phải nguyên tử**: một câu `UPDATE ... WHERE seats_held + seats_sold + $qty <= capacity RETURNING ...` trong transaction. Cấm đọc số chỗ rồi ghi lại ở tầng ứng dụng. Mẫu SQL ở `docs/02-architecture.md`.
3. **Webhook thanh toán idempotent**: xác thực chữ ký, ghi mọi sự kiện vào `webhook_events` (unique theo khóa chống trùng), nhận lặp không tạo vé hay cộng doanh thu hai lần. Đọc tài liệu chính thức PayOS trước khi code phần chữ ký, không đoán.
4. **Không tin dữ liệu tiền từ client**: giá, tổng tiền tính lại ở server từ `sessions`.
5. **Phân quyền theo đơn vị**: mọi truy vấn của organizer lọc theo `organizer_id` của người đăng nhập, truyền như tham số bắt buộc. Mỗi endpoint organizer có test "đơn vị B không truy cập dữ liệu đơn vị A".
6. **Nhà cung cấp thanh toán nằm sau interface** `PaymentProvider`.
7. **Có dự phòng cho xếp hạng**: ranker lỗi/chậm quá ngưỡng → xếp hạng BM25/văn bản trong API, ghi `search_logs.fallback_used=true`.
8. **Số sao đánh giá KHÔNG dùng làm nhãn huấn luyện**; nhãn theo `data/labeling-guideline.md`.
9. **Mọi bảng public phải bật RLS và không có policy** (migration 002 + test). API dùng `DATABASE_URL`; chỉ test và migration test dùng `DATABASE_URL_TEST` sau khi safety guard cho phép. Không kết nối PostgreSQL trực tiếp từ trình duyệt.
10. Secret chỉ ở `.env`, không commit; `.env.example` luôn được cập nhật.
11. Mọi câu SQL dùng tham số (`$1`, `$2`), không nối chuỗi.
12. Không thêm tính năng ngoài phạm vi khi chưa hỏi.

## Phạm vi và mức ưu tiên
- **Mức 1 (lõi):** đăng ký/đăng nhập, ba vai; đăng workshop, tạo buổi; bộ lọc cứng; xếp hạng; giữ chỗ có hạn; PayOS; webhook idempotent; mã vé hiển thị; bộ test đồng thời/webhook/phân quyền.
- **Mức 2:** duyệt bằng cờ trạng thái (đã có trong mức 1 ở dạng trường); doanh thu; đánh giá sau tham gia.
- **Mức 3:** vé QR + điểm danh; trích xuất nhu cầu bằng Gemini ra JSON (kèm bước khách xem lại).
- **Ngoài phạm vi:** chat khách-đơn vị, chia tiền tự động, hoàn tiền tự động (chỉ `refund_needed`), app di động, bản đồ phức tạp.
- **Mốc cắt:** cuối tuần 7, nếu mức 1 chưa xong thì bỏ mức 2 và 3.

## Cách làm việc với Claude
- Làm từng bước nhỏ theo `docs/04-roadmap-prompts.md`; mỗi bước phải chạy được và có test trước khi sang bước sau.
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
