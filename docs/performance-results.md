# Đo lại hiệu năng

Đo ngày 2026-11-05. Mọi thời gian là một lần chạy, không phải p75/p95. Không có Lighthouse baseline trước tối ưu, nên không so điểm Lighthouse sau với baseline khác môi trường.

## So sánh client trước/sau

Đây là production build với API fixture, cùng harness điều hướng, fixture có độ trễ 250 ms. JS là số byte script trình duyệt nhận trong lượt tải đầu; LCP là một quan sát duy nhất, chưa có độ lặp để dùng làm SLA.

| Khu vực | API tải đầu | API trang kế | API quay lại | Quay lại, 2 frame | JS tải đầu | LCP quan sát |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Khách trước → sau | 9 → 6 | 2 → 1 | 1 → 0 | 12 ms | 252,762 → 242,485 B | 744 → 944 ms |
| Admin trước → sau | 4 → 4 | 2 → 2 | 0 → 0 | 56 ms | 350,167 → 359,234 B | 892 → 1,352 ms |
| Studio trước → sau | 6 → 6 | 1 → 1 | 0 → 0 | 16 ms | 243,845 → 252,125 B | 1,100 → 1,940 ms |

Điểm chắc chắn nhất là API bị gọi lại khi quay về trang đã xem giảm về 0 ở cả ba khu vực. Hover prefetch đã gọi sẵn list/count của admin và dữ liệu trang studio; khi mở trang tương ứng không phát sinh API thêm. Kết quả chi tiết ở `output/performance/client-before/checks.json` và `client-after/checks.json` (artifact local, không commit).

Bundle toàn app: JS tải đầu giảm **668.1 → 555.8 kB raw** và **206.0 → 169.4 kB gzip**. Tổng các chunk cộng worker tăng nhẹ **603.2 → 621.6 kB gzip** do chia thêm chunk và prefetch. Trong harness, admin và studio nhận thêm ít byte JS ban đầu; cần kiểm tra lại trên browser cache thật sau deploy.

## Lighthouse trên build local

Lighthouse mobile chạy với fixture API cô lập, không có dữ liệu thật. Các request API đều nhận fixture hợp lệ; 401 ở `/me` và `/auth/refresh` của khách là trạng thái chưa đăng nhập có chủ đích.

| Khu vực | Request tổng | API | JS | Ảnh | Điểm | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Khách | 45 | 6 | 179 kB | 33 kB | 66 | 926 ms | 4,451 ms | 684 ms | 0.000 |
| Admin | 55 | 4 | 282 kB | 0 kB | 76 | 927 ms | 5,031 ms | 275 ms | 0.000 |
| Studio | 53 | 6 | 191 kB | 0 kB | 85 | 923 ms | 4,219 ms | 111 ms | 0.008 |

FCP dưới 1 giây trong Lighthouse; LCP còn 4.2–5.0 giây, chưa đạt mục tiêu 2 giây nếu lấy LCP làm tiêu chí. Admin Lighthouse xác định đoạn mô tả biểu đồ trong vùng trang dưới fold là LCP; dữ liệu fixture rỗng và một lần chạy khiến các điểm số này không đại diện cho tài khoản/dữ liệu thật. Đây là dấu hiệu cần đo nhiều lần với nội dung thật sau deploy, không phải căn cứ để tuyên bố đạt SLA.

## Production hiện đang deploy

Lighthouse mobile guest trên `workshop-project-beta.vercel.app` đo được: điểm **87**, FCP **988 ms**, LCP **2,949 ms**, TBT **334 ms**, CLS **0.004**, JS **190 kB**, ảnh **194 kB**. Đây là deployment hiện tại, chưa chứa thay đổi client/server trong workspace. Không có tài khoản admin/studio production để đo an toàn.

Header HTML và JS hash public hiện đều là `Cache-Control: public, max-age=0, must-revalidate`; JS được Vercel CDN trả `HIT`. Rule immutable mới trong `apps/web/vercel.json` chưa có hiệu lực production vì chưa deploy. Chưa đo API cold start lần nữa: manifest vẫn là Render Free và không có thay đổi hạ tầng/deploy ở bước này; lần đo trước health đầu tiên 32.6 giây, lượt kế 98 ms.

## Đánh giá server và việc cần đo sau deploy

- Thay đổi gộp truy vấn ảnh studio đã build/ESLint pass, nhưng endpoint `/me/studios` và admin studio list chưa được đo query count trên tài khoản/dữ liệu thật. Kỳ vọng metadata ảnh giảm từ tối đa `2 × số studio` truy vấn xuống 1 truy vấn cho danh sách (hoặc 0 nếu danh sách không có ảnh).
- Không xác nhận được dashboard vùng production DB. Repo chỉ cho biết Render Singapore/Free và URL DB môi trường làm việc trỏ Tokyo.
- Sau deploy: đo guest/admin/studio trên cùng thiết bị/mạng và dữ liệu; chạy mỗi route ít nhất 5 lần, báo median/p75; ghi request count, FCP/LCP, JS/ảnh chuyển tải, API p50/p95; xác nhận `/assets/*` trả immutable, kiểm tra API cold start và query count/EXPLAIN của `/me/studios`.
- Chưa deploy hay đổi gói/vùng, nên các phép đo production ở trên phản ánh bản live trước tối ưu. Bản build tạm dùng fixture API đã được build lại về cấu hình `.env` hiện tại sau khi đo.
