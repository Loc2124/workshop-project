# Mobile performance

> **LƯU TRỮ — không dùng làm chính sách hoặc trạng thái hiện hành.** Giữ nguyên nội dung như bằng chứng/bản nháp lịch sử. Quy tắc hiện hành, phạm vi đã có và việc còn thiếu được dẫn từ [mục lục tài liệu](../../README.md).

Đã thực hiện A2–A9 và B; giữ font tự host hiện có. Không thiết kế lại giao diện hoặc đổi quy tắc nghiệp vụ.

## Bundle

Production build, gzip level 9; KiB = 1024 byte. Baseline được chụp ngay trước đợt tối ưu này, sau khi tự host font.

| JavaScript                    | Trước raw / gzip KiB | Sau raw / gzip KiB |
| ----------------------------- | -------------------: | -----------------: |
| Entry                         |        438.9 / 127.5 |       208.5 / 61.0 |
| Entry + static dependencies   |        846.2 / 257.5 |      615.9 / 191.0 |
| Toàn bộ JS, gồm chunk tải sau |       1632.7 / 512.4 |     1789.0 / 594.0 |

Tổng JS tăng do có bộ nén ảnh và worker chạy tại trình duyệt, cùng các ranh giới chunk mới. Bộ nén/worker chỉ tải khi chọn ảnh; không nằm trong entry. Build tự kiểm tra entry gzip không vượt baseline và recharts/dnd-kit/TanStack Table không lọt vào static import graph của trang khách hoặc studio.

## Ảnh trên từng trang khách

Chromium mobile 390×844, DPR 2, cache lạnh, cùng fixture API trước/sau. Đo response body của ảnh, gồm logo SVG; không cộng font/JS. “Đầu trang” là lần tải đầu, “Cả trang” là sau khi cuộn hết. Đây là phép đo tái lập bằng fixture, không phải dung lượng ảnh thực tế của mọi studio trên production.

| Trang                   | Đầu trang trước → sau KiB | Cả trang trước → sau KiB |
| ----------------------- | ------------------------: | -----------------------: |
| `/`                     |              125.3 → 80.8 |            466.0 → 226.8 |
| `/kham-pha`             |               72.2 → 72.2 |            121.5 → 121.5 |
| `/kham-pha?view=studio` |               14.0 → 14.0 |              14.0 → 14.0 |
| `/studios/studio-test`  |               83.6 → 59.0 |            570.9 → 104.0 |
| `/workshop/workshop-1`  |               10.8 → 14.0 |              10.8 → 24.9 |
| `/danh-cho-nghe-nhan`   |               46.3 → 21.7 |              46.3 → 21.7 |
| `/ve-open-slot`         |               46.3 → 21.7 |              46.3 → 21.7 |
| `/dang-nhap`            |               10.8 → 10.8 |              10.8 → 10.8 |
| `/dang-ky`              |               10.8 → 10.8 |              10.8 → 10.8 |
| `/dang-ky-studio`       |               10.8 → 10.8 |              10.8 → 10.8 |
| `/demo/ve`              |               37.8 → 37.8 |              53.8 → 53.8 |

Trang chi tiết workshop tăng 14,1 KiB vì danh sách workshop liên quan nay tải đầy đủ sau lần refresh phiên thất bại. Baseline bị hủy query công khai khi xóa cache phiên nên thiếu phần này; không tính việc thiếu nội dung là tiết kiệm ảnh. Các trang khám phá đã dùng thumbnail trước đó nên dung lượng giữ nguyên.

## Thay đổi

- Img dùng lazy/async mặc định, priority eager/high, kích thước/aspect ratio, srcset/sizes. Thẻ dùng thumbnail khoảng 480px, hero dùng medium khoảng 960px; gallery lớn dùng bản gốc. Ảnh cũ thiếu biến thể vẫn dùng URL gốc.
- Sinh WebP original/medium/thumbnail cho ảnh tĩnh; giữ JPG làm nguồn pipeline và tương thích URL cũ. Manifest ánh xạ cả URL JPG cũ sang WebP. Hero tĩnh có responsive preload.
- Upload nén động trong worker cùng origin, tạo ba biến thể và cacheControl 31536000. Migration 030 bổ sung medium_key/medium_byte_size; đã áp dụng DB dev và test. API trả metadata biến thể, xóa đủ các file. Attachment báo cáo riêng tư giữ TTL riêng.
- Chỉ preconnect origin Supabase Storage từ cấu hình server tại build; không đưa service key vào frontend.
- PublicShell render header/footer độc lập auth; fallback giữ chiều cao. Query công khai được nối lại sau khi cache phiên bị clear.
- Polling thông báo chỉ chạy khi đăng nhập, tab hiển thị và sau load/idle. Dừng khi tab ẩn.
- Section dưới màn hình đầu dùng content-visibility; lịch đặt chỗ dùng IntersectionObserver + lazy. Gallery và báo cáo chỉ tải khi mở. Phần tử ảnh ưu tiên không bắt đầu với opacity 0; giữ hỗ trợ reduced motion.
- Khám phá memo thẻ, hai ảnh đầu ưu tiên, keepPreviousData, prefetch trang kế khi gần cuối và tránh mạng tiết kiệm dữ liệu. Sticky dùng CSS/ResizeObserver thay vì đo layout đồng bộ.
- Login/register/đăng ký studio là chunk riêng; bộ nén chỉ import khi chọn ảnh, object URL được thu hồi. Tỉnh/thành giữ hằng số shared. Dashboard/chart/table tiếp tục tách khỏi bundle khách.

## Kiểm chứng

- Production build và giới hạn bundle: đạt. ESLint và git diff --check: đạt.
- Web: 35 file, 168 test đạt, gồm test Img priority/srcset/biến thể/fallback.
- Browser: 12 kiểm tra đạt về shell/auth, prefetch, gallery lazy, polling theo visibility/idle, nén WebP và cache-control upload; 11 URL không tràn ngang hoặc phát sinh pageerror.
- API: lượt toàn bộ ban đầu có 142/148 test đạt; 5 file chứa các assertion cũ sau khi cập nhật chạy lại đạt 22/22. Lượt kiểm tra migration riêng cuối đạt 6/6 với timeout 120 giây (lượt toàn bộ cuối bị ngắt sau timeout 30 giây của bài này). Các lỗi đã được kiểm chứng lại, nhưng không tuyên bố có một lượt toàn bộ cuối 148/148. DB test tách riêng; các file integration chạy tuần tự để tránh tranh chấp settings/migration.

## File thay đổi trong đợt này

So với snapshot đầu đợt tối ưu mobile; không gộp các chỉnh sửa quản trị/font của đợt trước. Danh sách máy đọc được nằm trong mobile-performance.json.

- `apps/api/src/modules/admin/featured.repository.ts`
- `apps/api/src/modules/admin/workshop-moderation.ts`
- `apps/api/src/modules/catalog/catalog.service.ts`
- `apps/api/src/modules/images/image-variants.ts`
- `apps/api/src/modules/images/images.repository.ts`
- `apps/api/src/modules/images/images.routes.ts`
- `apps/api/src/modules/images/images.service.ts`
- `apps/api/tests/integration/admin-audit.test.ts`
- `apps/api/tests/integration/admin-categories.test.ts`
- `apps/api/tests/integration/migrations.test.ts`
- `apps/api/tests/integration/studio-admin.test.ts`
- `apps/api/tests/integration/studio-evidence-deposits.test.ts`
- `apps/api/tests/integration/studio-trust.test.ts`
- `apps/api/tests/integration/studio-workshops.test.ts`
- `apps/api/tests/unit/admin-list-query.test.ts`
- `apps/api/tests/unit/categories.test.ts`
- `apps/api/tests/unit/category-proposals.test.ts`
- `apps/api/tests/unit/image-thumbnails.test.ts`
- `apps/api/tests/unit/studio-trust.test.ts`
- `apps/api/vitest.config.ts`
- `apps/web/build/bundle-metrics.ts`
- `apps/web/build/performance-budget.json`
- `apps/web/build/storage-preconnect.ts`
- `apps/web/build/thumbnails.mjs`
- `apps/web/index.html`
- `apps/web/package.json`
- `docs/engineering/font-assets.md`
- `apps/web/public/images/workshops/artPhoto.medium.webp`
- `apps/web/public/images/workshops/artPhoto.webp`
- `apps/web/public/images/workshops/candlePhoto.medium.webp`
- `apps/web/public/images/workshops/candlePhoto.webp`
- `apps/web/public/images/workshops/craftPhoto.medium.webp`
- `apps/web/public/images/workshops/craftPhoto.webp`
- `apps/web/public/images/workshops/flowerPhoto.medium.webp`
- `apps/web/public/images/workshops/flowerPhoto.webp`
- `apps/web/public/images/workshops/jewelryPhoto.medium.webp`
- `apps/web/public/images/workshops/jewelryPhoto.webp`
- `apps/web/public/images/workshops/perfumePhoto.medium.webp`
- `apps/web/public/images/workshops/perfumePhoto.webp`
- `apps/web/public/images/workshops/soapPhoto.medium.webp`
- `apps/web/public/images/workshops/soapPhoto.webp`
- `apps/web/public/images/workshops/stampPhoto.medium.webp`
- `apps/web/public/images/workshops/stampPhoto.webp`
- `apps/web/public/images/workshops/terrazzoPhoto.medium.webp`
- `apps/web/public/images/workshops/terrazzoPhoto.webp`
- `apps/web/src/App.tsx`
- `apps/web/src/components/admin/ImageGalleryDialog.tsx`
- `apps/web/src/components/auth/RequireRole.tsx`
- `apps/web/src/components/catalog/ExploreFilters.tsx`
- `apps/web/src/components/catalog/HorizontalFilterBar.tsx`
- `apps/web/src/components/catalog/StudioCard.tsx`
- `apps/web/src/components/catalog/WorkshopCard.tsx`
- `apps/web/src/components/catalog/WorkshopGrid.tsx`
- `apps/web/src/components/details/ArtisanCard.tsx`
- `apps/web/src/components/details/DeferredSchedule.tsx`
- `apps/web/src/components/details/DetailPrimitives.tsx`
- `apps/web/src/components/details/StudioHero.tsx`
- `apps/web/src/components/details/StudioPhotoGrid.tsx`
- `apps/web/src/components/details/WorkshopDetails.tsx`
- `apps/web/src/components/home/HomeFeaturedStudios.tsx`
- `apps/web/src/components/home/HomeSearchHero.tsx`
- `apps/web/src/components/layout/HeaderSearch.tsx`
- `apps/web/src/components/layout/HeaderSearchPanel.tsx`
- `apps/web/src/components/layout/NotificationsMenu.tsx`
- `apps/web/src/components/layout/PublicShell.tsx`
- `apps/web/src/components/layout/SiteHeader.tsx`
- `apps/web/src/components/layout/StudioSwitcher.tsx`
- `apps/web/src/components/management/StudioEvidenceFields.tsx`
- `apps/web/src/components/management/StudioNotifications.tsx`
- `apps/web/src/components/reports/ReportButton.tsx`
- `apps/web/src/components/reports/ReportDialog.tsx`
- `apps/web/src/components/tickets/ArtisanAvatar.tsx`
- `apps/web/src/components/tickets/TicketCard.tsx`
- `apps/web/src/components/tickets/TicketStub.tsx`
- `apps/web/src/components/tickets/types.ts`
- `apps/web/src/components/ui/Deferred.tsx`
- `apps/web/src/components/ui/ImagePreload.tsx`
- `apps/web/src/components/ui/Img.test.tsx`
- `apps/web/src/components/ui/Img.tsx`
- `apps/web/src/components/ui/MediaImage.tsx`
- `apps/web/src/data/mockWorkshops.ts`
- `apps/web/src/hooks/useCatalog.ts`
- `apps/web/src/hooks/useDeferredStartup.ts`
- `apps/web/src/hooks/useManagement.ts`
- `apps/web/src/hooks/useOwnedStudios.ts`
- `apps/web/src/lib/compress-studio-image.ts`
- `apps/web/src/lib/image-sources.ts`
- `apps/web/src/lib/image-thumbnails.json`
- `apps/web/src/lib/image-variants.json`
- `apps/web/src/lib/session-cache.ts`
- `apps/web/src/pages/AboutPage.tsx`
- `apps/web/src/pages/AdminReportsPage.tsx`
- `apps/web/src/pages/AdminStudioProfilesPage.tsx`
- `apps/web/src/pages/AdminWorkshopPage.tsx`
- `apps/web/src/pages/ArtisanPage.test.tsx`
- `apps/web/src/pages/ArtisanPage.tsx`
- `apps/web/src/pages/ExplorePage.tsx`
- `apps/web/src/pages/HomePage.tsx`
- `apps/web/src/pages/StudioPage.tsx`
- `apps/web/src/pages/StudioRegistrationPage.tsx`
- `apps/web/src/pages/WorkshopPage.tsx`
- `apps/web/src/services/authSchemas.ts`
- `apps/web/src/services/authService.ts`
- `apps/web/src/services/featuredService.ts`
- `apps/web/src/services/imageService.ts`
- `apps/web/src/services/managementService.ts`
- `apps/web/src/styles.css`
- `apps/web/src/types/management.ts`
- `apps/web/src/types/studio.ts`
- `apps/web/src/types/workshop.ts`
- `apps/web/vite.config.ts`
- `db/migrations/030_image_medium_variants.sql`
- `package-lock.json`
- `packages/shared/src/index.ts`
