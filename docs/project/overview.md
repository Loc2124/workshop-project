# Open Slot — Tài liệu dự án

Nền tảng khám phá và đặt chỗ workshop thủ công tại Việt Nam · Bản đồng bộ 07/11/2026 · React + Tailwind CSS

> **Đặc tả sản phẩm, không phải xác nhận đã triển khai hết.** Đọc [trạng thái mã nguồn](current-status.md), [chính sách và mục chờ chốt](../policy/README.md), [API hiện có](../engineering/03-api-spec.md). Đã tích hợp nội dung của bản cập nhật tài liệu; các đề xuất vẫn là đề xuất.

## 1. Tổng quan

### 1.1 Mục tiêu

Open Slot giúp người dùng tìm và đặt chỗ các workshop thủ công (gốm, nến thơm, màu nước, đất sét...) tại các studio chế tác. Sản phẩm phục vụ hai nhóm: người chưa biết mình muốn làm gì (đi cùng người yêu, làm quà, thư giãn) và người đã biết rõ loại hình muốn học.

### 1.2 Giá trị cốt lõi

- Tìm nhanh studio và workshop còn chỗ theo thời gian, khu vực, ngân sách.
- Gợi ý theo mô tả tự nhiên qua ô “Mong muốn của bạn hôm nay?”.
- Giữ chỗ trực tiếp với nghệ nhân.
- Studio có công cụ riêng để quản lý workshop, lịch và lượt đặt.

### 1.3 Phạm vi

**Trong phạm vi bản đầu (MVP):** trang khám phá với hai chế độ xem Studio và Workshop; bộ lọc; trang chi tiết studio và workshop; đăng ký, đăng nhập; đặt chỗ và hủy chỗ; cổng quản lý cho chủ studio; trang quản trị duyệt studio; đánh giá sau khi tham gia; phạm vi toàn quốc theo tỉnh/thành phố (mục 5.2 và 7.3), ra mắt lần lượt từng thành phố.

**Ngoài phạm vi bản đầu:** ứng dụng di động native, chat trực tiếp, mã giảm giá, chương trình thành viên, đa ngôn ngữ, mở rộng ra ngoài Việt Nam. Định hướng thanh toán trước: nền tảng thu cọc qua payOS, hoàn tiền và chi trả cho studio qua kênh chi hộ sau buổi học; phần còn lại trả tại studio. Hoàn tự động/chi trả chưa có trong mã; chi tiết mục 4.6.

### 1.4 Thuật ngữ

| Thuật ngữ       | Ý nghĩa                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| Studio (Studio) | Một địa điểm do nghệ nhân hoặc đơn vị vận hành, chứa nhiều workshop         |
| Workshop        | Một nội dung trải nghiệm cụ thể (ví dụ: Nặn gốm bàn xoay), thuộc một studio |
| Session         | Một buổi diễn ra của workshop: ngày, giờ, sức chứa                          |
| Booking         | Một lượt đặt chỗ của khách vào một session                                  |

## 2. Người dùng và vai trò

| Vai trò          | Mô tả                         | Nhu cầu chính                                                   |
| ---------------- | ----------------------------- | --------------------------------------------------------------- |
| Khách vãng lai   | Chưa đăng nhập                | Xem studio, workshop, lịch còn chỗ                              |
| Khách hàng       | Đã đăng nhập                  | Đặt, hủy chỗ, xem lịch sử, viết đánh giá                        |
| Nhân viên studio | Thành viên của một studio     | Vận hành workshop, session, xử lý booking                       |
| Chủ studio       | Quản lý một hoặc nhiều studio | Toàn quyền trong studio, quản lý nhân sự, giá, thông tin studio |
| Admin Open Slot  | Đội vận hành nền tảng         | Duyệt studio, kiểm duyệt nội dung, xử lý khiếu nại              |

Vai trò hệ thống (customer, admin) tách khỏi vai trò trong studio (owner, staff). Một người dùng có thể vừa là khách vừa là chủ studio.

## 3. Yêu cầu chức năng

Ưu tiên: P0 = bắt buộc cho MVP, P1 = nên có sớm sau MVP, P2 = để sau.

### 3.1 Khám phá và tìm kiếm

| Mã    | Chức năng                                                                                | Ưu tiên |
| ----- | ---------------------------------------------------------------------------------------- | ------- |
| FR-01 | Trang khám phá có toggle Studio / Workshop, dùng chung bộ lọc                            | P0      |
| FR-02 | Lọc theo Thời gian, Tỉnh/Thành phố (kèm Khu vực khi có), Giá (3-4 mức có sẵn)            | P0      |
| FR-03 | Hàng chip loại workshop (gốm, nến thơm, màu nước...) phía trên lưới                      | P0      |
| FR-04 | Chip hiển thị bộ lọc đang áp dụng, xóa từng bộ lọc hoặc xóa tất cả                       | P0      |
| FR-05 | Sắp xếp: Studio theo phù hợp, rating, khoảng cách; Workshop theo giá, thời gian gần nhất | P0      |
| FR-06 | Hiển thị số kết quả theo chế độ (“12 studio” / “47 workshop”)                            | P0      |
| FR-07 | Bộ lọc lưu trên URL để chia sẻ link và dùng nút Back                                     | P0      |
| FR-08 | Ô gợi ý theo mô tả tự nhiên, kết quả là workshop kèm tên studio                          | P1      |
| FR-09 | Lưu workshop yêu thích (nút bookmark trên card)                                          | P1      |
| FR-10 | Tìm theo từ khóa tên studio, workshop                                                    | P1      |

### 3.2 Trang chi tiết

| Mã    | Chức năng                                                                          | Ưu tiên |
| ----- | ---------------------------------------------------------------------------------- | ------- |
| FR-11 | Trang studio: ảnh, mô tả, nghệ nhân, địa chỉ, bản đồ, danh sách workshop, đánh giá | P0      |
| FR-12 | Trang studio có bộ lọc nhỏ theo loại và ngày                                       | P0      |
| FR-13 | Trang workshop: ảnh, mô tả, thời lượng, trình độ, giá, danh sách session còn chỗ   | P0      |
| FR-14 | Hiển thị số chỗ còn trống của từng session                                         | P0      |

### 3.3 Tài khoản và đặt chỗ

| Mã    | Chức năng                                                                                                           | Ưu tiên |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| FR-15 | Đăng ký, đăng nhập bằng email hoặc số điện thoại                                                                    | P0      |
| FR-16 | Đặt chỗ: chọn session, số người, xác nhận thông tin                                                                 | P0      |
| FR-17 | Xem, hủy booking của mình theo chính sách hủy                                                                       | P0      |
| FR-18 | Thông báo email/SMS khi đặt, xác nhận, hủy, nhắc lịch                                                               | P1      |
| FR-19 | Đăng nhập bằng Google                                                                                               | P1      |
| FR-31 | Khách chọn thanh toán theo chế độ không cọc / cọc tùy chọn / cọc bắt buộc                                           | P0      |
| FR-32 | Studio đã xác minh tự chọn chế độ và tỷ lệ 1–50%; tài khoản nhận chi trả đã có luồng nhập và quản trị đối chiếu thủ công; hủy cố định 24 giờ | P0      |
| FR-33 | Studio ghi nhận phần thực thu tại studio; khoản phải thu/miễn có nhật ký (miễn chưa triển khai)                     | P0      |
| FR-34 | Đối soát tự động, hoàn tiền tự động và chi trả sau buổi (P0 cần triển khai, chưa có chi hộ)                         | P0      |
| FR-35 | Xác minh studio hai bậc: “Đã duyệt” (bắt buộc) và “Đã xác minh” (giấy tờ, tùy chọn) kèm nhãn tin cậy                | P1      |

### 3.4 Quản lý studio

| Mã    | Chức năng                                                                | Ưu tiên |
| ----- | ------------------------------------------------------------------------ | ------- |
| FR-20 | Đăng ký studio, gửi chờ duyệt                                            | P0      |
| FR-21 | Tạo, sửa, ẩn workshop                                                    | P0      |
| FR-22 | Tạo, sửa, hủy session; đặt sức chứa                                      | P0      |
| FR-23 | Danh sách booking của studio; xác nhận, từ chối, check-in, đánh dấu vắng | P0      |
| FR-24 | Quản lý thành viên (thêm, xóa nhân viên)                                 | P1      |
| FR-25 | Trả lời đánh giá                                                         | P1      |
| FR-26 | Thống kê cơ bản: lượt đặt, tỉ lệ lấp đầy                                 | P2      |

### 3.5 Đánh giá và quản trị

| Mã    | Chức năng                                                         | Ưu tiên |
| ----- | ----------------------------------------------------------------- | ------- |
| FR-27 | Viết đánh giá khi booking đã hoàn thành, mỗi booking một đánh giá | P0      |
| FR-28 | Admin duyệt hoặc từ chối studio đăng ký                           | P0      |
| FR-29 | Admin ẩn nội dung, đánh giá vi phạm                               | P1      |
| FR-30 | Admin xem và xử lý khiếu nại                                      | P2      |

## 4. Luồng nghiệp vụ chính

### 4.1 Khách tìm và đặt chỗ

1. Tìm workshop/studio theo bộ lọc, chọn buổi đang nhận đăng ký và số người.
2. Đăng nhập nếu cần; thông tin liên hệ lấy từ tài khoản, không tin giá/tiền do trình duyệt gửi.
3. Theo chế độ studio/workshop: không cọc → trả tại studio; tùy chọn → khách chọn; bắt buộc → cọc.
4. Trả tại studio hoặc miễn phí: xác nhận ngay, phát vé, không đồng hồ/QR thanh toán.
5. Cọc: giữ 15 phút theo hạn đã lưu, hiển thị QR; chỉ xác nhận khi kết quả thanh toán được xác minh.
6. Hết hạn, hủy, đổi giờ hoặc có tiền về muộn: xử lý theo mục 4.6 và bảng trạng thái. Không tự ghi nhận tham dự hay trả đủ khi hết buổi.
7. Studio chưa cần xác nhận thủ công việc đặt chỗ; chỉ xác nhận khoản đã thực thu tại studio và điểm danh theo quyền.

### 4.2 Studio tạo workshop và session

1. Studio tạo workshop (nháp), nhập mô tả, ảnh, giá, thời lượng, trình độ.
2. Đặt trạng thái “đang hiển thị”.
3. Thêm session: thời gian bắt đầu và sức chứa.
4. Khi có booking, studio xử lý theo luồng 4.1.

### 4.3 Đăng ký và duyệt studio

1. Người dùng đăng ký studio; trạng thái “chờ duyệt”.
2. Admin kiểm tra thông tin, ảnh, địa chỉ.
3. Duyệt thì studio “đang hoạt động” và hiển thị công khai; từ chối thì kèm lý do để chỉnh sửa và gửi lại.

### 4.4 Hủy và vắng mặt

Chính sách hủy cố định 24 giờ, số tiền hoàn theo khoản cọc gốc đã lưu, chi tiết mục 4.6. Khách chưa trả luôn hủy miễn phí; studio hủy thì hoàn toàn bộ tiền đã nhận. Điểm danh từng vé từ giờ bắt đầu, vắng từ S + 30 phút và ghi khoản hoàn phần vượt cọc đã có ở bước 4.1; không chuyển tiền hoàn tự động. Hủy từng chỗ/thay mã cọc đã triển khai ở 4.2. Xem [chính sách](../policy/README.md).

Đặt chỗ thuộc diện cần xác nhận sẽ đến phải có ít nhất 2 giờ từ khi dịch vụ gửi thư chấp nhận email yêu cầu xác nhận. Thông báo trong tài khoản chưa đủ; chưa gửi được hoặc không còn đủ 2 giờ trước buổi thì không nhả do thiếu xác nhận. Hạn thực tế là mốc muộn hơn giữa mốc studio cấu hình và email gửi thành công + 2 giờ, dùng đúng phiên bản lịch.

### 4.5 Đánh giá

Mục tiêu: sau tham dự hợp lệ/đặt chỗ hoàn thành, khách được mở form đánh giá (rating 1–5 và nội dung); API tạo đánh giá chưa hoàn chỉnh trong mã hiện tại. Mỗi booking một đánh giá. Rating của studio là trung bình các đánh giá thuộc studio đó.

### 4.6 Thanh toán

**Định hướng nghiệp vụ từ bộ tài liệu 07/11/2026; đối chiếu trạng thái triển khai bên dưới.**

#### Ba chế độ

Mỗi workshop thuộc một trong ba chế độ (kế thừa từ studio hoặc ghi đè):

- **Không cọc:** xác nhận ngay, trả toàn bộ tại studio.
- **Cọc tùy chọn:** khách chọn trả cọc trước hoặc trả tại studio.
- **Cọc bắt buộc:** chỉ xác nhận sau khi thanh toán cọc thành công.

Mức cọc do studio tự nhập, số nguyên 1–50%, không có tỷ lệ mặc định. Studio chưa đủ điều kiện xác minh chỉ nhận trả tại studio. Mỗi đặt chỗ lưu chế độ, tỷ lệ và số tiền tại lúc tạo; đổi cấu hình không tính lại đặt chỗ cũ.

#### Dòng tiền

1. Khách thanh toán cọc bằng chuyển khoản/VietQR qua payOS (định hướng dùng VietQR Pro; tài khoản ảo, ràng buộc số tiền và hành vi hoàn của ngân hàng cần xác minh với nhà cung cấp). Tiền vào tài khoản ngân hàng liên kết với payOS (hiện là tài khoản cá nhân, phạm vi đồ án).
2. Tiền chi (hoàn và payout) lấy từ **số dư ví Bảo Kim** kết nối với kênh chi payOS. Số dư ví được nạp từ tài khoản ngân hàng theo quy trình vận hành (mục J trong [bảng chuyển trạng thái](../policy/bang-chuyen-trang-thai.md)).
3. Open Slot payout cho studio vào **tài khoản ngân hàng của studio** trong **3 ngày làm việc** sau khi buổi kết thúc, trừ các khoản hoàn và điều chỉnh.
4. Hoàn tiền là **lệnh chi chuyển khoản vào tài khoản ngân hàng của khách**, tối đa **7 ngày làm việc** kể từ lúc hủy theo lịch nhà nước Việt Nam (gồm ngày nghỉ/nghỉ bù và ngày làm bù được công bố chính thức). Tài khoản nhận hiện do khách nhập riêng cho từng khoản hoàn; nguồn lấy từ giao dịch thu chỉ dùng khi nhà cung cấp hỗ trợ và đã đối chiếu.
5. Xử lý lệnh chi theo hạn đến trước, không phân biệt khoản hoàn khách hay chi trả studio; thiếu số dư phải cảnh báo. Mọi khoản chuyển đều cần quản trị duyệt trong giai đoạn đầu.
6. Studio chịu đúng phí thực tế nhà cung cấp cho từng lần thu, hoàn và chi trả, không cộng phụ phí Open Slot. Công bố cách tính và tính rõ cho studio trước khi bật cọc; trừ phí vào khoản chi của chính buổi học; nếu khoản chi đã hoàn tất thì ghi khoản studio phải hoàn riêng cho buổi đó, không chuyển sang buổi khác. Không trừ phí vào khoản khách được hoàn.

Phí thực tế cần lưu/đối soát riêng; không tự gán biểu phí hoặc coi chức năng thu phí/duyệt/chi trả đã có.

#### Giữ chỗ và nhận tiền

- Giữ chỗ 15 phút theo hạn đã lưu; hệ thống chỉ nhả chỗ sau thêm 3 phút đệm và sau khi kiểm tra cổng thanh toán.
- Mốc "đúng hạn" tính theo **giờ giao dịch đã xác minh**, không theo giờ nhận thông báo.
- Chuyển thiếu: hoàn lại, không cộng dồn. Chuyển thừa: xác nhận theo đúng số cọc, hoàn phần thừa.
- Tiền đúng hạn nhưng chỗ đã nhả: nếu người khác mới giữ chỗ chưa trả thì người trả đúng hạn được chỗ; nếu người khác đã xác nhận thì hoàn toàn bộ cho người trả đúng hạn.
- Tiền về sau hạn thật: xác nhận lại nếu buổi còn nhận đăng ký và còn đủ chỗ cho toàn bộ đặt chỗ; không thì hoàn toàn bộ. Đặt chỗ đã hủy không tự khôi phục.

#### Hủy và hoàn

| Tình huống                                                  | Kết quả                                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Chưa thanh toán                                             | Hủy miễn phí, mọi mốc giờ                                                                                                               |
| Đã thanh toán, hủy trước giờ học ≥ 24 giờ (gồm đúng 24 giờ) | Hoàn toàn bộ                                                                                                                            |
| Đã thanh toán, hủy < 24 giờ                                 | Giữ cọc gốc tại lúc đặt, hoàn phần vượt cọc                                                                                             |
| Không cọc nhưng đã trả                                      | Hoàn toàn bộ, kể cả < 24 giờ                                                                                                            |
| Studio hủy buổi, hoặc admin hủy/khóa studio                 | Hoàn toàn bộ (ngoại lệ gian lận khách do admin quyết định, có lý do)                                                                    |
| Studio đổi giờ                                              | Khách chọn giữ hoặc hủy và hoàn toàn bộ; không phản hồi trong 48 giờ (hoặc 12 giờ trước giờ mới nếu sát hơn) thì tự hủy và hoàn toàn bộ |

Hủy và điểm danh được thực hiện **theo từng chỗ/vé**. Tiền chia đều theo vé, phần dư dồn vào vé cuối.

Chính sách hủy cố định 24 giờ cho mọi studio ở bản đầu; không cho studio tùy chỉnh. Hạn hoàn 7 ngày làm việc vẫn từ lúc hủy dù khách thiếu/sai tài khoản; phải cảnh báo và yêu cầu bổ sung ngay. Chỉ cho đổi khi giờ học mới còn trên 12 giờ; còn đúng hoặc dưới 12 giờ thì từ chối đổi. Nếu không thể giữ lịch cũ, studio phải hủy. Hạn phản hồi là thời điểm sớm hơn giữa thông báo + 48 giờ và giờ mới − 12 giờ.

#### Tham dự và khoản còn nợ

- Studio đánh dấu đã đến hoặc vắng. Chỉ đánh dấu vắng từ 30 phút sau giờ bắt đầu. Vắng: không hoàn cọc, phần đã trả vượt cọc xử lý như hủy < 24 giờ.
- Buổi kết thúc không tự ghi nhận đã đến, hoàn thành hay trả hết tiền.
- Khoản còn nợ sau buổi là khoản phải thu của studio; studio chọn thu hoặc miễn, mọi thao tác có nhật ký.

#### Khiếu nại

Khách và studio gửi khiếu nại trong 7 ngày sau buổi học. Admin Open Slot quyết định. Mọi điều chỉnh là bút toán mới, không sửa hoặc xóa lịch sử. Thông thường studio trả lại tiền cho Open Slot trước khi nền tảng hoàn khách. Nếu studio chậm khiến khoản hoàn có nguy cơ vượt 7 ngày làm việc từ lúc hủy, Open Slot tạm ứng hoàn khách đúng hạn, rồi tiếp tục thu hồi từ studio; không bắt khách chờ và không tự gia hạn.

#### Chưa hỗ trợ

Đổi buổi, đổi địa điểm, chuyển tên người tham gia.

#### Trạng thái triển khai

Đã có cấu hình ba chế độ, tỷ lệ 1–50%, bản chụp cọc, giữ 15 phút, webhook, vé, công thức hoàn và miễn xác nhận sau mốc nhả. Phiên bản/hạn phản hồi đổi giờ đã có ở bước 3; điểm danh từng vé ở 4.1; hủy từng chỗ/thay mã cọc ở 4.2; nhả sau email được chấp nhận ít nhất 2 giờ ở 4.3. Hiện hoàn là studio chuyển thủ công rồi ghi mã đối chiếu. Chưa có số dư ví Bảo Kim, API chi hộ, chi trả studio, sổ tiền toàn hệ thống hoặc đệm 3 phút/đối soát cổng trước nhả giữ chỗ cọc. Không dùng đặc tả này để tuyên bố các phần còn thiếu đã hoạt động. Xem [trạng thái hiện tại](current-status.md).

## 5. Mô hình dữ liệu

### 5.1 Quan hệ

Studio có nhiều Workshop; Workshop có nhiều Session; Session có nhiều Booking; Booking có tối đa một Review. User liên kết với Studio qua bảng nối studio\_member.

### 5.2 Các bảng

Schema thực nằm trong db/migrations (hiện 54 file, gồm hai migration có tiền tố 035 và các migration tài chính 044–053). Không dùng bảng khái niệm dưới đây để tự tạo lại schema.

| Nhóm hiện có                                                                                           | Dữ liệu chính                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| users, auth_sessions, studio_members                                                                   | Tài khoản/phiên/vai hệ thống; quyền owner/staff theo studio                                                               |
| studios, workshops, sessions                                                                           | Chế độ/tỷ lệ studio, ghi đè workshop, bao gồm, ngừng tổ chức; giờ bắt đầu/kết thúc, hạn đăng ký, sức chứa/chỗ giữ/chỗ bán |
| bookings, booking_requests, payments, webhook_events                                                   | Giá/tiền/cọc/chế độ tại lúc tạo, trạng thái riêng, khoản nhận/hoàn; dòng thanh toán và sự kiện chống trùng                |
| tickets, booking_refund_receipts, reviews                                                              | Mỗi chỗ một vé; đánh giá đã có dữ liệu/đọc công khai, luồng tạo đánh giá chưa hoàn chỉnh                                  |
| studio_deposit_history, session_schedule_history, booking_schedule_acceptances, booking_status_history | Lịch sử cấu hình, đổi lịch và trạng thái                                                                                  |
| booking_reminders, email_outbox, user_notifications, workshop_schedule_subscriptions                   | Nhắc lịch/hàng đợi thông báo/đăng ký lịch mới; đã lưu đăng ký nhưng chưa có bước gửi lịch mới                             |
| provinces, areas, categories, images                                                                   | Danh mục và ảnh                                                                                                           |

Cần thêm cho dòng tiền mục tiêu: sổ tiền nhận/điều chỉnh, phân bổ từng vé, khoản hoàn có hạn/tài khoản nhận/lệnh chi, chi trả studio, xác minh tài khoản tự động qua ngân hàng và sổ nạp/đối soát ví. Đây chưa phải bảng hoặc API đã tồn tại.

### 5.3 Trạng thái

Tách riêng đặt chỗ, buổi học, thanh toán và tham dự. Một workshop có nhiều buổi, một buổi kết thúc không làm workshop ngừng hoạt động.

| Đối tượng                       | Trạng thái                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Buổi hiển thị theo giờ Việt Nam | Còn chỗ / Hết chỗ / Đã đóng đăng ký / Đang diễn ra / Đã kết thúc / Đã hủy; hủy luôn ưu tiên              |
| Đặt chỗ                         | Giữ chỗ / Xác nhận / Hết hạn / Hủy / Hoàn thành do thao tác hợp lệ, không tự suy từ hết giờ              |
| Tiền hiện tại                   | bookings.status là vòng đời tổng hợp; số tiền đã trả lấy paid_amount và payments, không lấy giờ kết thúc |
| Khoản hoàn hiện tại             | not_applicable / pending / forfeited / refunded; mới có ghi nhận thủ công                                |
| Lệnh hoàn/chi trả mục tiêu      | Theo mục E/G/J của bảng trạng thái; chưa triển khai                                                      |
| Tham dự                         | Chưa ghi nhận / Đã đến / Vắng; hiện theo toàn đặt chỗ, mục tiêu theo vé                                  |

### 5.4 Cách tính hai chế độ xem

Chế độ Workshop truy vấn trực tiếp `workshop` đã lọc. Chế độ Studio nhóm các workshop khớp bộ lọc theo `studioId`: lấy giá thấp nhất (“từ 250k”), đếm số workshop khớp, liệt kê các loại, và tính studio còn chỗ khi có ít nhất một session còn chỗ trong khoảng thời gian đã chọn. Không viết logic lọc riêng cho từng chế độ.

## 6. Phân quyền

| Hành động                           | Vãng lai | Khách | Nhân viên studio | Chủ studio | Admin        |
| ----------------------------------- | -------- | ----- | ---------------- | ---------- | ------------ |
| Xem studio, workshop, session       | ✓        | ✓     | ✓                | ✓          | ✓            |
| Đặt chỗ                             |          | ✓     |                  |            | ✓ (hộ khách) |
| Xem, hủy booking của mình           |          | ✓     |                  |            | ✓            |
| Viết đánh giá                       |          | ✓     |                  |            |              |
| Xem booking của studio mình         |          |       | ✓                | ✓          | ✓            |
| Xác nhận, từ chối, check-in booking |          |       | ✓                | ✓          | ✓            |
| Tạo, sửa workshop và session        |          |       | ✓                | ✓          | ✓            |
| Sửa thông tin studio, giá           |          |       |                  | ✓          | ✓            |
| Thêm, xóa nhân viên                 |          |       |                  | ✓          | ✓            |
| Trả lời đánh giá                    |          |       | ✓                | ✓          | ✓            |
| Duyệt studio, ẩn nội dung vi phạm   |          |       |                  |            | ✓            |

**Nguyên tắc:**

- Kiểm tra quyền ở server. Ẩn nút trên giao diện chỉ để tiện dùng, không phải lớp bảo vệ.
- Nhân viên và chủ studio chỉ thao tác trên dữ liệu có studioId nằm trong `studio_member` của họ.
- Khách chỉ truy cập booking có userId của chính mình.
- Bản đầu có thể chỉ dùng 3 vai trò (khách, chủ studio, admin); bảng `studio_member` vẫn tạo sẵn với mỗi studio một thành viên là chủ.

## 7. Thiết kế giao diện

### 7.1 Cấu trúc trang khám phá

**Đường dẫn công khai:**

- `/`: trang chủ gọn với tìm kiếm theo tỉnh/thành, ngày, nhu cầu; hiển thị tối đa 8 workshop sắp tới và lời mời dành cho nghệ nhân.
- `/explore`: danh mục workshop/studio, bộ lọc được lưu trên query string. Người dùng từ trang chủ sang đây trong một lần bấm và giữ nguyên các tiêu chí đã nhập.
- `/studios/:slug` và `/workshop/:slug`: trang chi tiết studio và workshop; slug ổn định, duy nhất. Các URL `/studios/:id` và `/workshops/:id` vẫn được API/web giữ để tương thích.

**Trang chủ:** hero có tiêu đề, nơi, ngày và mô tả nhu cầu; nút tìm/gợi ý chuyển sang trang khám phá `/kham-pha`. Tiếp theo là workshop sắp tới ở nơi đã chọn (hoặc toàn quốc), nút “Xem tất cả” và một khối dành cho nghệ nhân. Không thêm các khối nội dung dài khi dữ liệu studio còn ít.

**Trang khám phá:**

1. Header luôn có liên kết trực tiếp “Khám phá workshop”.
2. Tiêu đề và ô tìm kiếm gọn; không lặp lại hero lớn của trang chủ.
3. Thanh điều khiển: hàng chip loại workshop; thanh lọc; toggle Studio | Workshop; số kết quả; sắp xếp. Số kết quả và ô sắp xếp nằm trên một hàng ngang.
4. Lưới card xuất hiện sớm.

### 7.2 Toggle Studio | Workshop

- Mặc định là chế độ Workshop vì trang hiển thị lịch từng buổi; chế độ Studio dành cho người muốn xem theo địa điểm. Chế độ lưu trên URL (?view=workshop hoặc ?view=studio).
- Bộ lọc giữ nguyên khi chuyển chế độ.
- Bấm chip loại hình thì tự chuyển sang Workshop; bấm khu vực hoặc tên studio thì chuyển sang Studio; người dùng vẫn tự đổi được.
- Không trộn hai loại card trong cùng một lưới. Hai loại card dùng chung khung (kích thước, bo góc, font) để lưới đều.

### 7.3 Bộ lọc

Chỉ giữ 3 nhóm: Thời gian, Địa điểm, Giá. Loại workshop là hàng chip ngang. Bỏ bộ lọc Trình độ và ghi nhãn “Không cần kinh nghiệm” trên card, vì phần lớn workshop trải nghiệm đều dành cho người mới.

**Địa điểm (toàn quốc):** không lọc theo quận/huyện vì cấp huyện đã bỏ từ 1/7/2025, cả nước còn 34 tỉnh, thành phố và cấp xã ([nguồn](https://thuvienphapluat.vn/hoi-dap-phap-luat/ban-do-viet-nam-moi-nhat-2026-chi-tiet-cu-the-nhu-the-nao-138072924.html)). Lọc hai tầng:

- Tỉnh/Thành phố: ô chọn có tìm kiếm, chỉ hiện nơi đang có studio kèm số lượng (ví dụ “Đà Nẵng (6)”). Mặc định theo vị trí người dùng, luôn đổi được.
- Khu vực (tùy chọn): hiện sau khi chọn tỉnh/thành, chỉ ở nơi đủ studio để cần chia nhỏ. Do Open Slot tự định nghĩa theo thói quen đi lại, chọn được nhiều khu vực cùng lúc.
- “Gần tôi” (bán kính 3/5/10km) dùng tọa độ studio (P1).
- Nơi chưa có studio hiển thị gợi ý sang thành phố gần nhất.

**Vị trí bộ lọc (đề xuất, chưa chốt):** thanh ngang sticky ngay dưới hero, thu gọn thành một hàng khi dính. Với chỉ 3 nhóm lọc, thanh ngang cho lưới dùng hết chiều rộng và không làm card 4 cột bị chật. Phương án thay thế: sidebar trái sticky rộng khoảng 220px, khi đó lưới chỉ lên 4 cột ở màn từ 1536px trở lên.

**Mobile:** bộ lọc nằm ở trên, không đặt nút cố định ở dưới vì nó đè lên card và dễ chồng với thanh điều hướng của trình duyệt.

- Hero thu gọn: chỉ giữ tiêu đề ngắn và ô nhập mong muốn, để card xuất hiện ngay trong màn hình đầu.
- Hàng điều khiển dính ngay dưới header, tối đa hai hàng (khoảng 90-100px): nút “Bộ lọc” kèm số bộ lọc đang bật, rồi các chip nhanh cuộn ngang (Thời gian, Giá, Khu vực, loại workshop). Toggle Studio | Workshop nằm ngay dưới dạng segmented control gọn.
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

**Card Studio:** ảnh studio 4:3; tên studio; khu vực; rating và số đánh giá; dòng “6 workshop · gốm, nến thơm, màu nước”; “từ 250k”; số slot còn lại trong khoảng thời gian đã chọn.

**Card Workshop:** ảnh sản phẩm làm ra; tên workshop (tối đa 2 dòng); thời lượng; giá; buổi gần nhất kèm số chỗ còn (ví dụ “Thứ 7, 14:00 · còn 3 chỗ”); dòng “Studio Thảo Điền · TP.HCM” bấm được để sang trang studio (hiển thị tên studio và tỉnh/thành, không dùng quận/huyện); tên và ảnh nghệ nhân kèm một câu giới thiệu; nhãn “Không cần kinh nghiệm” khi phù hợp.

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

- Dùng ảnh thật của studio, nghệ nhân, sản phẩm thay cho icon trong vòng tròn mờ. Chưa có ảnh thì dùng placeholder 4:3, không dùng icon trang trí.
- Giảm gradient, bóng đổ mờ và các lớp nền bo góc lồng nhau. Chỉ dùng 2-3 mức bo góc (ví dụ 8px, 16px, pill).
- Giữ tông ấm (nâu đất, kem) và thêm một màu nhấn có cá tính từ chính sản phẩm (xanh chàm, xanh men gốm hoặc đỏ gạch), dùng dè dặt ở nút chính.
- Câu chữ cụ thể, có giọng riêng. Bỏ chữ “thông minh”, “AI” ở nhãn nhỏ. Mô tả đề xuất: “Kể cho chúng tôi nghe bạn muốn làm gì, chúng tôi chọn studio giúp bạn.” Số liệu có thời điểm cập nhật, ví dụ “48 studio còn chỗ cuối tuần này (cập nhật 10 phút trước)”.
- Thay hàng hashtag giống hệt nhau bằng vài gợi ý dạng câu ngắn (“Hẹn hò cuối tuần, không cần kinh nghiệm”).
- Nút “Gợi ý cho tôi” dùng icon tia sáng hoặc mũi tên phải, không dùng mũi tên “<”.
- Thêm dấu vết con người: tên và ảnh nghệ nhân, một câu giới thiệu do chính họ viết, đánh giá có tên thật.
- Một bộ icon thống nhất (lucide-react), không gắn icon vào mọi dòng chữ.

### 7.7 Khả năng truy cập

Focus ring rõ ràng; label cho mọi input lọc; alt cho ảnh; vùng bấm tối thiểu 44px trên mobile; điều hướng được bằng bàn phím; không truyền đạt thông tin chỉ bằng màu.

## 8. Kiến trúc kỹ thuật

### 8.1 Giao diện (React + Tailwind)

Component đề xuất: `ExplorePage`, `HeroSearch`, `CategoryChips`, `FilterBar`, `FilterChips`, `ViewToggle`, `ResultsHeader`, `ResultsGrid`, `StudioCard`, `WorkshopCard`, `MobileFilterSheet`, `StudioPage`, `WorkshopPage`, `BookingForm`, và nhóm màn hình cho studio (`StudioDashboard`, `WorkshopEditor`, `SessionCalendar`, `BookingList`) cùng màn hình admin.

- Màu, font, bo góc khai báo trong theme/styles của dự án, không rải giá trị cứng trong component.
- Trạng thái bộ lọc và chế độ xem lưu trên URL query (ví dụ `?view=studio&when=weekend&area=thu-duc&price=2&type=gom&sort=best`) để chia sẻ link và hoạt động đúng với nút Back.
- Dữ liệu công khai lấy qua API; dữ liệu mô phỏng chỉ dùng fixture/demo có nhãn, không làm fallback khi API lỗi.

### 8.2 Backend

Đã chọn Node.js/TypeScript/Express 5, PostgreSQL qua pg + SQL thuần, Zod, JWT cookie và kiểm tra phiên. Không dùng ORM hoặc Supabase Auth. CORS/credentials đã có trong API; cần kiểm chứng lại trên môi trường triển khai. Ranker Python/FastAPI là kế hoạch, chưa có dịch vụ hoàn chỉnh nối vào sản phẩm. Xem [kiến trúc](../engineering/02-architecture.md).

### 8.3 Danh sách API chính

Hợp đồng đã có và các endpoint còn là kế hoạch được tách tại [đặc tả API](../engineering/03-api-spec.md). POST /bookings nhận requestId, sessionId, quantity và paymentChoice; cùng mã/cùng nội dung trả đặt chỗ gốc. Hủy lấy GET /bookings/:id/cancellation-quote rồi POST /bookings/:id/cancel với quoteToken; điều kiện thay đổi phải xác nhận lại. Không xem các API hoàn tự động/chi trả/điểm danh từng vé trong tài liệu mục tiêu là API đã có.

## 9. Quy tắc nghiệp vụ và bảo mật

- **Thanh toán:** Open Slot thu tiền thanh toán trước qua payOS và payout cho studio sau buổi học qua chi hộ; tiền trả tại studio đi trực tiếp.
- Thông tin tài khoản nhận payout chỉ chủ studio được sửa; mỗi lần đổi cần xác thực lại, ghi nhật ký, thông báo chủ studio; payout tạm giữ đến khi xác minh lại.
- Mọi thao tác tiền (thu, hủy, hoàn, miễn nợ, điều chỉnh, payout) ghi nhật ký người thao tác, số tiền, trước-sau, lý do.
- Đã khóa chống tạo đặt chỗ trùng bằng requestId lưu ở giao diện và booking_requests tại API; mỗi lượt đặt mới có chủ ý được dùng mã mới.
- Giới hạn tần suất kiểm tra thanh toán thủ công; xử lý khi cổng thanh toán không phản hồi.
- Trước khi khách xác nhận, hiển thị rõ: số tiền cọc, phần trả tại studio, chính sách hủy, ai thu tiền, cách liên hệ; nhắc chỉ thanh toán theo thông tin trên Open Slot.
- Giám sát: tiền chưa đối soát, số dư ví Bảo Kim so với khoản hoàn và payout sắp đến hạn, khoản hoàn sắp quá hạn, lệnh chi lỗi, hàng đợi email, số chỗ không khớp.

Giữ chỗ nguyên tử và kiểm tra quyền tại API; không tin tiền từ client. Mọi bảng public có RLS, không dùng phân quyền DB công khai thay cho API. Không sửa migration đã chạy, không ghi secret trong tài liệu. Các cơ chế chi trả/đổi tài khoản/miễn nợ ở trên là yêu cầu, chưa phải khả năng hiện có.

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

| Nhóm              | Ví dụ ca kiểm thử                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lọc và chế độ xem | Chuyển Studio/Workshop giữ nguyên bộ lọc; xóa từng chip; tải lại trang vẫn giữ trạng thái từ URL; kết quả rỗng hiển thị thông báo hợp lý                                    |
| Đặt chỗ           | Đặt đúng số chỗ còn; đặt vượt chỗ bị chặn; hai người đặt chỗ cuối cùng cùng lúc; hủy trả chỗ lại                                                                            |
| Phân quyền        | Nhân viên studio A không xem được booking studio B; khách không xem được booking của người khác; vãng lai không đặt được; gọi API trực tiếp không qua giao diện vẫn bị chặn |
| Trạng thái        | Studio hủy session có booking thì booking bị hủy và khách được báo; không viết đánh giá khi booking chưa hoàn thành                                                         |
| Giao diện         | 4/3/2/1 cột đúng theo điểm ngắt; tên dài không tràn card; bottom sheet lọc trên mobile; thanh lọc sticky không che nội dung                                                 |
| Truy cập          | Điều hướng bằng bàn phím; độ tương phản; focus ring; vùng bấm 44px                                                                                                          |
| Dữ liệu biên      | Giá bằng 0, tên rất dài, studio chưa có đánh giá, session sát giờ bắt đầu, session đầy                                                                                      |

## 12. Lộ trình triển khai

| Giai đoạn               | Nội dung                                                                                                       | Kết quả                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 0. Chuẩn bị             | Chốt các quyết định mở (mục 13); thu thập ảnh thật và nội dung của một số studio thí điểm; chốt bảng màu, font | Bộ nội dung và quyết định thiết kế |
| 1. Giao diện khám phá   | Trang khám phá với dữ liệu mẫu: toggle, bộ lọc, hai loại card, responsive                                      | Bản demo giao diện chạy được       |
| 2. Backend và đặt chỗ   | Cơ sở dữ liệu, API công khai, đăng ký/đăng nhập, đặt và hủy chỗ                                                | Khách đặt được chỗ thật            |
| 3. Cổng studio          | Đăng ký studio, quản lý workshop, session, booking                                                             | Studio tự vận hành được            |
| 4. Quản trị và đánh giá | Duyệt studio, đánh giá, kiểm duyệt, thông báo                                                                  | Vòng vận hành khép kín             |
| 5. Kiểm thử và ra mắt   | Kiểm thử toàn diện, thí điểm với một số studio, thu phản hồi                                                   | Phát hành bản đầu                  |

Thời lượng từng giai đoạn ước lượng sau khi chốt nhân sự và phạm vi.

## 13. Quyết định còn mở và rủi ro

### 13.1 Quyết định còn mở

Chín nhóm đã chốt và ngoại lệ tạm ứng/biên đổi giờ/phí được ghi ở [sổ chính sách](../policy/README.md). Không còn treo thời gian chi trả, bên chịu phí, thứ tự chi, duyệt mọi lệnh, hạn từ lúc hủy hoặc cách xử lý vắng. Còn chi tiết vận hành: kênh chứng minh gửi thông báo, nguồn dự phòng/thu hồi, quyền tạm giữ khi khóa/đổi tài khoản, N ngày dự báo ví, lịch nghỉ, tên bên vận hành và xác minh hợp đồng/biểu phí nhà cung cấp.

### 13.2 Rủi ro

| Rủi ro                                                 | Giảm thiểu                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Thiếu ảnh thật, giao diện trông như template           | Thu thập ảnh từ studio thí điểm trước giai đoạn 1                      |
| Studio phản hồi booking chậm                           | Hạn xác nhận, nhắc việc cho studio, cân nhắc tự xác nhận               |
| Dữ liệu chỗ trống sai lệch (đặt trùng)                 | Giao dịch khi giữ chỗ, kiểm thử đồng thời                              |
| Đánh giá giả hoặc vi phạm                              | Chỉ cho đánh giá sau booking hoàn thành; công cụ ẩn nội dung cho admin |
| Card 4 cột bị chật nếu dùng sidebar                    | Dùng thanh lọc ngang hoặc hạ xuống 3 cột ở màn dưới 1536px             |
| Ít studio ở mỗi nơi, trang trông thưa khi mở toàn quốc | Ra mắt lần lượt từng thành phố; gợi ý thành phố gần nhất khi trống     |

### 13.3 Quyết định và trạng thái (07/11/2026)

Ngoài ba chế độ, cọc 1–50%, hủy 24 giờ, hoàn 7 ngày làm việc, hủy/điểm danh từng vé và miễn sau mốc nhả, chủ sản phẩm chốt thêm:

| Nhóm                   | Quyết định                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đổi giờ                | Chỉ cho đổi khi giờ học mới còn trên 12 giờ; còn đúng hoặc dưới 12 giờ thì từ chối đổi. Nếu không thể giữ lịch cũ, studio phải hủy. Hạn phản hồi là thời điểm sớm hơn giữa thông báo + 48 giờ và giờ mới − 12 giờ.                                                         |
| Chi trả studio         | Trong 3 ngày làm việc sau khi buổi kết thúc.                                                                                                                                                                                                                               |
| Khiếu nại sau chi trả  | Thông thường studio trả lại tiền cho Open Slot trước khi nền tảng hoàn khách. Nếu studio chậm khiến khoản hoàn có nguy cơ vượt 7 ngày làm việc từ lúc hủy, Open Slot tạm ứng hoàn khách đúng hạn, rồi tiếp tục thu hồi từ studio; không bắt khách chờ và không tự gia hạn. |
| Hạn hoàn               | 7 ngày làm việc từ lúc hủy; thiếu/sai tài khoản không đặt lại hạn. Cảnh báo và yêu cầu bổ sung ngay.                                                                                                                                                                       |
| Vắng mặt               | Chỉ giữ cọc gốc; hoàn phần đã trả vượt cọc. Không cọc thì phần giữ bằng 0.                                                                                                                                                                                                 |
| Thứ tự chi             | Khoản nào đến hạn trước xử lý trước, không phân biệt hoàn khách hay chi trả studio.                                                                                                                                                                                        |
| Phí                    | Studio chịu đúng phí thực tế nhà cung cấp cho từng lần thu, hoàn và chi trả, không cộng phụ phí Open Slot. Công bố cách tính và tính rõ cho studio trước khi bật cọc; trừ phí vào khoản chi của chính buổi học; nếu khoản chi đã hoàn tất thì ghi khoản studio phải hoàn riêng cho buổi đó, không chuyển sang buổi khác. Không trừ phí vào khoản khách được hoàn.                                                         |
| Duyệt lệnh chi         | Mọi khoản chuyển, gồm khoản tạm ứng hoàn khách, đều cần quản trị duyệt trong giai đoạn đầu. Bước duyệt không đặt lại hạn.                                                                                                                                                  |
| Cơ hội xác nhận sẽ đến | Ít nhất 2 giờ sau thông báo yêu cầu xác nhận gửi thành công. Chưa gửi được thì không nhả do thiếu xác nhận.                                                                                                                                                                |

Tất cả là đặc tả nghiệp vụ; không coi quyết định là tính năng đã triển khai. Xem trạng thái mã và roadmap. Phần nhà cung cấp, nguồn tiền và cơ chế vận hành vẫn phải được chuẩn bị/kiểm chứng.

## 14. Định vị và phân tích đối thủ

So sánh với SlotBetter (slotbetter.io). Thông tin khảo sát cũ từ trang giới thiệu và ảnh do chủ dự án cung cấp; chưa xác minh lại giá/chính sách đối thủ trong lần đồng bộ này, không dùng làm giá hiện hành.

|                     | SlotBetter                                                                                                                                | Open Slot                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Bản chất            | Công cụ quản lý đặt chỗ cho tổ chức (SaaS), mỗi tổ chức có trang và thương hiệu riêng                                                     | Sàn khám phá cho người dùng cuối, studio nằm bên trong                          |
| Khách hàng chính    | Người làm workshop                                                                                                                        | Người tìm workshop, studio là phía cung                                         |
| Cách khách tìm thấy | Tổ chức tự chia sẻ link                                                                                                                   | Khách tìm theo địa điểm, thời gian, giá, loại hình                              |
| Tiền                | Khách chuyển thẳng vào tài khoản tổ chức, SlotBetter không giữ tiền                                                                       | Định hướng: thu cọc qua nền tảng, chi trả sau buổi; phần còn lại trả tại studio |
| Thu phí             | Phí cố định theo lần xuất bản sự kiện (miễn phí tới 10 người; 250.000đ tới 100 người; 680.000đ cho 101-300 người; trên 300 báo giá riêng) | Miễn phí giai đoạn đầu; phí thu/chi theo bản nháp chính sách                    |
| Xác minh            | Yêu cầu giấy tờ doanh nghiệp trước khi xuất bản                                                                                           | Hai bậc: đã duyệt, đã xác minh                                                  |

**Định vị:** SlotBetter giúp tổ chức đã có khách nhận đặt chỗ gọn hơn; Open Slot giúp người chưa biết đi đâu tìm được workshop phù hợp và giúp studio có khách mới. Giá trị của Open Slot nằm ở khám phá và lượng khách, không ở công cụ vận hành.

**Điều học được cho cổng studio:** danh sách chia tab nháp / đang hoạt động / đã qua; banner nhắc xác minh nổi bật; trạng thái trống có hướng dẫn bước tiếp theo; hiển thị rõ ai nhận tiền và chính sách hủy trước khi thanh toán. Cân nhắc danh sách chờ (P1) vì đây là nỗi đau phổ biến của người làm workshop.

**Không bắt chước:** tùy biến thương hiệu, phông chữ, tên miền riêng cho từng tổ chức. Open Slot là sàn nên giao diện thống nhất giúp khách so sánh; studio chỉ đổi ảnh bìa và mô tả.

## Phụ lục. Prompt triển khai giao diện (rút gọn)

Dán vào công cụ AI/code để dựng giao diện trang khám phá:

- Stack: React + Tailwind CSS. Giữ nguyên chức năng;&#32;
- Trang “Khám phá workshop” có toggle Studio | Workshop dùng chung bộ lọc; hai loại card (StudioCard, WorkshopCard) cùng khung; dữ liệu mẫu hai bảng studio và workshop.
- Bộ lọc: Thời gian, Tỉnh/Thành phố (kèm Khu vực tùy chọn), Giá; hàng chip loại workshop; chip bộ lọc đang áp dụng có nút xóa; thanh lọc ngang sticky; mobile dùng hàng điều khiển dính (ẩn khi cuộn xuống) và bottom sheet cho bộ lọc đầy đủ. Trạng thái bộ lọc lưu trên URL.
- Lưới: 4 cột từ 1280px, 3 cột từ 1024px, 2 cột từ 768px, 1 cột dưới đó. Số kết quả và sắp xếp nằm một hàng ngang.
- Typography: Lora cho tiêu đề, Be Vietnam Pro cho nội dung, theo bảng cỡ chữ ở mục 7.5; tương phản tối thiểu 4.5:1.
- Giảm cảm giác template: ảnh thật thay icon, ít gradient và lớp bo góc lồng nhau, câu chữ cụ thể, một màu nhấn có cá tính, sửa icon nút “Gợi ý cho tôi”, thay logo placeholder.
- Đầu ra: component tách nhỏ, màu/font/bo góc trong `tailwind.config`, accessible, responsive, kèm danh sách thay đổi so với bản cũ.

## Cập nhật phạm vi 4.2 (08/11/2026)

Đã bổ sung hủy từng chỗ và thay mã cọc theo số chỗ gốc còn lại, giữ nguyên hạn giữ chỗ. Lưu lịch sử số chỗ/tổng tiền/cọc ban đầu; chỉ vô hiệu vé đã chọn. Tiền về mã cũ hoặc mã mới được xác minh và áp dụng một lần, phần dư hoặc không thể xác nhận được ghi cần hoàn. Chưa có chi hoàn tự động hoặc đối soát cổng toàn hệ thống. Chi tiết triển khai và bằng chứng kiểm tra tại [trạng thái hiện tại](../project/current-status.md) và [API](../engineering/03-api-spec.md).
