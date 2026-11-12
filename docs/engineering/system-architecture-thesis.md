# Báo Cáo Kiến Trúc Hệ Thống & Thiết Kế Kỹ Thuật (Phục vụ Đồ Án Tốt Nghiệp)

> **Dự án**: Open Slot — Nền tảng Đặt chỗ & Quản lý Workshop Thủ công & Nghệ thuật
> **Cập nhật**: Tháng 11/2026  
> **Tài liệu liên quan**: [Mục lục tổng quan](../README.md) · [Kiến trúc hệ thống](02-architecture.md) · [Đặc tả API](03-api-spec.md) · [Danh mục tài liệu](../danh-muc-tai-lieu.md)

---

## 1. Tổng quan Kiến trúc Hệ thống (System Architecture Overview)

Hệ thống **Open Slot** được thiết kế theo mô hình Monorepo hiện đại, tối ưu hóa cho độ tin cậy giao dịch (transactional reliability), tính nhất quán dữ liệu tài chính (ACID) và trải nghiệm người dùng di động (Mobile-First SPA).

```mermaid
flowchart TD
    subgraph ClientTier ["1. Client Tier (Web SPA - Mobile First)"]
        ReactSPA["React 19 + Vite SPA\n(@workshop/web)"]
        StateAndCache["TanStack Query v5\n(Server State & Cache)"]
        UIStyles["Tailwind CSS v4 + Radix UI\n(Responsive & Accessible)"]
        ReactSPA --> StateAndCache
        ReactSPA --> UIStyles
    end

    subgraph SharedTier ["2. Shared Contracts (@workshop/shared)"]
        ZodSchemas["Zod Validation Schemas\n(Booking, Auth, Payment DTOs)"]
        SharedTypes["TypeScript Types & Enums\n(Contracts & Bank Formats)"]
    end

    subgraph ApiTier ["3. Backend API Tier (@workshop/api)"]
        ExpressApp["Express 5 REST API\n(Node.js ESM)"]
        AuthMiddleware["JWT & RLS Session Guard"]
        RouterLayer["Modular Router Architecture\n(Admin Ledger, Bookings, Catalog, Studios)"]
        DBPool["PostgreSQL Pool (pg)\nACID withTransaction Boundary"]
        ExpressApp --> AuthMiddleware --> RouterLayer --> DBPool
    end

    subgraph DataTier ["4. Database Tier (PostgreSQL)"]
        PostgresDB[(PostgreSQL Database)]
        RLSPolicies["Row-Level Security\n& Data Integrity Constraints"]
        AuditLogs["JSONB Audit Event Log\n& Financial Ledger Traces"]
        PostgresDB --- RLSPolicies
        PostgresDB --- AuditLogs
    end

    subgraph ExternalGateways ["5. External Gateways & Providers"]
        PayOSGateway["PayOS Payment Gateway\n(HMAC-SHA256 Webhooks)"]
        VietQRService["VietQR Napas 247\n(Dynamic Settlement QR)"]
        SMTPService["Email Outbox Service\n(Resend / SMTP Queue)"]
    end

    ClientTier -- "HTTPS / JSON REST API" --> ApiTier
    ClientTier -. "Shared DTOs & Validation" .-> SharedTier
    ApiTier -. "Shared DTOs & Validation" .-> SharedTier
    DBPool -- "Connection Pool (ACID)" --> DataTier
    PayOSGateway -- "Signed Webhooks" --> ApiTier
    ApiTier -- "Create Payment Request" --> PayOSGateway
    ApiTier -- "Generate Settlement QR" --> VietQRService
    ApiTier -- "Transactional Email" --> SMTPService
```

### Công nghệ Cốt lõi (Tech Stack Matrix)

| Tầng (Tier)         | Công nghệ / Thư viện                               | Vai trò & Đặc điểm kiến trúc                                                                                  |
| :------------------ | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| **Frontend Web**    | React 19, TypeScript, Vite 6                       | SPA dựng theo chuẩn Mobile-First, tối ưu bundle size với code-splitting qua `manualChunks`.                   |
| **Giao diện & UI**  | Tailwind CSS v4, Radix UI Primitives, Lucide Icons | Thiết kế chuẩn mực, đáp ứng truy cập a11y, zero layout shift (CLS).                                           |
| **Quản lý State**   | TanStack Query v5                                  | Bộ nhớ đệm server-state thông minh, tự động revalidate và đồng bộ hóa optimistic UI.                          |
| **Backend API**     | Express 5, Node.js 22 (ESM)                        | Kiến trúc định tuyến theo module phân tán (`ledger/`, `catalog/`, `bookings/`), xử lý đồng thời non-blocking. |
| **Tính hợp lệ**     | Zod (End-to-End Validation)                        | Giao thức dữ liệu đồng nhất giữa Client và Server thông qua workspace `@workshop/shared`.                     |
| **Cơ sở dữ liệu**   | PostgreSQL 16                                      | RLS (Row Level Security), quan hệ khóa ngoại bảo đảm toàn vẹn tham chiếu, giao dịch ACID nghiêm ngặt.         |
| **Thanh toán & QR** | PayOS SDK & VietQR Napas 247                       | Thanh toán trực tuyến tự động qua cổng bảo mật và giải ngân VietQR chuẩn ngân hàng.                           |

---

## 2. Mô hình Thực thể Quan hệ (ERD - Entity Relationship Diagram)

Hệ thống lưu trữ mô hình dữ liệu workshop đa phiên (multi-session), ràng buộc sức chứa thời gian thực, quản lý phân bổ vé và sổ cái nghĩa vụ tài chính bất biến.

```mermaid
erDiagram
    users ||--o{ studio_members : "joins"
    users ||--o{ bookings : "places"
    studios ||--o{ studio_members : "employs"
    studios ||--o{ workshops : "hosts"
    studios ||--o{ studio_payout_accounts : "configures"
    studios ||--o{ studio_settlement_snapshots : "receives"
    workshops ||--o{ sessions : "schedules"
    sessions ||--o{ bookings : "reserves"
    bookings ||--o{ tickets : "issues"
    bookings ||--o{ payments : "collects"
    bookings ||--o{ customer_refund_accounts : "designates"
    bookings ||--o{ financial_obligations : "incurs"
    financial_obligations ||--o{ financial_transfers : "executes"
    studio_settlement_snapshots ||--o{ financial_obligations : "triggers"

    users {
        uuid id PK
        string email
        string phone
        string role "customer | studio_owner | admin"
        string full_name
        timestamp created_at
    }

    studios {
        uuid id PK
        string slug UK
        string name
        string address
        string deposit_mode "inherit | custom"
        int deposit_percent "0 - 100"
        timestamp verified_at
    }

    workshops {
        uuid id PK
        uuid studio_id FK
        string title
        string slug UK
        bigint price
        int duration_minutes
        boolean is_discontinued
    }

    sessions {
        uuid id PK
        uuid workshop_id FK
        timestamp starts_at
        timestamp ends_at
        timestamp registration_deadline
        int capacity
        int seats_held
        int seats_sold
        int schedule_version
        string status "scheduled | cancelled | completed"
    }

    bookings {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
        bigint order_code UK
        string reservation_status "pending | confirmed | cancelled | completed"
        string status "pending | paid | expired | cancelled | refund_needed"
        bigint total_amount
        bigint deposit_amount
        bigint paid_amount
        bigint refund_due_amount
        timestamp hold_expires_at
    }

    tickets {
        uuid id PK
        uuid booking_id FK
        int seat_number
        string ticket_code UK
        string attendance_status "registered | attended | absent"
        int version
    }

    payments {
        uuid id PK
        uuid booking_id FK
        bigint amount
        string kind "deposit | studio_pay"
        string status "pending | paid | cancelled | failed"
        string provider
        string provider_ref
        timestamp paid_at
    }

    financial_obligations {
        uuid id PK
        uuid booking_id FK
        uuid studio_id FK
        string kind "studio_payout | customer_refund | studio_recovery"
        bigint amount
        string status "pending | approved | paid | cancelled | manual_review"
        timestamp due_at
    }

    financial_transfers {
        uuid id PK
        uuid obligation_id FK
        string direction "inbound | outbound"
        string purpose "studio_payout | customer_refund | platform_advance"
        bigint amount
        bigint provider_fee
        string idempotency_key UK
        string status "pending_approval | approved | processing | succeeded | failed"
    }

    studio_settlement_snapshots {
        uuid id PK
        uuid booking_id FK
        uuid session_id FK
        bigint net_amount
        jsonb breakdown
        timestamp due_at
        timestamp created_at
    }
```

---

## 3. Các Biểu Đồ Tuần Tự Trọng Yếu (Core Sequence Diagrams)

### Luồng 1: Giữ Chỗ & Đặt Cọc Trực Tuyến (Atomic Seat Hold & Payment Checkout)

Quy trình bảo đảm không bán vượt sức chứa (overbooking) bằng cơ chế khóa bi-directional nguyên tử trong giao dịch PostgreSQL:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách Hàng (Web UI)
    participant API as Backend API
    participant DB as PostgreSQL (ACID)
    participant PayOS as Cổng Thanh Toán payOS

    Customer->>API: POST /bookings (sessionId, seatsCount, idempotencyKey)
    activate API
    API->>DB: withTransaction(client)
    activate DB
    Note over DB: Khóa dòng session FOR UPDATE<br/>Kiểm tra capacity >= seats_sold + seats_held + seatsCount
    DB->>DB: UPDATE sessions SET seats_held = seats_held + N
    DB->>DB: INSERT INTO bookings (reservation_status='pending', hold_expires_at=now()+15m)
    DB->>DB: INSERT INTO payments (kind='deposit', status='pending')
    DB-->>API: Trả về booking & payment record
    deactivate DB

    API->>PayOS: createPaymentLink(orderCode, depositAmount, webhookUrl)
    PayOS-->>API: checkoutUrl & paymentLinkId
    API-->>Customer: Trả về checkoutUrl & bookingId (201 Created)
    deactivate API

    Customer->>PayOS: Quét mã QR / Chuyển khoản ngân hàng
    activate PayOS
    PayOS->>API: POST /webhooks/payos (Signed HMAC payload)
    activate API
    API->>API: Xác thực chữ ký bí mật Webhook HMAC-SHA256
    API->>DB: withTransaction(client)
    activate DB
    Note over DB: Khóa session & booking FOR UPDATE
    DB->>DB: UPDATE payments SET status='paid', paid_at=now()
    DB->>DB: UPDATE sessions SET seats_held = seats_held - N, seats_sold = seats_sold + N
    DB->>DB: UPDATE bookings SET reservation_status='confirmed', paid_amount=deposit
    DB->>DB: INSERT INTO tickets (attendance_status='registered', ticket_code)
    DB-->>API: Xác nhận cập nhật thành công
    deactivate DB
    API-->>PayOS: HTTP 200 OK
    deactivate API
    deactivate PayOS
    Customer->>API: GET /bookings/:id (Polling / Refresh)
    API-->>Customer: Trả về Vé điện tử (Tickets) đã xác nhận
```

---

### Luồng 2: Quyết Toán Tự Động & Chi Trả Studio (Automated Settlement & Payout)

Quy trình quyết toán định kỳ hoặc sau khi buổi workshop kết thúc thành công:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản Trị Viên Sàn
    participant Cron as Settlement Worker
    participant API as Backend API
    participant DB as PostgreSQL
    participant Bank as Ngân Hàng / VietQR Napas

    Note over Cron: Buổi học kết thúc (ends_at đã qua)
    Cron->>API: Kích hoạt đối soát buổi học (closeSessionSettlement)
    activate API
    API->>DB: withTransaction(client)
    activate DB
    DB->>DB: Tính toán doanh thu thực nhận: net_amount = paid_amount - platform_fee
    DB->>DB: INSERT INTO studio_settlement_snapshots (booking_id, session_id, net_amount, breakdown)
    DB->>DB: INSERT INTO financial_obligations (kind='studio_payout', amount=net_amount, due_at=T+3)
    DB-->>API: Đã tạo nghĩa vụ chi trả (Pending Obligation)
    deactivate DB
    deactivate API

    Admin->>API: GET /admin/tai-chinh/nghia-vu (Xem danh sách nghĩa vụ đến hạn)
    API-->>Admin: Danh sách khoản chi trả kèm trạng thái tài khoản ngân hàng Studio
    Admin->>API: GET /admin/tai-chinh/nghia-vu/:id/vietqr
    activate API
    API->>DB: Truy xuất & giải mã AES-256 số tài khoản Studio
    API-->>Admin: Trả về mã VietQR động chuẩn Napas 247
    deactivate API

    Admin->>Bank: Quét mã VietQR chuyển khoản ngân hàng
    Admin->>API: POST /admin/tai-chinh/nghia-vu/:id/chuyen-nhanh-vietqr (reference, idempotencyKey)
    activate API
    API->>DB: withTransaction(client)
    activate DB
    DB->>DB: INSERT INTO financial_transfers (status='succeeded', direction='outbound')
    DB->>DB: UPDATE financial_obligations SET status='paid'
    DB->>DB: Ghi Audit Log bất biến (actor_id, reference)
    DB-->>API: Quyết toán hoàn tất
    deactivate DB
    API-->>Admin: Thông báo chuyển tiền thành công (HTTP 200)
    deactivate API
```

---

### Luồng 3: Hủy Chỗ & Hoàn Tiền Đa Mốc (Tiered Cancellation & Refund Policy)

Cơ chế chống giả mạo chính sách hoàn tiền bằng mã định danh mật mã HMAC Token có thời hạn 5 phút:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách Hàng
    participant API as Backend API
    participant DB as PostgreSQL
    actor Admin as Quản Trị Viên

    Customer->>API: GET /bookings/:id/cancel-quote (Xin báo giá hủy)
    activate API
    API->>DB: Đọc thời điểm starts_at, booking.paid_amount, booking.deposit_amount
    Note over API: Tính toán chính sách mốc thời gian:<br/>• Trước 24h: Hoàn 100% tiền đã đóng.<br/>• Dưới 24h: Giữ lại tiền cọc gốc, hoàn số còn lại.
    API->>API: Sinh HMAC Token (bookingId, refundAmount, exp=5 phút)
    API-->>Customer: Báo giá hoàn tiền & HMAC Token
    deactivate API

    Customer->>API: POST /bookings/:id/cancel (HMAC Token, lý do hủy)
    activate API
    API->>API: Xác thực chữ ký HMAC Token & kiểm tra thời hạn
    API->>DB: withTransaction(client)
    activate DB
    Note over DB: Khóa Session & Booking FOR UPDATE
    DB->>DB: UPDATE sessions SET seats_sold = seats_sold - N
    DB->>DB: UPDATE bookings SET reservation_status='cancelled', refund_due_amount=refundAmount
    DB->>DB: UPDATE tickets SET attendance_status='cancelled'
    DB->>DB: INSERT INTO financial_obligations (kind='customer_refund', amount=refundAmount, due_at=now()+7d)
    DB-->>API: Hủy thành công, đã ghi nhận nghĩa vụ hoàn
    deactivate DB
    API-->>Customer: Xác nhận hủy và hướng dẫn nhận hoàn tiền
    deactivate API

    Note over Admin: Đối soát & Thực hiện lệnh hoàn
    Admin->>API: POST /admin/tai-chinh/chuyen-tien/:id/ghi-nhan-ket-qua (result='succeeded')
    API->>DB: Cập nhật nghĩa vụ paid, kích hoạt queueRefundEmail gửi biên nhận hoàn tiền cho khách
```

---

## 4. Tối Ưu Hóa Frontend & Web Vitals (Performance Engineering)

### Kết quả Tái cấu trúc Kiến trúc Codebase (Refactoring Highlights)

Nhằm đáp ứng tiêu chuẩn khắt khe của Đồ án Tốt nghiệp ngành Kỹ thuật Phần mềm, toàn bộ codebase đã trải qua 4 giai đoạn chuẩn hóa kiến trúc:

1. **Phân tách Component Khổng lồ (De-monolith Components)**:
   - `StudioFinancesManager.tsx` (598 dòng → 157 dòng): Tách thành 4 sub-components chuyên trách (`FinanceMetricsSummary`, `FinanceAccountBanner`, `SettlementsTable`, `UpcomingBookingsTable`).
   - `WorkshopEditorSheet.tsx` (595 dòng → 274 dòng): Tách thành 4 fieldsets độc lập (`WorkshopBasicFields`, `WorkshopPricingFields`, `WorkshopDetailFields`, `WorkshopPolicyFields`).
   - `WorkshopSchedule.tsx` (535 dòng → 350 dòng): Tách các phần tử tương tác (`ScheduleSessionPicker`, `SchedulePriceBreakdown`, `ScheduleStickyBar`).
   - `SiteHeader.tsx` (471 dòng → 240 dòng): Tách menu và drawer di động (`HeaderUserMenu`, `HeaderMobileDrawer`).

2. **Chuẩn hóa Đường dẫn Tuyệt đối `@/...` (Path Aliases)**:
   - Loại bỏ triệt để các đường dẫn tương đối sâu dễ gây lỗi (`../../../../components/`, `../../lib/`).
   - Cấu trúc thư viện `src/lib/` phân lớp rõ ràng theo domain: `core/`, `api/`, `domain/`, `prefetch/`, `assets/`.

3. **Mô-đun hóa Sổ Cái Tài Chính Backend (`financial-ledger.ts`)**:
   - Tách file nguyên khối 1,553 dòng thành 5 route handlers phân nhiệm độc lập trong thư mục `apps/api/src/modules/admin/ledger/`:
     - `calendar.routes.ts`: Quản lý ngày làm việc và lịch nghỉ lễ theo luật định.
     - `obligations.routes.ts`: Nghĩa vụ tài chính và đối soát dòng tiền.
     - `transfers.routes.ts`: Lệnh chuyển khoản, duyệt chi và đồng bộ cổng thanh toán.
     - `accounts.routes.ts`: Xác minh và duyệt tài khoản ngân hàng thụ hưởng.
     - `fees.routes.ts`: Đối chiếu và thu phí nền tảng sàn giao dịch.

4. **Tối ưu Hóa Bundle Size & Mobile Web Vitals**:
   - **Code Splitting**: Cấu hình `manualChunks` tách biệt `vendor-react`, `vendor-query`, `vendor-radix` giúp trình duyệt client tận dụng bộ nhớ đệm HTTP Cache dài hạn.
   - **LCP (Largest Contentful Paint)**: Tối ưu ảnh bìa workshop bằng định dạng WebP nén sẵn, chỉ định rõ thuộc tính `width`, `height` và `fetchpriority="high"`.
   - **CLS (Cumulative Layout Shift) = 0**: Thiết lập khung giữ chỗ (`aspect-ratio: 16/9`) và Skeleton placeholders cho tất cả danh sách tải bất đồng bộ.
   - **INP (Interaction to Next Paint) < 50ms**: Tối ưu hóa render tree thông qua Memoization và TanStack Query cache deduplication.

---

## 5. Kết Luận

Kiến trúc hệ thống **Open Slot** giải quyết trọn vẹn bài toán thực tế của thị trường workshop thủ công:

- Đảm bảo **an toàn tuyệt đối về mặt tài chính và dữ liệu giao dịch** nhờ cơ chế khóa nguyên tử ACID và nhật ký kiểm toán không thể xóa sửa.
- Mang lại **trải nghiệm di động vượt trội** nhờ kiến trúc SPA tinh gọn, phân tách mô-đun bài bản và tuân thủ các chuẩn mực phát triển phần mềm hiện đại.
