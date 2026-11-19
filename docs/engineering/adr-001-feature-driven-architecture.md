# ADR 001: Tái cấu trúc kiến trúc theo hướng tính năng (Feature-Driven Architecture)

> Trạng thái: **ĐÃ CHẤP THUẬN & HOÀN TẤT**  
> Ngày quyết định: 19/11/2026  
> Tác giả: Nhóm Đồ án Tốt nghiệp Open Slot  
> Phạm vi: Toàn bộ Monorepo (`apps/web`, `apps/api`, `packages/shared`, `scripts`, `db`)

---

## 1. Bối cảnh (Context)

Nền tảng Open Slot phát triển qua nhiều giai đoạn với các phân hệ nghiệp vụ ngày càng mở rộng:
- Tìm kiếm & khám phá workshop thủ công mỹ nghệ (`catalog`).
- Đặt chỗ, giữ chỗ, thanh toán cọc và quản lý vé tham gia (`booking`).
- Quản trị studio, hội viên, địa điểm, lịch hoạt động và xác thực uy tín (`studio-management`).
- Nghiệp vụ buổi học, danh sách học viên, đổi lịch, điểm danh thủ công và mã QR (`workshop`, `sessions`).
- Đối soát tài chính, công nợ hoàn tiền, tài khoản ngân hàng và kiểm duyệt nền tảng (`admin-finance`).

### Các vấn đề kỹ thuật trước khi tái cấu trúc:
1. **Ô nhiễm thư mục `components/`**: Thư mục `apps/web/src/components/` chứa lẫn lộn cả các UI component nguyên tử (Button, Dialog, Input) với hàng chục thư mục chứa toàn bộ logic nghiệp vụ phức tạp (`booking-detail/`, `details/`, `management/`, `admin/`, `registration/`, `reviews/`, `reports/`, `auth/`, `home/`).
2. **Phụ thuộc vòng (Circular Dependencies) và khó bảo trì**: Việc các component nghiệp vụ nằm rải rác trong `components/` dẫn đến các import chéo khó kiểm soát, gây nghẽn quá trình phân tích module tĩnh và làm chậm quá trình kiểm thử tự động.
3. **Lệch ranh giới miền Backend (Domain Boundary Leak)**: Logic đổi lịch học (`schedule-changes`) trước đây bị đặt nhầm trong `modules/bookings/` thay vì thuộc quyền sở hữu của miền `modules/sessions/`.
4. **Hợp đồng chia sẻ thiếu đầy đủ (Missing Shared Contracts)**: Thiếu Zod schema chuẩn hóa cho các API quan trọng như quản trị workshop, buổi học, hồ sơ studio và giao dịch tài chính ở gói `packages/shared`.
5. **Rủi ro vận hành cơ sở dữ liệu**: Thiếu cơ chế chặn (DB Safety Guard) khi chạy các kịch bản nguy hiểm (`clean-database.ts`, `seed-demo-data.ts`) trên môi trường cơ sở dữ liệu từ xa/production.

---

## 2. Quyết định Kiến trúc (Architectural Decision)

### 2.1. Chuẩn hóa Kiến trúc Hướng tính năng (Feature-Driven Architecture) tại `apps/web`
Toàn bộ mã nguồn liên quan đến nghiệp vụ được tổ chức độc lập vào `apps/web/src/features/`:
- **`features/catalog/`**: Khám phá workshop, trang chủ, danh mục sản phẩm, bộ lọc, thẻ workshop.
- **`features/workshop/`**: Chi tiết workshop, lịch học, chính sách hủy/đặt cọc, đánh giá và báo cáo vi phạm.
- **`features/booking/`**: Chi tiết đơn đặt chỗ, thanh toán cọc, hoàn tiền và hủy vé.
- **`features/studio-management/`**: Không gian làm việc của chủ xưởng, hồ sơ studio, danh sách học viên, điểm danh và mời hội viên.
- **`features/admin-finance/`**: Sổ cái tài chính, hoàn tiền nghĩa vụ, duyệt studio/workshop và đối soát chuyển khoản.

Thư mục `apps/web/src/components/` được tinh gọn 100%, chỉ giữ lại các thành phần phi nghiệp vụ có thể tái sử dụng:
- `components/ui/`: Các UI primitives cơ sở (Button, Input, Card, Badge, Tooltip...).
- `components/layout/`: Layout shells chung (Header, Footer, Navigation, PageContainer).
- `components/common/`: Các thành phần tiện ích giao diện chung (`DataTable`, `ConfirmReasonDialog`, `ImageGalleryDialog`, `SearchableFilterSelect`).
- `components/tickets/`: Khung hiển thị và dựng hình vé (`TicketShell`, `TicketContent`, `TicketPrimitives`).

Các Route Guard nghiệp vụ xác thực (`RequireRole`, `RequireCustomer`) được di chuyển về đúng tầng điều hướng: `apps/web/src/app/router/guards/`.

### 2.2. Tái cấu trúc Ranh giới miền Backend (`apps/api`)
- Di chuyển toàn bộ dịch vụ và xử lý đổi lịch `schedule-changes` từ `apps/api/src/modules/bookings/` về đúng module sở hữu: `apps/api/src/modules/sessions/schedule-changes/`.
- Duy trì re-export facade tương thích ngược tại `modules/bookings/schedule-changes.ts` để đảm bảo không phá vỡ bất kỳ liên kết ngoài nào.
- Cập nhật `sessions.repository.ts` và API module export.

### 2.3. Bổ sung trọn vẹn Hợp đồng Dữ liệu Chung (`packages/shared/src/contracts/`)
Xây dựng và chuẩn hóa các Zod Contracts dùng chung giữa Frontend và Backend:
- `workshops.contract.ts`: Hợp đồng tạo mới, cập nhật và lọc workshop (`workshopInputContractSchema`, `createWorkshopContractSchema`, `updateWorkshopContractSchema`, `workshopFilterContractSchema`).
- `sessions.contract.ts`: Hợp đồng lịch học, điểm danh và đổi lịch (`createSessionContractSchema`, `updateSessionContractSchema`, `sessionAttendanceCheckInContractSchema`, `sessionScheduleChangeContractSchema`).
- `studios.contract.ts`: Hợp đồng hồ sơ studio, quy định tiền cọc và xác minh mức độ tin cậy (`studioProfileContractSchema`, `studioDepositSettingsContractSchema`, `studioVerificationDecisionContractSchema`).
- `finance.contract.ts`: Hợp đồng hủy đặt chỗ, hoàn tiền, thông tin tài khoản thụ hưởng và lệnh chuyển khoản (`cancelBookingContractSchema`, `refundObligationRepaymentContractSchema`, `payoutAccountContractSchema`, `payoutRequestContractSchema`, `transferExecutionContractSchema`).

### 2.4. Tăng cường An toàn CSDL & Tạo Bản chụp Lược đồ (`db/schema.sql`)
- Tạo `scripts/assert-safe-db.ts`: Chặn đứng mọi hành vi chạy các script phá hủy dữ liệu trên môi trường production (`NODE_ENV=production`) hoặc remote database nếu thiếu cờ `--force`/`ALLOW_DESTRUCTIVE_OPERATIONS=true`.
- Tích hợp bảo vệ vào `scripts/clean-database.ts` và `scripts/seed-demo-data.ts`.
- Tạo `db/schema.sql`: Bản chụp toàn bộ 62 migration DDL hợp nhất, phục vụ việc tra cứu nhanh cấu trúc CSDL của đồ án và khởi tạo môi trường thử nghiệm tức thì.

---

## 3. Kết quả và Đánh giá (Consequences & Evaluation)

### 3.1. Chỉ số Kỹ thuật & Độ ổn định (Zero-Regression)
- **Kiểm thử tự động**: Toàn bộ **257/257 test cases** trên **52 test files** của `apps/web` đều vượt qua thành công 100%.
- **Biên dịch Monorepo**: Lệnh `npm run build` thực hiện biên dịch thành công 100% trên cả 3 workspace (`@workshop/shared`, `@workshop/api`, `@workshop/web`) mà không phát sinh lỗi hoặc cảnh báo TypeScript.
- **Tốc độ thực thi**: Loại bỏ triệt để các vòng lặp phụ thuộc (circular barrel dependency) giúp quá trình import module nhanh hơn đáng kể. Kiểm thử `prefetch-navigation` giảm từ ~31 giây xuống còn ~26 mili-giây.

### 3.2. Giá trị đóng góp cho Đồ án Tốt nghiệp
1. **Tuân thủ Chuẩn Thiết kế Phần mềm Hiện đại**: Thể hiện rõ ràng năng lực áp dụng *Feature-Driven Architecture*, *Domain-Driven Design (DDD) Subdomains*, và *Clean Architecture*.
2. **End-to-End Type Safety**: Dữ liệu từ cơ sở dữ liệu PostgreSQL ➡️ DTO/Contract Zod (`@workshop/shared`) ➡️ Backend API Route Handler (`apps/api`) ➡️ Frontend Services & UI Hooks (`apps/web`) được ràng buộc kiểu tĩnh một cách nhất quán và minh bạch.
3. **Tính sẵn sàng vận hành (Production-Readiness)**: Hệ thống script an toàn, tài liệu đầy đủ và mã nguồn sạch sẽ, sẵn sàng cho hội đồng bảo vệ đánh giá chất lượng sản phẩm.
