# Danh mục và bàn giao tài liệu

Đồng bộ 07/11/2026. [Mục lục đọc nhanh](README.md). Đã đọc file cập nhật và ba file policy, tích hợp yêu cầu vào tổng quan/PRD/API/kiến trúc/test/roadmap/vận hành; đối chiếu các khả năng tiền thực tế trong mã. Không sửa mã nghiệp vụ, migration hoặc dữ liệu trong lần sắp xếp này.

## Tài liệu cần giữ

Mục lục, tổng quan, PRD, trạng thái, policy, API/kiến trúc/test, tài liệu chức năng và vận hành là bộ tài liệu hiện hành. Tài liệu theo từng vai/chức năng được giữ riêng để không tạo một file khổng lồ. Một yêu cầu chỉ có một nguồn chính: policy cho quy tắc, mã cho triển khai, nhật ký cho bằng chứng.

## Tài liệu không cần đọc hằng ngày

| Tài liệu/nhóm                                                             | Xử lý                                            | Lý do                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| cap-nhat-tai-lieu-du-an                                                   | Đã tích hợp, giữ bản nguồn trong archive/changes | Không cần dán thay lại; còn giá trị truy nguyên yêu cầu                                |
| open-slot-deposit-update, open-slot-policy-decisions                      | archive/changes                                  | Changelog/biên bản từng đợt, thay bằng tài liệu chức năng/trạng thái/policy hiện hành  |
| studio-trust-policy-draft                                                 | archive/policy                                   | Tỷ lệ 0–30%, mặc định 20%, dòng tiền cũ đã bị thay thế; không dùng làm yêu cầu mới     |
| 04-roadmap-prompts                                                        | archive/planning                                 | Prompt cũ loại hoàn/chi trả khỏi phạm vi; roadmap mới thay thế                         |
| marketnest-DESIGN                                                         | archive/design                                   | Không phải thương hiệu/màu hiện tại; chỉ còn tham khảo thiết kế                        |
| production-readiness-checklist cũ, repository-audit, open-slot-flow-audit | archive/audits                                   | Bằng chứng thời điểm; có checklist/roadmap hiện hành, không tái dùng trạng thái đạt cũ |
| Các báo cáo và JSON hiệu năng                                             | archive/performance                              | Giữ raw để đối chiếu; không đo lại và không nhận là hiệu năng hiện tại                 |

Không xóa file nào trong đợt này. Có thể bỏ changes/planning/policy/design lịch sử khỏi bản PDF/bộ đọc hằng ngày nếu cần rút gọn; nên giữ audit và raw hiệu năng làm bằng chứng đồ án.

## Ngoại lệ không chuyển

- README.md ở gốc: điểm vào repository và hướng dẫn chạy.
- CLAUDE.md ở gốc: hướng dẫn công cụ/AI, được cập nhật liên kết và phạm vi mới; không tự chuyển làm mất khả năng khám phá.
- Các file OFL trong apps/web/public/fonts: giấy phép giữ cạnh tài sản, không phải hướng dẫn dự án cần gom đi.
- Dữ liệu mẫu ở data, file cấu hình triển khai và mã kiểm tra ở đúng thư mục chạy; chỉ hướng dẫn gán nhãn/ảnh/font/ticket được chuyển vào docs/engineering.

## Kiểm tra bàn giao

Lệnh node scripts/check-docs.mjs kiểm tra đích liên kết nội bộ/anchor, bản đồ 50 file di chuyển, danh mục và phân nhóm. Lệnh này chỉ đọc file, không gọi mạng/DB. Không kiểm tra pháp lý, hợp đồng nhà cung cấp hoặc URL bên ngoài. Số đo/test nghiệp vụ trước đó không được chạy lại trong đợt tài liệu.

Kết quả lần đồng bộ: 61 file Markdown, toàn bộ liên kết nội bộ và 50 đích di chuyển được kiểm tra, không có lỗi hoặc cảnh báo liên kết lịch sử. Kiểm tra định dạng Prettier, ESLint cho script và diff khoảng trắng đã qua. Các mục nghiệp vụ chờ chủ sản phẩm chốt giữ nguyên nhãn chờ; không tự điền đáp án.

## Toàn bộ file

| Đường dẫn mới                                                                                        | Vai trò                            | Đường dẫn cũ / ghi chú                    |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| [README.md](README.md)                                                                               | Hiện hành; xem nhãn trong file     | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [archive/README.md](archive/README.md)                                                               | Lưu trữ; không dùng làm hiện trạng | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [archive/audits/open-slot-flow-audit.md](archive/audits/open-slot-flow-audit.md)                     | Lưu trữ; không dùng làm hiện trạng | docs/open-slot-flow-audit.md              |
| [archive/audits/production-readiness-checklist.md](archive/audits/production-readiness-checklist.md) | Lưu trữ; không dùng làm hiện trạng | docs/production-readiness-checklist.md    |
| [archive/audits/repository-audit.md](archive/audits/repository-audit.md)                             | Lưu trữ; không dùng làm hiện trạng | docs/repository-audit.md                  |
| [archive/changes/cap-nhat-tai-lieu-du-an.md](archive/changes/cap-nhat-tai-lieu-du-an.md)             | Lưu trữ; không dùng làm hiện trạng | docs/cap-nhat-tai-lieu-du-an.md           |
| [archive/changes/open-slot-deposit-update.md](archive/changes/open-slot-deposit-update.md)           | Lưu trữ; không dùng làm hiện trạng | docs/open-slot-deposit-update.md          |
| [archive/changes/open-slot-policy-decisions.md](archive/changes/open-slot-policy-decisions.md)       | Lưu trữ; không dùng làm hiện trạng | docs/open-slot-policy-decisions.md        |
| [archive/design/marketnest-DESIGN.md](archive/design/marketnest-DESIGN.md)                           | Lưu trữ; không dùng làm hiện trạng | docs/marketnest-DESIGN.md                 |
| [archive/performance/mobile-performance.json](archive/performance/mobile-performance.json)           | Lưu trữ; không dùng làm hiện trạng | docs/mobile-performance.json              |
| [archive/performance/mobile-performance.md](archive/performance/mobile-performance.md)               | Lưu trữ; không dùng làm hiện trạng | docs/mobile-performance.md                |
| [archive/performance/performance-client.md](archive/performance/performance-client.md)               | Lưu trữ; không dùng làm hiện trạng | docs/performance-client.md                |
| [archive/performance/performance-diagnosis.md](archive/performance/performance-diagnosis.md)         | Lưu trữ; không dùng làm hiện trạng | docs/performance-diagnosis.md             |
| [archive/performance/performance-results.md](archive/performance/performance-results.md)             | Lưu trữ; không dùng làm hiện trạng | docs/performance-results.md               |
| [archive/performance/performance-server.md](archive/performance/performance-server.md)               | Lưu trữ; không dùng làm hiện trạng | docs/performance-server.md                |
| [archive/performance/web-performance-bundles.json](archive/performance/web-performance-bundles.json) | Lưu trữ; không dùng làm hiện trạng | docs/web-performance-bundles.json         |
| [archive/performance/web-performance.md](archive/performance/web-performance.md)                     | Lưu trữ; không dùng làm hiện trạng | docs/web-performance.md                   |
| [archive/planning/04-roadmap-prompts.md](archive/planning/04-roadmap-prompts.md)                     | Lưu trữ; không dùng làm hiện trạng | docs/04-roadmap-prompts.md                |
| [archive/policy/studio-trust-policy-draft.md](archive/policy/studio-trust-policy-draft.md)           | Lưu trữ; không dùng làm hiện trạng | docs/studio-trust-policy-draft.md         |
| [document-map.json](document-map.json)                                                               | Bản đồ hoặc dữ liệu đo             | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [engineering/00-tech-stack.md](engineering/00-tech-stack.md)                                         | Hiện hành; xem nhãn trong file     | docs/00-tech-stack.md                     |
| [engineering/02-architecture.md](engineering/02-architecture.md)                                     | Hiện hành; xem nhãn trong file     | docs/02-architecture.md                   |
| [engineering/03-api-spec.md](engineering/03-api-spec.md)                                             | Hiện hành; xem nhãn trong file     | docs/03-api-spec.md                       |
| [engineering/05-ranking-spec.md](engineering/05-ranking-spec.md)                                     | Hiện hành; xem nhãn trong file     | docs/05-ranking-spec.md                   |
| [engineering/06-test-plan.md](engineering/06-test-plan.md)                                           | Hiện hành; xem nhãn trong file     | docs/06-test-plan.md                      |
| [engineering/admin-api-conventions.md](engineering/admin-api-conventions.md)                         | Hiện hành; xem nhãn trong file     | docs/admin-api-conventions.md             |
| [engineering/brand-assets.md](engineering/brand-assets.md)                                           | Hiện hành; xem nhãn trong file     | apps/web/public/brand/README.md           |
| [engineering/font-assets.md](engineering/font-assets.md)                                             | Hiện hành; xem nhãn trong file     | apps/web/public/fonts/README.md           |
| [engineering/forms-validation.md](engineering/forms-validation.md)                                   | Hiện hành; xem nhãn trong file     | docs/forms-validation.md                  |
| [engineering/frontend-structure.md](engineering/frontend-structure.md)                               | Hiện hành; xem nhãn trong file     | docs/frontend-structure.md                |
| [engineering/labeling-guideline.md](engineering/labeling-guideline.md)                               | Hiện hành; xem nhãn trong file     | data/labeling-guideline.md                |
| [engineering/performance.md](engineering/performance.md)                                             | Hiện hành; xem nhãn trong file     | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [engineering/ticket-components.md](engineering/ticket-components.md)                                 | Hiện hành; xem nhãn trong file     | apps/web/src/components/tickets/README.md |
| [features/admin-audit.md](features/admin-audit.md)                                                   | Hiện hành; xem nhãn trong file     | docs/admin-audit.md                       |
| [features/admin-bookings.md](features/admin-bookings.md)                                             | Hiện hành; xem nhãn trong file     | docs/admin-bookings.md                    |
| [features/admin-categories.md](features/admin-categories.md)                                         | Hiện hành; xem nhãn trong file     | docs/admin-categories.md                  |
| [features/admin-data-tables.md](features/admin-data-tables.md)                                       | Hiện hành; xem nhãn trong file     | docs/admin-data-tables.md                 |
| [features/admin-overview.md](features/admin-overview.md)                                             | Hiện hành; xem nhãn trong file     | docs/admin-overview.md                    |
| [features/admin-settings.md](features/admin-settings.md)                                             | Hiện hành; xem nhãn trong file     | docs/admin-settings.md                    |
| [features/admin-users.md](features/admin-users.md)                                                   | Hiện hành; xem nhãn trong file     | docs/admin-users.md                       |
| [features/artisan-onboarding.md](features/artisan-onboarding.md)                                     | Hiện hành; xem nhãn trong file     | docs/artisan-onboarding.md                |
| [features/content-reports.md](features/content-reports.md)                                           | Hiện hành; xem nhãn trong file     | docs/content-reports.md                   |
| [features/customer-bookings.md](features/customer-bookings.md)                                       | Hiện hành; xem nhãn trong file     | docs/customer-bookings.md                 |
| [features/dashboard.md](features/dashboard.md)                                                       | Hiện hành; xem nhãn trong file     | docs/dashboard.md                         |
| [features/featured-content.md](features/featured-content.md)                                         | Hiện hành; xem nhãn trong file     | docs/featured-content.md                  |
| [features/message-templates.md](features/message-templates.md)                                       | Hiện hành; xem nhãn trong file     | docs/message-templates.md                 |
| [features/studio-images.md](features/studio-images.md)                                               | Hiện hành; xem nhãn trong file     | docs/studio-images.md                     |
| [features/studio-review.md](features/studio-review.md)                                               | Hiện hành; xem nhãn trong file     | docs/studio-review.md                     |
| [features/workshop-moderation.md](features/workshop-moderation.md)                                   | Hiện hành; xem nhãn trong file     | docs/workshop-moderation.md               |
| [features/workshop-publication-policy.md](features/workshop-publication-policy.md)                   | Hiện hành; xem nhãn trong file     | docs/workshop-publication-policy.md       |
| [operations/deploy.md](operations/deploy.md)                                                         | Hiện hành; xem nhãn trong file     | docs/deploy.md                            |
| [operations/payment-operations.md](operations/payment-operations.md)                                 | Hiện hành; xem nhãn trong file     | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [operations/production-readiness-checklist.md](operations/production-readiness-checklist.md)         | Hiện hành; xem nhãn trong file     | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [policy/README.md](policy/README.md)                                                                 | Bản nháp/quyết định có phân loại   | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [policy/financial-calendar-and-settlement.md](policy/financial-calendar-and-settlement.md) | Quyết định đã chốt | Lịch ngày làm việc và quyết toán |
| [policy/bang-chuyen-trang-thai.md](policy/bang-chuyen-trang-thai.md)                                 | Bản nháp/quyết định có phân loại   | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [policy/chinh-sach-dat-cho-khach.md](policy/chinh-sach-dat-cho-khach.md)                             | Bản nháp/quyết định có phân loại   | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [policy/dieu-khoan-studio.md](policy/dieu-khoan-studio.md)                                           | Bản nháp/quyết định có phân loại   | Giữ nguyên hoặc tài liệu chỉ mục mới      |
| [project/01-prd.md](project/01-prd.md)                                                               | Hiện hành; xem nhãn trong file     | docs/01-prd.md                            |
| [project/current-status.md](project/current-status.md)                                               | Hiện hành; xem nhãn trong file     | docs/current-status.md                    |
| [project/overview.md](project/overview.md)                                                           | Hiện hành; xem nhãn trong file     | docs/Open Slot — Tài liệu dự án.md        |
| [project/roadmap.md](project/roadmap.md)                                                             | Hiện hành; xem nhãn trong file     | Giữ nguyên hoặc tài liệu chỉ mục mới      |
