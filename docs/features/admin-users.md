# Quản lý người dùng

> Đồng bộ tài liệu: 07/11/2026. [Mục lục](../README.md) · [Trạng thái mã nguồn](../project/current-status.md) · [Chính sách và mục còn chờ](../policy/README.md). Mô tả hiện có và mục tiêu phải đọc theo nhãn; số đo/kết quả cũ chỉ đúng ở lần ghi nhận.

Trang `/admin/nguoi-dung` (alias `/admin/users`) dùng DataTable và dropdown cuối hàng. Vai trò tài khoản: customer/studio_owner/admin. Studio_owner không tự cấp quyền tại studio bất kỳ; quan hệ owner/staff vẫn nằm trong studio_members. Đổi vai trò tài khoản không tự chuyển quyền sở hữu hoặc gỡ thành viên. Nhân viên được nhận diện bằng nhãn “Nhân viên tại n studio”, kể cả khi tài khoản đang có vai trò customer.

Migration 020 thêm enum studio_owner; migration 021 thêm is_blocked, blocked_reason/by/at, avatar_url; chuyển tài khoản customer đang sở hữu studio sang studio_owner. Trigger cấp studio_owner khi tạo quan hệ owner mới, giữ nguyên vai trò admin. Chưa có giao diện mời nhân viên hoặc cấu hình quyền chi tiết cho nhân viên.

- `GET /admin/nguoi-dung`: page/pageSize/sort/q/status/period=7d, status all/customer/studio_owner/admin/blocked. Tab vai trò bao gồm cả tài khoản bị khóa thuộc vai trò đó; tab Bị khóa đếm tất cả tài khoản bị khóa. Trả rows/total/statusCounts, không trả mật khẩu hay token.
- `PATCH /admin/nguoi-dung/:id`: action block/unblock/change_role, expectedRole và expectedBlocked chống thao tác trên dữ liệu cũ. Block/change_role yêu cầu reason 10–1000 ký tự; change_role thêm role. Unblock không yêu cầu lý do nhập tay, audit vẫn ghi “Mở khóa tài khoản”.

Backend trả 400 khi tự khóa/tự hạ quyền hoặc tác động admin hoạt động cuối cùng. Mọi thao tác quản lý dùng cùng advisory transaction lock và kiểm tra lại quyền người thực hiện sau khi lấy lock, tránh hai admin đồng thời vô hiệu hóa nhau. Tài khoản đổi trạng thái/vai trò giữa chừng trả 409.

Khóa hoặc đổi vai trò thu hồi tất cả auth_sessions của tài khoản cùng transaction với thay đổi và audit. Mở khóa không khôi phục phiên cũ. Login đúng mật khẩu của tài khoản bị khóa trả 403 với thông báo rõ; access-token và refresh-token cũ đều không hợp lệ. Cấp và làm mới phiên khóa dòng users trước auth_sessions để đồng bộ với thao tác khóa, tránh phát sinh phiên mới sau khi tài khoản bị khóa. Trigger DB kiểm tra lại tài khoản khi cấp/đổi refresh token. JWT chấp nhận ba vai trò nhưng quyền thực tế luôn đọc lại từ DB ở mỗi request.
