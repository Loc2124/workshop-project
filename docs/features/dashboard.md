# Dashboard

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

`DashboardLayout` dùng chung Sidebar, Breadcrumb, DropdownMenu và Avatar cho hai khu vực quản lý. Props gồm `menuItems` (`label`, `to`, icon lucide), `roleLabel`, `user`, bộ chọn studio và thông tin workspace. Các trang con render qua `Outlet` trong vùng nội dung rộng tối đa `max-w-5xl`.

## Đường dẫn

| Studio                                      | Quản trị                                |
| ------------------------------------------- | --------------------------------------- |
| `/studio/:studioId` — Tổng quan             | `/admin/ho-so-studio` — Hồ sơ chờ duyệt |
| `/studio/:studioId/workshops` — Workshop    | `/admin/studios` — Tất cả studio        |
| `/studio/:studioId/sessions` — Lịch và slot | `/admin/workshops` — Workshop           |
| `/studio/:studioId/bookings` — Đặt chỗ      | `/admin/users` — Người dùng             |
| `/studio/:studioId/profile` — Hồ sơ studio  |                                         |

`/studio` chọn studio đầu tiên. Bộ chọn studio giữ trang con, query và hash khi thay ID studio trong đường dẫn. Chỉ hiển thị studio mà tài khoản là chủ sở hữu. Các đường dẫn cũ có query `studioId` và `/studio/studios/:studioId` được chuyển tiếp.

Lịch và Đặt chỗ khóa khi studio chưa duyệt; nhập URL trực tiếp cũng trở về Tổng quan. Hồ sơ bị từ chối có dấu nhắc trên menu và nút mở thẳng form bổ sung. API `/me/studios` trả thêm `isDraft`, gồm hồ sơ nháp của chính chủ; tiếp tục nháp qua trang đăng ký với query `draftStudioId`. Thông tin nháp chưa gửi vẫn lưu trong phiên trình duyệt hiện có.

Số workshop đang mở tính từ workshop đã duyệt có buổi sắp tới còn chỗ. Slot còn trống là tổng sức chứa còn lại sau khi trừ ghế đã bán và đang giữ, chỉ tính buổi sắp tới đang lên lịch. Chưa có API thống kê đơn đặt chỗ nên hiển thị dấu gạch thay vì số 0. Lý do từ chối hiện đọc từ `rejectionReason` nếu có, nếu thiếu thì thông báo chưa có lý do được ghi nhận. Ngày gửi sử dụng `createdAt` từ dữ liệu hồ sơ hiện có.

`RequireRole` bảo vệ các route cha. Quyền `studio_owner` lấy từ membership `owner` trả về bởi `/me/studios`; quyền `admin` lấy từ tài khoản. Không đủ quyền chuyển về `/`. Khi không kiểm tra được phiên hoặc quyền, hiển thị lỗi và nút thử lại.

Các đường dẫn quản lý, đăng ký và trang công khai cũ chuyển tiếp sang đường dẫn mới. Đăng ký studio đầu tiên ở `/dang-ky-studio` và yêu cầu đăng nhập, vì người đăng ký chưa có membership chủ studio.

## Trạng thái chức năng

Workshop, lịch và hồ sơ dùng API hiện có; chủ studio có trang đặt chỗ, cấu hình cọc và ghi nhận thu/hoàn/tham dự theo khả năng hiện tại. Admin có Tổng quan và các danh sách Người dùng, Đặt chỗ, Báo cáo kèm thao tác theo quyền; không còn chỉ đọc. Những khoảng trống tiền/điểm danh được ghi ở trạng thái và policy.

Sidebar thu gọn thành icon dưới 1024px. Trên điện thoại, SidebarTrigger mở menu có đầy đủ nhãn; Escape đóng menu và đưa focus về nút mở. Các kiểu chữ, khoảng cách và bo góc nhỏ được giới hạn trong dashboard.

Xem `admin-overview.md` cho trang Tổng quan `/admin`, số liệu và nhật ký. Các danh sách có API và hành động theo từng tài liệu nghiệp vụ, không suy từ vai dashboard rằng được phép tự ghi nhận tiền.
