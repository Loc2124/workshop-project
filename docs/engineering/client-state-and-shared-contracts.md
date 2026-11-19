# Định hướng kiến trúc: Client State (Zustand) và Shared Contracts (Zod)

> **Trạng thái tài liệu:** **ĐÃ TRIỂN KHAI HOÀN TẤT (IMPLEMENTED)** (19/11/2026).  
> **Áp dụng cho:** `apps/web`, `apps/api`, `packages/shared`.

---

## 1. Bối cảnh & Phân loại State trong ứng dụng

Trong kiến trúc hiện tại của Open Slot, dữ liệu được chia làm hai loại rõ rệt:

1. **Server State (Dữ liệu từ máy chủ):**
   * *Bản chất:* Dữ liệu về workshop, buổi học (session), đơn đặt chỗ (booking), người dùng (user profile)... thuộc quyền sở hữu của máy chủ và database.
   * *Giải pháp hiện tại:* Đang được quản lý **100% bằng TanStack Query (`@tanstack/react-query`)**. Thư viện này tự động xử lý caching, deduplication, re-fetching ngầm và đồng bộ URL query params.
   * *Nguyên tắc:* **Không lưu Server State vào bất kỳ State Manager nào khác** (như Redux hay Zustand).

2. **Client-Only State (Trạng thái thuần máy khách):**
   * *Bản chất:* Dữ liệu phát sinh tức thời trên giao diện, không/chưa thuộc về database, hoặc cần duy trì xuyên suốt nhiều màn hình khi người dùng di chuyển giữa các route.
   * *Giải pháp đề xuất:* **Zustand** (khi có nhu cầu thực tế).

---

## 2. Tiêu chí và Hướng dẫn áp dụng Zustand

### 2.1. Khi nào KHÔNG dùng Zustand?
* Không dùng để lưu trữ dữ liệu trả về từ API (hãy dùng `useQuery` / `useMutation`).
* Không dùng cho state cục bộ chỉ nằm trong 1 component hoặc 1 form (hãy dùng `useState`, `useReducer`, hoặc `useForm`).
* Không tạo một "Mega Store" chứa tất cả mọi thứ như mô hình Redux cũ.

### 2.2. Khi nào ĐÁNG THÊM Zustand?
Zustand chỉ nên được thêm vào khi gặp 1 trong 3 ca sử dụng thực tế sau:

#### Ca 1: Luồng đặt chỗ nhiều bước qua nhiều Route (Multi-Step Booking Wizard)
* *Tình huống:* Quy trình đặt vé tách thành các URL riêng:
  1. `/workshops/:id/book/step-1-session`: Chọn buổi học.
  2. `/workshops/:id/book/step-2-tickets`: Chọn số vé, vị trí/loại vé.
  3. `/workshops/:id/book/step-3-info`: Nhập thông tin khách tham gia.
  4. `/workshops/:id/book/step-4-payment`: Xem lại báo giá & xác nhận cọc.
* *Tại sao cần Zustand:* Cần giữ nguyên lựa chọn của khách khi chuyển qua lại giữa các trang trước khi bấm xác nhận cuối cùng để gửi 1 payload hoàn chỉnh lên API.

#### Ca 2: Chế độ Check-in Ngoại tuyến (Offline Attendance Queue cho Studio)
* *Tình huống:* Nhân viên studio đứng tại cửa check-in vé bằng quét mã QR qua camera điện thoại. Trong điều kiện mạng chập chờn hoặc mất sóng:
  * Ứng dụng vẫn phải cho quét vé và ghi nhận tạm thời.
  * Xếp các lượt quét vào một hàng đợi ngoại tuyến (Offline Queue).
  * Tự động gửi đồng bộ lên API khi thiết bị có mạng trở lại.
* *Tại sao cần Zustand:* Kết hợp Zustand với middleware `persist` (lưu vào `localStorage` hoặc `IndexedDB`) giúp hàng đợi không bị mất ngay cả khi tải lại trang hoặc tắt trình duyệt.

#### Ca 3: Giỏ hàng nhiều workshop (Shopping Cart)
* *Tình huống:* Khách chọn đặt 2–3 buổi học của các workshop khác nhau rồi mới thanh toán gộp trong 1 giao dịch.
* *Tại sao cần Zustand:* State giỏ hàng tồn tại độc lập với server cho tới khi tạo đơn tổng.

---

### 2.3. Quy ước cấu trúc Store Zustand (Feature-Scoped)

Tuyệt đối **không** tạo `store.ts` toàn cục dùng chung cho cả web. Mỗi store phải thuộc về chính feature của nó:

```text
apps/web/src/
├── features/
│   ├── booking-flow/
│   │   ├── booking-flow.store.ts      # State luồng wizard đặt vé
│   │   └── components/
│   └── check-in/
│       ├── check-in-offline.store.ts  # Hàng đợi check-in ngoại tuyến
│       └── components/
```

#### Code mẫu 1: Multi-Step Booking Flow Store
```typescript
// apps/web/src/features/booking-flow/booking-flow.store.ts
import { create } from 'zustand';

interface BookingFlowState {
  workshopId: string | null;
  sessionId: string | null;
  ticketQuantity: number;
  customerNote: string;
  step: number;
  // Actions
  setSession: (workshopId: string, sessionId: string) => void;
  setTickets: (qty: number, note?: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetFlow: () => void;
}

export const useBookingFlowStore = create<BookingFlowState>((set) => ({
  workshopId: null,
  sessionId: null,
  ticketQuantity: 1,
  customerNote: '',
  step: 1,
  setSession: (workshopId, sessionId) => set({ workshopId, sessionId, step: 2 }),
  setTickets: (ticketQuantity, customerNote = '') => set({ ticketQuantity, customerNote, step: 3 }),
  nextStep: () => set((state) => ({ step: state.step + 1 })),
  prevStep: () => set((state) => ({ step: Math.max(1, state.step - 1) })),
  resetFlow: () => set({ workshopId: null, sessionId: null, ticketQuantity: 1, customerNote: '', step: 1 }),
}));
```

#### Code mẫu 2: Offline Check-in Queue Store (Có persist LocalStorage)
```typescript
// apps/web/src/features/check-in/check-in-offline.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PendingCheckIn {
  ticketCode: string;
  sessionId: string;
  scannedAt: string;
}

interface OfflineCheckInState {
  pendingQueue: PendingCheckIn[];
  enqueueTicket: (item: PendingCheckIn) => void;
  dequeueTicket: (ticketCode: string) => void;
  clearQueue: () => void;
}

export const useOfflineCheckInStore = create<OfflineCheckInState>()(
  persist(
    (set) => ({
      pendingQueue: [],
      enqueueTicket: (item) =>
        set((state) => ({
          pendingQueue: [...state.pendingQueue.filter((q) => q.ticketCode !== item.ticketCode), item],
        })),
      dequeueTicket: (ticketCode) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.filter((q) => q.ticketCode !== ticketCode),
        })),
      clearQueue: () => set({ pendingQueue: [] }),
    }),
    {
      name: 'openslot_offline_checkin_queue',
    }
  )
);
```

---

## 3. Chuẩn hóa Contracts Zod dùng chung (`packages/shared/contracts`)

Hiện tại, cả Web và API đều đã cài đặt:
* `zod`
* `react-hook-form`
* `@hookform/resolvers`

Để đạt được kiến trúc **Contract-First Design**, toàn bộ các định nghĩa Schema xác thực form/request sẽ được di chuyển vào `packages/shared/src/contracts/`.

### 3.1. Cấu trúc thư mục đề xuất
```text
packages/shared/src/
├── contracts/
│   ├── index.ts                        # Xuất tất cả contracts
│   ├── auth.contract.ts                # Đăng ký, đăng nhập, đổi mật khẩu
│   ├── booking.contract.ts             # Đặt chỗ, báo giá hủy, đổi lịch
│   ├── studio.contract.ts              # Hồ sơ studio, cấu hình cọc
│   └── workshop.contract.ts            # Tạo workshop, tạo buổi học
```

### 3.2. Triển khai cụ thể (Ví dụ Luồng Đặt chỗ)

#### Bước 1: Định nghĩa Contract trong `packages/shared`
```typescript
// packages/shared/src/contracts/booking.contract.ts
import { z } from 'zod';

export const createBookingSchema = z.object({
  sessionId: z.string().uuid({ message: 'Mã buổi học không đúng định dạng' }),
  quantity: z
    .number({ invalid_type_error: 'Số vé phải là số' })
    .int('Số vé phải là số nguyên')
    .min(1, 'Bạn phải đặt ít nhất 1 vé')
    .max(10, 'Mỗi lần đặt tối đa 10 vé'),
  customerName: z.string().trim().min(2, 'Tên khách hàng tối thiểu 2 ký tự').max(100),
  customerEmail: z.string().trim().email('Email không hợp lệ'),
  customerPhone: z.string().trim().regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, 'Số điện thoại không hợp lệ'),
  customerNote: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

// Xuất type TypeScript tự động từ schema
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
```

#### Bước 2: Dùng trong API Middleware (`apps/api`)
```typescript
// apps/api/src/modules/bookings/bookings.routes.ts
import { Router } from 'express';
import { createBookingSchema } from '@workshop/shared';
import { validateBody } from '../../middleware/validate';
import { bookingsController } from './bookings.controller';

const router = Router();

// Validate request body tự động trước khi vào controller
router.post('/bookings', validateBody(createBookingSchema), bookingsController.createBooking);

export default router;
```

#### Bước 3: Dùng trong React Hook Form (`apps/web`)
```tsx
// apps/web/src/components/booking/BookingForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBookingSchema, type CreateBookingInput } from '@workshop/shared';

export function BookingForm({ sessionId, onSubmit }: { sessionId: string; onSubmit: (data: CreateBookingInput) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      sessionId,
      quantity: 1,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Họ và tên</label>
        <input {...register('customerName')} className="input" />
        {errors.customerName && <p className="text-red-500 text-xs">{errors.customerName.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Số lượng vé</label>
        <input type="number" {...register('quantity', { valueAsNumber: true })} className="input" />
        {errors.quantity && <p className="text-red-500 text-xs">{errors.quantity.message}</p>}
      </div>

      <button type="submit" disabled={isSubmitting} className="btn-primary">
        Xác nhận đặt chỗ
      </button>
    </form>
  );
}
```

---

## 4. Giá trị kỹ thuật khi bảo vệ đồ án tốt nghiệp

Khi trình bày kiến trúc này với Hội đồng đánh giá:
1. **Tính nhất quán dữ liệu (Single Source of Truth):** Chứng minh được cả hệ thống Web và API chỉ có một nơi duy nhất định nghĩa luật xác thực (`packages/shared`), loại bỏ hoàn toàn lỗi lệch validation giữa client và server.
2. **Hiểu rõ ranh giới State (Clear State Boundary):** Giải thích rõ ràng sự phân biệt giữa **Server State** (giao cho TanStack Query quản lý) và **Client State** (chỉ dùng Zustand khi cần lưu tạm cross-route wizard hoặc offline persistence).
3. **Hiệu năng & Tiết kiệm tài nguyên:** Không chạy theo xu hướng cài đặt thư viện bừa bãi; chỉ đưa công cụ vào khi có nghiệp vụ thực tế yêu cầu.
