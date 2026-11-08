# Tối ưu server và hạ tầng

> **LƯU TRỮ — không dùng làm chính sách hoặc trạng thái hiện hành.** Giữ nguyên nội dung như bằng chứng/bản nháp lịch sử. Quy tắc hiện hành, phạm vi đã có và việc còn thiếu được dẫn từ [mục lục tài liệu](../../README.md).

## Đã thực hiện

- `GET /me/studios` và danh sách studio admin trước đây gọi tối đa hai truy vấn ảnh cho từng studio: một truy vấn ảnh hồ sơ và một truy vấn QR. Nay gom ID ảnh của cả danh sách, bỏ ID trùng và đọc metadata trong một truy vấn; danh sách không có ảnh không truy vấn bảng `images`. Vẫn giữ thứ tự ảnh của từng studio và cùng cấu trúc response. Xem `apps/api/src/modules/studios/studios.service.ts` và `apps/api/src/modules/admin/admin.service.ts`.
- Thêm `Cache-Control: public, max-age=31536000, immutable` cho `/assets/*` đã fingerprint bởi Vite. URL asset đổi theo nội dung build nên có thể lưu lâu trên trình duyệt/CDN. Không áp cache dài cho JSON riêng tư hay ảnh có URL có thể bị ghi đè. Xem `apps/web/vercel.json`.
- Không thêm cache server cho catalog, slot, hay response featured trong bước này. Các endpoint này có trạng thái duyệt, nội dung thay đổi và chỗ còn trống phụ thuộc booking/hold; cache thiếu invalidation chính xác có thể hiển thị sai hoặc trễ. `GET /home/featured` đang cố ý `no-store`.
- Không thêm index mới: trước đó đã thấy các index phục vụ booking/session/studio; dữ liệu đo được rất nhỏ và câu SQL mẫu chạy khoảng 1 ms. Cần EXPLAIN trên dữ liệu sản xuất có ý nghĩa trước khi chọn index, để tránh migration tốn ghi mà không giải quyết RTT.

## Kiểm chứng hạ tầng và giới hạn

- Repo khai báo Render web service vùng Singapore, gói `free`, health check `/health`, DB pool tối đa 5. Đây là cấu hình trong `render.yaml`, không phải kiểm tra dashboard hiện hành.
- URL DB có trong môi trường làm việc trỏ tới Supabase Tokyo (`ap-northeast-1`). Không có quyền truy cập dashboard Supabase/Render để xác nhận cấu hình production hiện tại. Đo RTT DB từ máy dev cũng không đại diện chính xác cho RTT giữa Render và Supabase.
- Đo production trước đây: health check Render đầu tiên khoảng 32,6 giây, request tiếp theo 98 ms. Đây là dấu hiệu mạnh của cold start; cấu hình free Render ngủ sau idle và cần khoảng một phút để khởi động. Cách khắc phục bền vững là chuyển API sang instance không ngủ (gói trả phí) hoặc nền tảng luôn bật. Ping định kỳ chỉ giảm khả năng ngủ, không đảm bảo uptime và có thể vi phạm/chạm giới hạn gói.
- Render đã ở Singapore theo manifest. Supabase Tokyo là vùng đang thấy từ cấu hình local; nếu production cũng Tokyo, Singapore là ứng viên gần Việt Nam và gần API hơn. Chuyển Supabase không đổi region trực tiếp: cần tạo project mới, di chuyển schema/dữ liệu/storage/secrets, kiểm thử, đổi `DATABASE_URL`/storage config rồi mới cutover. Chưa tự chuyển vì cần dashboard, downtime/cutover có kiểm soát và có thể phát sinh chi phí.
- API production đã trả Brotli trong phép đo trước; không thêm compression middleware trùng lặp. Upload ảnh đang yêu cầu cacheControl 31536000 cho object có key UUID và ảnh đã có thumbnail/medium.

## Đo lại sau bước này

- Build API và frontend để kiểm tra kiểu và cấu hình.
- So sánh lại authenticated `/me/studios` và admin list trên cùng DB/dữ liệu: kỳ vọng số truy vấn ảnh giảm từ `2 × số studio` về một truy vấn (hoặc 0 nếu không có ảnh). Thời gian thực tế phụ thuộc số studio/ảnh và RTT.
- Sau deploy Vercel, kiểm tra response asset có `Cache-Control: public, max-age=31536000, immutable`, URL JS/CSS có hash, HTML vẫn revalidate.
- Chưa thay đo production cold-start hay đo Lighthouse trong bước này; các số đo guest trước đó không đại diện cho admin/studio đã đăng nhập.
