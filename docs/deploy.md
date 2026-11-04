# Triển khai API và web

## Kiến trúc triển khai

- API Node.js/Express: Render, cấu hình Blueprint tại `render.yaml`.
- Web: React + TypeScript + Vite + Tailwind CSS, build thành static site; có cấu hình Vercel tại `apps/web/vercel.json`.
- Database: Supabase PostgreSQL.

Web là SPA độc lập, gọi API bằng biến build-time `VITE_API_BASE_URL` (ví dụ `https://workshop-api.onrender.com`). Web chỉ dùng dữ liệu API và không thay thế bằng mock khi API lỗi. API giới hạn CORS theo origin `WEB_ORIGIN`, cho phép credentials, và từ chối request thay đổi dữ liệu từ origin trình duyệt khác. Request đăng nhập và các request cần phiên gửi cookie bằng `credentials: 'include'`; production dùng cookie `HttpOnly`, `Secure`, `SameSite=None` để hoạt động giữa domain Vercel và Render. Local dùng `SameSite=Lax`.

Trang khám phá có thể xin quyền vị trí trình duyệt để chọn tỉnh/thành mặc định. Tọa độ được gửi trực tiếp tới reverse-geocoding endpoint cấu hình bằng `VITE_REVERSE_GEOCODE_URL`; mặc định là Nominatim/OpenStreetMap. Người dùng có thể đổi tỉnh hoặc từ chối quyền vị trí. Chỉ bật tính năng này trên HTTPS khi deploy.

## Trạng thái hiện tại

- API có cấu hình deploy trên Render và endpoint `GET /health`.
- Frontend trong `apps/web` có giao diện khách, xác thực, đặt chỗ, lịch sử và vé; xem README để biết phạm vi còn thiếu.
- Migration booking/thanh toán mới nhất trong repository là `034_customer_booking_payments.sql`. Chưa xác nhận URL công khai, giá trị `WEB_ORIGIN` production hoặc migration đã chạy ở từng database; kiểm tra lịch sử trước khi triển khai.
- `packages/shared` chưa có script build; API chưa cần build package này riêng.
- `JWT_SECRET` phải là chuỗi base64url ngẫu nhiên dài ít nhất 43 ký tự, có tối thiểu 16 ký tự khác nhau. Sinh bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; đặt trực tiếp trong secret manager/dashboard, không ghi vào Git hoặc log.
- Production yêu cầu `WEB_ORIGIN` dùng HTTPS. Nếu thay `JWT_SECRET`, access token hiện hành không còn hợp lệ nhưng phiên có refresh token còn hạn có thể lấy access token mới; để thu hồi mọi phiên, thu hồi các dòng `auth_sessions` của user.
- Access JWT có thời hạn 15 phút; refresh token ngẫu nhiên có thời hạn 14 ngày, lưu dưới dạng SHA-256 hash trong `auth_sessions` và xoay sau mỗi lần `POST /auth/refresh`. Logout thu hồi phiên hiện tại; đổi role có hiệu lực ngay do middleware đọc role từ database. Khi cần thu hồi mọi phiên, quản trị phải thu hồi các dòng `auth_sessions` của user.

## 1. API trên Render

Tạo Blueprint trong Render Dashboard, kết nối repository và chọn `render.yaml`. Blueprint cài dependencies ở root, build workspace API, chạy API và dùng `/health` làm health check.

Khi được yêu cầu, nhập `DATABASE_URL` của Supabase dev/demo và `WEB_ORIGIN` là origin chính xác của static site web. Blueprint tạo `JWT_SECRET`; giữ secret trong dashboard, không commit vào Git. Render cấp `PORT` tự động.

Không chạy migration cho tới khi xác nhận `DATABASE_URL` trỏ đúng project dev/demo và cổng 5432. API dùng `WEB_ORIGIN` để giới hạn CORS, cho phép credentials và từ chối request thay đổi dữ liệu từ origin trình duyệt khác. Blueprint đặt cookie `SameSite=None; Secure` để frontend Vercel gọi API Render qua hai site riêng.

## 2. Web React/Vite

Cấu hình static site với root repository hoặc thư mục phù hợp monorepo:

- Install: `npm ci --include=dev` tại root.
- Build: `npm run build --workspace @workshop/web`.
- Publish directory: thư mục output Vite, thường là `apps/web/dist`.
- Build environment: `VITE_API_BASE_URL=https://<api-domain>`.
- Reverse geocoding: `VITE_REVERSE_GEOCODE_URL=https://nominatim.openstreetmap.org/reverse` (tọa độ trình duyệt được gửi tới endpoint này khi người dùng cho phép định vị).
- SPA fallback: mọi đường dẫn frontend cần được rewrite về `/index.html`.

Output hiện tại là `apps/web/dist`; dùng cấu hình rewrite/cache trong `apps/web/vercel.json` khi triển khai Vercel. Thư mục `apps/web/build` chứa mã hỗ trợ build cần được commit. Chỉ đưa URL API công khai vào biến `VITE_*`; không đưa database URL, JWT secret, PayOS key hoặc secret nào vào bundle frontend. Sau khi có domain web, đặt `WEB_ORIGIN` ở Render thành origin đầy đủ, ví dụ `https://workshop.example.com`.

## 3. Biến môi trường API

| Biến                       | Giá trị                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`             | Supabase dev/demo; Direct hoặc Session pooler cổng 5432      |
| `WEB_ORIGIN`               | Origin web production chính xác, dùng cho CORS               |
| `JWT_SECRET`               | Secret base64url ngẫu nhiên >= 43 ký tự, lưu trong dashboard |
| `JWT_EXPIRES_IN`           | Thời hạn access JWT; mặc định `15m`                          |
| `REFRESH_TOKEN_EXPIRES_IN` | Thời hạn refresh token; mặc định `14d`                       |
| `NODE_ENV`                 | `production`                                                 |
| `COOKIE_SECURE`            | `true` ở production                                          |
| `COOKIE_SAME_SITE`         | `none` ở production; `lax` cho local                         |
| `COOKIE_NAME`              | `workshop_session`                                           |
| `REFRESH_COOKIE_NAME`      | `workshop_refresh`                                           |
| `DB_POOL_MAX`              | Mặc định `5`, giảm nếu giới hạn kết nối database thấp        |
| `TRUST_PROXY_HOPS`         | `1` khi API chạy sau load balancer Render                    |
| `HOLD_MINUTES`             | Thời gian giữ chỗ chờ cọc; mặc định `15` phút                 |
| `EXPIRY_JOB_INTERVAL_SECONDS` | Chu kỳ worker giải phóng hold quá hạn; mặc định `60` giây |
| `PAYMENT_PROVIDER`         | Production bắt buộc `payos`; `mock` chỉ cho local/test       |
| `PAYOS_CLIENT_ID`          | Client ID trong PayOS dashboard                               |
| `PAYOS_API_KEY`            | API key trong PayOS dashboard                                 |
| `PAYOS_CHECKSUM_KEY`       | Checksum key để xác thực webhook                              |
| `PAYOS_RETURN_URL`         | HTTPS URL web nhận chuyển hướng sau thanh toán                |
| `PAYOS_CANCEL_URL`         | HTTPS URL web nhận chuyển hướng khi rời checkout             |
| `PAYOS_WEBHOOK_URL`        | HTTPS URL API webhook đã đăng ký trong PayOS                  |
| `RANKER_URL`               | URL dịch vụ ranker; hiện chưa triển khai                     |
| `PORT`                     | Render cấp tự động                                           |

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
3. Gọi API catalog/booking từ web và kiểm tra CORS chỉ cho phép origin đã cấu hình.
4. Đăng nhập và xác nhận cookie được lưu với thuộc tính phù hợp; không chia sẻ giá trị cookie.
5. Ghi lại URL HTTPS, thời điểm và kết quả smoke test; không ghi secret.

Migration dev/demo, URL công khai, kết nối API tới Supabase và giá trị `WEB_ORIGIN` production chưa được xác nhận trong repository.

## 7. Booking, thanh toán và đối soát

- Production dùng `PAYMENT_PROVIDER=payos`; nhập ba credential PayOS qua secret manager, không đưa chúng vào `VITE_*` hoặc repository.
- Đặt `PAYOS_RETURN_URL` và `PAYOS_CANCEL_URL` tới web production (lần lượt `/payment/return` và `/payment/cancel`), và đặt `PAYOS_WEBHOOK_URL` là `https://<api-domain>/webhooks/payos`; đăng ký URL webhook chính xác trong PayOS. Chỉ webhook hợp lệ mới xác nhận thanh toán; URL return/cancel của trình duyệt không phải bằng chứng đã trả tiền.
- PayOS thu tiền cọc về một tài khoản nền tảng. MVP chưa hỗ trợ split settlement; studio tự đối soát/chuyển tiền thủ công.
- `EXPIRY_JOB_INTERVAL_SECONDS` mặc định 60 giây. Worker dùng advisory lock; cleanup theo yêu cầu vẫn chạy trước thao tác đặt chỗ và trước khi trả chỗ còn trống.
- Mock checkout và nút xác nhận mô phỏng chỉ hoạt động khi API không ở production và `PAYMENT_PROVIDER=mock`.
- Hủy booking đã thu tiền chuyển sang `refund_needed`; studio cần xử lý hoàn thủ công. Không có API hoàn tiền tự động.
