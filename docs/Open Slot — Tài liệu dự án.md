# Open Slot — Tài liệu dự án

Nền tảng khám phá và đặt chỗ workshop thủ công trên toàn Việt Nam · Phiên bản 1.0 (bản nháp) · 28/10/2026 · Stack giao diện: React + Tailwind CSS

## 1. Tổng quan

### 1.1 Mục tiêu

Open Slot giúp người dùng tìm và đặt chỗ các workshop thủ công (gốm, nến thơm, màu nước, đất sét...) tại các xưởng chế tác. Sản phẩm phục vụ hai nhóm: người chưa biết mình muốn làm gì (đi cùng người yêu, làm quà, thư giãn) và người đã biết rõ loại hình muốn học.

### 1.2 Giá trị cốt lõi

- Tìm nhanh xưởng và workshop còn chỗ theo thời gian, khu vực, ngân sách.
- Gợi ý theo mô tả tự nhiên qua ô “Mong muốn của bạn hôm nay?”.
- Giữ chỗ trực tiếp với nghệ nhân.
- Xưởng có công cụ riêng để quản lý workshop, lịch và lượt đặt.

### 1.3 Phạm vi

**Trong phạm vi bản đầu (MVP):** trang khám phá với hai chế độ xem Xưởng và Workshop; bộ lọc; trang chi tiết xưởng và workshop; đăng ký, đăng nhập; đặt chỗ và hủy chỗ; cổng quản lý cho chủ xưởng; trang quản trị duyệt xưởng; đánh giá sau khi tham gia; phạm vi toàn quốc theo tỉnh/thành phố (mục 5.2 và 7.3), ra mắt lần lượt từng thành phố.

**Ngoài phạm vi bản đầu:** ứng dụng di động native, chat trực tiếp, mã giảm giá, chương trình thành viên, đa ngôn ngữ, mở rộng ra ngoài Việt Nam. Open Slot không giữ hay chuyển tiền; thanh toán xử lý theo mục 4.6.

### 1.4 Thuật ngữ

| Thuật ngữ      | Ý nghĩa                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| Xưởng (Studio) | Một địa điểm do nghệ nhân hoặc đơn vị vận hành, chứa nhiều workshop        |
| Workshop       | Một nội dung trải nghiệm cụ thể (ví dụ: Nặn gốm bàn xoay), thuộc một xưởng |
| Session        | Một buổi diễn ra của workshop: ngày, giờ, sức chứa                         |
| Booking        | Một lượt đặt chỗ của khách vào một session                                 |

## 2. Người dùng và vai trò

| Vai trò         | Mô tả                        | Nhu cầu chính                                                 |
| --------------- | ---------------------------- | ------------------------------------------------------------- |
| Khách vãng lai  | Chưa đăng nhập               | Xem xưởng, workshop, lịch còn chỗ                             |
| Khách hàng      | Đã đăng nhập                 | Đặt, hủy chỗ, xem lịch sử, viết đánh giá                      |
| Nhân viên xưởng | Thành viên của một xưởng     | Vận hành workshop, session, xử lý booking                     |
| Chủ xưởng       | Quản lý một hoặc nhiều xưởng | Toàn quyền trong xưởng, quản lý nhân sự, giá, thông tin xưởng |
| Admin Open Slot | Đội vận hành nền tảng        | Duyệt xưởng, kiểm duyệt nội dung, xử lý khiếu nại             |

Vai trò hệ thống (customer, admin) tách khỏi vai trò trong xưởng (owner, staff). Một người dùng có thể vừa là khách vừa là chủ xưởng.

## 3. Yêu cầu chức năng

Ưu tiên: P0 = bắt buộc cho MVP, P1 = nên có sớm sau MVP, P2 = để sau.

### 3.1 Khám phá và tìm kiếm

| Mã    | Chức năng                                                                               | Ưu tiên |
| ----- | --------------------------------------------------------------------------------------- | ------- |
| FR-01 | Trang khám phá có toggle Xưởng / Workshop, dùng chung bộ lọc                            | P0      |
| FR-02 | Lọc theo Thời gian, Tỉnh/Thành phố (kèm Khu vực khi có), Giá (3-4 mức có sẵn)           | P0      |
| FR-03 | Hàng chip loại workshop (gốm, nến thơm, màu nước...) phía trên lưới                     | P0      |
| FR-04 | Chip hiển thị bộ lọc đang áp dụng, xóa từng bộ lọc hoặc xóa tất cả                      | P0      |
| FR-05 | Sắp xếp: Xưởng theo phù hợp, rating, khoảng cách; Workshop theo giá, thời gian gần nhất | P0      |
| FR-06 | Hiển thị số kết quả theo chế độ (“12 xưởng” / “47 workshop”)                            | P0      |
| FR-07 | Bộ lọc lưu trên URL để chia sẻ link và dùng nút Back                                    | P0      |
| FR-08 | Ô gợi ý theo mô tả tự nhiên, kết quả là workshop kèm tên xưởng                          | P1      |
| FR-09 | Lưu workshop yêu thích (nút bookmark trên card)                                         | P1      |
| FR-10 | Tìm theo từ khóa tên xưởng, workshop                                                    | P1      |

### 3.2 Trang chi tiết

| Mã    | Chức năng                                                                         | Ưu tiên |
| ----- | --------------------------------------------------------------------------------- | ------- |
| FR-11 | Trang xưởng: ảnh, mô tả, nghệ nhân, địa chỉ, bản đồ, danh sách workshop, đánh giá | P0      |
| FR-12 | Trang xưởng có bộ lọc nhỏ theo loại và ngày                                       | P0      |
| FR-13 | Trang workshop: ảnh, mô tả, thời lượng, trình độ, giá, danh sách session còn chỗ  | P0      |
| FR-14 | Hiển thị số chỗ còn trống của từng session                                        | P0      |

### 3.3 Tài khoản và đặt chỗ

| Mã    | Chức năng                                                                                                                    | Ưu tiên |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| FR-15 | Đăng ký, đăng nhập bằng email hoặc số điện thoại                                                                             | P0      |
| FR-16 | Đặt chỗ: chọn session, số người, xác nhận thông tin                                                                          | P0      |
| FR-17 | Xem, hủy booking của mình theo chính sách hủy                                                                                | P0      |
| FR-18 | Thông báo email/SMS khi đặt, xác nhận, hủy, nhắc lịch                                                                        | P1      |
| FR-19 | Đăng nhập bằng Google                                                                                                        | P1      |
| FR-31 | Khi đặt chỗ, khách chọn trả tại xưởng hoặc thanh toán trước (chuyển thẳng vào tài khoản của xưởng)                           | P0      |
| FR-32 | Xưởng cấu hình hình thức nhận tiền (tài khoản ngân hàng hoặc mã QR) và chính sách hủy; hiển thị cho khách trước khi xác nhận | P0      |
| FR-33 | Xưởng xác nhận đã nhận tiền cho booking thanh toán trước, hoặc đã thu tiền khi check-in                                      | P0      |
| FR-34 | Tự đối soát thanh toán qua cổng thanh toán, hỗ trợ đặt cọc                                                                   | P1      |
| FR-35 | Xác minh xưởng hai bậc: “Đã duyệt” (bắt buộc) và “Đã xác minh” (giấy tờ, tùy chọn) kèm nhãn tin cậy                          | P1      |

### 3.4 Quản lý xưởng

| Mã    | Chức năng                                                               | Ưu tiên |
| ----- | ----------------------------------------------------------------------- | ------- |
| FR-20 | Đăng ký xưởng, gửi chờ duyệt                                            | P0      |
| FR-21 | Tạo, sửa, ẩn workshop                                                   | P0      |
| FR-22 | Tạo, sửa, hủy session; đặt sức chứa                                     | P0      |
| FR-23 | Danh sách booking của xưởng; xác nhận, từ chối, check-in, đánh dấu vắng | P0      |
| FR-24 | Quản lý thành viên (thêm, xóa nhân viên)                                | P1      |
| FR-25 | Trả lời đánh giá                                                        | P1      |
| FR-26 | Thống kê cơ bản: lượt đặt, tỉ lệ lấp đầy                                | P2      |

### 3.5 Đánh giá và quản trị

| Mã    | Chức năng                                                         | Ưu tiên |
| ----- | ----------------------------------------------------------------- | ------- |
| FR-27 | Viết đánh giá khi booking đã hoàn thành, mỗi booking một đánh giá | P0      |
| FR-28 | Admin duyệt hoặc từ chối xưởng đăng ký                            | P0      |
| FR-29 | Admin ẩn nội dung, đánh giá vi phạm                               | P1      |
| FR-30 | Admin xem và xử lý khiếu nại                                      | P2      |

## 4. Luồng nghiệp vụ chính

### 4.1 Khách tìm và đặt chỗ

1. Khách vào trang khám phá, chọn chế độ Xưởng hoặc Workshop, áp dụng bộ lọc.
2. Bấm vào card để mở trang xưởng hoặc workshop.
3. Chọn session còn chỗ và số người.
4. Nếu chưa đăng nhập, hệ thống yêu cầu đăng nhập rồi quay lại đúng bước đang làm.
5. Xác nhận thông tin; hệ thống giữ chỗ trong một giao dịch.
6. Booking ở trạng thái “chờ xác nhận”. Xưởng xác nhận trong hạn quy định (xem mục 13) thì chuyển “đã xác nhận”; quá hạn thì xử lý theo quy tắc đã chọn.
7. Khách nhận thông báo kết quả.

### 4.2 Xưởng tạo workshop và session

1. Xưởng tạo workshop (nháp), nhập mô tả, ảnh, giá, thời lượng, trình độ.
2. Đặt trạng thái “đang hiển thị”.
3. Thêm session: thời gian bắt đầu và sức chứa.
4. Khi có booking, xưởng xử lý theo luồng 4.1.

### 4.3 Đăng ký và duyệt xưởng

1. Người dùng đăng ký xưởng; trạng thái “chờ duyệt”.
2. Admin kiểm tra thông tin, ảnh, địa chỉ.
3. Duyệt thì xưởng “đang hoạt động” và hiển thị công khai; từ chối thì kèm lý do để chỉnh sửa và gửi lại.

### 4.4 Hủy và vắng mặt

- Khách hủy trước hạn: chỗ được trả lại session.
- Xưởng hủy session đã có booking: hệ thống hủy toàn bộ booking liên quan và thông báo cho khách.
- Khách không đến: xưởng đánh dấu “vắng mặt”.

### 4.5 Đánh giá

Sau khi booking “đã hoàn thành”, khách được mở form đánh giá (rating 1-5 và nội dung). Mỗi booking một đánh giá. Rating của xưởng là trung bình các đánh giá thuộc xưởng đó.

### 4.6 Thanh toán

Open Slot không giữ và không chuyển tiền. Mỗi xưởng bật một hoặc cả hai hình thức, khách chọn khi đặt chỗ:

- **Trả tại xưởng:** booking chỉ giữ chỗ; xưởng đánh dấu đã thu tiền khi check-in.
- **Thanh toán trước:** khách chuyển thẳng vào tài khoản ngân hàng của xưởng (mã QR hiển thị trên trang đặt chỗ). Bản đầu xưởng tự xác nhận đã nhận tiền; về sau đối soát tự động qua cổng thanh toán và hỗ trợ đặt cọc.

Trước khi khách xác nhận, trang đặt chỗ hiển thị rõ: ai nhận tiền, tổng tiền, hình thức đã chọn, chính sách hủy và cách liên hệ xưởng. Trạng thái thanh toán của booking: chưa thanh toán → đã thanh toán (xưởng xác nhận) → đã hoàn tiền (nếu hủy theo chính sách, do xưởng xử lý). Chính sách hủy và hoàn tiền do từng xưởng đặt; Open Slot chỉ hiển thị, không xử lý hoàn tiền.

## 5. Mô hình dữ liệu

### 5.1 Quan hệ

Studio có nhiều Workshop; Workshop có nhiều Session; Session có nhiều Booking; Booking có tối đa một Review. User liên kết với Studio qua bảng nối studio\_member.

### 5.2 Các bảng

| Bảng            | Trường chính                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`          | id, tên, email, số điện thoại, mật khẩu băm, vai trò hệ thống (customer / admin), ngày tạo                                                                                       |
| `studio`        | id, tên, slug, provinceId, areaId (có thể rỗng), địa chỉ theo phường/xã, tọa độ, ảnh, mô tả, tên nghệ nhân, trạng thái, bậc xác minh (đã duyệt / đã xác minh), rating trung bình |
| `studio_member` | studioId, userId, vai trò trong xưởng (owner / staff)                                                                                                                            |
| `workshop`      | id, studioId, tên, slug, loại, mô tả, ảnh, giá, thời lượng, trình độ, trạng thái                                                                                                 |
| `session`       | id, workshopId, thời gian bắt đầu, thời gian kết thúc, sức chứa, số chỗ đã đặt, trạng thái                                                                                       |
| `booking`       | id, sessionId, userId, số người, tổng tiền, hình thức thanh toán (tại xưởng / trước), trạng thái thanh toán, trạng thái, ghi chú, thời điểm tạo                                  |
| `review`        | id, bookingId, rating, nội dung, trạng thái hiển thị, phản hồi của xưởng                                                                                                         |
| `favorite`      | userId, workshopId (P1)                                                                                                                                                          |
| province        | id, mã, tên, thứ tự hiển thị (34 dòng; là dữ liệu cấu hình, địa giới đổi thì cập nhật dữ liệu, không sửa code)                                                                   |
| area            | id, provinceId, tên, thứ tự hiển thị (nhóm khu vực do Open Slot tự định nghĩa theo thói quen đi lại; tỉnh nhỏ không cần)                                                         |
| studio\_payment | studioId, bật trả tại xưởng, bật thanh toán trước, tên ngân hàng, số tài khoản, tên chủ tài khoản, ảnh mã QR, chính sách hủy (văn bản)                                           |

Tách Workshop (bán cái gì) và Session (bán khi nào) để tránh tạo lại workshop cho mỗi buổi. Số chỗ còn trống tính từ sức chứa trừ số chỗ đã đặt, nằm ở session, không nằm ở workshop.

### 5.3 Trạng thái

| Đối tượng | Chuỗi trạng thái                                                             |
| --------- | ---------------------------------------------------------------------------- |
| Studio    | nháp → chờ duyệt → đang hoạt động → tạm ẩn                                   |
| Workshop  | nháp → đang hiển thị → ẩn                                                    |
| Session   | mở → đã đầy → đã diễn ra / đã hủy                                            |
| Booking   | chờ xác nhận → đã xác nhận → đã hoàn thành; nhánh: đã hủy, từ chối, vắng mặt |

### 5.4 Cách tính hai chế độ xem

Chế độ Workshop truy vấn trực tiếp `workshop` đã lọc. Chế độ Xưởng nhóm các workshop khớp bộ lọc theo `studioId`: lấy giá thấp nhất (“từ 250k”), đếm số workshop khớp, liệt kê các loại, và tính xưởng còn chỗ khi có ít nhất một session còn chỗ trong khoảng thời gian đã chọn. Không viết logic lọc riêng cho từng chế độ.

## 6. Phân quyền

| Hành động                           | Vãng lai | Khách | Nhân viên xưởng | Chủ xưởng | Admin        |
| ----------------------------------- | -------- | ----- | --------------- | --------- | ------------ |
| Xem xưởng, workshop, session        | ✓        | ✓     | ✓               | ✓         | ✓            |
| Đặt chỗ                             |          | ✓     |                 |           | ✓ (hộ khách) |
| Xem, hủy booking của mình           |          | ✓     |                 |           | ✓            |
| Viết đánh giá                       |          | ✓     |                 |           |              |
| Xem booking của xưởng mình          |          |       | ✓               | ✓         | ✓            |
| Xác nhận, từ chối, check-in booking |          |       | ✓               | ✓         | ✓            |
| Tạo, sửa workshop và session        |          |       | ✓               | ✓         | ✓            |
| Sửa thông tin xưởng, giá            |          |       |                 | ✓         | ✓            |
| Thêm, xóa nhân viên                 |          |       |                 | ✓         | ✓            |
| Trả lời đánh giá                    |          |       | ✓               | ✓         | ✓            |
| Duyệt xưởng, ẩn nội dung vi phạm    |          |       |                 |           | ✓            |

**Nguyên tắc:**

- Kiểm tra quyền ở server. Ẩn nút trên giao diện chỉ để tiện dùng, không phải lớp bảo vệ.
- Nhân viên và chủ xưởng chỉ thao tác trên dữ liệu có studioId nằm trong `studio_member` của họ.
- Khách chỉ truy cập booking có userId của chính mình.
- Bản đầu có thể chỉ dùng 3 vai trò (khách, chủ xưởng, admin); bảng `studio_member` vẫn tạo sẵn với mỗi xưởng một thành viên là chủ.

## 7. Thiết kế giao diện

### 7.1 Cấu trúc trang khám phá

**Đường dẫn công khai:**

- `/`: trang chủ gọn với tìm kiếm theo tỉnh/thành, ngày, nhu cầu; hiển thị tối đa 8 workshop sắp tới và lời mời dành cho nghệ nhân.
- `/explore`: danh mục workshop/xưởng, bộ lọc được lưu trên query string. Người dùng từ trang chủ sang đây trong một lần bấm và giữ nguyên các tiêu chí đã nhập.
- `/xuong/:slug` và `/workshop/:slug`: trang chi tiết xưởng và workshop; slug ổn định, duy nhất. Các URL `/studios/:id` và `/workshops/:id` vẫn được API/web giữ để tương thích.

**Trang chủ:** hero có tiêu đề, nơi, ngày và mô tả nhu cầu; nút “Gợi ý cho tôi” chuyển thẳng sang `/explore`. Tiếp theo là workshop sắp tới ở nơi đã chọn (hoặc toàn quốc), nút “Xem tất cả” và một khối dành cho nghệ nhân. Không thêm các khối nội dung dài khi dữ liệu xưởng còn ít.

**Trang khám phá:**

1. Header luôn có liên kết trực tiếp “Khám phá workshop”.
2. Tiêu đề và ô tìm kiếm gọn; không lặp lại hero lớn của trang chủ.
3. Thanh điều khiển: hàng chip loại workshop; thanh lọc; toggle Xưởng | Workshop; số kết quả; sắp xếp. Số kết quả và ô sắp xếp nằm trên một hàng ngang.
4. Lưới card xuất hiện sớm.

### 7.2 Toggle Xưởng | Workshop

- Mặc định là chế độ Workshop vì trang hiển thị lịch từng buổi; chế độ Xưởng dành cho người muốn xem theo địa điểm. Chế độ lưu trên URL (?view=workshop hoặc ?view=studio).
- Bộ lọc giữ nguyên khi chuyển chế độ.
- Bấm chip loại hình thì tự chuyển sang Workshop; bấm khu vực hoặc tên xưởng thì chuyển sang Xưởng; người dùng vẫn tự đổi được.
- Không trộn hai loại card trong cùng một lưới. Hai loại card dùng chung khung (kích thước, bo góc, font) để lưới đều.

### 7.3 Bộ lọc

Chỉ giữ 3 nhóm: Thời gian, Địa điểm, Giá. Loại workshop là hàng chip ngang. Bỏ bộ lọc Trình độ và ghi nhãn “Không cần kinh nghiệm” trên card, vì phần lớn workshop trải nghiệm đều dành cho người mới.

**Địa điểm (toàn quốc):** không lọc theo quận/huyện vì cấp huyện đã bỏ từ 1/7/2025, cả nước còn 34 tỉnh, thành phố và cấp xã ([nguồn](https://thuvienphapluat.vn/hoi-dap-phap-luat/ban-do-viet-nam-moi-nhat-2026-chi-tiet-cu-the-nhu-the-nao-138072924.html)). Lọc hai tầng:

- Tỉnh/Thành phố: ô chọn có tìm kiếm, chỉ hiện nơi đang có xưởng kèm số lượng (ví dụ “Đà Nẵng (6)”). Mặc định theo vị trí người dùng, luôn đổi được.
- Khu vực (tùy chọn): hiện sau khi chọn tỉnh/thành, chỉ ở nơi đủ xưởng để cần chia nhỏ. Do Open Slot tự định nghĩa theo thói quen đi lại, chọn được nhiều khu vực cùng lúc.
- “Gần tôi” (bán kính 3/5/10km) dùng tọa độ xưởng (P1).
- Nơi chưa có xưởng hiển thị gợi ý sang thành phố gần nhất.

**Vị trí bộ lọc (đề xuất, chưa chốt):** thanh ngang sticky ngay dưới hero, thu gọn thành một hàng khi dính. Với chỉ 3 nhóm lọc, thanh ngang cho lưới dùng hết chiều rộng và không làm card 4 cột bị chật. Phương án thay thế: sidebar trái sticky rộng khoảng 220px, khi đó lưới chỉ lên 4 cột ở màn từ 1536px trở lên.

**Mobile:** bộ lọc nằm ở trên, không đặt nút cố định ở dưới vì nó đè lên card và dễ chồng với thanh điều hướng của trình duyệt.

- Hero thu gọn: chỉ giữ tiêu đề ngắn và ô nhập mong muốn, để card xuất hiện ngay trong màn hình đầu.
- Hàng điều khiển dính ngay dưới header, tối đa hai hàng (khoảng 90-100px): nút “Bộ lọc” kèm số bộ lọc đang bật, rồi các chip nhanh cuộn ngang (Thời gian, Giá, Khu vực, loại workshop). Toggle Xưởng | Workshop nằm ngay dưới dạng segmented control gọn.
- Hàng này ẩn khi cuộn xuống và hiện lại khi cuộn lên, để lúc đọc card có nhiều chỗ nhất.
- Bấm “Bộ lọc” mở sheet cao khoảng 85% gồm Thời gian, Khu vực, Giá, Sắp xếp. Nút chính “Xem N kết quả” (N cập nhật theo thời gian thực) và “Xóa lọc” nằm trong sheet.
- Bấm một chip nhanh mở sheet nhỏ chỉ chứa nhóm đó, chọn xong tự đóng.
- Chip đang bật có màu nhấn và nút ✕ để xóa ngay; vùng bấm tối thiểu 44px.

### 7.4 Lưới và card

| Màn hình    | Số cột |
| ----------- | ------ |
| ≥1280px     | 4      |
| 1024-1279px | 3      |
| 768-1023px  | 2      |
| <768px      | 1      |

Khoảng cách giữa các card: 20px.

**Card Xưởng:** ảnh xưởng 4:3; tên xưởng; khu vực; rating và số đánh giá; dòng “6 workshop · gốm, nến thơm, màu nước”; “từ 250k”; số slot còn lại trong khoảng thời gian đã chọn.

**Card Workshop:** ảnh sản phẩm làm ra; tên workshop (tối đa 2 dòng); thời lượng; giá; buổi gần nhất kèm số chỗ còn (ví dụ “Thứ 7, 14:00 · còn 3 chỗ”); dòng “Xưởng Thảo Điền · TP.HCM” bấm được để sang trang xưởng (hiển thị tên xưởng và tỉnh/thành, không dùng quận/huyện); tên và ảnh nghệ nhân kèm một câu giới thiệu; nhãn “Không cần kinh nghiệm” khi phù hợp.

**Quy tắc nội dung card:** ảnh phải đúng nội dung workshop, mỗi workshop có ảnh riêng (ảnh mẫu dùng chung chỉ được dùng ở bản demo). Tên card chiếm cố định 2 dòng để các hàng thẳng nhau. Nhãn loại chỉ dùng loại cụ thể (gốm, nến, tranh, hoa, nước hoa, da, xà phòng...), không dùng “Thủ công” vì mọi workshop đều là thủ công. Chữ phụ (địa điểm, “/ người”, mô tả nghệ nhân) đạt tương phản tối thiểu 4.5:1. Bỏ mọi câu chữ demo (ví dụ “12 workshop mẫu”) trước khi ra mắt.

Chỉ gắn badge lên card khi có thông tin thật; không gắn cho mọi card.

### 7.5 Typography

- Tiêu đề: Lora (serif, có subset tiếng Việt). Nội dung: Be Vietnam Pro. Tối đa 2 font, mỗi font 2-3 weight.
- Dùng rem. Body 16px, line-height 1.6; tiêu đề line-height 1.2-1.3.

| Thành phần         | Cỡ chữ  | Weight  |
| ------------------ | ------- | ------- |
| H1                 | 40-44px | 600     |
| Mô tả dưới tiêu đề | 17-18px | 400     |
| Ô nhập gợi ý       | 16-17px | 400     |
| Nút chính          | 16px    | 600     |
| Bộ lọc, chip       | 15-16px | 500     |
| Tên card           | 18-20px | 600     |
| Địa điểm, rating   | 14px    | 400-500 |
| Chữ phụ nhỏ nhất   | ≥13px   | 500     |

- Tương phản chữ/nền tối thiểu 4.5:1 (ví dụ chữ #3B2314 trên nền #FDF3EC). Chữ đặt trên ảnh phải có lớp nền đặc hoặc gradient tối phía sau.

### 7.6 Phong cách và giọng văn

- Dùng ảnh thật của xưởng, nghệ nhân, sản phẩm thay cho icon trong vòng tròn mờ. Chưa có ảnh thì dùng placeholder 4:3, không dùng icon trang trí.
- Giảm gradient, bóng đổ mờ và các lớp nền bo góc lồng nhau. Chỉ dùng 2-3 mức bo góc (ví dụ 8px, 16px, pill).
- Giữ tông ấm (nâu đất, kem) và thêm một màu nhấn có cá tính từ chính sản phẩm (xanh chàm, xanh men gốm hoặc đỏ gạch), dùng dè dặt ở nút chính.
- Câu chữ cụ thể, có giọng riêng. Bỏ chữ “thông minh”, “AI” ở nhãn nhỏ. Mô tả đề xuất: “Kể cho chúng tôi nghe bạn muốn làm gì, chúng tôi chọn xưởng giúp bạn.” Số liệu có thời điểm cập nhật, ví dụ “48 xưởng còn chỗ cuối tuần này (cập nhật 10 phút trước)”.
- Thay hàng hashtag giống hệt nhau bằng vài gợi ý dạng câu ngắn (“Hẹn hò cuối tuần, không cần kinh nghiệm”).
- Nút “Gợi ý cho tôi” dùng icon tia sáng hoặc mũi tên phải, không dùng mũi tên “<”.
- Thêm dấu vết con người: tên và ảnh nghệ nhân, một câu giới thiệu do chính họ viết, đánh giá có tên thật.
- Một bộ icon thống nhất (lucide-react), không gắn icon vào mọi dòng chữ.

### 7.7 Khả năng truy cập

Focus ring rõ ràng; label cho mọi input lọc; alt cho ảnh; vùng bấm tối thiểu 44px trên mobile; điều hướng được bằng bàn phím; không truyền đạt thông tin chỉ bằng màu.

## 8. Kiến trúc kỹ thuật

### 8.1 Giao diện (React + Tailwind)

Component đề xuất: `ExplorePage`, `HeroSearch`, `CategoryChips`, `FilterBar`, `FilterChips`, `ViewToggle`, `ResultsHeader`, `ResultsGrid`, `StudioCard`, `WorkshopCard`, `MobileFilterSheet`, `StudioPage`, `WorkshopPage`, `BookingForm`, và nhóm màn hình cho xưởng (`StudioDashboard`, `WorkshopEditor`, `SessionCalendar`, `BookingList`) cùng màn hình admin.

- Màu, font, bo góc khai báo trong `tailwind.config` (theme.extend), không rải giá trị cứng trong component.
- Trạng thái bộ lọc và chế độ xem lưu trên URL query (ví dụ `?view=studio&when=weekend&area=thu-duc&price=2&type=gom&sort=best`) để chia sẻ link và hoạt động đúng với nút Back.
- Dữ liệu lấy qua một lớp gọi API riêng; bản đầu dùng dữ liệu mẫu (khoảng 8 xưởng, 20-30 workshop) để demo lọc và chuyển chế độ.

### 8.2 Backend (đề xuất, chưa chốt)

API REST, cơ sở dữ liệu quan hệ (ví dụ PostgreSQL) vì dữ liệu có quan hệ chặt và cần giao dịch khi giữ chỗ. Lớp ORM tùy chọn (ví dụ Prisma). Xác thực bằng phiên hoặc JWT; phân quyền kiểm tra ở middleware theo vai trò và theo studioId.

### 8.3 Danh sách API chính

| Phương thức và đường dẫn                          | Mô tả                                             | Quyền                         |
| ------------------------------------------------- | ------------------------------------------------- | ----------------------------- |
| GET /studios                                      | Danh sách xưởng, nhận tham số lọc                 | Công khai                     |
| GET /studios/:id                                  | Chi tiết xưởng                                    | Công khai                     |
| GET /workshops                                    | Danh sách workshop, nhận tham số lọc              | Công khai                     |
| GET /workshops/:id/sessions                       | Session còn chỗ của workshop                      | Công khai                     |
| POST /bookings                                    | Tạo booking (giữ chỗ trong giao dịch)             | Khách                         |
| GET /me/bookings                                  | Booking của tôi                                   | Khách                         |
| PATCH /bookings/:id/cancel                        | Hủy booking                                       | Khách (của mình)              |
| POST /reviews                                     | Tạo đánh giá                                      | Khách (booking đã hoàn thành) |
| POST /studios                                     | Đăng ký xưởng                                     | Người dùng đăng nhập          |
| POST, PATCH /studios/:id/workshops                | Tạo, sửa workshop                                 | Nhân viên, chủ xưởng          |
| POST /workshops/:id/sessions, PATCH /sessions/:id | Tạo, sửa session                                  | Nhân viên, chủ xưởng          |
| GET /studios/:id/bookings                         | Booking của xưởng                                 | Nhân viên, chủ xưởng          |
| PATCH /bookings/:id/status                        | Xác nhận, từ chối, check-in, vắng                 | Nhân viên, chủ xưởng          |
| POST, DELETE /studios/:id/members                 | Quản lý nhân sự                                   | Chủ xưởng                     |
| PATCH /studios/:id/approval                       | Duyệt hoặc từ chối xưởng                          | Admin                         |
| PATCH /reviews/:id/hide                           | Ẩn đánh giá vi phạm                               | Admin                         |
| GET /provinces, GET /provinces/:id/areas          | Tỉnh/thành và khu vực đang có xưởng, kèm số lượng | Công khai                     |

## 9. Quy tắc nghiệp vụ và bảo mật

- **Chống đặt vượt chỗ:** cập nhật số chỗ đã đặt bằng giao dịch hoặc khóa dòng để hai người không cùng giữ chỗ cuối.
- Không giảm sức chứa session xuống dưới số chỗ đã đặt.
- Không xóa session đã có booking; phải hủy kèm thông báo cho khách.
- Đánh giá chỉ mở khi booking “đã hoàn thành”, mỗi booking một đánh giá.
- Mật khẩu băm bằng thuật toán chuyên dụng (bcrypt hoặc argon2); không lưu dạng rõ.
- Kiểm tra và làm sạch mọi dữ liệu đầu vào (nội dung đánh giá, mô tả xưởng) để chống XSS và injection.
- Giới hạn tần suất (rate limit) cho đăng nhập, đặt chỗ và gợi ý.
- Ảnh tải lên: giới hạn định dạng và dung lượng, xử lý resize ở server.
- Dữ liệu cá nhân của khách (tên, số điện thoại) chỉ hiển thị cho xưởng có booking liên quan.

* **Thanh toán:** Open Slot không giữ, không chuyển tiền; tiền đi thẳng vào tài khoản của xưởng hoặc trả tại xưởng.
* Thông tin tài khoản nhận tiền chỉ chủ xưởng được sửa; mỗi lần đổi cần xác thực lại, ghi nhật ký và thông báo cho chủ xưởng.
* Trước khi khách xác nhận, hiển thị rõ ai nhận tiền, chính sách hủy và cách liên hệ xưởng; nhắc khách chỉ chuyển tiền theo thông tin hiển thị trên Open Slot để tránh giả mạo.

## 10. Yêu cầu phi chức năng

| Nhóm              | Yêu cầu                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Hiệu năng         | Trang khám phá hiển thị nội dung chính nhanh; ảnh lazy-load, đúng kích thước, định dạng hiện đại |
| Responsive        | Hoạt động tốt từ 360px đến màn hình rộng                                                         |
| Tương thích       | Phiên bản mới của Chrome, Safari, Edge, Firefox; Safari iOS và Chrome Android                    |
| Khả năng truy cập | Theo hướng dẫn WCAG 2.1 mức AA                                                                   |
| Tiếng Việt        | Font có subset tiếng Việt; dấu hiển thị đúng ở mọi cỡ chữ                                        |
| Bảo mật           | Truyền qua HTTPS; kiểm tra quyền ở server                                                        |
| Khả năng mở rộng  | Tách module để thêm thanh toán, thông báo, thống kê sau này                                      |

## 11. Kế hoạch kiểm thử

**Mức kiểm thử:** kiểm thử đơn vị cho logic lọc, tính chỗ trống, tính giá “từ”; kiểm thử API cho phân quyền và đặt chỗ; kiểm thử giao diện end-to-end cho các luồng chính; kiểm thử thủ công trên thiết bị thật.

**Nhóm ca kiểm thử trọng tâm:**

| Nhóm              | Ví dụ ca kiểm thử                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lọc và chế độ xem | Chuyển Xưởng/Workshop giữ nguyên bộ lọc; xóa từng chip; tải lại trang vẫn giữ trạng thái từ URL; kết quả rỗng hiển thị thông báo hợp lý                                   |
| Đặt chỗ           | Đặt đúng số chỗ còn; đặt vượt chỗ bị chặn; hai người đặt chỗ cuối cùng cùng lúc; hủy trả chỗ lại                                                                          |
| Phân quyền        | Nhân viên xưởng A không xem được booking xưởng B; khách không xem được booking của người khác; vãng lai không đặt được; gọi API trực tiếp không qua giao diện vẫn bị chặn |
| Trạng thái        | Xưởng hủy session có booking thì booking bị hủy và khách được báo; không viết đánh giá khi booking chưa hoàn thành                                                        |
| Giao diện         | 4/3/2/1 cột đúng theo điểm ngắt; tên dài không tràn card; bottom sheet lọc trên mobile; thanh lọc sticky không che nội dung                                               |
| Truy cập          | Điều hướng bằng bàn phím; độ tương phản; focus ring; vùng bấm 44px                                                                                                        |
| Dữ liệu biên      | Giá bằng 0, tên rất dài, xưởng chưa có đánh giá, session sát giờ bắt đầu, session đầy                                                                                     |

## 12. Lộ trình triển khai

| Giai đoạn               | Nội dung                                                                                                      | Kết quả                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 0. Chuẩn bị             | Chốt các quyết định mở (mục 13); thu thập ảnh thật và nội dung của một số xưởng thí điểm; chốt bảng màu, font | Bộ nội dung và quyết định thiết kế |
| 1. Giao diện khám phá   | Trang khám phá với dữ liệu mẫu: toggle, bộ lọc, hai loại card, responsive                                     | Bản demo giao diện chạy được       |
| 2. Backend và đặt chỗ   | Cơ sở dữ liệu, API công khai, đăng ký/đăng nhập, đặt và hủy chỗ                                               | Khách đặt được chỗ thật            |
| 3. Cổng xưởng           | Đăng ký xưởng, quản lý workshop, session, booking                                                             | Xưởng tự vận hành được             |
| 4. Quản trị và đánh giá | Duyệt xưởng, đánh giá, kiểm duyệt, thông báo                                                                  | Vòng vận hành khép kín             |
| 5. Kiểm thử và ra mắt   | Kiểm thử toàn diện, thí điểm với một số xưởng, thu phản hồi                                                   | Phát hành bản đầu                  |

Thời lượng từng giai đoạn ước lượng sau khi chốt nhân sự và phạm vi.

## 13. Quyết định còn mở và rủi ro

### 13.1 Quyết định còn mở

| Vấn đề                | Lựa chọn                                                        | Đề xuất                                                                                             |
| --------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Cách xác nhận booking | Xưởng xác nhận thủ công hoặc tự xác nhận khi còn chỗ            | Cần chốt theo năng lực phản hồi của xưởng; nếu thủ công thì đặt hạn xác nhận và quy tắc khi quá hạn |
| Thanh toán            | Thanh toán tại xưởng, đặt cọc online, hoặc thanh toán đủ online | Đã chốt (xem 13.3)                                                                                  |
| Chính sách hủy        | Thời hạn hủy miễn phí, phí hủy muộn                             | Chưa quyết định                                                                                     |
| Mô hình doanh thu     | Hoa hồng theo booking, phí đăng ký xưởng, hoặc kết hợp          | Chưa quyết định                                                                                     |
| Ô gợi ý theo mô tả    | Phân tích từ khóa thành bộ lọc, hoặc dùng mô hình AI            | Bắt đầu bằng ánh xạ từ khóa sang bộ lọc, nâng cấp sau                                               |

### 13.2 Rủi ro

| Rủi ro                                                | Giảm thiểu                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Thiếu ảnh thật, giao diện trông như template          | Thu thập ảnh từ xưởng thí điểm trước giai đoạn 1                       |
| Xưởng phản hồi booking chậm                           | Hạn xác nhận, nhắc việc cho xưởng, cân nhắc tự xác nhận                |
| Dữ liệu chỗ trống sai lệch (đặt trùng)                | Giao dịch khi giữ chỗ, kiểm thử đồng thời                              |
| Đánh giá giả hoặc vi phạm                             | Chỉ cho đánh giá sau booking hoàn thành; công cụ ẩn nội dung cho admin |
| Card 4 cột bị chật nếu dùng sidebar                   | Dùng thanh lọc ngang hoặc hạ xuống 3 cột ở màn dưới 1536px             |
| Ít xưởng ở mỗi nơi, trang trông thưa khi mở toàn quốc | Ra mắt lần lượt từng thành phố; gợi ý thành phố gần nhất khi trống     |

### 13.3 Quyết định đã chốt (28/10/2026)

| Vấn đề            | Quyết định                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mô hình doanh thu | Miễn phí hoàn toàn cho xưởng giai đoạn đầu để thu hút xưởng; ghi rõ “miễn phí giai đoạn đầu”. Theo dõi: số xưởng còn hoạt động, booking mỗi xưởng mỗi tháng, tỉ lệ xưởng xác nhận kịp, tỉ lệ vắng mặt, tỉ lệ khách quay lại. Đặt trước mốc để cân nhắc thu phí |
| Thanh toán        | Khách chọn trả tại xưởng hoặc thanh toán trước chuyển thẳng vào tài khoản xưởng; Open Slot không giữ tiền (mục 4.6)                                                                                                                                            |
| Xác minh xưởng    | Hai bậc: “Đã duyệt” (thông tin cơ bản, địa chỉ, ảnh, liên hệ, link mạng xã hội; admin duyệt thủ công) bắt buộc để hiển thị; “Đã xác minh” (giấy tờ doanh nghiệp) tùy chọn, có nhãn tin cậy                                                                     |

## 14. Định vị và phân tích đối thủ

So sánh với SlotBetter (slotbetter.io). Thông tin lấy từ trang giới thiệu công khai và ảnh bảng quản lý do chủ dự án cung cấp, chưa phải đánh giá đầy đủ.

|                     | SlotBetter                                                                                                                                | Open Slot                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Bản chất            | Công cụ quản lý đặt chỗ cho tổ chức (SaaS), mỗi tổ chức có trang và thương hiệu riêng                                                     | Sàn khám phá cho người dùng cuối, xưởng nằm bên trong                |
| Khách hàng chính    | Người làm workshop                                                                                                                        | Người tìm workshop, xưởng là phía cung                               |
| Cách khách tìm thấy | Tổ chức tự chia sẻ link                                                                                                                   | Khách tìm theo địa điểm, thời gian, giá, loại hình                   |
| Tiền                | Khách chuyển thẳng vào tài khoản tổ chức, SlotBetter không giữ tiền                                                                       | Tương tự: thanh toán trước chuyển thẳng cho xưởng hoặc trả tại xưởng |
| Thu phí             | Phí cố định theo lần xuất bản sự kiện (miễn phí tới 10 người; 250.000đ tới 100 người; 680.000đ cho 101-300 người; trên 300 báo giá riêng) | Miễn phí giai đoạn đầu                                               |
| Xác minh            | Yêu cầu giấy tờ doanh nghiệp trước khi xuất bản                                                                                           | Hai bậc: đã duyệt, đã xác minh                                       |

**Định vị:** SlotBetter giúp tổ chức đã có khách nhận đặt chỗ gọn hơn; Open Slot giúp người chưa biết đi đâu tìm được workshop phù hợp và giúp xưởng có khách mới. Giá trị của Open Slot nằm ở khám phá và lượng khách, không ở công cụ vận hành.

**Điều học được cho cổng xưởng:** danh sách chia tab nháp / đang hoạt động / đã qua; banner nhắc xác minh nổi bật; trạng thái trống có hướng dẫn bước tiếp theo; hiển thị rõ ai nhận tiền và chính sách hủy trước khi thanh toán. Cân nhắc danh sách chờ (P1) vì đây là nỗi đau phổ biến của người làm workshop.

**Không bắt chước:** tùy biến thương hiệu, phông chữ, tên miền riêng cho từng tổ chức. Open Slot là sàn nên giao diện thống nhất giúp khách so sánh; xưởng chỉ đổi ảnh bìa và mô tả.

## Phụ lục. Prompt triển khai giao diện (rút gọn)

Dán vào công cụ AI/code để dựng giao diện trang khám phá:

- Stack: React + Tailwind CSS. Giữ nguyên chức năng;&#32;
- Trang “Khám phá workshop” có toggle Xưởng | Workshop dùng chung bộ lọc; hai loại card (StudioCard, WorkshopCard) cùng khung; dữ liệu mẫu hai bảng studio và workshop.
- Bộ lọc: Thời gian, Tỉnh/Thành phố (kèm Khu vực tùy chọn), Giá; hàng chip loại workshop; chip bộ lọc đang áp dụng có nút xóa; thanh lọc ngang sticky; mobile dùng hàng điều khiển dính (ẩn khi cuộn xuống) và bottom sheet cho bộ lọc đầy đủ. Trạng thái bộ lọc lưu trên URL.
- Lưới: 4 cột từ 1280px, 3 cột từ 1024px, 2 cột từ 768px, 1 cột dưới đó. Số kết quả và sắp xếp nằm một hàng ngang.
- Typography: Lora cho tiêu đề, Be Vietnam Pro cho nội dung, theo bảng cỡ chữ ở mục 7.5; tương phản tối thiểu 4.5:1.
- Giảm cảm giác template: ảnh thật thay icon, ít gradient và lớp bo góc lồng nhau, câu chữ cụ thể, một màu nhấn có cá tính, sửa icon nút “Gợi ý cho tôi”, thay logo placeholder.
- Đầu ra: component tách nhỏ, màu/font/bo góc trong `tailwind.config`, accessible, responsive, kèm danh sách thay đổi so với bản cũ.
