# Checklist trước phát hành

Đồng bộ 07/11/2026. Các ô dưới đây là tiêu chí cần kiểm chứng, **không phải xác nhận đã đạt**. [Mục lục](../README.md) · [Trạng thái mã](../project/current-status.md).

## Nghiệp vụ và tiền

- [ ] Áp dụng chín quyết định và ba điểm làm rõ đã chốt; xác minh phần vận hành còn mở, bản hướng khách/studio khớp khả năng thật.
- [ ] Qua toàn bộ nhánh A–J trong bảng chuyển trạng thái, ghi rõ nhánh chưa làm/chưa chạy.
- [ ] Không vượt sức chứa, không phát vé/nhả chỗ/thu/hoàn/chi trả hai lần khi gửi lặp hoặc đồng thời.
- [ ] Hủy từ khách, studio và quản trị đồng bộ số tiền/chỗ/vé/thông báo; phân biệt khoản cần hoàn với đã hoàn.
- [ ] Kiểm chứng thu tiền sau điểm danh, hủy một phần, đổi giờ nhiều lần và không phản hồi.
- [ ] Mọi lệnh chuyển quản trị duyệt, theo hạn đến trước; 3 ngày làm việc chi trả/7 ngày làm việc hoàn từ hủy; studio chịu phí thực tế, không phụ phí. Có tạm ứng/thu hồi và đối soát, không coi ghi nhận thủ công là tự động.
- [ ] Xác nhận môi trường thanh toán/email, hành vi tài khoản ảo và nguồn chi; có quy trình sự cố/thử lại an toàn.

## Kỹ thuật và dữ liệu

- [ ] Migration đã áp đúng môi trường, kiểm tra checksum/RLS, không sửa SQL đã chạy; hiện có 44 file migration; migration đến 043 đã áp ở DB test và DB ứng dụng cấu hình, vẫn phải xác minh riêng môi trường phát hành.
- [ ] DB kiểm tra độc lập, qua guard ALLOW_DESTRUCTIVE_TESTS; không chạy reset/test trên dữ liệu dev/demo.
- [ ] TypeScript/build/lint, kiểm tra đơn vị/tích hợp/đồng thời và luồng trình duyệt có bằng chứng mới.
- [ ] Bước 4.2 đã qua 243 ca web/50 file; hồi quy 70/70 gồm 39 khách, 2 quản trị và 29 đơn vị; hủy từng chỗ 15/15, sau đó 2/2 ca tiền lẻ/mức tối thiểu ở lượt lọc (15 bỏ qua). Không coi đây là bằng chứng chi hộ, tiền/email thật hoặc toàn bộ bộ kiểm tra API đã đạt.
- [ ] Ảnh thật, địa chỉ/liên hệ đầy đủ, nội dung bao gồm đúng; dữ liệu mô phỏng không xuất hiện công khai.
- [ ] Chính sách tiền theo snapshot; lịch/địa điểm và phiên bản đồng ý được giữ lịch sử.

## Môi trường và vận hành

- [ ] URL HTTPS, SPA fallback, cookie/CORS/credentials, secret và quyền lưu trữ đã kiểm chứng.
- [ ] Worker nhắc/hết hạn chạy lại an toàn khi host ngủ hoặc khởi động lại; có giám sát lỗi/hàng đợi.
- [ ] Kiểm tra mobile/keyboard/modal và giờ Việt Nam; đồng hồ không bắt đầu lại khi tải trang.
- [ ] Sao lưu/phục hồi, nhật ký và người trực xử lý tiền chưa đối soát, khoản hoàn quá hạn, số chỗ lệch.

Checklist/audit dài cũ là [bằng chứng lưu trữ](../archive/audits/production-readiness-checklist.md), không dùng lại trạng thái đạt của lần đo cũ.

Bước 3 bổ sung phiên bản/hạn phản hồi đổi giờ, hủy Hold cũ và ghi khoản hoàn khi hết hạn. Migration 039 đã áp DB test và DB ứng dụng cấu hình. Cần xác minh worker luôn chạy, kênh email thật, phiên bản API/web tương thích và tồn đọng đổi giờ trước khi phát hành. Bản cũ không gửi scheduleVersion sẽ bị từ chối an toàn, không tự chấp nhận giờ mới. Không coi ghi khoản hoàn là bằng chứng tiền đã chuyển.

Bước 4.1 có điểm danh từng vé/khóa sửa khi có khoản hoàn và biên nhận hoàn nhiều đợt. Migration 040 đã áp ở DB test và DB ứng dụng cấu hình. Cần kiểm chứng lại quyền admin/studio, backfill điểm danh cũ, phiên bản API/web tương thích và quy trình xử lý sửa nhầm. Không có chuyển tiền tự động ở 4.1. Bước 4.2 đã thêm hủy từng chỗ/thay mã cọc, kiểm tra 15 ca tích hợp đạt; vẫn cần kiểm chứng tạo/tra cứu/hủy mã và giao dịch đến cả mã cũ/mới tại cổng thật.

## Xác nhận sẽ đến (4.3)

- [ ] EMAIL_DELIVERY_URL/TOKEN cấu hình đúng; 2xx chỉ khi dịch vụ gửi thư đã chấp nhận, Idempotency-Key được tôn trọng; kiểm chứng bằng thư thật và lỗi gửi.
- [ ] Nhả chỉ với email đúng phiên bản lịch đã sent ít nhất 2 giờ; thông báo trong tài khoản không đủ; không nhả khi không còn đủ 2 giờ trước buổi.
- [ ] Gửi lỗi/hết 5 lượt thử phải được vận hành theo dõi; không sửa thủ công sent_at để ép nhả và không suy email cũ thành bằng chứng.
- [ ] Migration 043 đã áp đúng đích, không sửa các migration đã chạy; phát hành API/web tương thích trường attendanceConfirmationDeadline.
