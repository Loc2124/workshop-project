# Open Slot — Bước 2: tối ưu client

Ngày 05/11/2026. Tiếp theo `performance-diagnosis.md`. Không đổi CSS, markup nội dung trang, nhận diện, routing, API server, quy tắc nghiệp vụ hoặc điều kiện phân quyền. Không deploy Vercel trong bước này. Các thay đổi thiết kế studio có sẵn từ lượt trước được giữ nguyên và không tính vào danh sách dưới đây.

## Thay đổi

1. **Cache phiên và dữ liệu công khai.** Khi refresh thất bại/đăng xuất/đổi user, chỉ hủy và xóa query thuộc tài khoản; giữ nguyên `catalog`, `categories`, `site-settings`, kể cả request đang chạy. Key chưa được xác định là public vẫn bị xóa theo hướng thận trọng. Preview admin là `private/userId`, không được giữ lại. Giữ cơ chế epoch và chặn ghi muộn từ tài khoản cũ.
2. **QueryClient.** `staleTime=30s`, `gcTime=10 phút`; địa lý/settings/detail workshop có freshness 60s như cấu hình từng query. Query auth có `staleTime` và `gcTime` vô hạn trong vòng đời SPA, không gọi `/me` lại chỉ vì rời route lâu. Vẫn bootstrap một lần qua API sau khi mở mới/reload; JWT và refresh token tiếp tục nằm trong cookie HttpOnly, không chuyển sang localStorage.
3. **Địa lý.** `useProvinces`, ProvinceCombobox dự phòng và AreaMultiSelect dùng cùng Query cache. Key tỉnh “available” tách khỏi “all” dùng khi đăng ký studio; key khu vực chứa provinceId. Mutation thay đổi catalog invalidate cả tỉnh/khu vực để số studio/slot không bị giữ sai.
4. **Prefetch dùng chung.** Listener không tạo markup, bắt hover có chủ đích 120ms và focus của liên kết nội bộ; không prefetch data khi Save-Data/2G. Bộ xử lý nặng chỉ import khi cần. Public home/explore/detail và menu dashboard có prefetch data/chunk; key dùng lại được khi vào trang. Admin list prefetch list/count song song với mặc định đúng trang; URL có bộ lọc admin được để page validator xử lý, không đoán key. Admin chỉ prefetch khi session hiện tại có role admin; studio kiểm tra owner, draft, trạng thái khóa và session epoch trước khi fetch.
5. **Giảm waterfall.** Detail workshop, reviews bằng id/slug và danh sách liên quan bắt đầu độc lập. Không đổi schema response/review hoặc tập workshop được xếp hạng. Catalog cho gợi ý header vẫn giữ toàn bộ dữ liệu và thứ tự để không đổi kết quả, nhưng lấy các trang còn lại theo nhóm tối đa 3 request song song sau trang đầu, thay vì hoàn toàn nối tiếp.
6. **Chia code.** Bốn bộ quản lý studio thành lazy chunks riêng, không tải cả workshop/session/booking/profile khi chỉ vào một mục. Notifications trang khách chỉ tải khi đăng nhập. Dialog thông tin footer tải khi mở, có preload khi hover/focus. Không gom mọi Radix/Floating UI vào một vendor chunk bắt buộc cho trang khách; Rollup tách theo sử dụng thực tế. Chart/table/DnD vẫn tách khỏi graph static khách/studio.
7. **Invalidation đặt chỗ.** Chuẩn hóa key booking studio dùng chung cho page và prefetch; mutation booking/session làm mới cả danh sách booking studio đúng user. Không làm optimistic update cho thanh toán hoặc giữ chỗ vì cần kết quả xác nhận từ server.

## Kết quả build

Build production TypeScript + Vite, analyzer và kiểm tra budget đều qua; gzip đo theo cùng plugin zlib level 9, kB = 1.000 byte.

| Chỉ số                                    |      Trước |        Sau |
| ----------------------------------------- | ---------: | ---------: |
| JS entry + static dependencies, raw       |   668,1 kB |   555,8 kB |
| JS entry + static dependencies, gzip      |   206,0 kB |   169,4 kB |
| Tổng JS tất cả lazy chunks + worker, raw  | 1.818,6 kB | 1.844,7 kB |
| Tổng JS tất cả lazy chunks + worker, gzip |   603,2 kB |   621,6 kB |

JS dùng chung ban đầu giảm khoảng **17,8% gzip**. Tổng JS tăng do thêm cơ chế prefetch và chia nhỏ module. Không diễn giải tổng tất cả chunk thành dung lượng mọi người phải tải lúc đầu.

## Kiểm tra client trước/sau

Production preview, cùng fixture tách biệt cho khách/admin/studio và độ trễ API 250ms. `/me` và refresh giả lập 60ms. Không đăng nhập bằng tài khoản thật, không sửa DB, không mutation. Các số sau kiểm tra client/cache; không phải tốc độ backend thật, Lighthouse hay kết quả 4G production.

| Khu vực                                  | API lần đầu trước → sau | API chuyển trang kế trước → sau | API quay lại trước → sau |
| ---------------------------------------- | ----------------------: | ------------------------------: | -----------------------: |
| Khách `/` → khám phá → `/`               |                   9 → 6 |                           2 → 1 |                1 → **0** |
| Admin tổng quan → người dùng → tổng quan |                   4 → 4 |                           2 → 2 |                0 → **0** |
| Studio tổng quan → đặt chỗ → tổng quan   |                   6 → 6 |                           1 → 1 |                0 → **0** |

- Sau thay đổi, mỗi `/home/featured`, `/categories`, `/settings`, `/provinces` chỉ gọi một lần trong luồng khách trên; không bị xóa cache bởi hai response auth 401.
- Mỗi khu vực chỉ gọi `/me` **một lần** trong toàn bộ luồng điều hướng đã kiểm tra.
- Hover Báo cáo admin tải list/count trước; click sau hover không gọi thêm API. Hover/click Lịch và slot studio dùng lại cache từ tổng quan, không gọi thêm API.
- Dialog footer mở, Escape đóng, trả focus về liên kết mở dialog. Không có JS pageerror trong ba luồng.
- Admin/studio đã tái sử dụng cache trước đợt sửa; không tuyên bố đã giảm từ nhiều request về 0 ở hai khu vực này. Thay đổi mới bổ sung prefetch, phân tách module và bảo vệ cache khi đổi phiên.
- `encodedDataLength` JS quan sát lần mở trực tiếp: khách **252,8 → 242,5 kB**, admin **350,2 → 359,2 kB**, studio **243,8 → 252,1 kB**. Phân mảnh chunk/metadata prefetch có overhead trên dashboard; không tuyên bố mọi route đều tải ít JS hơn. Số này gồm các lazy chunks thật sự được route cần, header mạng và không tương đương bảng static gzip.
- Thời gian hai frame sau click quay lại trong lượt kiểm tra ở mức vài chục ms, nhưng đây không phải phép đo đầy đủ thời điểm render nội dung. Chưa dùng làm chỉ số SLA hoặc thay thế Lighthouse.
- Đối chiếu screenshot: admin và studio giống pixel ở khung đã chụp; trang khách giữ nguyên bố cục/nội dung, khác khung ảnh hero do animation có sẵn. Không sửa CSS/asset/ảnh trong bước này.

## Validation và rủi ro

- **190 test / 43 file web qua**, gồm test giữ cache public/in-flight, xóa private preview, đổi account, refresh đến muộn, chặn mutation ghi vào tài khoản cũ, deduplicate địa lý, invalidation booking studio và prefetch đúng key/quyền.
- ESLint web qua; TypeScript và production build qua. Không chạy integration API có ghi DB cho thay đổi client này.
- Cache Query vẫn là bộ nhớ của tab, không persist qua F5. Mở app mới vẫn phải xác minh cookie HttpOnly; không tin user/role từ localStorage để mở guard.
- Cache có thể cũ trong 30–60s; các mutation đã invalidate nhóm liên quan. Server vẫn quyết định tồn chỗ, quyền, tiền và trạng thái thanh toán.
- Prefetch có thể tải dữ liệu trước khi thật sự click; có trì hoãn hover, dedup bằng Query key, bỏ qua mạng tiết kiệm và không bỏ qua server authorization.
- Ảnh giữ pipeline WebP/thumbnail/medium/srcset/lazy/size hiện có. Không thay ảnh hay thêm hiệu ứng blur/AVIF trong nhiệm vụ giữ giao diện; ảnh cũ thiếu variant cần xử lý ở server/pipeline sau.
- Admin đã có phân trang và giữ dữ liệu khi refetch. Studio/customer list chưa được đổi API phân trang; giảm field/payload, endpoint gợi ý tìm kiếm gọn hơn, xử lý N+1/SQL/region/cold start/cache CDN thuộc bước 3.
- Bản thay đổi còn ở workspace; cold start Render, DB round trip và điểm Lighthouse production chưa thay đổi. Chưa tuyên bố đạt lần đầu dưới 2 giây trên 4G.

## File thêm/sửa trong bước 2

Nền tảng/cache:

- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx` — cập nhật chú thích vòng đời cache, không đổi routes
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/lib/session-cache.ts`
- `apps/web/src/lib/session-cache.test.ts`
- `apps/web/src/lib/query-keys.ts`
- `apps/web/src/lib/query-invalidation.ts`
- `apps/web/src/lib/query-invalidation.test.ts`

Địa lý và dữ liệu công khai:

- `apps/web/src/lib/geography-queries.ts` — mới
- `apps/web/src/lib/geography-queries.test.ts` — mới
- `apps/web/src/hooks/useProvinces.ts`
- `apps/web/src/hooks/useStudioProvinces.ts`
- `apps/web/src/components/catalog/ProvinceCombobox.tsx`
- `apps/web/src/components/catalog/AreaMultiSelect.tsx`
- `apps/web/src/hooks/useCatalog.ts`
- `apps/web/src/hooks/useCategoryCatalog.ts`
- `apps/web/src/services/catalogService.ts`
- `apps/web/src/pages/WorkshopPage.tsx`

Prefetch và lazy modules:

- `apps/web/src/components/NavigationPrefetch.tsx` — mới
- `apps/web/src/lib/prefetch-navigation.ts` — mới
- `apps/web/src/lib/prefetch-navigation.test.ts` — mới
- `apps/web/src/lib/prefetch-table.ts` — mới
- `apps/web/src/lib/prefetch-table.test.ts` — mới
- `apps/web/src/components/layout/FooterInformationDialog.tsx` — mới
- `apps/web/src/components/layout/FooterLinks.tsx`
- `apps/web/src/components/layout/SiteHeader.tsx`
- `apps/web/src/pages/StudioWorkspacePage.tsx`
- `apps/web/src/components/management/StudioBookingManager.tsx`
- `apps/web/vite.config.ts`

Các trang admin thêm hàm prefetch đọc dữ liệu theo schema/key hiện có, không đổi JSX trang:

- `apps/web/src/pages/AdminAuditPage.tsx`
- `apps/web/src/pages/AdminBookingsPage.tsx`
- `apps/web/src/pages/AdminCategoriesPage.tsx`
- `apps/web/src/pages/AdminContentPage.tsx`
- `apps/web/src/pages/AdminMessageTemplatesPage.tsx`
- `apps/web/src/pages/AdminReportsPage.tsx`
- `apps/web/src/pages/AdminSettingsPage.tsx`
- `apps/web/src/pages/AdminStudioProfilesPage.tsx`
- `apps/web/src/pages/AdminUsersPage.tsx`
- `apps/web/src/pages/AdminWorkshopPage.tsx`

Báo cáo này: `docs/performance-client.md`. Script/artifact: `output/performance/verify-client-cache.mjs`, `client-before/checks.json`, `client-after/checks.json`, ảnh đối chiếu, `bundle-client-after.json`, `bundle-analysis-client-after.html`. Artifact trong output không thay thế source/tests được theo dõi bởi Git.
