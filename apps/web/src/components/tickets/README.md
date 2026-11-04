# Vé Open Slot

Trang chủ dùng `TicketRow` cho tối đa tám workshop theo cấu hình nội dung; trang khám phá dùng `WorkshopCard` bọc `TicketCard`. `TicketRow` cũng dùng `TicketCard` với biến thể nổi bật cho vé đầu tiên. Studio trên cả hai trang dùng chung `StudioCard` dạng ticket.

## Cấu trúc code

- `TicketShell`: hình học khuyết và phân chia thân/cuống. `tickets.css` chỉ giữ mask và quy tắc in.
- `TicketPrimitives`: link toàn vé, tiêu đề/studio và hành động dùng chung.
- `TicketContent`: ảnh, thông tin buổi, nghệ nhân, giá/rating/số chỗ. Cùng `TicketFooter` hỗ trợ hàng ngang hoặc cuống dọc.
- `MediaImage` trong `components/ui`: xử lý ảnh đang tải, lỗi và placeholder cho vé, hero, khối nghệ nhân.
- `useBookingTicketActions`: logic tải PNG và in; phần JSX của `BookingTicket` chỉ ghép nội dung.
- `booking.ts`: danh sách trạng thái dùng chung giữa vé và trang demo.

Layout, khoảng cách, cỡ chữ, màu và responsive dùng Tailwind. Trang chủ dùng lưới cùng container với tiêu đề: hai cột từ 1024px, vé workshop đầu `featured` trải hai cột; các vé còn lại và studio chia hai cột. Cuống ảnh dùng cùng `TicketStub` trên mọi trang.

Dữ liệu API và bản xem trước admin lấy từ `/home/featured` và `/admin/noi-dung/preview` với cùng hợp đồng: studio có loại, địa chỉ, cấp xác minh, số workshop/buổi còn chỗ và giá thấp nhất của buổi sắp diễn ra. Studio chưa có buổi còn chỗ nhận `startingPrice: null` và hiển thị “Chưa có lịch tổ chức”. Chỉ dùng dữ liệu từ API; mock chỉ dành cho kiểm thử.

```tsx
import { TicketRow, TicketCard, BookingTicket, toTicketProps } from './components/tickets';

// Chuyển dữ liệu catalog hiện có sang props vé.
<TicketRow {...toTicketProps(workshop)} />
<TicketCard {...toTicketProps(workshop)} pattern />
<TicketRow loading />
<TicketCard loading />

// Dữ liệu booking phải đến từ hệ thống đặt chỗ khi tích hợp thực tế.
<BookingTicket
  {...toTicketProps(workshop)}
  studio={{ name: 'Gốm Nhà Mình', provinceName: 'TP. Hồ Chí Minh', address: 'Địa chỉ studio' }}
  booking={{
    code: 'OS-9031-1017', status: 'confirmed', partySize: 2,
    paymentMethod: 'at_studio', paymentStatus: 'unpaid',
  }}
/>
```

Các component cũng nhận trực tiếp `workshop`, `studio`, `session`, `artisan` theo `TicketData` trong `types.ts`. `session.startAt` là ISO 8601 có múi giờ, hoặc `null` khi chưa có lịch. `workshop.takeaway` và `requirements` là các trường bổ sung tùy chọn cho thông tin ngắn trên vé ngang. Tiền là số nguyên VND. Có thể truyền `href` cho vé catalog; toàn bộ vé là một link, không lồng button/link bên trong.

## Bố cục và trạng thái

- `TicketShell` nhận `body`, `stub`, `variant="row" | "card"`, `pattern` mặc định `false`.
- `TicketInfoBox` được đặt trong `dl`, nhận `label`, `value`, `detail`, `emphasis`.
- Vé ngang có ảnh đầy cuống cùng ngày/giờ đè trên lớp tối; thiếu ảnh dùng nền theo loại. Thân có loại, số vé, studio, nghệ nhân, dòng thời lượng/thành phẩm; giá và rating bên trái, hành động bên phải. `SeatsStamp` hiển thị con dấu khi còn 1–3 chỗ, các trường hợp khác dùng `SeatsBadge`. Dưới 768px thân ở trên, cuống ở dưới.
- Số chỗ chỉ hiện một lần trong thân vé, không lặp trong ô thông tin. Vé hết chỗ vẫn là link truy cập được. Các trạng thái dùng chữ và độ đậm, không chỉ dựa vào màu.
- `formatSessionDate(value, { parts: true })` cung cấp các phần ngày/giờ theo `Asia/Ho_Chi_Minh`; cách gọi chuỗi cũ vẫn được hỗ trợ.
- QR mã hóa `booking.code`, kích thước hiển thị 144px có quiet zone. Đây không phải cơ chế xác thực hay điểm danh ở backend.
- `Lưu vé` xuất PNG bằng `html-to-image`; `In vé` tạo vùng in riêng và mở hộp thoại in. Bản in giữ QR, mã và trạng thái. Vé hủy có nhãn và đường gạch chéo.

`booking.status`: `pending`, `confirmed`, `completed`, `cancelled`.
`paymentMethod`: `at_studio`, `prepaid`.
`paymentStatus`: `unpaid`, `pending`, `paid`, `refunded`.

## Đổi màu và hình dạng

Trong `apps/web/tailwind.config.js`, sửa `const primary` để đổi màu nhấn đồng bộ cho nút, ô thông tin, đường ngăn và nhãn chỗ. Cập nhật `primary-hover` thành sắc độ hover phù hợp nếu đổi họ màu.

Các token riêng của vé nằm trong `theme.extend.colors.ticket`: `DEFAULT`, `stub`, `accent`, `line`, `ink`, `skeleton`. Bo góc: `borderRadius.ticket`, `borderRadius['ticket-info']`. Bán kính khuyết: `spacing['ticket-notch']`.

Khuyết dùng hai lớp CSS radial mask trên mỗi phần của vé với phép `intersect`; không có hình tròn phủ màu nền. Màu đen trong mask chỉ biểu thị alpha, không phải màu hiển thị. Đường ngăn dùng border dotted khi `perforated` (vé ngang trang chủ), dashed cho các biến thể còn lại; các chi tiết trang trí được ẩn khỏi accessibility tree.

Không thêm API booking/thanh toán/điểm danh trong thay đổi giao diện này. Dữ liệu demo được ghi rõ là mô phỏng.

`TicketRow` nhận thêm `featured?: boolean` và `ticketNumber?: number`. Workshop dùng `categoryId`; tên, icon, màu và ảnh dự phòng lấy qua `getCategoryMeta(id)` từ dữ liệu categories dùng chung. `categoryColor(id)` trả màu CSS từ metadata.
