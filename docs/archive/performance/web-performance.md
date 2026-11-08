Báo cáo tối ưu web ngày 03/11/2026. Giữ cấu trúc giao diện và quy tắc nghiệp vụ hiện có.

Đo bản trước ở commit `d247ad4` và bản sau bằng production build. “JS tải ban đầu” gồm entry và toàn bộ static imports, không cộng các dynamic imports chưa cần tải. Đơn vị kB = 1.000 byte; gzip đo trực tiếp từ file dist bằng Python gzip mức 9 cho cả hai bản. Không cộng CSS, ảnh hoặc font. Số gzip in trong build dùng Node zlib mức 9 nên có thể lệch nhẹ theo phiên bản zlib.

| Chỉ số           | Trước (kB) | Sau (kB) | Thay đổi |
| ---------------- | ---------: | -------: | -------: |
| Entry JS         |      663.6 |    449.4 |   -32.3% |
| Entry gzip       |      189.4 |    130.3 |   -31.2% |
| JS tải ban đầu   |    1,130.2 |    866.5 |   -23.3% |
| Gzip tải ban đầu |      334.9 |    263.9 |   -21.2% |
| Tổng JS          |    1,652.9 |  1,671.9 |    +1.1% |
| Tổng gzip        |      498.5 |    525.0 |    +5.3% |

Tổng JS tăng nhẹ vì thêm ranh giới tải riêng và phần quản lý cache/ảnh. Lợi ích chính là trình duyệt khách không tải mã dashboard ngay khi mở trang. Build kiểm tra tự động để Recharts, dnd-kit và TanStack Table không lọt vào static imports của entry hoặc các route studio.

Đã thực hiện theo 5 phần:

1. Đồng bộ phiên: chờ hủy query rồi xóa cache khi đăng xuất, refresh thất bại hoặc đổi userId; xóa đúng bản nháp studio của tài khoản rời phiên. Query riêng tư dùng tiền tố `['private', userId, ...]`. `['auth', 'me']` là khóa bootstrap để xác định tài khoản trước khi tạo các query này. Chặn refresh/ghi cache đến muộn từ tài khoản cũ và gắn lại observer sau `clear()`; vùng quản trị khởi tạo lại khi đổi tài khoản.
2. Chỉ tải visualizer khi `ANALYZE=true`. Build in dung lượng entry ban đầu/tổng JS và xuất `dist/bundle-metrics.json` sau khi Vite hoàn tất sửa mã preload.
3. Các trang admin/studio và dashboard shell dùng React.lazy/Suspense với Skeleton; menu sidebar prefetch chunk khi hover hoặc focus. Vendor React, Router, Query và các thư viện admin có chunk riêng.
4. Query key factory dùng chung cho studio/workshop/booking/user và số đếm. Mutation chỉ làm mới nhóm liên quan; duyệt/từ chối cập nhật cache chi tiết rồi làm mới danh sách/số đếm. DataTable giữ dữ liệu trang trước trong lúc tải và nạp trước trang kế; số đếm dùng endpoint riêng và không phụ thuộc page/sort.
5. Img dùng chung, decoding async, lazy mặc định; priority chuyển sang eager/high. Giữ kích thước/aspect utility hiện có, thêm tỷ lệ dự phòng khi chưa có kích thước ảnh. Danh sách dùng thumbnail: 9 ảnh mẫu giảm tổng từ 858.899 xuống 118.956 byte; ảnh upload mới có bản WebP cạnh dài tối đa 480px, tối đa 200KB. Gallery lớn dùng bản gốc.

Migration `029_image_thumbnails.sql` đã áp dụng cho DB dev và DB test. Thumbnail dùng cùng bucket public, signed URL và kiểm tra quyền hiện có; backend xác minh cả hai file trước khi đánh dấu ready, xóa cả hai khi dọn ảnh. Ảnh cũ chưa có thumbnail tiếp tục dùng bản gốc, không có đợt chuyển đổi hàng loạt. Cần deploy API/migration trước frontend mới.

Kiểm tra: web 35 file / 164 test qua; API ảnh 3 file / 13 test qua; build web/API và ESLint qua. Playwright kiểm tra đăng nhập admin/chủ studio, biểu đồ tải riêng, hover tải chunk, prefetch trang kế không gọi trùng, cache số đếm, giữ hàng cũ khi tìm kiếm, URL query, xóa nháp khi logout và chuyển route studio. Các kiểm tra trình duyệt dùng dữ liệu giả, không ghi dữ liệu nghiệp vụ thật.

Để xem biểu đồ bundle trên PowerShell:

```powershell
$env:ANALYZE = 'true'
npm run build --workspace @workshop/web
Remove-Item Env:ANALYZE
```

Mở `apps/web/dist/bundle-analysis.html`. Build thường không tạo file này. Tạo lại thumbnail ảnh mẫu bằng `npm run images:thumbnails --workspace @workshop/web` khi thay ảnh gốc. Số liệu byte được lưu ở [web-performance-bundles.json](web-performance-bundles.json).

Danh sách file thay đổi:

- `apps/api/src/modules/admin/featured.repository.ts`
- `apps/api/src/modules/admin/workshop-moderation.ts`
- `apps/api/src/modules/images/images.repository.ts`
- `apps/api/src/modules/images/images.routes.ts`
- `apps/api/src/modules/images/images.service.ts`
- `apps/api/src/modules/studios/studios.service.ts`
- `apps/api/tests/unit/image-thumbnails.test.ts`
- `apps/web/build/bundle-metrics.ts`
- `apps/web/build/thumbnails.mjs`
- `apps/web/package.json`
- `apps/web/public/images/workshops/artPhoto.thumb.webp`
- `apps/web/public/images/workshops/candlePhoto.thumb.webp`
- `apps/web/public/images/workshops/craftPhoto.thumb.webp`
- `apps/web/public/images/workshops/flowerPhoto.thumb.webp`
- `apps/web/public/images/workshops/jewelryPhoto.thumb.webp`
- `apps/web/public/images/workshops/perfumePhoto.thumb.webp`
- `apps/web/public/images/workshops/soapPhoto.thumb.webp`
- `apps/web/public/images/workshops/stampPhoto.thumb.webp`
- `apps/web/public/images/workshops/terrazzoPhoto.thumb.webp`
- `apps/web/src/App.tsx`
- `apps/web/src/components/admin/DataTable.test.tsx`
- `apps/web/src/components/admin/DataTable.tsx`
- `apps/web/src/components/admin/ImageGalleryDialog.tsx`
- `apps/web/src/components/admin/SearchableFilterSelect.tsx`
- `apps/web/src/components/auth/RequireRole.tsx`
- `apps/web/src/components/catalog/PriceFilter.tsx`
- `apps/web/src/components/catalog/WorkshopCard.tsx`
- `apps/web/src/components/details/ArtisanCard.tsx`
- `apps/web/src/components/details/DetailPrimitives.tsx`
- `apps/web/src/components/details/StudioHero.tsx`
- `apps/web/src/components/details/WorkshopDetails.tsx`
- `apps/web/src/components/home/HomeFeaturedStudios.tsx`
- `apps/web/src/components/home/HomeSearchHero.tsx`
- `apps/web/src/components/layout/DashboardLayout.tsx`
- `apps/web/src/components/layout/DashboardSkeleton.tsx`
- `apps/web/src/components/layout/Logo.tsx`
- `apps/web/src/components/layout/NotificationsMenu.tsx`
- `apps/web/src/components/layout/StudioSwitcher.tsx`
- `apps/web/src/components/management/StudioEvidenceEditor.tsx`
- `apps/web/src/components/management/StudioEvidenceFields.tsx`
- `apps/web/src/components/management/StudioNotifications.tsx`
- `apps/web/src/components/reports/ReportButton.tsx`
- `apps/web/src/components/tickets/ArtisanAvatar.tsx`
- `apps/web/src/components/tickets/TicketCard.tsx`
- `apps/web/src/components/tickets/TicketContent.tsx`
- `apps/web/src/components/tickets/TicketStub.tsx`
- `apps/web/src/components/ui/Img.test.tsx`
- `apps/web/src/components/ui/Img.tsx`
- `apps/web/src/components/ui/MediaImage.tsx`
- `apps/web/src/components/ui/avatar.tsx`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/hooks/useCatalog.ts`
- `apps/web/src/hooks/useHomeCatalog.ts`
- `apps/web/src/hooks/useManagement.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/compress-studio-image.ts`
- `apps/web/src/lib/dashboard-routes.ts`
- `apps/web/src/lib/image-thumbnails.json`
- `apps/web/src/lib/query-invalidation.test.ts`
- `apps/web/src/lib/query-invalidation.ts`
- `apps/web/src/lib/query-keys.ts`
- `apps/web/src/lib/session-cache.test.ts`
- `apps/web/src/lib/session-cache.ts`
- `apps/web/src/lib/session-events.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/pages/AdminApprovalPage.test.tsx`
- `apps/web/src/pages/AdminApprovalPage.tsx`
- `apps/web/src/pages/AdminAuditPage.tsx`
- `apps/web/src/pages/AdminBookingsPage.tsx`
- `apps/web/src/pages/AdminCategoriesPage.tsx`
- `apps/web/src/pages/AdminContentPage.tsx`
- `apps/web/src/pages/AdminMessageTemplatesPage.tsx`
- `apps/web/src/pages/AdminOverviewPage.tsx`
- `apps/web/src/pages/AdminRecordsPage.tsx`
- `apps/web/src/pages/AdminReportsPage.tsx`
- `apps/web/src/pages/AdminSettingsPage.tsx`
- `apps/web/src/pages/AdminStudioProfilesPage.test.tsx`
- `apps/web/src/pages/AdminStudioProfilesPage.tsx`
- `apps/web/src/pages/AdminUsersPage.tsx`
- `apps/web/src/pages/AdminWorkshopPage.tsx`
- `apps/web/src/pages/StudioPage.tsx`
- `apps/web/src/services/authService.ts`
- `apps/web/src/services/imageService.ts`
- `apps/web/src/services/managementService.ts`
- `apps/web/src/styles.css`
- `apps/web/src/types/management.ts`
- `apps/web/vite.config.ts`
- `db/migrations/029_image_thumbnails.sql`
- `docs/archive/performance/web-performance-bundles.json`
- `docs/archive/performance/web-performance.md`
- `package-lock.json`
