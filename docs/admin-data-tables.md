# Component dùng chung cho admin

Các trang Hồ sơ studio, Tất cả studio và Workshop dùng `DataTable`, `ConfirmReasonDialog`, `StatusBadge`. Người dùng, Đặt chỗ và Báo cáo cũng dùng DataTable cho các danh sách chỉ đọc.

## DataTable

Vị trí: `apps/web/src/components/admin/DataTable.tsx`. Table dùng component shadcn và TanStack Table v8 ở chế độ manual pagination/filtering/sorting. Dữ liệu không được lọc hay sắp xếp lại ở frontend.

```tsx
<DataTable
  columns={columns}
  fetcher={fetchAdminStudios}
  queryKey={['management', 'admin-studios', 'table']}
  tabs={[
    { value: 'pending', label: 'Chờ duyệt' },
    { value: 'approved', label: 'Đã duyệt' },
  ]}
  defaultTab="pending"
  defaultSort="createdAt:desc"
  filters={filters}
  getRowId={(row) => row.id}
  onRowClick={openDetails}
/>
```

`columns` và `fetcher` là hai props bắt buộc. Các props còn lại gồm `defaultPageSize` (20), `searchPlaceholder`, `emptyMessage`, `onRowsChange` (đồng bộ dữ liệu Sheet sau khi cache cập nhật). Nên giữ `columns` ổn định bằng `useMemo`.

Fetcher nhận `(query, signal)` và trả Promise:

```ts
type DataTableQuery = {
  page: number;
  pageSize: number;
  sort: string; // columnId:asc hoặc columnId:desc
  q: string;
  tab: string;
  filters: Record<string, string>;
};
type DataTableResult<T> = {
  rows: T[];
  total: number;
  statusCounts?: Record<string, number>;
};
```

Nếu dùng Tabs, fetcher trả `statusCounts` theo `value` của từng Tab. Số đếm áp dụng từ khóa và bộ lọc nhưng không giới hạn theo Tab hoặc trang hiện tại. Thiếu số đếm hiển thị “—”, không tự đếm từ các dòng của trang.

URL lưu `page`, `q`, `tab`, cùng `pageSize`, `sort` và `filter.<id>`. Nhập tìm kiếm debounce 300 ms. Đổi từ khóa, Tab, bộ lọc, số dòng hoặc sắp xếp đều về trang 1. Back/Forward khôi phục từ URL. Trang vượt tổng số trang được điều chỉnh bằng replace; bộ lọc và cột sort không được cấu hình sẽ bị bỏ qua.

Fetcher cần chuyển tiếp AbortSignal để hủy request không còn dùng. Query key mặc định theo pathname; với các bảng nghiệp vụ nên đặt prefix khớp `managementKeys` để mutation hiện có tự invalidate. Component có Skeleton, trạng thái rỗng, lỗi và nút Thử lại. Lỗi không được trình bày như một danh sách rỗng.

## API danh sách

Hai endpoint nhận `page`, `pageSize` (1–100), `sort`, `q` (tối đa 200 ký tự), `status`, `provinceId`, `categoryId`:

- `GET /admin/studios`: sort theo `name`, `ownerFullName`, `province`, `createdAt`, `status`.
- `GET /admin/workshops`: sort theo `title`, `studioName`, `basePrice`, `province`, `createdAt`, `status`.

`sort` có dạng `name:asc`. Chỉ dùng cột trong allowlist; giá trị tìm kiếm/bộ lọc truyền qua SQL parameters. `%`, `_` và dấu gạch chéo ngược trong từ khóa được tìm như ký tự thường. Sắp xếp thêm ID để phân trang ổn định khi các giá trị bằng nhau.

Response gồm `studios` hoặc `workshops`, `pagination: { page, pageSize, total }`, `statusCounts`. `status=all` chọn mọi trạng thái. Bộ lọc workshop không nhận `needs_changes`.

Tương thích luồng cũ: studio chỉ có query `status` hoặc không có query vẫn trả danh sách cũ; muốn response phân trang phải gửi `page`/`pageSize` hoặc tham số mới. API tiếp tục nhận alias `page_size`; nếu gửi cả hai tên với hai giá trị khác nhau thì trả lỗi. Workshop không truyền trạng thái vẫn mặc định Chờ duyệt.

## ConfirmReasonDialog

Vị trí: `apps/web/src/components/admin/ConfirmReasonDialog.tsx`. Dùng shadcn Dialog + Form, React Hook Form và Zod.

Props: `open`, `onOpenChange`, `title`, `description`, `requireReason` (true), `minLength` (10), `maxLength` (1000), `confirmLabel`, `destructive`, `onConfirm(reason)`.

Lý do được trim trước khi trả về. `requireReason={false}` ẩn ô nhập và trả chuỗi rỗng. `onConfirm` có thể bất đồng bộ: thành công đóng Dialog; throw lỗi giữ Dialog và lý do để thử lại. Trong lúc gửi, khóa các nút và thao tác đóng. Caller chỉ hiển thị toast khi API đã thành công.

## StatusBadge

Vị trí: `apps/web/src/components/ui/status-badge.tsx`. Nhận `status`, tùy chọn `label`, `tone`, `className`. Nháp dùng xám; Chờ duyệt vàng; Đã duyệt xanh; Từ chối đỏ; Cần bổ sung cam. Trạng thái chưa biết dùng màu xám, không tự suy diễn trạng thái thành công.
