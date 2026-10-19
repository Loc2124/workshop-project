# Triển khai API và web (Bước 5B)

Nhà cung cấp đã chọn: **API trên Render, web trên Vercel**. Blueprint API nằm tại `render.yaml`. Chưa có URL công khai cho tới khi import repository vào tài khoản Render và Vercel. Gói miễn phí có thể ngủ hoặc giới hạn tài nguyên; xem lại điều khoản/giới hạn trong dashboard trước khi xác nhận tạo dịch vụ.

## Trạng thái hiện tại

- Có thể build API và Next.js web từ monorepo tại thư mục gốc repository.
- API có `GET /health`, đọc `PORT` do host cấp, hỗ trợ `API_PORT` cho môi trường local, giới hạn connection pool mặc định ở 5 và có `npm run start --workspace @workshop/api`.
- Web cần `API_INTERNAL_URL` khi build để rewrite `/api/*` tới API. Đây là biến server-side, không phải `NEXT_PUBLIC_*`.
- Giao diện đăng nhập/đăng ký và customer catalog chưa được triển khai; vì vậy smoke test trình duyệt cho các luồng này chưa sẵn sàng. API auth và catalog có thể kiểm tra trực tiếp qua rewrite/API.
- `packages/shared` hiện không có script build và API/web chưa import package này. Không cần build package riêng lúc này; nếu thêm phụ thuộc workspace sau này, cập nhật thứ tự build để build shared trước consumer.

## 1. API trên Render

Tạo Blueprint mới trong Render Dashboard, kết nối repository này và chọn `render.yaml`. Blueprint dùng repository root làm working directory, cài dependencies qua `npm ci --include=dev` (cần TypeScript và type declarations để build), build workspace API, start bằng lệnh workspace, và dùng `/health` để health check. Dev dependencies chỉ cần trong giai đoạn build; không cần thiết lúc chạy API. Kế hoạch được đặt `free`; đổi plan trong dashboard nếu cần dịch vụ không ngủ.

Khi Render hỏi các biến `sync: false`, điền `DATABASE_URL` của project Supabase dev/demo và `WEB_ORIGIN` tạm bằng `https://example.invalid`. Không lưu URL DB trong Git. Blueprint tự tạo `JWT_SECRET`; `PORT` do Render cấp. Sau khi deploy, ghi lại hostname API, ví dụ `workshop-api.onrender.com`.

Không chạy migration cho tới khi xác nhận `DATABASE_URL` đúng project dev/demo và cổng 5432. Dịch vụ API có thể khởi động nhưng các route cần DB chưa sẵn sàng trước migration.

## 2. Web trên Vercel

Import cùng repository thành một project Vercel. Đặt **Root Directory** là `apps/web`; để Vercel nhận diện npm workspace và framework Next.js. Giữ build command mặc định (`next build`). Đặt Install Command thành `npm install --production=false` để chắc chắn các gói build trong `devDependencies` được cài, kể cả khi `NODE_ENV=production` đang có trong Vercel Project Settings. Nếu cấu hình project yêu cầu cài từ repository root, dùng `cd ../.. && npm ci --include=dev` và Build Command `cd ../.. && npm run build --workspace @workshop/web`.

Thêm biến môi trường `API_INTERNAL_URL` vào Production (và Preview nếu cần), với giá trị origin API Render, ví dụ `https://workshop-api.onrender.com` — không có path hoặc dấu `/` cuối. Build lại web sau khi thêm biến này vì Next.js đóng rewrite vào cấu hình build.

Sau deploy, ghi lại hostname HTTPS web, rồi quay lại Render và đổi `WEB_ORIGIN` thành origin Vercel chính xác, ví dụ `https://workshop-web.vercel.app`. Lưu thay đổi để Render deploy lại API. Cấu hình này ghi nhận origin dự kiến; rewrite hiện tại không cần mở CORS.

## 3. Biến môi trường API

Blueprint đã khai báo biến cố định và secret cần nhập trong dashboard. Các giá trị cần kiểm tra:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | Supabase dev/demo; Direct hoặc Session pooler cổng `5432` |
| `WEB_ORIGIN` | Origin Vercel chính xác sau khi web deploy |
| `JWT_SECRET` | Render sinh tự động; không thay bằng giá trị đã commit |
| `NODE_ENV`, `COOKIE_SECURE`, `COOKIE_NAME` | Blueprint đặt `production`, `true`, `workshop_session` |
| `DB_POOL_MAX` | `5`; giảm nếu project Supabase giới hạn connection thấp |
| `TRUST_PROXY_HOPS` | Blueprint đặt `1` cho load balancer Render đứng trước API |
| `PAYMENT_PROVIDER` | `mock`; Bước 5B không bật thanh toán thật |
| `RANKER_URL` | `http://localhost:8001`; chưa dùng trong bước deploy này |
| `PORT` | Render cấp tự động; không đặt thủ công |

`API_PORT` vẫn được hỗ trợ cho local; `PORT` của Render được ưu tiên. Nếu không kết nối được Supabase Direct, đổi `DATABASE_URL` sang Session pooler cổng `5432`. Không chép URL chứa mật khẩu vào ticket, log, tài liệu hoặc Git.

`WEB_ORIGIN` ghi nhận origin web mong đợi; web gọi API qua Next.js rewrite cùng origin nên không cần mở CORS. Render kết thúc TLS tại load balancer; `TRUST_PROXY_HOPS=1` giúp Express nhận đúng IP và giao thức HTTPS từ proxy để cookie `Secure` hoạt động đúng. [Render khuyến nghị `trust proxy` bằng 1](https://render.com/articles/how-to-implement-authentication-and-authorization).

## 4. Biến môi trường web

Đặt trong Vercel Project Settings → Environment Variables:

| Biến | Giá trị |
|---|---|
| `API_INTERNAL_URL` | Base URL HTTPS công khai của API, ví dụ `https://<api-domain>`; không thêm `/api` hay dấu `/` cuối |

Next.js rewrite chuyển `/api/<path>` thành `<API_INTERNAL_URL>/<path>`. Không đặt `DATABASE_URL`, `JWT_SECRET`, PayOS key hay bất kỳ secret nào vào biến `NEXT_PUBLIC_*`; không cần biến `NEXT_PUBLIC_*` cho URL API trong cấu hình rewrite hiện tại.

## 5. Migration và xác nhận RLS

Chỉ sau khi tự xác nhận `DATABASE_URL` đang trỏ tới Supabase project dev/demo đúng, chạy migration thủ công từ môi trường tin cậy. Không chạy lệnh test hoặc `migrate:test` lên project dev/demo:

```powershell
$env:DATABASE_URL = "<URL dev/demo cổng 5432>"
npm run migrate
```

Không thêm chuỗi thật vào `.env.example`, shell history dùng chung, hoặc Git. Nếu cần xác nhận mọi bảng trong `public` đều bật RLS và không có policy, chạy truy vấn sau trong SQL editor của đúng project:

```sql
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       count(p.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p
  ON p.schemaname = n.nspname
 AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
```

Mỗi dòng phải có `rls_enabled = true` và `policy_count = 0`. Xem lại đích database trước khi xác nhận thao tác migration; migration đã chạy không được sửa.

## 6. Smoke test và các mục chưa thể kiểm tra

Sau khi cả hai dịch vụ báo deploy thành công và có HTTPS URL:

1. Mở `https://<api-domain>/health`; mong đợi HTTP 200 và `{"ok":true}`.
2. Gọi `https://<web-domain>/api/health`; mong đợi cùng phản hồi để xác nhận rewrite web → API.
3. Gọi `GET https://<web-domain>/api/workshops`; mong đợi danh sách rỗng hoặc các workshop đã duyệt/còn chỗ. Nếu chưa chạy seed, danh sách rỗng là bình thường.
4. Khi có tài khoản demo/customer hợp lệ, đăng nhập qua `POST https://<web-domain>/api/auth/login` và xác nhận response có `Set-Cookie` với `HttpOnly`, `Secure`, `SameSite=Lax`; không chia sẻ giá trị cookie. Kiểm tra cookie được lưu trong trình duyệt chỉ khi UI đăng nhập được bổ sung.
5. Ghi lại URL HTTPS cuối cùng, thời điểm kiểm tra, kết quả và mọi hạng mục chưa sẵn sàng ở checklist bảo vệ; không ghi secret hay cookie.

Chưa thể xác nhận URL HTTPS, khả năng kết nối từ Render đến Supabase, giới hạn pool phù hợp, thiết lập proxy chính xác, hành vi ngủ/đánh thức, đăng ký/đăng nhập qua UI, hay webhook PayOS cho tới khi kết nối repository, cấu hình dashboard, chạy migration đã xác nhận và smoke test. Bước này chưa bật thanh toán thật. Render Free services có thể ngủ khi idle; Vercel Hobby chỉ dành cho mục đích cá nhân/phi thương mại, cần kiểm tra điều khoản phù hợp với cách sử dụng dự án.
