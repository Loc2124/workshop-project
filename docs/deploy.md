# Triển khai API và web

## Kiến trúc triển khai

- API Node.js/Express: Render, cấu hình Blueprint tại `render.yaml`.
- Web: React + TypeScript + Vite + Tailwind CSS, build thành static site. Nhà cung cấp hosting web chưa chốt.
- Database: Supabase PostgreSQL.

Web là SPA độc lập, gọi API bằng biến build-time `VITE_API_BASE_URL` (ví dụ `https://workshop-api.onrender.com`). API giới hạn CORS theo origin `WEB_ORIGIN`, cho phép credentials, và từ chối request thay đổi dữ liệu từ origin trình duyệt khác. Request đăng nhập và các request cần phiên gửi cookie bằng `credentials: 'include'`; production dùng cookie `HttpOnly`, `Secure`, `SameSite=None` để hoạt động giữa domain Vercel và Render. Local dùng `SameSite=Lax`.

Trang khám phá có thể xin quyền vị trí trình duyệt để chọn tỉnh/thành mặc định. Tọa độ được gửi trực tiếp tới reverse-geocoding endpoint cấu hình bằng `VITE_REVERSE_GEOCODE_URL`; mặc định là Nominatim/OpenStreetMap. Người dùng có thể đổi tỉnh hoặc từ chối quyền vị trí. Chỉ bật tính năng này trên HTTPS khi deploy.

## Trạng thái hiện tại

- API có cấu hình deploy trên Render và endpoint `GET /health`.
- Frontend React/Vite trong `apps/web` hiện chỉ có cấu hình nền và cấu trúc thư mục; chưa có màn hình giao diện. Có thể chọn Vercel để host static site sau khi hoàn thiện web.
- Chưa xác nhận URL công khai, giá trị `WEB_ORIGIN` production hoặc migration trên database dev/demo.
- `packages/shared` chưa có script build; API chưa cần build package này riêng.

## 1. API trên Render

Tạo Blueprint trong Render Dashboard, kết nối repository và chọn `render.yaml`. Blueprint cài dependencies ở root, build workspace API, chạy API và dùng `/health` làm health check.

Khi được yêu cầu, nhập `DATABASE_URL` của Supabase dev/demo và `WEB_ORIGIN` là origin chính xác của static site web. Blueprint tạo `JWT_SECRET`; giữ secret trong dashboard, không commit vào Git. Render cấp `PORT` tự động.

Không chạy migration cho tới khi xác nhận `DATABASE_URL` trỏ đúng project dev/demo và cổng 5432. API dùng `WEB_ORIGIN` để giới hạn CORS, cho phép credentials và từ chối request thay đổi dữ liệu từ origin trình duyệt khác. Blueprint đặt cookie `SameSite=None; Secure` để frontend Vercel gọi API Render qua hai site riêng.

## 2. Web React/Vite

Khi `apps/web` đã được tạo, cấu hình static site với root repository hoặc thư mục phù hợp monorepo:

- Install: `npm ci --include=dev` tại root.
- Build: `npm run build --workspace @workshop/web`.
- Publish directory: thư mục output Vite, thường là `apps/web/dist`.
- Build environment: `VITE_API_BASE_URL=https://<api-domain>`.
- Reverse geocoding: `VITE_REVERSE_GEOCODE_URL=https://nominatim.openstreetmap.org/reverse` (tọa độ trình duyệt được gửi tới endpoint này khi người dùng cho phép định vị).
- SPA fallback: mọi đường dẫn frontend cần được rewrite về `/index.html`.

Tên lệnh và output directory cần khớp cấu hình Vite thực tế khi ứng dụng được tạo. Chỉ đưa URL API công khai vào biến `VITE_*`; không đưa database URL, JWT secret, PayOS key hoặc secret nào vào bundle frontend. Sau khi có domain web, đặt `WEB_ORIGIN` ở Render thành origin đầy đủ, ví dụ `https://workshop.example.com`.

## 3. Biến môi trường API

| Biến               | Giá trị                                                 |
| ------------------ | ------------------------------------------------------- |
| `DATABASE_URL`     | Supabase dev/demo; Direct hoặc Session pooler cổng 5432 |
| `WEB_ORIGIN`       | Origin web production chính xác, dùng cho CORS          |
| `JWT_SECRET`       | Secret mạnh, lưu trong dashboard                        |
| `NODE_ENV`         | `production`                                            |
| `COOKIE_SECURE`    | `true` ở production                                     |
| `COOKIE_SAME_SITE` | `none` ở production; `lax` cho local                    |
| `COOKIE_NAME`      | `workshop_session`                                      |
| `DB_POOL_MAX`      | Mặc định `5`, giảm nếu giới hạn kết nối database thấp   |
| `TRUST_PROXY_HOPS` | `1` khi API chạy sau load balancer Render               |
| `PAYMENT_PROVIDER` | `mock` cho giai đoạn demo hiện tại                      |
| `RANKER_URL`       | URL dịch vụ ranker; hiện chưa triển khai                |
| `PORT`             | Render cấp tự động                                      |

Không chép URL có mật khẩu hoặc secret vào tài liệu, log, ticket hay Git.

## 4. Cookie và CORS giữa hai origin

Frontend gửi request có cookie với `credentials: 'include'` và API trả `Access-Control-Allow-Credentials: true` cùng `Access-Control-Allow-Origin` cụ thể, không dùng wildcard. Cookie `SameSite=None; Secure` cho deployment Vercel/Render; local dùng `SameSite=Lax`.

## 5. Migration và RLS

Chỉ sau khi xác nhận `DATABASE_URL` trỏ tới đúng project dev/demo mới chạy migration thủ công từ môi trường tin cậy:

```powershell
$env:DATABASE_URL = "<URL dev/demo cổng 5432>"
npm run migrate
```

Không chạy test hoặc `migrate:test` trên project dev/demo. Migration đã chạy không được sửa; tạo migration mới nếu cần thay đổi schema.

## 6. Smoke test sau deploy

1. Mở `https://<api-domain>/health`; cần nhận HTTP 200 và `{"ok":true}`.
2. Mở web production và kiểm tra assets được tải, các route SPA tải lại trực tiếp được.
3. Khi giao diện catalog được triển khai, gọi API từ web và kiểm tra CORS chỉ cho phép origin đã cấu hình.
4. Khi luồng đăng nhập UI sẵn sàng, đăng nhập và xác nhận cookie được lưu với thuộc tính phù hợp; không chia sẻ giá trị cookie.
5. Ghi lại URL HTTPS, thời điểm và kết quả smoke test; không ghi secret.

Migration dev/demo, URL công khai, kết nối API tới Supabase và giá trị `WEB_ORIGIN` production chưa được xác nhận trong repository.
