# Tech stack đã chốt và lý do

## Quyết định
| Lớp | Chọn | Lý do ngắn |
|---|---|---|
| Cơ sở dữ liệu | **PostgreSQL trên hai Supabase project riêng**: dev/demo dùng `DATABASE_URL`, test chỉ dùng `DATABASE_URL_TEST`. Không cài PostgreSQL local; CI dùng PostgreSQL service container | Cùng engine; tách hẳn dữ liệu test khỏi project dev/demo |
| Truy cập DB | **`pg` + SQL thuần**, không ORM | Giữ chỗ nguyên tử và idempotent cần kiểm soát câu SQL; AI dễ sinh sai khi qua lớp ORM |
| Migration | Trình chạy tự viết `scripts/migrate.ts` + file SQL đánh số + bảng `schema_migrations` (có checksum) | Đơn giản, không phụ thuộc công cụ |
| API | **Node.js + TypeScript + Express**, `zod` để validate (middleware), `pino-http` để log, `helmet`, `cookie-parser`, `express-rate-limit` | Phổ biến nhất, AI sinh code chính xác, tài liệu và ví dụ rất nhiều |
| Xác thực | **Tự làm**: băm mật khẩu (argon2 hoặc bcrypt), JWT trong cookie httpOnly, SameSite=Lax | Một hệ phân quyền duy nhất (API), không trộn với RLS/Supabase Auth |
| Web | **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, `react-hook-form` + `zod` | Nhiều ví dụ, AI sinh tốt, ít phải tự thiết kế giao diện |
| Gọi API từ web | Next.js `rewrites`: `/api/*` → API | Cùng origin, cookie httpOnly hoạt động không cần cấu hình CORS phức tạp |
| Test API | **Vitest** + `supertest` + PostgreSQL thật; test đồng thời dùng nhiều kết nối song song | Bằng chứng kiểm thử cho báo cáo |
| Test web | Mức tối thiểu: một vài test e2e luồng chính bằng Playwright (mức 2) | Khớp định hướng automation test của bạn |
| Tác vụ nền | Hàm `releaseExpiredHolds()` gọi định kỳ trong tiến trình API, có advisory lock chống chạy chồng; cũng gọi theo buổi khi đặt chỗ và trước khi trả số chỗ còn ở trang chi tiết | Dễ test trực tiếp, không phụ thuộc pg_cron; không lệ thuộc job khi host tạm ngủ |
| Thanh toán | **PayOS** qua interface `PaymentProvider`; `MockProvider` cho test/demo | Đã có tài khoản; đổi nhà cung cấp chỉ sửa một chỗ |
| AI huấn luyện | **Python 3.11**, PyTorch, `sentence-transformers`, `rank_bm25`, `scikit-learn`; huấn luyện trên Colab | Chạy được không cần GPU cá nhân |
| AI phục vụ | **FastAPI** trong `services/ranker`, cache vector workshop | Hợp đồng `/rank` ở `docs/05-ranking-spec.md` |
| Monorepo | **npm workspaces** | Ít công cụ nhất |
| CI | GitHub Actions: lint + test với PostgreSQL service | Log kiểm thử đưa vào báo cáo |
| Webhook khi chạy local | Tunnel (ví dụ ngrok hoặc cloudflared) | PayOS cần URL công khai |

## Không dùng (cố ý)
- Supabase Auth, RLS làm cơ chế phân quyền, Edge Functions, PostgREST/client SDK từ trình duyệt.
- ORM (Prisma, TypeORM...), GraphQL, Redis, message queue, microservice ngoài `ranker`.
- Mô hình ngôn ngữ tự train từ đầu.

## Kết nối cơ sở dữ liệu và an toàn test
- API dùng `DATABASE_URL` của Supabase project dev/demo. Test và migration dành cho test chỉ dùng `DATABASE_URL_TEST` của Supabase project riêng chỉ dành cho test.
- Lấy chuỗi Direct hoặc Session pooler trong Supabase Dashboard > Connect. Cả hai dùng cổng `5432`; Session pooler là lựa chọn khi máy/mạng không truy cập được host Direct.
- Không dùng Transaction pooler (cổng `6543`) cho API hoặc migration.
- Trước khi test, migration test hoặc reset dữ liệu test, gọi `assertSafeTestDatabase()` từ `scripts/assert-safe-test-db.ts`. Thao tác bị từ chối trừ khi `ALLOW_DESTRUCTIVE_TESTS` đúng chính xác `"true"`, hai URL hợp lệ, và host hoặc username của URL test khác URL dev/demo.
- Máy phát triển không cần cài PostgreSQL hoặc Docker. CI dùng PostgreSQL service container riêng; không dùng Supabase project cá nhân trong workflow CI.

## Quy ước phiên bản
Dùng phiên bản ổn định/LTS mới nhất tại thời điểm dựng dự án, ghi cố định trong `package.json` và `requirements.txt`. Với thư viện bảo mật và thanh toán, ưu tiên bản đã phát hành ít nhất vài tuần.

## Hosting (triển khai ban đầu ở Bước 5B, hoàn thiện ở Bước 18; kiểm tra điều kiện hiện hành)
- Web: nền tảng host Next.js.
- API: nơi chạy Node.js có URL công khai (cần cho webhook PayOS).
- Ranker: nơi chạy Python có đủ RAM cho mô hình; chọn mô hình nhỏ và luôn có dự phòng BM25 trong API.
- Database: Supabase (gói miễn phí tự tạm dừng sau 1 tuần không hoạt động: kiểm tra trước buổi demo).
