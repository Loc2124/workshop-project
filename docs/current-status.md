# Trạng thái mã nguồn Open Slot

Cập nhật: 03/11/2026. Đây là trạng thái repository, không phải xác nhận phát hành production. README là điểm bắt đầu; PRD, roadmap và đặc tả mô tả cả chức năng dự kiến.

## Phạm vi đã triển khai

- Trang khách: trang chủ, khám phá/lọc, chi tiết workshop/studio, giới thiệu và trang dành cho nghệ nhân.
- Xác thực: đăng ký, đăng nhập, JWT cookie, refresh token xoay vòng, thu hồi phiên và phân quyền hệ thống/thành viên studio.
- Studio: đăng ký, hồ sơ/minh chứng, quản lý workshop và lịch tổ chức, quyền owner/staff.
- Admin: duyệt studio/workshop, tổng quan, người dùng, danh mục, đơn đặt chỗ, báo cáo nội dung, nội dung nổi bật, mẫu thông báo, cấu hình và nhật ký thao tác.
- Ảnh/hiệu năng: nén ảnh tại trình duyệt, thumbnail/ảnh vừa, font tự host, tải thành phần theo nhu cầu, cache phiên/query và kiểm soát bundle.
- Có 30 file migration; việc có file không xác nhận migration đã áp dụng ở mọi môi trường.

## Phần còn cần hoàn thiện hoặc xác minh

- Luồng khách mua vé từ đặt chỗ đến thanh toán, nhận vé và check-in cần kiểm chứng xuyên suốt; trang quản lý đơn và vé demo không phải bằng chứng luồng này đã hoàn chỉnh.
- Ranker theo đặc tả chưa có dịch vụ hoàn chỉnh nối vào sản phẩm.
- URL production, cấu hình hosting, CORS/cookie, storage và migration mới nhất cần xác minh ở môi trường triển khai.

## Kiểm tra trong đợt cập nhật này

- `npm run build`: API và web qua; Vite có cảnh báo annotation từ dependency Zod, không làm build thất bại.
- `npm run test --workspace @workshop/web`: 35 file, 168 test qua.
- Tại `apps/api`, `npx vitest run tests/unit`: 22 file, 87 test qua; không chạy integration test hoặc thao tác database.
- Lint loại trừ thư mục công cụ tạm đã được Git bỏ qua; chuẩn hóa 19 file không đạt Prettier.
- Không chạy migration, seed hoặc triển khai hosting trong đợt này. Các số đo trình duyệt trong tài liệu hiệu năng thuộc lần đo được ghi ở tài liệu đó, không được đo lại trong đợt cập nhật này.
