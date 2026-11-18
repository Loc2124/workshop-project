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

## 4. Phân Tích & Thiết Kế Phân Hệ Quản Trị Viên (Admin Subsystem Analysis & Design)

Phân hệ Quản trị viên (Admin) đóng vai trò trung tâm điều phối dòng tiền, thẩm định đối tác và bảo vệ quyền lợi giữa Khách hàng và Studio. Nhằm đáp ứng tiêu chuẩn báo cáo Đồ án Tốt nghiệp / Thực tập, mục này đặc tả toàn diện kiến trúc phân hệ Admin qua hệ thống biểu đồ UML chuẩn mực.

### 4.1. Biểu Đồ Use Case Tổng Thể Phân Hệ Admin (Admin Use Case Diagram)

```mermaid
graph LR
    Admin([Quản Trị Viên / Admin])

    subgraph FinancialLedger ["Phân hệ Tài chính & Đối soát"]
        UC1(["UC-AD01: Đối soát & Hoàn cọc VietQR 247"])
        UC2(["UC-AD02: Quyết toán & Chi trả Studio"])
        UC3(["UC-AD03: Quản lý lịch ngày làm việc & đối soát"])
        UC4(["UC-AD04: Tra cứu phí sàn & lịch sử giao dịch"])
        UC_Crypto(["<<include>> Giải mã AES-256 STK ngân hàng"])
        UC_Audit(["<<include>> Ghi nhật ký kiểm toán Audit Log"])
        
        UC1 -.-> UC_Crypto
        UC1 -.-> UC_Audit
        UC2 -.-> UC_Crypto
        UC2 -.-> UC_Audit
    end

    subgraph ModerationSubsystem ["Phân hệ Kiểm duyệt & Thẩm định"]
        UC5(["UC-AD05: Thẩm định hồ sơ & bằng chứng Studio"])
        UC6(["UC-AD06: Duyệt nội dung & chính sách cọc Workshop"])
        UC7(["UC-AD07: Xử lý khiếu nại & báo cáo vi phạm"])
        UC5 -.-> UC_Audit
        UC6 -.-> UC_Audit
    end

    subgraph OperationSubsystem ["Phân hệ Vận hành & Giám sát"]
        UC8(["UC-AD08: Giám sát đặt chỗ & tra soát đơn hàng"])
        UC9(["UC-AD09: Quản lý tài khoản & phân quyền người dùng"])
        UC10(["UC-AD10: Xem bảng tổng quan chỉ số Dashboard"])
    end

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
```

---

### 4.2. Biểu Đồ Hoạt Động: Quy Trình Xử Lý Hoàn Cọc & Chi Trả (Activity Diagram)

Quy trình khép kín đảm bảo tính toàn vẹn giao dịch và bảo mật tài khoản thụ hưởng:

```mermaid
flowchart TD
    Start([Khách hủy chỗ / Đơn cần hoàn cọc]) --> A1[Hệ thống ghi nhận nghĩa vụ kind='customer_refund']
    A1 --> A2[Khách cung cấp STK nhận hoàn]
    A2 --> A3[Mã hóa đối xứng AES-256-GCM lưu DB]
    A3 --> A4[Admin mở trang Quản lý Tài chính /admin/tai-chinh]
    A4 --> A5[Admin chọn 'Chuyển khoản VietQR']
    A5 --> A6[Backend giải mã STK & sinh mã 'OS HOAN orderCode']
    A6 --> A7[Hiển thị ảnh VietQR động chuẩn Napas 247]
    A7 --> A8[Admin quét mã QR qua App Ngân hàng]
    A8 --> A9{Chuyển tiền thành công?}
    A9 -- Không --> A10[Hủy bỏ thao tác hoặc chuyển sang manual_review]
    A10 --> EndFail([Kết thúc: Giữ nguyên trạng thái chờ])
    A9 -- Có --> A11[Admin nhập Mã giao dịch ngân hàng Reference]
    A11 --> A12[Gửi xác nhận kèm Idempotency-Key chống trùng]
    A12 --> A13[Tạo financial_transfers status='succeeded']
    A13 --> A14[Cập nhật financial_obligations status='paid']
    A14 --> A15[Cập nhật bookings refund_status='refunded']
    A15 --> A16[Ghi Audit Log bất biến & Hàng đợi gửi Email biên nhận]
    A16 --> EndSuccess([Kết thúc: Hoàn tất đối soát hoàn cọc])
```

---

### 4.3. Biểu Đồ Tuần Tự: Admin Thực Hiện Đối Soát & Hoàn Cọc (Sequence Diagram)

Quy trình tương tác chi tiết giữa các tầng kiến trúc trong hệ thống:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản Trị Viên (Admin)
    participant UI as Admin Web (React SPA)
    participant API as Backend (Ledger Router)
    participant Crypto as Crypto Service (AES-256)
    participant DB as PostgreSQL (ACID)
    participant VietQR as Cổng VietQR (Napas 247)
    participant Email as Email Outbox Queue

    Admin->>UI: Mở tab Nghĩa vụ tài chính (/admin/tai-chinh)
    UI->>API: GET /admin/tai-chinh/nghia-vu
    API->>DB: Truy vấn financial_obligations (kind='customer_refund')
    DB-->>API: Danh sách khoản hoàn cọc kèm hạn thanh toán
    API-->>UI: Hiển thị danh sách nghĩa vụ

    Admin->>UI: Bấm chọn "Chuyển khoản VietQR"
    UI->>API: GET /admin/tai-chinh/nghia-vu/:id/vietqr
    activate API
    API->>DB: Đọc customer_refund_accounts (encrypted_number, iv, tag)
    API->>Crypto: decryptFinancialAccount(encryptedNumber, iv, tag)
    Crypto-->>API: Trả về số tài khoản giải mã
    API->>DB: Ghi Audit Log: financial.customer_account.full_viewed
    API->>API: Sinh nội dung chuyển khoản: "OS HOAN " + orderCode
    API->>VietQR: Sinh link ảnh VietQR (BIN, STK, Số tiền, Nội dung)
    VietQR-->>API: Image URL VietQR Napas 247
    API-->>UI: Trả về preview (URL mã QR, STK, Số tiền, Nội dung)
    deactivate API

    UI-->>Admin: Hiển thị Modal VietQR chuyển khoản
    Admin->>Admin: Dùng ứng dụng ngân hàng quét mã và thực hiện chuyển tiền
    Admin->>UI: Nhập Mã đối chiếu giao dịch (Reference) & bấm Xác nhận
    UI->>API: POST /admin/tai-chinh/nghia-vu/:id/chuyen-nhanh-vietqr (reference, idempotencyKey)
    activate API
    API->>DB: withTransaction(client)
    activate DB
    DB->>DB: Kiểm tra trùng lặp idempotency_key
    DB->>DB: INSERT INTO financial_transfers (status='succeeded', direction='outbound')
    DB->>DB: UPDATE financial_obligations SET status='paid'
    DB->>DB: UPDATE bookings SET refund_status='refunded'
    DB->>DB: Ghi Audit Log bất biến (actor_id, reference, reason)
    DB-->>API: Xác nhận giao dịch ghi nhận thành công
    deactivate DB
    API->>Email: queueRefundEmail(bookingId, transferId, amount, reference)
    API-->>UI: Phản hồi hoàn tất (HTTP 200 OK)
    deactivate API
    UI-->>Admin: Thông báo thành công & Tự động làm mới danh sách
```

---

### 4.4. Biểu Đồ Tuần Tự: Admin Thẩm Định & Phê Duyệt Đối Tác Studio (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản Trị Viên (Admin)
    participant UI as Admin Web (React SPA)
    participant API as Backend (Admin Studios)
    participant DB as PostgreSQL (ACID)
    participant Email as Email Outbox Queue

    Admin->>UI: Mở danh sách hồ sơ Studio chờ duyệt (/admin/studios?status=pending)
    UI->>API: GET /admin/studios?status=pending
    API->>DB: SELECT * FROM studios WHERE verified_at IS NULL
    DB-->>API: Danh sách hồ sơ kèm tài liệu pháp lý & bằng chứng
    API-->>UI: Hiển thị chi tiết hồ sơ & chính sách cọc

    Admin->>UI: Đánh giá hồ sơ & chọn hành động (Phê duyệt / Cần sửa đổi / Từ chối)
    alt Phê duyệt hợp lệ
        Admin->>UI: Bấm "Phê duyệt đối tác" (verified)
        UI->>API: POST /admin/studios/:id/review (decision='verified')
        activate API
        API->>DB: withTransaction(client)
        activate DB
        DB->>DB: UPDATE studios SET verified_at=now()
        DB->>DB: INSERT INTO admin_activity_log (action='studio.verified', target_id=studio_id)
        DB-->>API: Xác nhận cập nhật
        deactivate DB
        API->>Email: Gửi email thông báo hồ sơ Studio đã được kích hoạt
        API-->>UI: Thông báo phê duyệt thành công
        deactivate API
    else Cần bổ sung thông tin
        Admin->>UI: Nhập lý do yêu cầu sửa đổi & gửi
        UI->>API: POST /admin/studios/:id/review (decision='needs_changes', reason)
        activate API
        API->>DB: UPDATE studios SET review_status='needs_changes', review_feedback=reason
        API->>Email: Gửi email yêu cầu Studio bổ sung tài liệu
        API-->>UI: Đã gửi yêu cầu chỉnh sửa
        deactivate API
    end
```

---

### 4.5. Biểu Đồ Trạng Thái: Quản Lý Nghĩa Vụ Tài Chính & Giao Dịch Chi (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> awaiting_funds: Buổi học kết thúc / Đơn cần thu hồi tiền từ Studio
    [*] --> pending: Đơn hủy hợp lệ / Đủ điều kiện hoàn cọc cho khách
    
    awaiting_funds --> pending: Studio đã chuyển hoàn tiền về sàn
    
    pending --> approved: Admin tạo lệnh chuyển tiền & được phê duyệt
    pending --> cancelled: Hủy bỏ nghĩa vụ do sai lệch đơn hàng

    approved --> processing: Gửi lệnh chi hộ qua cổng tự động
    approved --> paid: Admin quét mã VietQR chuyển khoản thành công trực tiếp

    processing --> paid: Cổng thanh toán phản hồi giao dịch thành công
    processing --> manual_review: Cổng thanh toán timeout / Chờ tra soát đối chiếu
    processing --> failed: Ngân hàng thụ hưởng báo từ chối lệnh chi

    manual_review --> paid: Admin đối soát chứng từ khớp lệnh
    manual_review --> failed: Xác nhận không thể thực hiện lệnh chi
    
    failed --> pending: Khởi tạo lại lệnh chuyển mới

    paid --> [*]: Nghĩa vụ hoàn tất (Closed)
    cancelled --> [*]: Hủy bỏ hoàn toàn
```

---

### 4.6. Bảng Đặc Tả Use Case Mẫu (Use Case Specification)

| Thuộc tính (Field) | Nội dung chi tiết (Specification) |
| :--- | :--- |
| **Mã Use Case** | **UC-AD01** |
| **Tên Use Case** | Đối soát & Hoàn tiền cọc cho khách hàng qua VietQR 247 |
| **Actor chính** | Quản trị viên sàn (Admin) |
| **Mô tả tóm tắt** | Quản trị viên tra cứu các khoản cọc cần hoàn trả do khách hủy chỗ hợp lệ hoặc sự kiện bị hủy, xem thông tin tài khoản giải mã, quét mã VietQR chuẩn Napas 247 và ghi nhận mã đối chiếu để hoàn tất quy trình hoàn cọc. |
| **Tiền điều kiện (Pre-condition)** | 1. Admin đã đăng nhập với vai trò `admin`.<br/>2. Đơn đặt chỗ ở trạng thái cần hoàn (`refund_needed` / `cancelled`).<br/>3. Khách hàng đã cập nhật thông tin tài khoản ngân hàng nhận hoàn tiền hợp lệ trong hệ thống. |
| **Hậu điều kiện (Post-condition)** | 1. Nghĩa vụ tài chính chuyển sang trạng thái `paid`.<br/>2. Lệnh chuyển tiền `financial_transfers` được ghi nhận trạng thái `succeeded`.<br/>3. Ghi vết kiểm toán bất biến vào bảng `admin_audit_logs`.<br/>4. Email biên nhận hoàn tiền được đưa vào hàng đợi gửi cho khách hàng. |
| **Luồng sự kiện chính (Main Flow)** | 1. Admin truy cập trang Quản lý Tài chính (`/admin/tai-chinh`).<br/>2. Hệ thống tải và hiển thị danh sách các khoản nghĩa vụ hoàn tiền (`kind = customer_refund`).<br/>3. Admin chọn khoản hoàn cọc cần thực hiện và bấm "Chuyển khoản VietQR".<br/>4. Hệ thống giải mã số tài khoản (AES-256), ghi vết audit log, sinh link ảnh mã VietQR có gắn sẵn nội dung `OS HOAN <orderCode>` và số tiền cần hoàn.<br/>5. Admin dùng ứng dụng ngân hàng quét mã QR và tiến hành chuyển khoản.<br/>6. Sau khi chuyển thành công, Admin nhập mã giao dịch ngân hàng (Reference Code) vào hệ thống và xác nhận.<br/>7. Hệ thống cập nhật trạng thái trong giao dịch cơ sở dữ liệu và gửi thông báo thành công cho Admin. |
| **Luồng ngoại lệ (Alternative / Exception)** | - *3a. Khách chưa cập nhật STK:* Hệ thống cảnh báo "Chưa có tài khoản nhận hoàn tiền", chuyển trạng thái sang chờ khách bổ sung.<br/>- *6a. Trùng mã Idempotency:* Hệ thống từ chối yêu cầu để ngăn chặn việc ghi nhận lặp giao dịch. |

---

## 5. Tối Ưu Hóa Frontend & Web Vitals (Performance Engineering)

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
