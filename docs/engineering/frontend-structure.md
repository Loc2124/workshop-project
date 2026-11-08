# Cấu trúc frontend

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

## Các lớp chính

| Thư mục/file                              | Trách nhiệm                                                                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/HomePage.tsx`                      | Ghép các section của trang chủ; không chứa truy vấn, định vị hay CSS layout riêng.                                                                  |
| `components/home/`                        | Hero/tìm kiếm, danh sách workshop, ba bước trải nghiệm, giới thiệu dành cho nghệ nhân.                                                              |
| `hooks/useHomeCatalog.ts`                 | Bộ lọc trang chủ, lưu lựa chọn tỉnh, định vị tự động/thử lại, điều hướng URL, dữ liệu workshop nổi bật theo API, tối đa tám, chỉ các buổi đặt được. |
| `hooks/useProvinces.ts`                   | Danh mục tỉnh có studio, loading/error và hủy request; dùng chung cho trang chủ và khám phá.                                                        |
| `hooks/useBookingTicketActions.ts`        | Lưu PNG và in vé; tách khỏi phần trình bày booking.                                                                                                 |
| `components/layout/PageContainer.tsx`     | Một khung căn lề chung cho header, footer, các section và trang.                                                                                    |
| `components/layout/SectionHeading.tsx`    | Tiêu đề section, mô tả và hành động.                                                                                                                |
| `components/ui/MediaImage.tsx`            | Ảnh, placeholder khi chờ tải/thiếu/lỗi; dùng cho hero, ảnh nghệ nhân và vé.                                                                         |
| `components/tickets/TicketPrimitives.tsx` | Link toàn vé, tiêu đề/studio và hành động dùng chung.                                                                                               |
| `components/tickets/TicketContent.tsx`    | Giá, rating, số chỗ, nghệ nhân, ô lịch và footer vé.                                                                                                |
| `components/tickets/TicketShell.tsx`      | Ghép thân/cuống và hình học khuyết; hỗ trợ ngang/dọc/in.                                                                                            |
| `components/tickets/booking.ts`           | Nhãn trạng thái booking và thanh toán; trang demo dùng cùng danh sách trạng thái.                                                                   |

Các variant `TicketRow`, `TicketCard`, `BookingTicket` chỉ ghép những phần trên. Public props và `toTicketProps` giữ nguyên; xem [hướng dẫn component vé](ticket-components.md).

## Tailwind và CSS

- Layout, responsive, typography, màu, trạng thái hover/focus, spacing, skeleton và bo góc dùng utility Tailwind.
- Token/theme và styles hiện hành trong apps/web quyết định màu/font/bo góc. Giữ nền kem–xanh olive; không áp bảng màu MarketNest trong archive vào giao diện mới.
- Đã bỏ `pages/home.css` và các selector footer toàn cục. Không thêm CSS ghi đè theo tên trang cho component dùng chung.
- `tickets.css` chỉ còn mask hình học và điều kiện in cô lập vé. CSS cho slider native và lịch vẫn nằm trong stylesheet chung vì cần pseudo-element/biến của thư viện.
- Các component catalog cũ không còn được sử dụng (`ArtistRating`, `WorkshopImage`, `SessionDate`) đã được gỡ; logic ngày vẫn dùng `lib/format.ts`, ảnh dùng `MediaImage`, rating dùng phần nội dung vé.

## Độ rộng vé desktop

Danh sách trang chủ rộng bằng `PageContainer`, lưới hai cột từ 1024px với vé đầu nổi bật trải hai cột. `TicketRow` có cuống ảnh khoảng 28%, tối thiểu 120px; dưới 768px cuống xuống dưới. `BookingTicket` vẫn dùng cuống 12rem để QR 144px có khoảng trắng đầy đủ.

## Kiểm tra

```sh
npm run build --workspace @workshop/web
npx eslint apps/web/src
python output/playwright/home-ticket-grid-review.py
python output/playwright/logo-integration-review.py
node node_modules/tsx/dist/cli.mjs output/code-review/catalog-check.ts
```

Kiểm tra trình duyệt dùng dữ liệu demo/fixture cho tìm kiếm, định vị, responsive, mask, PNG và PDF; không thay thế kiểm thử tích hợp API/booking thật. Không có thay đổi database trong lần refactor này.
