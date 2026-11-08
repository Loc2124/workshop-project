# Hai bậc tin cậy của studio

> **LƯU TRỮ — không dùng làm chính sách hoặc trạng thái hiện hành.** Giữ nguyên nội dung như bằng chứng/bản nháp lịch sử. Quy tắc hiện hành, phạm vi đã có và việc còn thiếu được dẫn từ [mục lục tài liệu](../../README.md).

Trạng thái: đã triển khai bậc tin cậy, hồ sơ bậc 1 có điện thoại/email/3–8 ảnh thật, cấp/thu hồi xác minh và cấu hình tỷ lệ cọc theo workshop. Chỉ bậc 2 được cấu hình cọc, chủ studio chọn 0–30%, mặc định 20% với workshop mới đủ điều kiện. Luồng thu tiền, ưu tiên xếp hạng và tiếp nhận giấy tờ định danh trực tuyến chưa triển khai. Xem `docs/features/studio-images.md` cho thiết kế ảnh, điều kiện hồ sơ và cách vận hành.

## Bậc 1 — Đã duyệt

Hệ thống dùng trạng thái hồ sơ `approved` hiện có cho bậc 1. Admin kiểm tra thủ công trước khi công khai. Được duyệt không đồng nghĩa với đã xác minh danh tính. Hồ sơ chưa duyệt/bị từ chối có `trustLevel=unapproved` và không hiển thị huy hiệu công khai.

Hồ sơ bắt buộc có tên studio, địa chỉ thực tế, cả số điện thoại và email liên hệ, ít nhất 3 ảnh thật (tối đa 8). Facebook/Instagram/Google Maps là tùy chọn. Chủ studio tải file; ảnh đầu tiên được chọn làm ảnh bìa. Admin xem thông tin và ảnh trước khi duyệt. Hệ thống kiểm tra định dạng, quyền sở hữu và số lượng; tính xác thực của không gian vẫn do admin kiểm tra thủ công. Hồ sơ cũ thiếu dữ liệu cần bổ sung rồi xét duyệt lại, không tự cấp huy hiệu từ trạng thái cũ.

## Bậc 2 — Đã xác minh

Đối chiếu trực tiếp danh tính người đại diện cùng địa chỉ thực tế (`identity_address`), hoặc giấy đăng ký hộ kinh doanh/doanh nghiệp (`business_registration`). Admin chọn căn cứ, xác nhận đã đối chiếu đúng studio và cấp huy hiệu; studio không tự cấp trạng thái này. Có thể bổ sung cuộc gọi video xem studio theo quy trình vận hành sau này. Chỉ studio đã duyệt mới được cấp bậc 2.

Giấy tờ định danh phải có cơ chế tiếp nhận và truy cập riêng, không lưu vào mô tả, ảnh công khai hoặc đường dẫn hồ sơ công khai. Cần xác định cách lưu trữ, quyền truy cập, thời hạn giữ và xóa trước khi mở tính năng tiếp nhận giấy tờ.

Hiện có huy hiệu “Bậc 2 · Đã xác minh” trên thẻ studio, trang studio và khu vực quản lý. Khách có thể mở phần giải thích phạm vi xác minh; huy hiệu không bảo đảm chất lượng mọi trải nghiệm. Bậc 2 được cấu hình cọc 0–30% theo workshop (mặc định 20%); các bậc khác có tỷ lệ có hiệu lực 0%. Ưu tiên xếp hạng chưa triển khai.

## Luồng đã triển khai

- Admin mở `/quan-tri/duyet`, lọc “Đã duyệt”, chọn căn cứ và xác nhận đã hoàn tất đối chiếu rồi cấp xác minh. Không nhận file, số CCCD, số giấy phép hoặc đường dẫn giấy tờ qua API này.
- API `PATCH /admin/studios/:id/verification` chỉ dành cho admin. Cấp: `{ verified: true, method: "identity_address" | "business_registration", confirmed: true }`; thu hồi: `{ verified: false, reason: "..." }` với lý do 1–500 ký tự. Body có trường thừa bị từ chối.
- Migration `013_studio_trust.sql` thêm `verified_at`, `verified_by` và bảng riêng `studio_verification_history` có RLS không policy. Ghi thời điểm, người xử lý, hành động, căn cứ hoặc lý do thu hồi; không lưu giấy tờ. API khóa dòng studio, cập nhật và ghi lịch sử trong cùng transaction; yêu cầu lặp/race trả 409 thay vì ghi trùng.
- Thu hồi đưa studio về bậc 1 và cần lý do. Nếu admin đổi hồ sơ sang pending/rejected, xác minh được thu hồi đồng thời và ghi lịch sử. Duyệt lại chỉ khôi phục bậc 1, không tự khôi phục bậc 2. Database từ chối trường hợp studio không được duyệt nhưng vẫn có metadata xác minh.
- DTO công khai chỉ trả `trustLevel` (`approved|verified`). Chủ studio xem được bậc hiện tại qua `/me/studios`; chỉ admin xem lịch sử cùng người xử lý/căn cứ/lý do qua `/admin/studios`. Không công khai metadata người xác minh.
- Phía web làm mới danh sách quản lý và catalog sau thao tác để cập nhật huy hiệu. Chế độ demo không tự gắn huy hiệu khi dữ liệu mẫu không có bậc tin cậy.

## Những quyết định còn mở

- Đã chốt: bậc 1 thanh toán tại studio, không nhận cọc. Bậc 2 cho chủ studio chỉnh tỷ lệ theo workshop trong khoảng 0–30%, mặc định 20% cho workshop mới.
- Điều kiện người đặt được miễn cọc.
- Cách xử lý đặt chỗ hiện có khi trạng thái duyệt/xác minh thay đổi (hiện chỉ thay huy hiệu/trạng thái công khai, chưa có nghiệp vụ sửa/hủy booking tự động).

Tiền cọc đi thẳng vào QR của studio theo định hướng sản phẩm. Hiện có `depositPercent` và kiểm tra giới hạn/quyền tại API quản lý workshop cùng database, nhưng chưa có luồng thu cọc thực tế. Khi làm đặt chỗ/thanh toán phải kiểm tra lại điều kiện và số tiền ở server, không chỉ dựa vào cấu hình/form nghệ nhân.

Luồng đăng ký studio hiện có được giữ nguyên. Tài liệu này không phải chính sách thanh toán đã có hiệu lực.
