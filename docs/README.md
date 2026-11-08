# Tài liệu Open Slot

Cập nhật 07/11/2026. Đây là điểm bắt đầu đọc tài liệu toàn dự án. Các đường dẫn cũ đã được chuyển theo [bản đồ file](document-map.json).

## Đọc theo nhu cầu

| Bạn cần                                | Đọc trước                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hiểu sản phẩm và phạm vi đồ án         | [Tổng quan dự án](project/overview.md) → [PRD](project/01-prd.md)                                                                                                            |
| Biết mã hiện tại làm được gì           | [Trạng thái mã nguồn](project/current-status.md)                                                                                                                             |
| Chốt nghiệp vụ tiền/chỗ/vé             | [Chỉ mục chính sách](policy/README.md) → [bảng chuyển trạng thái](policy/bang-chuyen-trang-thai.md)                                                                          |
| Lịch ngày nghỉ và quyết toán           | [Quy tắc lịch ngày làm việc và quyết toán](policy/financial-calendar-and-settlement.md), [vận hành thanh toán](operations/payment-operations.md)                               |
| Đọc chính sách cho khách hoặc studio   | [Chính sách khách](policy/chinh-sach-dat-cho-khach.md), [điều khoản studio](policy/dieu-khoan-studio.md) — đều là bản nháp, chưa dùng làm cam kết công khai                  |
| Triển khai chức năng còn thiếu         | [Roadmap hiện hành](project/roadmap.md), [đặt chỗ hiện tại](features/customer-bookings.md)                                                                                   |
| Phát triển hoặc kiểm tra API           | [Tech stack](engineering/00-tech-stack.md), [kiến trúc](engineering/02-architecture.md), [API](engineering/03-api-spec.md), [kế hoạch kiểm tra](engineering/06-test-plan.md) |
| Triển khai môi trường và vận hành tiền | [Deploy](operations/deploy.md), [dòng tiền mục tiêu](operations/payment-operations.md), [checklist phát hành](operations/production-readiness-checklist.md)                  |
| Tìm tài liệu từng màn hình/chức năng   | [Danh mục đầy đủ](danh-muc-tai-lieu.md)                                                                                                                                      |
| Xem bằng chứng/số đo/bản nháp cũ       | [Lưu trữ](archive/README.md) — không coi số đo cũ là kết quả hiện tại                                                                                                        |

## Phân biệt trạng thái

- **Đã có trong mã:** đã tìm thấy triển khai; không đồng nghĩa được kiểm chứng trên production.
- **Đã kiểm tra:** phải kèm phạm vi, thời điểm, môi trường và kết quả. Không dùng kết quả mô phỏng để khẳng định đã chuyển tiền thật.
- **Đặc tả mục tiêu:** nghiệp vụ cần triển khai; chưa được phép mô tả là tính năng đang hoạt động.
- **Chờ chốt/xác minh:** không tự áp dụng thành chính sách hoặc mặc định cấu hình.
- **Lưu trữ:** bằng chứng lịch sử/nguồn đầu vào; không còn là tài liệu vận hành chính.

## Nguồn sự thật

1. Quyết định chủ sản phẩm đã xác nhận trong hội thoại được ghi ở [chỉ mục chính sách](policy/README.md).
2. Ba file policy cùng bản cập nhật tài liệu là đặc tả bổ sung; mục có nhãn đề xuất vẫn chờ chốt. Khi mâu thuẫn, giữ lại câu hỏi thay vì tự chọn một mặc định.
3. Mã, migration và cấu hình là bằng chứng **đã triển khai**, không tự thay đổi chính sách. Khoảng cách giữa đặc tả và mã được ghi ở trạng thái/roadmap.
4. Nhật ký kiểm tra là bằng chứng theo thời điểm, không bảo đảm mọi môi trường đã cập nhật.

## Cấu trúc và quy tắc cập nhật

```text
docs/
  project/       tổng quan, PRD, tiến độ, roadmap
  policy/        ba bản chính sách + chỉ mục quyết định
  features/      hợp đồng theo chức năng và vai trò
  engineering/   stack, API, kiến trúc, test, frontend, dữ liệu/ảnh/font
  operations/    deploy, checklist, quy trình thu/hoàn/chi trả
  archive/       bản nháp thay thế, audit và số đo theo thời điểm
```

Thay đổi nghiệp vụ: cập nhật policy → tổng quan/PRD → kiến trúc/API/test → tài liệu chức năng → trạng thái/roadmap/vận hành. Chỉ chuyển việc sang “đã kiểm tra” khi có bằng chứng mới. Không sửa số đo lịch sử thành số mới khi chưa đo lại.

Chạy `node scripts/check-docs.mjs` để kiểm tra liên kết nội bộ, mục lục, bản đồ di chuyển và tài liệu nằm đúng thư mục. Tài liệu này không yêu cầu chạy migration, sửa dữ liệu hoặc triển khai hosting.
