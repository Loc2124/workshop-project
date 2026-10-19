# Đặc tả API (khởi điểm — cập nhật khi triển khai)

Tiền: VND số nguyên. Thời gian: ISO 8601. Lỗi trả dạng `{ "error": { "code": "...", "message": "..." } }`.

## Xác thực
| Method | Đường dẫn | Vai | Ghi chú |
|---|---|---|---|
| POST | /auth/register | công khai | Tạo customer |
| POST | /auth/login | công khai | Trả token |
| GET | /me | đăng nhập | |

## Khách hàng
| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | /workshops | Lọc: `date_from`, `date_to`, `price_min`, `price_max`, `district`, `category`; phân trang `page`, `page_size` (mặc định 1, 20; tối đa 100). Trả `{ items, pagination: { page, pageSize, total } }` |
| POST | /search | Body: `{ filters, need_text }` → danh sách đã lọc cứng rồi xếp hạng; ghi `search_logs` |
| GET | /workshops/:id | Chi tiết workshop đã duyệt của organizer đã duyệt + các buổi `scheduled` tương lai còn chỗ |
| POST | /bookings | Body: `{ session_id, quantity }` → giữ chỗ + tạo thanh toán; trả `{ booking, checkout_url }` |
| GET | /bookings/:id | Chỉ chủ đơn |
| GET | /me/bookings | Lịch sử |
| GET | /bookings/:id/tickets | Vé của đơn đã `paid` |
| POST | /bookings/:id/review | Mức 2. `{ rating, comment }` |

## Thanh toán
| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | /webhooks/payos | Công khai nhưng xác thực chữ ký; idempotent |
| GET | /payment/return, /payment/cancel | Trang trả về cho khách (chỉ hiển thị; **không** dùng để xác nhận thanh toán) |

## Đơn vị tổ chức (mọi truy vấn lọc theo organizer_id)
| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | /organizer/profile | Tạo/sửa hồ sơ |
| GET/POST | /organizer/workshops | Danh sách, tạo |
| PATCH | /organizer/workshops/:id | Sửa workshop của mình |
| POST | /organizer/workshops/:id/sessions | Tạo buổi |
| PATCH | /organizer/sessions/:id | Sửa lịch/giá/sức chứa; không giảm sức chứa dưới số đã giữ/bán hoặc đổi giá khi có booking `pending`/`paid` |
| POST | /organizer/sessions/:id/cancel | Hủy buổi; booking `pending` chuyển `cancelled`, booking `paid` chuyển `refund_needed` |
| GET | /organizer/sessions/:id/registrations | Danh sách đăng ký (triển khai cùng booking) |
| GET | /organizer/revenue | Mức 2 |
| POST | /organizer/tickets/check-in | Mức 3 |

Các endpoint organizer trả `404` nếu workshop/buổi không tồn tại hoặc không thuộc đơn vị đang đăng nhập, để không làm lộ tài nguyên của đơn vị khác. Workshop mới có trạng thái `pending`; sửa workshop đã duyệt đưa trạng thái về `pending` để admin duyệt lại.

## Quản trị
| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | /admin/organizers, /admin/workshops | Lọc theo trạng thái |
| PATCH | /admin/organizers/:id/status | `pending|approved|rejected` |
| PATCH | /admin/workshops/:id/status | Như trên |
| GET | /admin/bookings, /admin/webhook-events | Theo dõi; có lọc `refund_needed`, `signature_valid=false` |

## Dịch vụ ranker (nội bộ)
`POST {RANKER_URL}/rank` — xem `docs/05-ranking-spec.md`.

### Quy ước thời gian
- `date_from` và `date_to` nhận ngày lịch `YYYY-MM-DD`, tính theo `Asia/Ho_Chi_Minh` (UTC+7); khoảng lọc là nửa mở `[date_from 00:00, date_to + 1 ngày 00:00)`.
- API tạo/sửa buổi chỉ nhận thời điểm ISO 8601 có độ lệch múi giờ. DB lưu `timestamptz`; web định dạng qua helper dùng chung đặt `timeZone: 'Asia/Ho_Chi_Minh'`.
