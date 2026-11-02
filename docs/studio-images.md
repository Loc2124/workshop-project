# Ảnh studio, hồ sơ bậc 1 và mức cọc

## Cấu hình Supabase Storage

Thêm vào `.env` của API (không dùng `VITE_*`, không commit khóa):

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
STUDIO_IMAGE_BUCKET=studio-images
```

Theo lựa chọn hiện tại của dự án, ưu tiên `SUPABASE_SERVICE_ROLE_KEY`; backend gửi key qua `apikey` và JWT Bearer. Nếu không cấu hình service_role, vẫn hỗ trợ `SUPABASE_SECRET_KEY` mới qua `apikey` (không JWT Bearer). Không cần publishable key hoặc JWKS URL cho luồng ảnh này vì ứng dụng tự xác thực tài khoản, còn frontend chỉ nhận signed upload URL.

Chạy `npm run storage:setup` để tạo/cập nhật bucket `studio-images`: public, chỉ `image/webp`, tối đa 1 MB/file. Script không tạo policy ghi/xóa cho anon. Kiểm tra trong Dashboard rằng bucket này không bị ảnh hưởng bởi policy INSERT/UPDATE/DELETE rộng cho `anon`/`public` đã có từ trước. Ảnh studio là nội dung công khai; giấy tờ định danh không được đưa vào bucket này. Mỗi môi trường dùng cấu hình project riêng; test tự động dùng storage giả lập, không dùng service role của dev để tải dữ liệu test.

URL đọc được ghép ở backend: `${SUPABASE_URL}/storage/v1/object/public/studio-images/${key}`. Bảng `images` chỉ giữ key, phạm vi studio/workshop, người tải, kích thước và trạng thái; không lưu URL công khai cố định. Ảnh công khai đi thẳng tới CDN, không ký URL đọc và không phụ thuộc image transformation trả phí.

## Luồng tải

1. Khách phải đăng nhập từ nút bắt đầu trên trang nghệ nhân; đăng nhập/tạo tài khoản giữ redirect về `/dang-ky-studio`. Đi thẳng vào form khi chưa đăng nhập cũng được chuyển đến đăng nhập.
2. Lần chọn ảnh đầu tiên, web gọi `POST /studios/drafts` để tạo studio nháp và membership owner. Hồ sơ nháp không hiện trong danh sách quản lý thông thường, hàng chờ admin hoặc catalog; ID được lưu trong bản nháp theo tài khoản.
3. Trình duyệt nhận JPG/PNG/WebP tối đa 10 MB, dùng Canvas chuyển WebP và resize cạnh dài tối đa 1600px, nén xuống dưới 1 MB. Không thêm SDK Supabase vào trình duyệt và không gửi file qua Express.
4. Web gọi `POST /images/upload-url` với `{ studioId, workshopId?, byteSize }`. API kiểm tra owner và đúng cặp workshop/studio, tạo key `studios/{studioId}/{workshopId|profile}/{uuid}.webp`, ghi reservation trạng thái pending rồi xin signed upload URL có `upsert=false` bằng service role ở backend.
5. Frontend PUT file trực tiếp tới signed upload URL, hiển thị tiến độ upload thật qua XHR. API chỉ trả URL/token giới hạn ở object đó; không trả service role key.
6. Frontend gọi `POST /images/:id/complete`. Backend kiểm tra owner, trạng thái và hạn reservation, đọc file từ Storage để đối chiếu MIME, bytes, chữ ký WebP và kích thước. Chỉ ảnh ready mới được tính vào hồ sơ. `GET /images?studioId=...` trả ảnh của owner để khôi phục xem trước sau refresh.
7. Form chọn 3–8 ảnh. Ảnh đầu trong `photoIds` là ảnh bìa; chọn ảnh bìa thay đổi thứ tự này. `POST /studios` gửi `draftStudioId` và các trường hồ sơ, bắt buộc số điện thoại, email và các ID ảnh ready thuộc đúng draft studio. API hoàn tất draft trong transaction.

Danh sách tỉnh/thành trong form lấy từ `packages/shared/src/provinces.ts`, không gọi API; các ID khớp migration địa lý hiện có. Thanh bước có số, vạch nối, dấu tick. Nút xem lại bị khóa khi hồ sơ chưa hợp lệ và luôn có dòng “Còn thiếu” tương ứng. Form giữ draft sau refresh; không lưu token upload hoặc file gốc vào sessionStorage.

## Xóa và dọn ảnh

`DELETE /images/:id` chỉ cho owner. Ảnh đang thuộc hồ sơ đã gửi không được xóa ngay: chủ studio gửi bộ ảnh thay thế qua `PATCH /studios/:studioId/evidence`, rồi web yêu cầu xóa các ảnh cũ không còn dùng. Lưu hồ sơ mới đưa studio về pending, xóa xác minh hiện tại và ghi lý do thu hồi.

Backend khóa studio trước khi kiểm tra ảnh đang dùng, ghi trạng thái deleting, gọi Storage remove theo key chính xác, rồi ghi deleted. Nếu xóa Storage thất bại, record được giữ để thử lại, không mất dấu file. Record deleted được giữ qua thời hạn signed upload (2 giờ) để dọn lại nếu token cũ bị dùng sau lần xóa đầu.

Chạy `npm run images:cleanup` định kỳ, ví dụ mỗi giờ từ tác vụ vận hành. Mỗi lượt tối đa 100 ảnh: dọn pending/deleted đã hết hạn, thử lại deleting, và ảnh profile ready không còn được tham chiếu sau 7 ngày. Chỉ xóa record hết hạn sau khi Storage remove thành công. Chạy lại nếu vẫn còn backlog. Chưa cài lịch cron tự động trên hosting.

## Điều kiện duyệt và cọc

Migration `014_studio_evidence_and_deposits.sql` bổ sung hồ sơ liên hệ, ảnh, draft và tỷ lệ cọc workshop. Hồ sơ cũ chưa đủ liên hệ/3 ảnh vẫn giữ dữ liệu nhưng bị ẩn khỏi catalog cho đến khi chủ studio bổ sung và admin duyệt; không giả định ảnh mẫu là minh chứng thật. Admin chỉ duyệt bậc 1 khi hồ sơ đầy đủ. Facebook, Instagram, Google Maps không bắt buộc; nếu nhập phải là URL HTTPS đúng dịch vụ. Thông tin liên hệ là thông tin kinh doanh công khai riêng, không tự lấy email tài khoản để điền thay.

Chỉ bậc 2 và hồ sơ đầy đủ mới có `canCollectDeposit=true`. Chủ studio chọn tỷ lệ theo workshop, số nguyên 0–30%; workshop mới mặc định 20% nếu đủ điều kiện, ngược lại 0%. 0% nghĩa là thanh toán toàn bộ tại studio. Staff không được chỉnh giá/cọc; API và database cùng chặn tỷ lệ ngoài giới hạn và cấu hình cọc mới khi không đủ điều kiện. Thao tác thay tỷ lệ khóa studio trong transaction để không đua với thu hồi xác minh.

Khi mất điều kiện nhận cọc, tỷ lệ có hiệu lực (`effectiveDepositPercent`) về 0 ngay; tỷ lệ cấu hình cũ được giữ riêng trong DTO quản lý. DTO công khai chỉ trả tỷ lệ có hiệu lực. Cập nhật hồ sơ/xác minh làm mới cache quản lý và catalog. Đây là cấu hình và kiểm soát quyền cho bước booking/payment tiếp theo, chưa có luồng nhận tiền cọc thực tế. Khi làm booking phải tính tiền từ giá buổi trên server, snapshot tỷ lệ của đơn và kiểm tra lại điều kiện trong transaction; không tin tỷ lệ/tổng tiền từ client.
